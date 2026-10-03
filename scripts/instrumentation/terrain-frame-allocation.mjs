// Prepared terrain placement only; excludes raster and simulation timing.
import { createHash } from "node:crypto";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  server: { host: "127.0.0.1", port: 0, hmr: false },
  logLevel: "error",
});
server.middlewares.use("/terrain-frame-probe", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.end("<!doctype html><title>Terrain frame allocation probe</title>");
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/terrain-frame-probe`);
  await page.evaluate(async () => {
    const { Chunk } = await import("/tilefun/src/world/Chunk.ts");
    const { Camera } = await import("/tilefun/src/rendering/Camera.ts");
    const { TileRenderer } = await import("/tilefun/src/rendering/TileRenderer.ts");
    const renderer = new TileRenderer(),
      chunks = new Map(),
      sheets = new Map();
    for (let y = -1; y <= 1; y++)
      for (let x = -1; x <= 1; x++) {
        const chunk = new Chunk();
        chunks.set(`${x},${y}`, chunk);
        renderer.resources.publish(chunk, x, y, new OffscreenCanvas(256, 256));
      }
    const world = { getChunkIfLoaded: (x, y) => chunks.get(`${x},${y}`), getRoadAt: () => 0 };
    const view = new Camera();
    view.zoom = 1 / 3;
    view.setViewport(768, 768);
    const range = { minCx: -1, minCy: -1, maxCx: 1, maxCy: 1 };
    window.terrainFrameProbe = (frames, parity = false) => {
      let items = 0;
      const geometry = [];
      for (let i = 0; i < frames; i++) {
        view.x = 128 + Math.sin(i * 0.01) * 16;
        view.y = 128 + Math.cos(i * 0.01) * 16;
        const draws = renderer.collectTerrainDraws(view, world, sheets, range, false, 0);
        items += draws.length;
        if (parity) geometry.push(draws.map(({ resource: _id, ...r }) => r));
      }
      return { items, ...(parity ? { geometry } : {}) };
    };
    window.terrainFrameProbe(60);
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("HeapProfiler.collectGarbage");
  await cdp.send("HeapProfiler.startSampling", {
    samplingInterval: 4096,
    includeObjectsCollectedByMajorGC: true,
    includeObjectsCollectedByMinorGC: true,
  });
  const result = await page.evaluate(() => window.terrainFrameProbe(3000));
  const { profile } = await cdp.send("HeapProfiler.stopSampling");
  const byFunction = new Map();
  const visit = (node) => {
    const name = node.callFrame.functionName || "(anonymous)";
    if (node.selfSize) byFunction.set(name, (byFunction.get(name) ?? 0) + node.selfSize);
    for (const child of node.children) visit(child);
  };
  visit(profile.head);
  const parity = await page.evaluate(() => window.terrainFrameProbe(120, true));
  console.log(
    JSON.stringify(
      {
        browser: browser.version(),
        frames: 3000,
        ...result,
        sampledBytes: [...byFunction.values()].reduce((a, b) => a + b, 0),
        allocationByFunction: Object.fromEntries([...byFunction].sort((a, b) => b[1] - a[1])),
        geometryHash: createHash("sha256").update(JSON.stringify(parity.geometry)).digest("hex"),
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  await server.close();
}
