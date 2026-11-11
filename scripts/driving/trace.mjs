const overlap = (a, b, low, high) => Math.max(0, Math.min(b, high) - Math.max(a, low));
const round = (value) => Math.round(value * 1000) / 1000;

/** Synchronous trace slices only; async compositor flows are retained in the
 * raw trace, not mistaken for CPU execution. Match B/E independently per thread. */
export function completeEvents(events) {
  const result = [],
    stacks = new Map();
  for (const e of events) {
    if (e.ph === "X" && e.dur > 0) result.push(e);
    else if (e.ph === "B") {
      const key = `${e.pid}:${e.tid}`,
        stack = stacks.get(key) ?? [];
      stack.push(e);
      stacks.set(key, stack);
    } else if (e.ph === "E") {
      const start = stacks.get(`${e.pid}:${e.tid}`)?.pop();
      if (start && e.ts > start.ts)
        result.push({
          ...start,
          ph: "X",
          dur: e.ts - start.ts,
          ...(typeof e.tts === "number" && typeof start.tts === "number"
            ? { tdur: e.tts - start.tts }
            : {}),
        });
    }
  }
  return result;
}

export function unionUs(ranges) {
  let total = 0,
    end = -Infinity;
  for (const [a, b] of ranges.sort((a, b) => a[0] - b[0])) {
    total += Math.max(0, b - Math.max(end, a));
    end = Math.max(end, b);
  }
  return total;
}

function profileData(cpu) {
  if (!cpu) return undefined;
  const nodes = new Map(cpu.nodes.map((n) => [n.id, n])),
    parents = new Map();
  for (const n of cpu.nodes) for (const child of n.children ?? []) parents.set(child, n.id);
  // Chrome can deliver samples out of timestamp order (negative timeDeltas).
  // Reconstruct and sort observations before assigning disjoint sample weights.
  let at = cpu.startTime;
  const points = cpu.samples.map((id, i) => {
    at += cpu.timeDeltas[i];
    return { id, at };
  });
  points.sort((a, b) => a.at - b.at);
  return { nodes, parents, points, start: cpu.startTime };
}
function profileWindow(cpu, low, high, location) {
  if (!cpu) return undefined;
  const { nodes, parents } = cpu;
  const self = new Map(),
    inclusive = new Map();
  let at = cpu.start,
    samples = 0;
  for (const point of cpu.points) {
    const next = point.at,
      weight = overlap(at, next, low, high);
    if (weight > 0) {
      samples++;
      const id = point.id;
      self.set(id, (self.get(id) ?? 0) + weight);
      for (let p = id; p !== undefined; p = parents.get(p))
        inclusive.set(p, (inclusive.get(p) ?? 0) + weight);
    }
    at = next;
  }
  const top = (map) =>
    [...map]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 14)
      .map(([id, us]) => ({
        ...location(nodes.get(id).callFrame),
        sampledWallMs: round(us / 1000),
      }));
  return { samples, self: top(self), inclusive: top(inclusive) };
}

/** Correlations, not automatic causal labels. rAF timestamps are aligned to the
 * trace's explicit cadence marks; a neighbouring-frame context is also retained. */
