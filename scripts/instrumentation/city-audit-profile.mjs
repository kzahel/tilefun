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
    if (realm.traffic?.drivingQueries) {
      wrap(realm.traffic.drivingQueries, "props", "driving.prop-candidates", true);
      if (realm.traffic.drivingQueries.bodies)
        wrap(realm.traffic.drivingQueries, "bodies", "driving.body-candidates", true);
    }
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
    motion = [],
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
    if (window.__cityTrace)
      performance.measure("tilefun.render", { start, end: performance.now() });
    timeline.push({ kind: "render", start: performance.timeOrigin + start, ms });
    return result;
  };
  const start = await new Promise(requestAnimationFrame);
  performance.mark("tilefun.sample.start");
  window.__cityRenderProfile?.reset();
  lastFrame = start;
  const recordMotion = (now) => {
    const p = g.stateView.playerEntity.position;
    motion.push({ elapsedMs: now - start, wx: p.wx, wy: p.wy });
  };
  recordMotion(start);
  let nextMotion = start + 1000;
  let renderProfile;
  try {
    while (performance.now() - start < seconds * 1000) {
      const now = await new Promise(requestAnimationFrame),
        ms = now - lastFrame;
      frames.push(ms);
      if (window.__cityTrace) performance.measure("tilefun.frame", { start: lastFrame, end: now });
      timeline.push({ kind: "frame", start: performance.timeOrigin + lastFrame, ms });
      lastFrame = now;
      if (now >= nextMotion) {
        recordMotion(now);
        nextMotion = now + 1000;
      }
    }
  } finally {
    performance.mark("tilefun.sample.end");
    renderProfile = window.__cityRenderProfile?.();
    delete window.__cityTrace;
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
  recordMotion(performance.now());
  return {
    ...(renderProfile ? { renderProfile } : {}),
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
      [
        "drawCalls",
        "frames",
        "uploadedBytes",
        "vertexUploadedBytes",
        "meshDrawCalls",
        "meshDraws",
        "meshImageHits",
        "meshImageMisses",
      ].map((k) => [k, (g.renderer.getDiagnostics().gpu?.[k] ?? 0) - (gpuBefore[k] ?? 0)]),
    ),
    canvas: { width: g.canvas.width, height: g.canvas.height },
    camera: {
      scale: g.camera.scale,
      viewportWidth: g.camera.viewportWidth,
      viewportHeight: g.camera.viewportHeight,
    },
    host: await g.transport.getDiagnostics(),
    timeline,
    motion,
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    zoom: g.camera.zoom,
  };
}

