/** New cycle adapter copied from pinned v2 capture; actual shared renderer only.
 * Explicit --loader-qualified is required after parent releases/applies the engine branch. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const configPath = process.argv[2];
if (!configPath)
  throw Error("Usage: node scripts/vehicle-bake/family-capture-cycle.mjs CONFIG [--qa-only]");
const config = JSON.parse(await readFile(configPath, "utf8"));
assert.equal(config.toolchain, "motorcycle-v1");
assert.ok(Array.isArray(config.wheelIds));
assert.ok(
  JSON.stringify(config.wheelIds) === '["F","R"]' ||
    JSON.stringify(config.wheelIds) === '["F","R","SC"]',
);
if (!process.argv.includes("--loader-qualified")) {
  await mkdir(resolve(config.qa), { recursive: true });
  const pending = {
    status: "pending-shared-loader",
    toolchain: "motorcycle-v1",
    wheelIds: config.wheelIds,
    reason:
      "Actual shared CarMeshAsset cycle branch must be released/applied and tested by parent first. No raw GLTF fallback or fake browser qualification.",
    next: "After parent loader qualification, rerun this exact shared capture with --loader-qualified; failures remain failures.",
  };
  await writeFile(
    resolve(config.qa, "cycle-capture-pending.json"),
    `${JSON.stringify(pending, null, 2)}\n`,
  );
  console.log(JSON.stringify(pending));
  process.exit(2);
}
const out = resolve(config.output);
const qa = resolve(config.qa);
if (!process.argv.includes("--qa-only") && existsSync(resolve(out, "review-manifest.json")))
  throw Error("Frozen review revision: capture into a new directory.");
await mkdir(qa, { recursive: true });
const candidate = JSON.parse(await readFile(resolve(out, "candidate.json"), "utf8")).candidates[0];
const nativeSize = candidate.nativeSize ?? 128;
assert.equal(nativeSize, config.nativeSize ?? 128);
const sha = createHash("sha256")
  .update(await readFile(resolve(out, candidate.glb)))
  .digest("hex");
assert.equal(sha, candidate.audit.sha256);
const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  cacheDir: resolve(qa, "vite-cache"),
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
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  const address = server.httpServer.address();
  await page.goto(
    `http://127.0.0.1:${address.port}/tilefun/${config.output.replaceAll("\\", "/").replace(/^public\//, "")}/index.html`,
  );
  await page.waitForFunction(() => window.familyReviewReady === true);
  const folder = resolve(out, "captures");
  if (!process.argv.includes("--qa-only")) {
    await mkdir(folder, { recursive: true });
    const stats = await page.evaluate(() => window.familyReview.state.stats);
    assert.equal(stats.triangles, candidate.audit.triangles);
    assert.equal(stats.sourceMeshes, candidate.audit.meshes);
    const rig = await page.evaluate(() => window.familyReview.auditRig());
    assert.equal(config.toolchain, "motorcycle-v1");
    assert.ok(Array.isArray(config.wheelIds) && [2, 3].includes(config.wheelIds.length));
    assert.equal(new Set(config.wheelIds).size, config.wheelIds.length);
    assert.deepEqual(rig.wheels.map((wheel) => wheel.id).sort(), [...config.wheelIds].sort());
    const views = [];
    for (const mode of ["study", "engine"]) {
      for (let index = 0; index < 16; index++) {
        const result = await page.evaluate(
          ({ yaw, mode }) => {
            const rendered = window.familyReview.pose(yaw, 0, mode);
            let opaque = 0;
            let edge = 0;
            const size = rendered.nativeSize;
            const bounds = { minX: size, minY: size, maxX: -1, maxY: -1 };
            for (let i = 3; i < rendered.pixels.length; i += 4) {
              if (!rendered.pixels[i]) continue;
              opaque++;
              const p = (i - 3) / 4;
              const x = p % size;
              const y = Math.floor(p / size);
              if (x === 0 || x === size - 1 || y === 0 || y === size - 1) edge++;
              bounds.minX = Math.min(bounds.minX, x);
              bounds.minY = Math.min(bounds.minY, y);
              bounds.maxX = Math.max(bounds.maxX, x);
              bounds.maxY = Math.max(bounds.maxY, y);
            }
            return {
              png: document.querySelector("#low").toDataURL().split(",")[1],
              opaque,
              edge,
              bounds,
            };
          },
          { yaw: index * 22.5, mode },
        );
        assert.ok(result.opaque > 300, `Empty ${mode} ${index}`);
        assert.equal(result.edge, 0, `Camera clipping ${mode} ${index}`);
        await writeFile(resolve(folder, `${mode}-${index}.png`), Buffer.from(result.png, "base64"));
        views.push({
          mode,
          yaw: index * 22.5,
          opaque: result.opaque,
          edgePixels: result.edge,
          bounds: result.bounds,
        });
      }
    }
    const cropProof = [];
    if (nativeSize > 128) {
      for (let index = 0; index < 16; index++) {
        const proof = await page.evaluate(
          ({ index, nativeSize }) => {
            const api = window.familyReview;
            api.setNativeSize(128);
            const small = api.pose(index * 22.5, 0, "engine").pixels;
            api.setNativeSize(nativeSize);
            const large = api.pose(index * 22.5, 0, "engine").pixels;
            const offset = (nativeSize - 128) / 2;
            let mismatchedChannels = 0;
            // Exclude the 1px frame boundary: clipping changes outline neighbour tests there.
            for (let y = 1; y < 127; y++)
              for (let x = 1; x < 127; x++)
                for (let c = 0; c < 4; c++) {
                  if (
                    small[(y * 128 + x) * 4 + c] !==
                    large[((y + offset) * nativeSize + x + offset) * 4 + c]
                  )
                    mismatchedChannels++;
                }
            return {
              yaw: index * 22.5,
              comparedPixels: 126 * 126,
              mismatchedChannels,
              includesInteriorOutline: true,
              excludedFrameBoundary: 1,
            };
          },
          { index, nativeSize },
        );
        assert.equal(
          proof.mismatchedChannels,
          0,
          `Native viewport crop changed game pixels at ${proof.yaw}`,
        );
        cropProof.push(proof);
      }
    }
    const radii = await page.evaluate(() => window.familyReview.wheelRadii());
    assert.deepEqual(radii.map((wheel) => wheel.id).sort(), [...config.wheelIds].sort());
    const radius = radii[0].radius;
    const phases = [];
    for (let index = 0; index < 8; index++) {
      const phase = index < 4 ? index : index - 8;
      const distance = (radius * Math.PI * phase) / 4;
      for (const mode of ["study", "engine"]) {
        const png = await page.evaluate(
          ({ distance, mode }) => {
            window.familyReview.pose(45, distance, mode);
            return document.querySelector("#low").toDataURL().split(",")[1];
          },
          { distance, mode },
        );
        await writeFile(
          resolve(folder, `${mode === "study" ? "roll" : "game-roll"}-${index}.png`),
          Buffer.from(png, "base64"),
        );
      }
      phases.push({
        phaseDegrees: phase * 45,
        referenceWheelId: radii[0].id,
        distance,
        wheels: radii.map((wheel) => ({
          id: wheel.id,
          radius: wheel.radius,
          actualPhaseDegrees: (distance / wheel.radius) * (180 / Math.PI),
        })),
      });
    }
    for (const mode of ["study", "engine"]) {
      const png = await page.evaluate((mode) => {
        window.familyReview.pose(45, 0, mode, true);
        return document.querySelector("#low").toDataURL().split(",")[1];
      }, mode);
      await writeFile(resolve(folder, `wire-${mode}.png`), Buffer.from(png, "base64"));
    }
    assert.deepEqual(errors, []);
    await writeFile(
      resolve(folder, "capture.json"),
      `${JSON.stringify(
        {
          status: "passed",
          toolchain: "motorcycle-v1",
          sharedLoaderQualification: "passed-actual-shared-CarMeshAsset",
          id: candidate.id,
          glbSha256: sha,
          stats,
          rig,
          views,
          phases,
          centered128GameCropProof: cropProof,
          sourceScale: "80 / 4.6 (unchanged)",
          nativeSize,
          dimensions: [nativeSize, nativeSize],
          groundOrigins: {
            study: [nativeSize / 2, nativeSize / 2 + 28],
            engine: [nativeSize / 2, nativeSize / 2],
          },
          study: "50 degrees; viewport expands by nativeSize / 128; constant 28px registration",
          game: "setCarMeshProjection(camera.projectionMatrix,nativeSize/2); centered ground",
          engineComponents: [
            "CarMeshAsset",
            "VehicleGeometryBatches",
            "CarPixelOutline",
            "setCarMeshProjection",
          ],
          registration: "Human review pending; no gameplay activation",
          errors,
        },
        null,
        2,
      )}\n`,
    );
  }
  await page.evaluate(() => window.familyReview.pose(45, 0, "study", false));
  await page.locator("#angle").fill("112.5");
  assert.equal(await page.locator("#angle-value").textContent(), "112.5°");
  await page.locator("#projection").selectOption("engine");
  assert.equal(await page.evaluate(() => window.familyReview.state.mode), "engine");
  await page.locator("#wireframe").check();
  assert.equal(await page.evaluate(() => window.familyReview.state.wireframe), true);
  await page.locator("#wireframe").uncheck();
  await page.locator("#play").click();
  await page.waitForFunction(() => window.familyReview.state.yaw > 113);
  await page.locator("#play").click();
  assert.equal(await page.evaluate(() => window.familyReview.state.playing), false);
  for (const zoom of ["1", "2", "3"]) {
    await page.locator("#zoom").selectOption(zoom);
    assert.equal(
      await page.locator("#low").evaluate((el) => el.getBoundingClientRect().width),
      nativeSize * Number(zoom),
    );
    assert.equal(
      await page.locator("#native").evaluate((el) => el.getBoundingClientRect().width),
      nativeSize,
    );
  }
  await page.locator("#zoom").selectOption("2");
  await page.evaluate(() => window.familyReview.pose(45, 0, "study", false));
  await page.screenshot({ path: resolve(qa, "desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const zoom of ["1", "2", "3"]) {
    await page.locator("#zoom").selectOption(zoom);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      `Mobile overflow at ${zoom}x`,
    );
    assert.equal(
      await page.locator("#native").evaluate((el) => el.getBoundingClientRect().width),
      nativeSize,
    );
    if (candidate.styleReference)
      assert.equal(
        await page.locator("#reference").evaluate((el) => el.getBoundingClientRect().width),
        128,
      );
    if (nativeSize * Number(zoom) > 324) {
      assert.ok(
        await page.locator(".enlarged").evaluate((el) => el.scrollWidth > el.clientWidth),
        "Enlargement scrolls internally",
      );
      await page.locator(".enlarged").evaluate((el) => {
        el.scrollLeft = el.scrollWidth;
      });
      assert.ok(
        await page.locator(".enlarged").evaluate((el) => el.scrollLeft > 0),
        "Enlarged pixels remain reachable",
      );
    }
  }
  await page.locator("#zoom").selectOption("2");
  await page.locator(".enlarged").evaluate((el) => {
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  });
  await page.screenshot({ path: resolve(qa, "mobile.png"), fullPage: true });
  let offline = "not yet assembled";
  if (process.argv.includes("--qa-only")) {
    const off = await browser.newPage();
    const offlineRequests = [];
    off.on("request", (request) => {
      if (/^https?:/.test(request.url())) offlineRequests.push(request.url());
    });
    off.on("pageerror", (error) => errors.push(error.message));
    await off.goto(pathToFileURL(resolve(config.offline)).href);
    await off.waitForFunction(() => window.familyReviewReady === true);
    const embedded = await off.evaluate(async () => {
      const api = window.familyReview;
      const bytes = await (
        await fetch(window.familyReviewOffline.assets[api.state.candidate.glb])
      ).arrayBuffer();
      return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("");
    });
    assert.equal(embedded, sha, "Offline embedded exact GLB");
    assert.deepEqual(offlineRequests, [], "Offline viewer makes no network requests");
    offline = { exactGlbSha256: embedded, networkRequests: offlineRequests };
    await off.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(
    resolve(qa, "browser-qa.json"),
    `${JSON.stringify(
      {
        status: "passed",
        toolchain: "motorcycle-v1",
        sharedLoaderQualification: "passed-actual-shared-CarMeshAsset",
        glbSha256: sha,
        browser: "bundled full Chromium",
        version: browser.version(),
        fullChromiumRequested: true,
        desktop: [1200, 1050],
        mobile: [390, 844],
        controls: ["heading", "study/game", "wireframe", "rotate+roll", "native/2x/3x"],
        nativeCardActualPixels: nativeSize,
        mobileNoPageOverflowAllScales: true,
        offline,
        errors,
      },
      null,
      2,
    )}\n`,
  );
  console.log(
    JSON.stringify({ status: "passed", id: candidate.id, glbSha256: sha, output: out, qa }),
  );
} finally {
  await browser?.close();
  await server.close();
}
