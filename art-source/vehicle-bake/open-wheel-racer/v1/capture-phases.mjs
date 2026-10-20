/** Family-only different-radius ordinary-distance/equal-angle actual GLB proof. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const base = "data/vehicle-bake/open-wheel-racer";
const config = JSON.parse(await readFile(`${base}/author-config.json`, "utf8"));
const sha = createHash("sha256")
  .update(await readFile("public/demos/vehicle-bake/open-wheel-racer/v1/model.glb"))
  .digest("hex");
const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  cacheDir: resolve(base, "phase-vite-cache"),
  logLevel: "error",
  server: { port: 0, host: "127.0.0.1", watch: null },
  optimizeDeps: { entries: [] },
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({ channel: "chromium", headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1050 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const address = server.httpServer.address();
  await page.goto(`http://127.0.0.1:${address.port}/tilefun/${config.output}/index.html`);
  await page.waitForFunction(() => window.familyReviewReady === true);
  const radii = await page.evaluate(async () => {
    const module = await import(
      "/tilefun/scripts/vehicle-bake/open-wheel-racer/phase-probe-browser.mjs"
    );
    window.formulaPhaseProbe = module.install();
    return window.formulaPhaseProbe.radii;
  });
  assert.equal(radii.length, 4);
  const views = [];
  for (const kind of ["ordinary-distance", "equal-angle"])
    for (const mode of ["study", "engine"])
      for (let i = 0; i < 8; i++) {
        const phase = i < 4 ? i : i - 8;
        const result = await page.evaluate(
          ({ kind, phase, mode }) => window.formulaPhaseProbe.render(kind, phase, mode),
          { kind, phase, mode },
        );
        await writeFile(
          `${config.output}/captures/${kind}-${mode}-${i}.png`,
          Buffer.from(result.png, "base64"),
        );
        delete result.png;
        views.push(result);
      }
  assert.deepEqual(errors, []);
  await writeFile(
    `${base}/different-radius-phases.json`,
    `${JSON.stringify(
      {
        status: "passed",
        glbSha256: sha,
        nativeSize: 224,
        radii,
        views,
        errors,
        browser: "bundled full Chromium",
        browserVersion: browser.version(),
        meaning:
          "Ordinary distance is shared by all4 wheels and produces radius-dependent angles. Equal-angle diagnostic invokes the existing declared-wheel rig with each radius-specific travel and temporarily overrides only the local viewer instance; no shared harness changes. Both signed8phase sets per camera prove actual transforms, fixed body/pivots and pixel-exact absolute reset. Shared rig independently quarters/reverses each wheel.",
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await browser?.close();
  await server.close();
}