// Opt-in inclusive renderer timers and target-allocation census. Separate from
// shallow timing captures; private runtime fields are diagnostic-only hooks.
export function installCityRenderProfile() {
  const backend = document.querySelector("#game").__game.renderer;
  const totals = {},
    targetSizes = {},
    assets = {};
  const restores = [];
  // Attribution only: replay the unchanged quad order through bounded texture sets.
  const batchCensus = { quads: 0, textureSwitches: 0, barriers: 0 };
  const lanes = [1, 2, 4, 8].map((limit) => ({ limit, draws: 0, quads: 0, textures: new Set() }));
  const finish = (lane) => {
    if (lane.quads) lane.draws++;
    lane.quads = 0;
    lane.textures.clear();
  };
  const surface = backend.surface,
    quad = surface.quad,
    flush = surface.flush;
  let insideQuad = 0;
  surface.quad = function (...args) {
    batchCensus.quads++;
    if (this.count && this.texture !== args[0]) batchCensus.textureSwitches++;
    for (const lane of lanes) {
      if (lane.quads === 2048 || (!lane.textures.has(args[0]) && lane.textures.size === lane.limit))
        finish(lane);
      lane.textures.add(args[0]);
      lane.quads++;
    }
    insideQuad++;
    try {
      return quad.apply(this, args);
    } finally {
      insideQuad--;
    }
  };
  surface.flush = function (...args) {
    if (!insideQuad) {
      if (this.count) batchCensus.barriers++;
      for (const lane of lanes) finish(lane);
    }
    return flush.apply(this, args);
  };
  restores.push(() => {
    surface.quad = quad;
    surface.flush = flush;
  });
  const wrap = (owner, method, label, census) => {
    if (!owner || typeof owner[method] !== "function") return;
    const original = owner[method];
    owner[method] = function (...args) {
      const start = performance.now();
      try {
        census?.(this, args);
        return original.apply(this, args);
      } finally {
        totals[label] ??= { calls: 0, ms: 0 };
        const row = totals[label];
        row.calls++;
        row.ms += performance.now() - start;
      }
    };
    restores.push(() => {
      owner[method] = original;
    });
  };
  for (const method of ["beginFrame", "prepareTerrain", "collectTerrain", "collectElevationItems"])
    wrap(backend, method, method);
  wrap(backend, "submit", "submit", (_, args) => {
    const key = `pass:${args[1].kind}`;
    totals[key] ??= { calls: 0, items: 0 };
    const row = totals[key];
    row.calls++;
    row.items += args[1].items?.length ?? args[1].draws?.length ?? 0;
  });
  wrap(backend.surface, "flush", "flush");
  wrap(backend.surface, "page", "page");
  wrap(backend.meshes, "draw", "mesh", (_, args) => {
    const id = args[1].mesh?.assetId;
    if (id) assets[id] = (assets[id] ?? 0) + 1;
  });
  for (const [label, target] of [
    ["body", backend.meshes?.target],
    ["outline", backend.meshes?.outline?.target],
  ])
    wrap(target, "setSize", `resize:${label}`, (self, args) => {
      if (self.width === args[0] && self.height === args[1]) return;
      const key = `${label}:${args[0]}x${args[1]}`;
      targetSizes[key] = (targetSizes[key] ?? 0) + 1;
    });
  window.__cityRenderProfile = () => {
    for (const restore of restores.reverse()) restore();
    delete window.__cityRenderProfile;
    for (const lane of lanes) finish(lane);
    return {
      totals,
      targetSizes,
      assets,
      batchCensus,
      orderedTextureBatches: Object.fromEntries(lanes.map((lane) => [lane.limit, lane.draws])),
    };
  };
  window.__cityRenderProfile.reset = () => {
    for (const key of Object.keys(batchCensus)) batchCensus[key] = 0;
    for (const lane of lanes) {
      finish(lane);
      lane.draws = 0;
    }
    for (const records of [totals, targetSizes, assets])
      for (const key of Object.keys(records)) delete records[key];
  };
}

// Diagnostic intervention only: retain the original exact-resolution body and
// outline targets per size. Submission/order/projection remain native. Restore
// the original resources and dispose every cloned target before closing the page.
export function installCityMeshTargetReuse() {
  const meshes = document.querySelector("#game").__game.renderer.meshes;
  if (!meshes) throw Error("Mesh target reuse requires the GPU backend");
  const body = meshes.target,
    outline = meshes.outline.target,
    draw = meshes.draw;
  const pairs = new Map();
  meshes.draw = function (camera, item) {
    if (item.mesh && this.ready.has(item.mesh.assetId)) {
      const resolution = Math.min(1024, Math.max(1, Math.ceil(item.mesh.radius * 2)));
      let pair = pairs.get(resolution);
      if (!pair) {
        pair = { body: body.clone(), outline: outline.clone() };
        pair.body.setSize(resolution, resolution);
        pair.outline.setSize(resolution, resolution);
        pairs.set(resolution, pair);
      }
      this.target = pair.body;
      this.outline.target = pair.outline;
    }
    return draw.call(this, camera, item);
  };
  window.__cityMeshTargetReuse = () => {
    const result = {
      sizes: [...pairs.keys()].sort((a, b) => a - b),
      bytes: [...pairs.keys()].reduce((sum, size) => sum + size * size * 12, 0),
    };
    meshes.draw = draw;
    meshes.target = body;
    meshes.outline.target = outline;
    for (const pair of pairs.values()) {
      pair.body.dispose();
      pair.outline.dispose();
    }
    delete window.__cityMeshTargetReuse;
    return result;
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
