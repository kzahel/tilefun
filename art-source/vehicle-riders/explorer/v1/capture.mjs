import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const base = "data/vehicle-riders/explorer";
const out = "public/demos/vehicle-riders/explorer/v1";
const config = JSON.parse(await readFile(`${out}/rider.json`, "utf8"));
const sha = async (p) =>
  createHash("sha256")
    .update(await readFile(p))
    .digest("hex");
assert.equal(await sha(config.carControl.glb), config.carControl.sha256);
assert.equal(
  await sha(config.identityReference.approvedPNG),
  config.identityReference.approvedPNGsha256,
);
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
  await page.goto(`http://127.0.0.1:${address.port}/tilefun/${out}/index.html`);
  await page.waitForFunction(() => window.riderReady === true);
  assert.ok(
    await page.evaluate(
      () => window.riderControl.singleDepthTarget && window.riderControl.normalizedSharedParent,
    ),
  );
  const views = [];
  for (const mode of ["study", "engine"])
    for (let index = 0; index < 16; index++) {
      const row = { mode, index, yaw: index * 22.5, counts: {} };
      for (const view of ["combined", "rider", "bare", "visible-mask"]) {
        const result = await page.evaluate(
          ({ yaw, mode, view }) => window.riderControl.render(yaw, mode, view, false),
          { yaw: row.yaw, mode, view },
        );
        assert.equal(result.edgePixels, 0);
        await writeFile(
          `${base}/captures/${view}-${mode}-${index}.png`,
          Buffer.from(result.png, "base64"),
        );
        row.counts[view] = result.rawOccupied;
      }
      assert.ok(row.counts["visible-mask"] <= row.counts.rider);
      row.occludedRiderPixels = row.counts.rider - row.counts["visible-mask"];
      views.push(row);
    }
  for (const mode of ["study", "engine"])
    for (const view of ["combined", "rider"]) {
      const wire = await page.evaluate(
        ({ mode, view }) => window.riderControl.render(45, mode, view, true),
        { mode, view },
      );
      await writeFile(`${base}/captures/wire-${view}-${mode}.png`, Buffer.from(wire.png, "base64"));
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
  await offline
    .waitForFunction(() => window.riderReady === true)
    .catch(async (error) => {
      await writeFile(
        `${base}/offline-error.json`,
        JSON.stringify({ errors, pose: await offline.locator("#pose").textContent() }),
      );
      throw error;
    });
  const off = await offline.evaluate(() =>
    window.riderControl.render(45, "engine", "combined", false),
  );
  const online = await page.evaluate(() =>
    window.riderControl.render(45, "engine", "combined", false),
  );
  assert.equal(off.png, online.png);
  assert.deepEqual(requests, []);
  assert.deepEqual(errors, []);
  assert.equal(await sha(config.carControl.glb), config.carControl.sha256);
  await writeFile(
    `${base}/capture.json`,
    `${JSON.stringify({ status: "passed", presentationStatus: "prototype-not-production", humanApproval: false, riderSha256: await sha(`${out}/rider.glb`), carSha256: config.carControl.sha256, browser: "bundled full Chromium", browserVersion: browser.version(), nativeSize: 224, radius: 112, singleDepthTarget: true, sharedNormalizedParent: true, sharedCarProjectionAndOutline: true, views, desktopMobileControls: true, mobileNoOverflow: true, offline: { exactCombinedPixels: true, networkRequests: requests }, errors, limitation: "Only art/composition proof. No main renderer/authority/pooling/fallback/AI or all-avatar support." }, null, 2)}\n`,
  );
} finally {
  await browser?.close();
  await server.close();
}
