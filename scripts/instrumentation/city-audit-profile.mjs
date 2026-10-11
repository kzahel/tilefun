// Serialized into the owned production Worker. Inclusive timers overlap.
export function installCityAuthority({ deep }) {
  const server = globalThis.__diagnosticAuthority;
  const realm = server.activeRealm;
  const timings = {},
    counts = {},
    ticks = [],
    populations = [];
  const readSets = new Map();
  let trafficCar;
  let phase = "outside",
    selected = new Map(),
    serial = 0;
  const record = (key, ms) => {
    timings[key] ??= [];
    timings[key].push(ms);
  };
  const wrap = (owner, method, label, census = false) => {
    if (!owner || typeof owner[method] !== "function") throw Error(`Missing probe ${label}`);
    const original = owner[method];
    owner[method] = function (...args) {
      const previous = phase,
        previousCar = trafficCar;
      if (label === "traffic.blocked" || label === "traffic.surfaceProbe")
        trafficCar = args[0]?.entity.id;
      if (!census) phase = label;
      const start = performance.now();
      try {
        const result = original.apply(this, args);
        if (census) {
          const key = `${previous}:${label}`;
          counts[key] ??= { calls: 0, candidates: 0, maxCandidates: 0 };
          const row = counts[key];
          row.calls++;
          if (label === "road-read" || label === "height-read") {
            const setKey = `${key}:${trafficCar ?? "none"}`;
            if (!readSets.has(setKey)) readSets.set(setKey, new Set());
            const cells = readSets.get(setKey),
              cell = `${args[0]},${args[1]}`;
            if (cells.has(cell)) row.repeatedCellsThisTick = (row.repeatedCellsThisTick ?? 0) + 1;
            else {
              row.uniqueCellsThisTick = (row.uniqueCellsThisTick ?? 0) + 1;
              cells.add(cell);
            }
          }
          row.candidates += result?.length ?? 0;
          row.maxCandidates = Math.max(row.maxCandidates, result?.length ?? 0);
        }
        return result;
      } finally {
        if (!census) record(label, performance.now() - start);
        phase = previous;
        trafficCar = previousCar;
      }
    };
  };
  const population = () => {
    const entities = realm.entityManager.entities;
    const states = [...(realm.traffic?.states.values() ?? [])];
    return {
      resident: entities.length,
      props: realm.propManager.props.length,
      active: selected.size,
      residentPeople: entities.filter((e) => e.routeAI && e.type.startsWith("person")).length,
      activePeople: [...selected.keys()].filter((e) => e.routeAI && e.type.startsWith("person"))
        .length,
      cars: states.length,
      activeCars: states.filter((s) => selected.has(s.entity)).length,
      carsWithNonzeroVelocity: states.filter(
        (s) => Math.hypot(s.entity.velocity?.vx ?? 0, s.entity.velocity?.vy ?? 0) > 0.1,
      ).length,
      movingPeople: [...selected.keys()].filter(
        (e) => e.routeAI && Math.hypot(e.velocity?.vx ?? 0, e.velocity?.vy ?? 0) > 0.1,
      ).length,
      trafficWaiting: Object.fromEntries(
        [...new Set(states.map((s) => s.waiting))].map((k) => [
          k,
          states.filter((s) => s.waiting === k).length,
        ]),
      ),
      views: [...realm.sessions.values()].map((s) => ({ ...s.visibleRange })),
      inputQueue: [...realm.sessions.values()].reduce((n, s) => n + s.inputQueue.length, 0),
    };
  };
  const select = realm.computeEntityTickDtsMulti;
  realm.computeEntityTickDtsMulti = function (...args) {
    selected = select.apply(this, args);
    return selected;
  };
  for (const [owner, method, label] of [
    [realm, "computeEntityTickDtsMulti", "selection"],
    [realm.propActivity, "select", "prop-selection"],
    [realm, "decisionDts", "decision-selection"],
    [realm.entityManager, "update", "npc-physics"],
    [realm.traffic, "tick", "traffic"],
    [realm.traffic, "drive", "driving"],
    [realm.railway, "tick", "railway"],
    [realm.streaming, "update", "streaming"],
    [realm, "replicate", "replication"],
    [realm.worldAPI.overlap, "tick", "overlap"],
    [realm.worldAPI.tags, "tick", "tags"],
  ])
    if (owner) wrap(owner, method, label);
  if (deep) {
    for (const method of ["blocked", "surfaceProbe", "populate", "choose", "reserve"])
      wrap(realm.traffic, method, `traffic.${method}`);
    for (const [owner, method, label] of [
      [realm.propManager, "getPropsInChunkRange", "prop-query"],
      [realm.entityManager.spatialHash, "queryRange", "body-query"],
      [realm.world, "getRoadAt", "road-read"],
      [realm.world, "getHeightAt", "height-read"],
    ])
      wrap(owner, method, label, true);
  }
  globalThis.__cityPhase = record;
  globalThis.__cityDrivingLists = deep
    ? (props, entities) => {
        counts["driving:provided-lists"] ??= { calls: 0, props: 0, entities: 0 };
        const row = counts["driving:provided-lists"];
        row.calls++;
        row.props += props;
        row.entities += entities;
      }
    : undefined;
  const tick = server.tick;
  server.tick = function (...args) {
    readSets.clear();
    const start = performance.now();
    const value = tick.apply(this, args);
    const end = performance.now();
    ticks.push({ start: performance.timeOrigin + start, ms: end - start });
    record("tick", end - start);
    if (++serial % 30 === 0) populations.push(population());
    return value;
  };
  const summary = (values) => {
    const s = values.slice().sort((a, b) => a - b);
    return {
      count: s.length,
      mean: s.reduce((a, b) => a + b, 0) / (s.length || 1),
      p50: s[Math.floor(s.length * 0.5)] ?? 0,
      p95: s[Math.floor(s.length * 0.95)] ?? 0,
      p99: s[Math.floor(s.length * 0.99)] ?? 0,
      max: s.at(-1) ?? 0,
    };
  };
  globalThis.__cityReset = () => {
    for (const key of Object.keys(timings)) delete timings[key];
    for (const key of Object.keys(counts)) delete counts[key];
    ticks.length = 0;
    populations.length = 0;
    serial = 0;
  };
  globalThis.__cityRead = () => ({
    timing: Object.fromEntries(Object.entries(timings).map(([k, v]) => [k, summary(v)])),
    counts,
    ticks,
    populations,
    population: population(),
    hz: ticks.length > 1 ? ((ticks.length - 1) * 1000) / (ticks.at(-1).start - ticks[0].start) : 0,
  });
}

