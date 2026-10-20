/** Actual shared-loader renders and paint isolation checks; full bundled Chromium. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve("public/demos/original-vehicles/paint-study-v1");
const study = JSON.parse(await readFile(resolve(root, "study.json"), "utf8"));
const config = JSON.parse(await readFile("scripts/vehicle-bake/paint-variants-v1.json", "utf8"));
const qa = resolve("data/vehicle-bake/paint-study-v1");
await mkdir(qa, { recursive: true });
const publicRoot = resolve("public");
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost");
    assert.ok(url.pathname.startsWith("/tilefun/"));
    const file = resolve(publicRoot, decodeURIComponent(url.pathname.slice("/tilefun/".length)));
    assert.ok(file.startsWith(publicRoot + sep));
    response.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".json": "application/json",
        ".css": "text/css",
        ".png": "image/png",
        ".glb": "model/gltf-binary",
      }[extname(file)] ?? "application/octet-stream",
    );
    response.end(await readFile(file));
  } catch {
    response.statusCode = 404;
    response.end();
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
let browser;
try {
  browser = await chromium.launch({ channel: "chromium", headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1050 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const baseFrames = new Map();
  const results = [];
  for (const row of study.candidates) {
    const out = resolve(root, row.id);
    const manifest = resolve(out, "review-manifest.json");
    try {
      await readFile(manifest);
      throw Error(`Frozen paint revision: ${row.id}`);
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    await copyFile(resolve(root, "viewer.js"), resolve(out, "viewer.js"));
    await page.goto(
      `http://127.0.0.1:${server.address().port}/tilefun/demos/original-vehicles/paint-study-v1/${row.id}/index.html`,
    );
    await page
      .waitForFunction(() => window.familyReviewReady === true)
      .catch(async (error) => {
        throw Error(
          `${error.message}\n${errors.join("\n")}\n${await page.locator("#status").textContent()}`,
        );
      });
    const family = config.families[row.family];
    const candidate = await page.evaluate(() => window.familyReview.state.candidate);
    const radius = (await page.evaluate(() => window.familyReview.wheelRadii()))[0].radius;
    const poses = ["study", "engine"].flatMap((mode) => [
      ...Array.from({ length: 16 }, (_, i) => ({
        mode,
        yaw: i * 22.5,
        distance: 0,
        name: `${mode}-${i}`,
      })),
      ...Array.from({ length: 8 }, (_, i) => ({
        mode,
        yaw: 45,
        distance: (radius * Math.PI * (i < 4 ? i : i - 8)) / 4,
        name: `${mode}-roll-${i}`,
      })),
    ]);
    const render = (pose) =>
      page.evaluate((pose) => {
        const api = window.familyReview;
        const result = api.pose(pose.yaw, pose.distance, pose.mode);
        return {
          pixels: result.pixels,
          png: document.querySelector("#low").toDataURL().split(",")[1],
        };
      }, pose);
    if (!baseFrames.has(row.family)) {
      const base = { ...candidate, glb: `/tilefun/${family.glb.replace(/^public\//, "")}` };
      await page.evaluate((base) => window.familyReview.load(base), base);
      const frames = new Map();
      const folder = resolve(root, `base-${row.family}`, "captures");
      await mkdir(folder, { recursive: true });
      for (const pose of poses) {
        const result = await render(pose);
        frames.set(pose.name, result.pixels);
        await writeFile(resolve(folder, `${pose.name}.png`), Buffer.from(result.png, "base64"));
      }
      baseFrames.set(row.family, frames);
      await page.evaluate((candidate) => window.familyReview.load(candidate), candidate);
    }
    const rig = await page.evaluate(() => window.familyReview.auditRig());
    assert.equal(rig.wheels.length, 4);
    const stats = await page.evaluate(() => window.familyReview.state.stats);
    assert.equal(stats.triangles, family.triangles);
    const paintColors = new Set(family.paintColors.map((c) => c.join(",")));
    const views = [];
    const folder = resolve(out, "captures");
    await mkdir(folder, { recursive: true });
    for (const pose of poses) {
      const result = await render(pose);
      const reference = baseFrames.get(row.family).get(pose.name);
      let changed = 0;
      let opaque = 0;
      for (let i = 0; i < reference.length; i += 4) {
        assert.equal(
          result.pixels[i + 3],
          reference[i + 3],
          `Silhouette changed: ${row.id}/${pose.name}`,
        );
        if (reference[i + 3]) opaque++;
        const differs = result.pixels.slice(i, i + 3).some((v, c) => v !== reference[i + c]);
        if (!paintColors.has(reference.slice(i, i + 3).join(","))) {
          assert.equal(
            differs,
            false,
            `Protected glass/trim/rubber/ink changed: ${row.id}/${pose.name}/${i / 4}`,
          );
        }
        if (differs) changed++;
      }
      assert.ok(opaque > 300);
      views.push({
        ...pose,
        opaquePixels: opaque,
        changedPaintPixels: changed,
        alphaExact: true,
        nonPaintExact: true,
      });
      await writeFile(resolve(folder, `${pose.name}.png`), Buffer.from(result.png, "base64"));
    }
    await page.evaluate(() => window.familyReview.pose(45, 0, "engine"));
    await page.locator("#projection").selectOption("study");
    assert.equal(await page.evaluate(() => window.familyReview.state.mode), "study");
    await page.locator("#angle").fill("112.5");
    assert.equal(await page.evaluate(() => window.familyReview.state.yaw), 112.5);
    await page.locator("#wireframe").check();
    assert.equal(await page.evaluate(() => window.familyReview.state.wireframe), true);
    await page.locator("#wireframe").uncheck();
    await page.locator("#play").click();
    assert.equal(await page.evaluate(() => window.familyReview.state.playing), true);
    await page.locator("#play").click();
    await page.evaluate(() => window.familyReview.pose(45, 0, "engine"));
    for (const viewport of [
      { width: 1200, height: 1050 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      for (const zoom of ["1", "2", "3"]) {
        await page.locator("#zoom").selectOption(zoom);
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
        );
        assert.equal(
          await page.locator("#native").evaluate((el) => el.getBoundingClientRect().width),
          row.nativeSize,
        );
      }
    }
    await page.setViewportSize({ width: 1200, height: 1050 });
    assert.deepEqual(errors, []);
    const hash = createHash("sha256")
      .update(await readFile(resolve(out, "model.glb")))
      .digest("hex");
    assert.equal(hash, row.glbSha256);
    const proof = {
      status: "passed",
      glbSha256: hash,
      baseSha256: row.baseSha256,
      browser: browser.version(),
      browserChannel: "bundled full Chromium",
      views,
      rig,
      stats,
      desktop: [1200, 1050],
      mobile: [390, 844],
      allScalesNoOverflow: true,
      errors,
      humanApproval: false,
      normalGameplay: false,
    };
    await writeFile(resolve(out, "capture-proof.json"), `${JSON.stringify(proof, null, 2)}\n`);
    results.push({ id: row.id, glbSha256: hash, views: views.length, status: "passed" });
    console.log(
      `${row.id}: ${views.length} actual GLB frames; paint-only, alpha and independent wheels passed`,
    );
  }
  await writeFile(
    resolve(qa, "capture-summary.json"),
    `${JSON.stringify({ status: "passed", results, errors }, null, 2)}\n`,
  );
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
