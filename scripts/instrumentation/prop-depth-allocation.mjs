// Synthetic prop-depth allocations, excluding raster and simulation work.
import { createHash } from "node:crypto";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  server: { host: "127.0.0.1", port: 0, hmr: false },
  logLevel: "error",
});
server.middlewares.use("/prop-depth-probe", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.end("<!doctype html><title>Prop depth allocation probe</title>");
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/prop-depth-probe`);
  const mode = await page.evaluate(async (fresh) => {
    const depth = await import("/tilefun/src/rendering/propDepth.ts");
    const props = Array.from({ length: 400 }, (_, i) => ({
      position: { wx: (i % 20) * 32, wy: Math.floor(i / 20) * 32 },
      collider: null,
      walls: [
        { offsetX: 0, offsetY: 0, width: 16, height: 28, zHeight: 8 },
        { offsetX: 10, offsetY: 4, width: 8, height: 12, zBase: 8, zHeight: 16 },
        { offsetX: 0, offsetY: 0, width: 32, height: 32 },
      ],
    }));
    const cache = !fresh && depth.PropDepthCache ? new depth.PropDepthCache() : undefined;
    const collect = () => (cache ? cache.collect(props) : depth.propDepthSurfaces(props));
    window.depthProbe = (frames) => {
      let surfaces = 0;
      for (let i = 0; i < frames; i++) {
        surfaces += collect().length;
        cache?.release();
      }
      return { surfaces, diagnostics: cache?.getDiagnostics() ?? null };
    };
    window.depthParity = () => {
      const frames = [];
      for (let i = 0; i < 8; i++) {
        props[0].position.wy += 3;
        props[1].walls[0].width += 2;
        props[2].walls[0].zHeight = i % 2 ? Infinity : 8;
        props.reverse();
        const surfaces = collect();
        frames.push(
          JSON.stringify({
            surfaces,
            depths: [0, 8, 24].map((z) =>
              depth.depthAboveProps(
                0,
                { left: -20, right: 100, top: -20, bottom: 100 },
                z,
                surfaces,
              ),
            ),
          }),
        );
        cache?.release();
      }
      return frames;
    };
    window.depthProbe(60);
    return cache ? "cached" : "fresh";
  }, process.argv.includes("--fresh"));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("HeapProfiler.collectGarbage");
  await cdp.send("HeapProfiler.startSampling", {
    samplingInterval: 4096,
    includeObjectsCollectedByMajorGC: true,
    includeObjectsCollectedByMinorGC: true,
  });
  const result = await page.evaluate(() => window.depthProbe(600));
  const { profile } = await cdp.send("HeapProfiler.stopSampling");
  const byFunction = new Map();
  const visit = (node) => {
    const name = node.callFrame.functionName || "(anonymous)";
    if (node.selfSize) byFunction.set(name, (byFunction.get(name) ?? 0) + node.selfSize);
    for (const child of node.children) visit(child);
  };
  visit(profile.head);
  const collectionMs = await page.evaluate(() => {
    const times = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      window.depthProbe(600);
      times.push(performance.now() - start);
    }
    return times;
  });
  const parity = await page.evaluate(() => window.depthParity());
  console.log(
    JSON.stringify(
      {
        browser: browser.version(),
        mode,
        frames: 600,
        collectionMs,
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
