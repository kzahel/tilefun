// Opt-in diagnostic hooks. Installed only inside a benchmark stage, never in play.
// Timings are inclusive and instrumentation changes the measured workload.
export function installStreamingProfile() {
  const game = document.querySelector("#game").__game;
  const backend = game.renderer;
  const surface = backend.surface;
  const totals = {};
  const uploads = {};
  const evictions = {};
  const restores = [];
  const wrap = (owner, method, invoke) => {
    if (!owner || typeof owner[method] !== "function") return;
    const original = owner[method];
    owner[method] = function (...args) {
      return invoke(original, this, args);
    };
    restores.push(() => {
      owner[method] = original;
    });
  };
  const time = (key, run) => {
    const start = performance.now();
    try {
      return run();
    } finally {
      totals[key] ??= { calls: 0, ms: 0, items: 0 };
      const row = totals[key];
      row.calls++;
      row.ms += performance.now() - start;
    }
  };
  wrap(backend, "submit", (fn, self, args) => {
    const pass = args[1];
    const key = `submit:${pass.kind}`;
    const result = time(key, () => fn.apply(self, args));
    totals[key].items += pass.items?.length ?? pass.draws?.length ?? 0;
    return result;
  });
  for (const method of ["prepareTerrain", "collectTerrain", "collectElevationItems"])
    wrap(backend, method, (fn, self, args) => time(method, () => fn.apply(self, args)));
  const sources = new WeakMap();
  for (const [key, sheet] of backend.sheets) sources.set(sheet.image, `sheet:${key}`);
  if (backend.overlay) sources.set(backend.overlay, "overlay");
  const sourceName = (image) => sources.get(image) ?? `canvas:${image.width}x${image.height}`;
  if (surface) {
    const seen = new WeakSet();
    for (const pages of surface.pages.values()) for (const page of pages) seen.add(page);
    wrap(surface, "page", (fn, self, args) => {
      const before = surface.stats.uploadedBytes;
      const page = fn.apply(self, args);
      const bytes = surface.stats.uploadedBytes - before;
      if (bytes) {
        const key = `${sourceName(args[0])}:${seen.has(page) ? "revision" : "creation"}`;
        uploads[key] ??= { count: 0, bytes: 0 };
        const row = uploads[key];
        row.count++;
        row.bytes += bytes;
        seen.add(page);
      }
      return page;
    });
    wrap(surface, "remove", (fn, self, args) => {
      const key = sourceName(args[0].image);
      evictions[key] = (evictions[key] ?? 0) + 1;
      return fn.apply(self, args);
    });
  }
  window.__streamingProfile = () => {
    for (const restore of restores) restore();
    delete window.__streamingProfile;
    return { totals, uploads, evictions };
  };
}

export function summarizeCpuProfile(profile) {
  const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
  const times = new Map();
  for (let i = 0; i < (profile.samples?.length ?? 0); i++) {
    const frame = nodes.get(profile.samples[i])?.callFrame;
    if (!frame) continue;
    // Only function names and repo-relative source paths; omit origins/IDs.
    const source = frame.url.includes("/src/")
      ? frame.url.slice(frame.url.indexOf("/src/")).split("?")[0]
      : frame.url.includes("node_modules")
        ? "dependency"
        : "browser/benchmark";
    const key = `${source}:${frame.functionName || "(anonymous)"}`;
    times.set(key, (times.get(key) ?? 0) + (profile.timeDeltas?.[i] ?? 0));
  }
  return [...times]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([functionName, us]) => ({ functionName, selfMs: Math.round(us) / 1000 }));
}
