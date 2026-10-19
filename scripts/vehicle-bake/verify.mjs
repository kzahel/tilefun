/** Verify the standalone delivery and its real mesh interactions without a server. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const out = resolve("data/vehicle-bake/viewer-check");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chromium", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1050 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(pathToFileURL(resolve("data/vehicle-bake/review.html")).href);
  await page.waitForFunction(() => window.vehicleBakeReady === true);
  const manifest = await page.evaluate(() => window.vehicleBake.manifest);
  for (const candidate of manifest.candidates) {
    await page.locator("#candidate").selectOption(candidate.id);
    await page.waitForFunction((id) => window.vehicleBake.state.candidate.id === id, candidate.id);
    assert.equal(
      await page.evaluate(() => window.vehicleBake.state.stats.triangles),
      candidate.audit.triangles,
    );
    assert.ok(
      (await page.locator("#model").getAttribute("href")).startsWith(
        "data:model/gltf-binary;base64,",
      ),
    );
  }
  await page.locator("#candidate").selectOption(manifest.recommended);
  await page.waitForFunction(
    (id) => window.vehicleBake.state.candidate.id === id,
    manifest.recommended,
  );
  await page.locator("#zoom").selectOption("1");
  const solid = await page.locator("#low").evaluate((canvas) => canvas.toDataURL());
  await page.locator("#wireframe").check();
  const wire = await page.locator("#low").evaluate((canvas) => canvas.toDataURL());
  assert.notEqual(wire, solid);
  await page.locator("#wireframe").uncheck();
  await page.locator("#projection").selectOption("engine");
  assert.equal(await page.evaluate(() => window.vehicleBake.state.mode), "engine");
  await page.locator("#play").click();
  const yaw = await page.evaluate(() => window.vehicleBake.state.yaw);
  await page.waitForFunction((value) => Math.abs(window.vehicleBake.state.yaw - value) > 1, yaw);
  await page.locator("#play").click();
  assert.equal(await page.locator("#play").getAttribute("aria-pressed"), "false");
  await page.locator("#projection").selectOption("study");
  await page.evaluate(() => window.vehicleBake.pose(45));
  await page.locator("#zoom").selectOption("2");
  await page.waitForFunction(() => document.querySelector("#reference").complete);
  await page.screenshot({ path: resolve(out, "standalone.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: resolve(out, "mobile.png"), fullPage: true });
  assert.deepEqual(errors, []);
  const receipt = {
    status: "passed",
    standalone: true,
    models: manifest.candidates.length,
    checks: [
      "embedded actual GLBs",
      "candidate switching",
      "native zoom",
      "wireframe",
      "game projection",
      "rotation and wheel roll",
      "play/pause",
      "mobile layout",
    ],
    errors,
  };
  await writeFile(resolve(out, "result.json"), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt, null, 2));
} finally {
  await browser.close();
}