// Serialized into the owned main page; native callbacks keep their arguments.
export async function sampleCityClient(seconds) {
  const g = document.querySelector("#game").__game;
  const gpuBefore = { ...g.renderer.getDiagnostics().gpu };
  const frames = [],
    renders = [],
    updates = [],
    ackTimes = [],
    timeline = [],
    acks = new Map();
  let lastFrame = performance.now(),
    lastAck = g.stateView.lastProcessedInputSeq,
    maxReplay = 0,
    maxResim = 0,
    maxTravel = 0;
  const initialPosition = { ...g.stateView.playerEntity.position };
  const callbacks = g.loop.callbacks,
    render = callbacks.render,
    update = callbacks.update,
    send = g.transport.send;
  g.performanceMetrics.reset();
  await g.transport.resetDiagnostics();
  g.transport.send = function (message) {
    if (message.type === "player-input") acks.set(message.seq, performance.now());
    return send.call(this, message);
  };
  callbacks.update = (...args) => {
    const start = performance.now();
    const result = update(...args);
    const ms = performance.now() - start;
    updates.push(ms);
    const p = g.stateView.playerEntity.position;
    maxTravel = Math.max(
      maxTravel,
      Math.hypot(p.wx - initialPosition.wx, p.wy - initialPosition.wy),
    );
    const d = g.remoteView._predictor?.lastReconcileDiagnostics;
    if (d) {
      maxReplay = Math.max(maxReplay, d.replayCount);
      maxResim = Math.max(maxResim, d.resimPosErr);
    }
    const ack = g.stateView.lastProcessedInputSeq;
    if (ack !== lastAck && acks.has(ack)) ackTimes.push(performance.now() - acks.get(ack));
    lastAck = ack;
    for (const seq of acks.keys()) if (seq <= ack) acks.delete(seq);
    return result;
  };
  callbacks.render = (...args) => {
    const start = performance.now();
    const result = render(...args);
    const ms = performance.now() - start;
    renders.push(ms);
    timeline.push({ kind: "render", start: performance.timeOrigin + start, ms });
    return result;
  };
  const start = await new Promise(requestAnimationFrame);
  lastFrame = start;
  try {
    while (performance.now() - start < seconds * 1000) {
      const now = await new Promise(requestAnimationFrame),
        ms = now - lastFrame;
      frames.push(ms);
      timeline.push({ kind: "frame", start: performance.timeOrigin + lastFrame, ms });
      lastFrame = now;
    }
  } finally {
    callbacks.render = render;
    callbacks.update = update;
    g.transport.send = send;
  }
  const summary = (values) => {
    const s = values.slice().sort((a, b) => a - b);
    return {
      count: s.length,
      mean: s.reduce((a, b) => a + b, 0) / (s.length || 1),
      p50: s[Math.floor(s.length * 0.5)] ?? 0,
      p95: s[Math.floor(s.length * 0.95)] ?? 0,
      p99: s[Math.floor(s.length * 0.99)] ?? 0,
      max: s.at(-1) ?? 0,
    };
  };
  return {
    elapsedMs: performance.now() - start,
    frames: summary(frames),
    framesOver25: frames.filter((x) => x > 25).length,
    render: summary(renders),
    update: summary(updates),
    ack: summary(ackTimes),
    maxReplay,
    maxResim,
    maxTravel,
    initialPosition,
    finalPosition: { ...g.stateView.playerEntity.position },
    replicated: g.stateView.entities.length,
    renderer: g.renderer.getDiagnostics(),
    gpuDelta: Object.fromEntries(
      ["drawCalls", "frames", "uploadedBytes", "vertexUploadedBytes", "meshDrawCalls"].map((k) => [
        k,
        (g.renderer.getDiagnostics().gpu?.[k] ?? 0) - (gpuBefore[k] ?? 0),
      ]),
    ),
    canvas: { width: g.canvas.width, height: g.canvas.height },
    camera: {
      scale: g.camera.scale,
      viewportWidth: g.camera.viewportWidth,
      viewportHeight: g.camera.viewportHeight,
    },
    host: await g.transport.getDiagnostics(),
    timeline,
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    zoom: g.camera.zoom,
  };
}

// Return true only for fully resident and prepared visible terrain.
export function cityReady() {
  const g = document.querySelector("#game").__game;
  if (g.renderer.getDiagnostics().pending) return false;
  const r = g.camera.getVisibleChunkRange();
  for (let y = r.minCy; y <= r.maxCy; y++)
    for (let x = r.minCx; x <= r.maxCx; x++) {
      const p = g.camera.worldToScreen(x * 256, y * 256),
        size = 256 * g.camera.scale;
      if (p.sx + size <= 0 || p.sy + size <= 0 || p.sx >= g.canvas.width || p.sy >= g.canvas.height)
        continue;
      const c = g.stateView.world.getChunkIfLoaded(x, y);
      if (!c || !g.renderer.hasTerrain(c) || !g.renderer.isTerrainReady(c)) return false;
    }
  return true;
}
