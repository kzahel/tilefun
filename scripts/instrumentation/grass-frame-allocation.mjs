// Synthetic allocation sampling and exact grass-output parity; run from repo root.
// Includes collected objects. Sampling estimates JS allocations, not GPU or frame pacing.

import { createHash } from "node:crypto";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  server: { host: "127.0.0.1", port: 0, hmr: false },
  logLevel: "error",
});
server.middlewares.use("/grass-cache-probe", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.end("<!doctype html><title>Grass frame allocation probe</title>");
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/grass-cache-probe`);
  const mode = await page.evaluate(async () => {
    const { Chunk } = await import("/tilefun/src/world/Chunk.ts");
    const { TerrainId } = await import("/tilefun/src/autotile/TerrainId.ts");
    const grass = await import("/tilefun/src/rendering/GrassBladeRenderer.ts");
    const scratch = grass.GrassFrameBuffer ? new grass.GrassFrameBuffer() : undefined;
    const chunks = new Map();
    for (let cy = -1; cy <= 1; cy++)
      for (let cx = -1; cx <= 1; cx++) {
        const chunk = new Chunk();
        chunk.autotileComputed = true;
        chunk.blendBase.fill(TerrainId.Grass);
        chunks.set(`${cx},${cy}`, chunk);
      }
    const world = { getChunkIfLoaded: (cx, cy) => chunks.get(`${cx},${cy}`) };
    const entities = Array.from({ length: 16 }, (_, i) => ({
      position: { wx: i * 19 - 128, wy: i * 13 - 64 },
    }));
    const visible = { minCx: -1, maxCx: 1, minCy: -1, maxCy: 1 };
    const viewport = { minWx: -256, minWy: -256, maxWx: 512, maxWy: 512 };
    const output = [];
    window.grassProbe = (frames) => {
      let items = 0;
      for (let i = 0; i < frames; i++) {
        output.length = 0;
        items += grass.collectGrassBladeItems(
          world,
          entities,
          visible,
          viewport,
          i / 60,
          scratch,
          output,
        ).length;
      }
      output.length = 0;
      return { items, diagnostics: scratch?.getDiagnostics() ?? null };
    };
    window.grassParity = () => {
      const frames = [];
      for (const time of [0, 0.75, 2.5]) {
        output.length = 0;
        frames.push(
          JSON.stringify(
            grass.collectGrassBladeItems(world, entities, visible, viewport, time, scratch, output),
          ),
        );
      }
      output.length = 0;
      return frames;
    };
    window.grassProbe(60);
    return scratch ? "reused" : "allocating";
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("HeapProfiler.collectGarbage");
  await cdp.send("HeapProfiler.startSampling", {
    samplingInterval: 4096,
    includeObjectsCollectedByMajorGC: true,
    includeObjectsCollectedByMinorGC: true,
  });
  const result = await page.evaluate(() => window.grassProbe(600));
  const { profile } = await cdp.send("HeapProfiler.stopSampling");
  const byFunction = new Map();
  const visit = (node) => {
    if (node.selfSize)
      byFunction.set(
        node.callFrame.functionName || "(anonymous)",
        (byFunction.get(node.callFrame.functionName || "(anonymous)") ?? 0) + node.selfSize,
      );
    for (const child of node.children) visit(child);
  };
  visit(profile.head);
  const parity = await page.evaluate(() => window.grassParity());
  console.log(
    JSON.stringify(
      {
        browser: browser.version(),
        mode,
        frames: 600,
        ...result,
        sampledBytes: [...byFunction.values()].reduce((a, b) => a + b, 0),
        allocationByFunction: Object.fromEntries([...byFunction].sort((a, b) => b[1] - a[1])),
        frameHashes: parity.map((frame) => createHash("sha256").update(frame).digest("hex")),
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  await server.close();
}
