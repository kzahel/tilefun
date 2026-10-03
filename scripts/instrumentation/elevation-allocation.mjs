// Static elevation collection only; excludes raster, simulation and presentation timing.
import { createHash } from "node:crypto";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  server: { host: "127.0.0.1", port: 0, hmr: false },
  logLevel: "error",
});
server.middlewares.use("/elevation-probe", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.end("<!doctype html><title>Elevation allocation probe</title>");
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/elevation-probe`);
  await page.evaluate(async () => {
    const { Chunk } = await import("/tilefun/src/world/Chunk.ts");
    const { TileRenderer } = await import("/tilefun/src/rendering/TileRenderer.ts");
    const renderer = new TileRenderer();
    const chunks = new Map();
    for (let y = -1; y <= 1; y++)
      for (let x = -1; x <= 1; x++) {
        const chunk = new Chunk();
        for (let i = 0; i < 256; i++) chunk.heightGrid[i] = i % 4;
        chunks.set(`${x},${y}`, chunk);
        renderer.resources.publish(chunk, x, y, new OffscreenCanvas(256, 256));
      }
    const world = { getChunkIfLoaded: (x, y) => chunks.get(`${x},${y}`) };
    const range = { minCx: -1, maxCx: 1, minCy: -1, maxCy: 1 };
    window.elevationProbe = (frames) => {
      let items = 0;
      for (let i = 0; i < frames; i++) items += renderer.collectElevationItems(world, range).length;
      return { items, diagnostics: renderer.getElevationDiagnostics?.() ?? null };
    };
    window.elevationParity = () => {
      const outputs = [];
      const record = () => {
        const items = renderer.collectElevationItems(world, range);
        if (items.some((item) => !renderer.resolveTerrainResource(item.terrainResource)))
          throw Error("Unresolved resource");
        outputs.push(
          JSON.stringify(items.map(({ terrainResource: _id, ...geometry }) => geometry)),
        );
      };
      record();
      const chunk = chunks.get("0,0");
      chunk.setHeight(0, 0, 3);
      chunk.invalidateVisuals();
      record();
      renderer.resources.publish(chunk, 0, 0, new OffscreenCanvas(256, 256));
      record();
      renderer.releaseChunk(chunk);
      record();
      const replacement = new Chunk();
      replacement.setHeight(2, 2, 2);
      chunks.set("0,0", replacement);
      renderer.resources.publish(replacement, 0, 0, new OffscreenCanvas(256, 256));
      record();
      return outputs;
    };
    window.elevationProbe(60);
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("HeapProfiler.collectGarbage");
  await cdp.send("HeapProfiler.startSampling", {
    samplingInterval: 4096,
    includeObjectsCollectedByMajorGC: true,
    includeObjectsCollectedByMinorGC: true,
  });
  const result = await page.evaluate(() => window.elevationProbe(600));
  const { profile } = await cdp.send("HeapProfiler.stopSampling");
  const byFunction = new Map();
  const visit = (node) => {
    const name = node.callFrame.functionName || "(anonymous)";
    if (node.selfSize) byFunction.set(name, (byFunction.get(name) ?? 0) + node.selfSize);
    for (const child of node.children) visit(child);
  };
  visit(profile.head);
  const parity = await page.evaluate(() => window.elevationParity());
  console.log(
    JSON.stringify(
      {
        browser: browser.version(),
        frames: 600,
        ...result,
        sampledBytes: [...byFunction.values()].reduce((a, b) => a + b, 0),
        allocationByFunction: Object.fromEntries([...byFunction].sort((a, b) => b[1] - a[1])),
        geometryHashes: parity.map((value) => createHash("sha256").update(value).digest("hex")),
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  await server.close();
}
