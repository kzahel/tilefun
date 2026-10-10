/** Sample only the task-owned authority Worker, leaving other browser targets alone. */
export async function startWorkerCpu(browser, workerUrl) {
  const cdp = await browser.newBrowserCDPSession();
  const pending = new Map();
  let sessionId,
    serial = 0;
  cdp.on("Target.receivedMessageFromTarget", (event) => {
    if (event.sessionId !== sessionId) return;
    const response = JSON.parse(event.message);
    const request = pending.get(response.id);
    if (!request) return;
    pending.delete(response.id);
    clearTimeout(request.timer);
    if (response.error) request.reject(Error(response.error.message));
    else request.resolve(response.result);
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++serial;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(Error(`Worker ${method} timed out`));
      }, 10000);
      pending.set(id, { resolve, reject, timer });
      cdp
        .send("Target.sendMessageToTarget", {
          sessionId,
          message: JSON.stringify({ id, method, params }),
        })
        .catch((error) => {
          clearTimeout(timer);
          pending.delete(id);
          reject(error);
        });
    });
  const close = async () => {
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(Error("Worker profiler closed"));
    }
    pending.clear();
    try {
      if (sessionId) await cdp.send("Target.detachFromTarget", { sessionId });
    } finally {
      await cdp.detach();
    }
  };
  try {
    const { targetInfos } = await cdp.send("Target.getTargets");
    const targets = targetInfos.filter((t) => t.type === "worker" && t.url === workerUrl);
    if (targets.length !== 1)
      throw Error(`Expected one owned authority Worker, found ${targets.length}`);
    ({ sessionId } = await cdp.send("Target.attachToTarget", {
      targetId: targets[0].targetId,
      flatten: false,
    }));
    await send("Profiler.enable");
    await send("Profiler.setSamplingInterval", { interval: 1000 });
    await send("Profiler.start");
    return {
      stop: async () => {
        try {
          return (await send("Profiler.stop")).profile;
        } finally {
          await close();
        }
      },
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}

/** Inclusive entries overlap; the self rows partition sampled time. */
export function summarizeWorkerCpu(profile) {
  const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
  const parents = new Map();
  for (const node of nodes.values())
    for (const child of node.children ?? []) parents.set(child, node.id);
  const self = new Map(),
    inclusive = new Map();
  let totalUs = 0,
    idleUs = 0;
  for (let i = 0; i < (profile.samples?.length ?? 0); i++) {
    const id = profile.samples[i],
      us = profile.timeDeltas?.[i] ?? 0;
    totalUs += us;
    if (nodes.get(id)?.callFrame.functionName === "(idle)") idleUs += us;
    self.set(id, (self.get(id) ?? 0) + us);
    let ancestor = id;
    const visited = new Set();
    while (ancestor !== undefined && !visited.has(ancestor)) {
      visited.add(ancestor);
      inclusive.set(ancestor, (inclusive.get(ancestor) ?? 0) + us);
      ancestor = parents.get(ancestor);
    }
  }
  const rows = (weights) => {
    const merged = new Map();
    for (const [id, us] of weights) {
      const frame = nodes.get(id)?.callFrame;
      if (!frame || frame.functionName === "(root)" || frame.functionName === "(idle)") continue;
      const source = frame.url.includes("/src/")
        ? `src/${frame.url.split("/src/")[1].split("?")[0]}`
        : "runtime";
      const name = frame.functionName || "(anonymous)",
        line = frame.lineNumber + 1;
      const key = `${source}:${line}:${name}`;
      const row = merged.get(key) ?? { name, source, line, sampledMs: 0 };
      row.sampledMs += us / 1000;
      merged.set(key, row);
    }
    return [...merged.values()].sort((a, b) => b.sampledMs - a.sampledMs).slice(0, 40);
  };
  return {
    intervalUs: 1000,
    samples: profile.samples?.length ?? 0,
    sampledMs: totalUs / 1000,
    idleMs: idleUs / 1000,
    activeMs: (totalUs - idleUs) / 1000,
    topSelf: rows(self),
    topInclusive: rows(inclusive),
  };
}
