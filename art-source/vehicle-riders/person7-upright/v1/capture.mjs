import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const base = "data/vehicle-riders/person7-upright";
const output = "public/demos/vehicle-riders/person7-upright/v1";
const C = JSON.parse(await readFile("scripts/vehicle-riders/person7-upright/rider.json", "utf8"));
const sha = async (p) =>
  createHash("sha256")
    .update(await readFile(p))
    .digest("hex");
assert.equal(await sha(C.contactProfile.source), C.contactProfile.sha256);
for (const [p, h] of Object.entries(C.identityInputs)) assert.equal(await sha(p), h);
for (const entry of C.scaleControls) assert.equal(await sha(entry.path), entry.sha256);
await mkdir(`${base}/captures`, { recursive: true });
const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  cacheDir: resolve(base, "vite-cache"),
  logLevel: "error",
  optimizeDeps: { entries: [] },
  server: { host: "127.0.0.1", port: 0, watch: null },
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({ channel: "chromium", headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 920 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const address = server.httpServer.address();
  await page.goto(`http://127.0.0.1:${address.port}/tilefun/${base}/author-view/index.html`);
  await page.waitForFunction(() => window.riderReady === true);
  assert.ok(
    await page.evaluate(
      () =>
        window.riderControl.fixtureOnly &&
        !window.riderControl.actualBikePresent &&
        !window.riderControl.CarMeshAssetUsed,
    ),
  );
  const views = [];
  for (const mode of ["study", "engine"])
    for (let i = 0; i < 16; i++)
      for (const view of ["rider", "combined", "bare"]) {
        const r = await page.evaluate(
          ({ mode, yaw, view }) => window.riderControl.render(yaw, mode, view, false),
          { mode, yaw: i * 22.5, view },
        );
        assert.equal(r.edgePixels, 0);
        assert.ok(r.rawOccupied > 0);
        await writeFile(`${base}/captures/${view}-${mode}-${i}.png`, Buffer.from(r.png, "base64"));
        delete r.png;
        views.push({ ...r, index: i });
      }
  const rulerViews = [];
  for (const mode of ["study", "engine"])
    for (let i = 0; i < 16; i++) {
      const r = await page.evaluate(
        ({ mode, yaw }) => window.riderControl.render(yaw, mode, "ruler", false),
        { mode, yaw: i * 22.5 },
      );
      assert.equal(r.edgePixels, 0);
      await writeFile(`${base}/captures/ruler-${mode}-${i}.png`, Buffer.from(r.png, "base64"));
      delete r.png;
      rulerViews.push({ ...r, index: i });
    }
  const wireViews = [];
  for (const mode of ["study", "engine"])
    for (let i = 0; i < 16; i++)
      for (const view of ["rider", "combined"]) {
        const r = await page.evaluate(
          ({ mode, view, yaw }) => window.riderControl.render(yaw, mode, view, true),
          { mode, view, yaw: i * 22.5 },
        );
        assert.equal(r.edgePixels, 0);
        await writeFile(
          `${base}/captures/wire-${view}-${mode}-${i}.png`,
          Buffer.from(r.png, "base64"),
        );
        if (i === 2)
          await writeFile(
            `${base}/captures/wire-${view}-${mode}.png`,
            Buffer.from(r.png, "base64"),
          );
        delete r.png;
        wireViews.push({ ...r, index: i });
      }
  await page.evaluate(() => window.riderControl.render(45, "study", "combined", false));
  await page.screenshot({ path: `${base}/desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const zoom of ["1", "2", "3"]) {
    await page.locator("#zoom").selectOption(zoom);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  await page.locator("#zoom").selectOption("1");
  await page.locator("#view").selectOption("rider");
  await page.locator("#mode").selectOption("engine");
  await page.locator("#wire").check();
  await page.locator("#wire").uncheck();
  await page.screenshot({ path: `${base}/mobile.png`, fullPage: true });
  const offline = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const requests = [];
  offline.on("request", (r) => {
    if (/^https?:/.test(r.url())) requests.push(r.url());
  });
  offline.on("pageerror", (e) => errors.push(e.message));
  await offline.context().setOffline(true);
  await offline.goto(pathToFileURL(resolve(`${base}/offline.html`)).href);
  await offline.waitForFunction(() => window.riderReady === true);
  const a = await offline.evaluate(() =>
    window.riderControl.render(45, "engine", "combined", false),
  );
  const b = await page.evaluate(() => window.riderControl.render(45, "engine", "combined", false));
  assert.equal(a.png, b.png);
  const ar = await offline.evaluate(() => window.riderControl.render(90, "engine", "ruler", false));
  const br = await page.evaluate(() => window.riderControl.render(90, "engine", "ruler", false));
  assert.equal(ar.png, br.png);
  assert.deepEqual(requests, []);
  assert.deepEqual(errors, []);
  await writeFile(
    `${base}/capture.json`,
    `${JSON.stringify(
      {
        status: "passed",
        presentationStatus: "prototype-not-production",
        humanApproval: false,
        riderSha256: await sha(`${output}/rider.glb`),
        profileSha256: C.contactProfile.sha256,
        fixtureSha256: await sha(`${base}/synthetic-contact-fixture.glb`),
        actualBikePresent: false,
        CarMeshAssetUsed: false,
        fixtureGeometryStaysIgnored: true,
        singleDepthTarget: true,
        sharedProjectionAndOutline: true,
        nativeSize: 224,
        radius: 112,
        browser: "bundled full Chromium",
        browserVersion: browser.version(),
        views,
        wireViews,
        rulerViews,
        scaleControlInputs: C.scaleControls,
        desktopMobileControls: true,
        mobileNoOverflow: true,
        offline: {
          exactFixtureCombinedPixels: true,
          exactRulerPixels: true,
          networkRequests: requests,
        },
        errors,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await browser?.close();
  await server.close();
}
