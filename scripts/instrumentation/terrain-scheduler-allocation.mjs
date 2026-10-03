// Isolates scheduler bookkeeping from raster work; sampled bytes are not FPS evidence.
import { createHash } from "node:crypto";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  server: { host: "127.0.0.1", port: 0, hmr: false },
  logLevel: "error",
});
server.middlewares.use("/scheduler-probe", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.end("<!doctype html><title>Terrain scheduler probe</title>");
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/scheduler-probe`);
  await page.evaluate(async () => {
    const { TileRenderer } = await import("/tilefun/src/rendering/TileRenderer.ts");
    const { Chunk } = await import("/tilefun/src/world/Chunk.ts");
    const { Camera } = await import("/tilefun/src/rendering/Camera.ts");
    const chunks = new Map();
    const surface = new OffscreenCanvas(1, 1);
    for (let y = -1; y <= 6; y++)
      for (let x = -1; x <= 8; x++) chunks.set(`${x},${y}`, new Chunk());
    const world = { getChunkIfLoaded: (x, y) => chunks.get(`${x},${y}`), getRoadAt: () => 0 };
    const camera = new Camera();
    const sheets = new Map();
    const visible = { minCx: 0, minCy: 0, maxCx: 7, maxCy: 5 };
    let renderer;
    window.resetProbe = (pending) => {
      renderer = new TileRenderer(() => 0);
      for (const [key, chunk] of chunks) {
        const [cx, cy] = key.split(",").map(Number);
        if (!pending) renderer.resources.publish(chunk, cx, cy, surface);
      }
    };
    window.schedulerProbe = (frames) => {
      for (let i = 0; i < frames; i++) {
        camera.x = 1024 + Math.sin(i / 10) * 64;
        camera.y = 768 + Math.cos(i / 10) * 64;
        renderer.prepareTerrain(camera, world, sheets, visible, Infinity, 0);
      }
      return renderer.getDiagnostics();
    };
    window.schedulerParity = () => {
      window.resetProbe(true);
      const order = [];
      renderer.advanceCacheBuild = (_key, _chunk, cx, cy, _sheets, remaining) => {
        order.push([cx, cy]);
        return remaining - 1;
      };
      for (let i = 0; i < 20; i++) {
        camera.x = 1024 + Math.sin(i) * 64;
        camera.y = 768 + Math.cos(i) * 64;
        const chunk = chunks.get("0,0");
        if (i % 2) {
          renderer.resources.publish(chunk, 0, 0, surface);
          chunk.invalidateVisuals();
        } else renderer.resources.delete(chunk);
        renderer.prepareTerrain(camera, world, sheets, visible, Infinity, 80);
      }
      return JSON.stringify(order);
    };
  });
  const cdp = await page.context().newCDPSession(page);
  const scenarios = [];
  for (const pending of [false, true]) {
    await page.evaluate((pending) => window.resetProbe(pending), pending);
    await page.evaluate(() => window.schedulerProbe(60));
    await cdp.send("HeapProfiler.collectGarbage");
    await cdp.send("HeapProfiler.startSampling", {
      samplingInterval: 4096,
      includeObjectsCollectedByMajorGC: true,
      includeObjectsCollectedByMinorGC: true,
    });
    const diagnostics = await page.evaluate(() => window.schedulerProbe(3000));
    const { profile } = await cdp.send("HeapProfiler.stopSampling");
    const byFunction = new Map();
    const visit = (node) => {
      const name = node.callFrame.functionName || "(anonymous)";
      byFunction.set(name, (byFunction.get(name) ?? 0) + node.selfSize);
      for (const child of node.children) visit(child);
    };
    visit(profile.head);
    scenarios.push({
      pending,
      frames: 3000,
      diagnostics,
      sampledBytes: [...byFunction.values()].reduce((a, b) => a + b, 0),
      allocationByFunction: Object.fromEntries(
        [...byFunction].filter(([, bytes]) => bytes).sort((a, b) => b[1] - a[1]),
      ),
    });
  }
  const parity = await page.evaluate(() => window.schedulerParity());
  console.log(
    JSON.stringify(
      {
        browser: browser.version(),
        scenarios,
        orderHash: createHash("sha256").update(parity).digest("hex"),
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  await server.close();
}
