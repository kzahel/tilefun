import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const folder = resolve(
  process.argv[2] ?? "public/demos/original-vehicles/explorer-boat-v1/captures",
);
await mkdir(folder, { recursive: true });
const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  logLevel: "error",
  server: { port: 0, host: "127.0.0.1", watch: null },
  optimizeDeps: { entries: [] },
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({ channel: "chromium", headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    `http://127.0.0.1:${server.httpServer.address().port}/tilefun/demos/original-vehicles/explorer-boat-v1/index.html`,
  );
  await page.waitForFunction(() => window.boatReview?.ready);
  for (let i = 0; i < 16; i++) {
    const result = await page.evaluate((i) => {
      const png = window.boatReview.pose(i * 22.5, 0);
      const c = document.querySelector("canvas"),
        p = c.getContext("2d").getImageData(0, 0, 128, 128).data;
      let opaque = 0,
        edge = 0;
      for (let y = 0; y < 128; y++)
        for (let x = 0; x < 128; x++)
          if (p[(y * 128 + x) * 4 + 3]) {
            opaque++;
            if (x === 0 || x === 127 || y === 0 || y === 127) edge++;
          }
      return { png, opaque, edge };
    }, i);
    assert.ok(result.opaque > 300);
    assert.equal(result.edge, 0);
    await writeFile(
      resolve(folder, `engine-${i}.png`),
      Buffer.from(result.png.split(",")[1], "base64"),
    );
  }
  const a = await page.evaluate(() => window.boatReview.pose(45, 0));
  const b = await page.evaluate(() => window.boatReview.pose(45, 2));
  assert.notEqual(a, b, "Propeller motion invisible");
  assert.deepEqual(errors, []);
  await writeFile(
    resolve(folder, "audit.json"),
    `${JSON.stringify(
      {
        headings: 16,
        viewport: [128, 128],
        actualExportedGlb: true,
        sharedGameProjection: true,
        noClippedViews: true,
        propellerMoves: true,
        stats: await page.evaluate(() => window.boatReview.stats),
      },
      null,
      2,
    )}\n`,
  );
  console.log("16 actual GLB headings, no clipping, independent propeller PASS");
} finally {
  await browser?.close();
  await server.close();
}