export function analyzeDrivingTrace(
  cell,
  trace,
  cpu,
  location = (f) => ({ function: f.functionName }),
) {
  const sampled = profileData(cpu);
  if (cell.diagnostic?.trace?.dataLossOccurred) throw Error("Trace lost data");
  const starts = trace.filter((e) => e.name === "tilefun.driving.start");
  if (starts.length !== 1) throw Error("Expected one benchmark cadence start mark");
  const start = starts[0],
    end = trace.find(
      (e) => e.name === "tilefun.driving.end" && e.pid === start.pid && e.tid === start.tid,
    );
  if (!end) throw Error("Missing benchmark cadence end mark");
  const mapped = cell.diagnostic.navigationStartS * 1e6 + cell.pageClock.startMs * 1000;
  if (!Number.isFinite(mapped) || Math.abs(mapped - start.ts) > 2000)
    throw Error("Page/profile and trace clocks disagree");
  if (Math.abs((end.ts - start.ts) / 1000 - cell.elapsedMs) > 2)
    throw Error("Trace and report cadence windows disagree");
  const slices = completeEvents(trace),
    main = slices.filter((e) => e.pid === start.pid && e.tid === start.tid);
  const names = new Map(
    trace.filter((e) => e.name === "thread_name").map((e) => [`${e.pid}:${e.tid}`, e.args?.name]),
  );
  const gc = main.filter((e) => e.name === "MinorGC" || e.name === "MajorGC");
  const tasks = main.filter(
    (e) => e.name === "RunTask" || e.name === "ThreadControllerImpl::RunTask",
  );
  const intervals = (events, low, high) =>
    events
      .filter((e) => overlap(e.ts, e.ts + e.dur, low, high))
      .map((e) => [Math.max(low, e.ts), Math.min(high, e.ts + e.dur)]);
  const view = (e, low, high) => ({
    name: e.name,
    thread: names.get(`${e.pid}:${e.tid}`),
    atMs: round((e.ts - start.ts) / 1000),
    wallMs: round(e.dur / 1000),
    threadMs: typeof e.tdur === "number" ? round(e.tdur / 1000) : null,
    overlapMs: round(overlap(e.ts, e.ts + e.dur, low, high) / 1000),
    ...(e.args?.chrome_mojo_event_info?.mojo_interface_tag
      ? { mojoInterface: e.args.chrome_mojo_event_info.mojo_interface_tag }
      : {}),
    ...(e.args?.data?.functionName
      ? {
          call: location({
            ...e.args.data,
            url: e.args.data.url ?? "",
            lineNumber: (e.args.data.lineNumber ?? 1) - 1,
            columnNumber: (e.args.data.columnNumber ?? 1) - 1,
          }),
        }
      : {}),
  });
  const top = (events, low, high, limit = 14) =>
    events
      .filter((e) => overlap(e.ts, e.ts + e.dur, low, high))
      .sort(
        (a, b) => overlap(b.ts, b.ts + b.dur, low, high) - overlap(a.ts, a.ts + a.dur, low, high),
      )
      .slice(0, limit)
      .map((e) => view(e, low, high));
  const window = (low, high) => ({
    mainTaskWallMs: round(unionUs(intervals(tasks, low, high)) / 1000),
    mainGcWallMs: round(unionUs(intervals(gc, low, high)) / 1000),
    gc: gc.filter((e) => overlap(e.ts, e.ts + e.dur, low, high)).map((e) => view(e, low, high)),
    main: top(main, low, high),
    gpu: top(
      slices.filter((e) => names.get(`${e.pid}:${e.tid}`) === "CrGpuMain"),
      low,
      high,
    ),
    workers: top(
      slices.filter(
        (e) => e.pid === start.pid && /[Ww]orker/.test(names.get(`${e.pid}:${e.tid}`) ?? ""),
      ),
      low,
      high,
      6,
    ),
    profile: profileWindow(sampled, low, high, location),
  });
  let at = start.ts;
  const frames = [];
  for (let i = 0; i < cell.frames.length; i++) {
    const low = at;
    at += cell.frames[i] * 1000;
    if (cell.frames[i] > cell.idleFrameMs * 1.5)
      frames.push({
        index: i,
        atMs: round((at - start.ts) / 1000),
        frameMs: round(cell.frames[i]),
        interval: window(low, at),
        context: window(low - cell.idleFrameMs * 1000, at + cell.idleFrameMs * 1000),
      });
  }
  return {
    clockErrorUs: round(mapped - start.ts),
    elapsedMs: round((end.ts - start.ts) / 1000),
    mainGc: gc
      .filter((e) => overlap(e.ts, e.ts + e.dur, start.ts, end.ts))
      .map((e) => view(e, start.ts, end.ts)),
    longMainSlices: main
      .filter((e) => e.dur >= 15000 && overlap(e.ts, e.ts + e.dur, start.ts, end.ts))
      .map((e) => view(e, start.ts, end.ts)),
    longCallbacks: main
      .filter(
        (e) =>
          e.name === "FunctionCall" &&
          e.dur >= 12000 &&
          overlap(e.ts, e.ts + e.dur, start.ts, end.ts),
      )
      .sort((a, b) => b.dur - a.dur)
      .slice(0, 8)
      .map((e) => ({
        ...view(e, start.ts, end.ts),
        profile: profileWindow(sampled, e.ts, e.ts + e.dur, location),
      })),
    frames,
  };
}
