// Synthetic retention diagnostic, not a frame-pacing benchmark. Run from repo root.
// Force GC only between batches, after all synthetic chunks become unreachable.

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
  res.end("<!doctype html><title>Grass cache retention probe</title>");
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/grass-cache-probe`);
  await page.evaluate(async () => {
    const { Chunk } = await import("/tilefun/src/world/Chunk.ts");
    const { TerrainId } = await import("/tilefun/src/autotile/TerrainId.ts");
    const { collectGrassBladeItems } = await import("/tilefun/src/rendering/GrassBladeRenderer.ts");
    window.probe = (first, count) => {
      let total = 0;
      for (let cx = first; cx < first + count; cx++) {
        const c = new Chunk();
        c.autotileComputed = true;
        c.blendBase.fill(TerrainId.Grass);
        total += collectGrassBladeItems(
          { getChunkIfLoaded: () => c },
          [],
          { minCx: cx, maxCx: cx, minCy: 0, maxCy: 0 },
          { minWx: cx * 256, maxWx: (cx + 1) * 256, minWy: 0, maxWy: 256 },
          0,
        ).length;
      }
      return total;
    };
    window.probe(-10, 10);
  });
  const cdp = await page.context().newCDPSession(page);
  const heap = async () => {
    await cdp.send("HeapProfiler.collectGarbage");
    return (await cdp.send("Runtime.getHeapUsage")).usedSize;
  };
  const before = await heap();
  const blades = await page.evaluate(() => window.probe(0, 1000));
  const after = await heap();
  const moreBlades = await page.evaluate(() => window.probe(1000, 1000));
  const afterSecond = await heap();
  console.log(
    JSON.stringify({
      browser: browser.version(),
      chunksPerPass: 1000,
      blades,
      moreBlades,
      heapBefore: before,
      heapAfterFirst: after,
      heapAfterSecond: afterSecond,
      firstRetainedBytes: after - before,
      secondRetainedBytes: afterSecond - after,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
