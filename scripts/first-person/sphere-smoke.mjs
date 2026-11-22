import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const temp = await mkdtemp(path.join(os.tmpdir(), "tilefun-sphere-smoke-"));
const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  cacheDir: path.join(temp, "vite"),
  optimizeDeps: { entries: ["scripts/first-person/sphere-smoke.ts"] },
  server: { host: "127.0.0.1", port: 0, hmr: false, watch: null },
  logLevel: "error",
});
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}/tilefun`;
  browser = await chromium.launch({
    channel: "chromium",
    args: process.argv.includes("--software")
      ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-gpu"]
      : [],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(`${origin}/__sphere-smoke.html?*`, (route) =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Sphere smoke</title>" }),
  );
  await page.goto(`${origin}/__sphere-smoke.html?wildlife3dDrafts=1`);
  const { assets, characterCatalog } = await page.evaluate(async () => {
    const { sphereFixtures } = await import("/tilefun/scripts/first-person/sphere-fixtures.ts");
    return sphereFixtures();
  });
  for (const [file, bytes] of Object.entries(assets))
    await page.route(`${origin}/${file}`, (route) =>
      route.fulfill({ contentType: "model/gltf-binary", body: Buffer.from(bytes) }),
    );
  const results = await page.evaluate(async (characterCatalog) => {
    const catalog = document.createElement("script");
    catalog.id = "tilefun-wildlife-draft-catalog";
    catalog.type = "application/json";
    catalog.textContent = JSON.stringify(characterCatalog);
    document.head.append(catalog);
    const { runSphereSmoke } = await import("/tilefun/scripts/first-person/sphere-smoke.ts");
    return runSphereSmoke();
  }, characterCatalog);
  assert.deepEqual(errors, []);
  assert.equal(results.length, 16);
  for (const result of results) {
    const { name, mode, viewport, measured, expected, bodyImages, rigidMeshes, skinnedMeshes } =
      result;
    const label = `${name}, ${mode}, ${viewport.join(" × ")}`;
    const skinned = name === "character";
    const imaged = !skinned && mode === "top-down image";
    assert.deepEqual(
      [bodyImages, rigidMeshes, skinnedMeshes],
      [Number(imaged), Number(!skinned && !imaged), Number(skinned)],
      label,
    );
    // Nearest sampling in the native image can differ by a world texel, drawn
    // three screen pixels high. Direct meshes rasterize at screen resolution.
    const tolerance = imaged ? 3 : 2;
    for (const axis of ["width", "height"])
      assert.ok(
        Math.abs(measured[axis] - expected[axis]) <= tolerance,
        `${label}, ${axis}: got ${measured[axis]}, wanted ${expected[axis].toFixed(1)} ± ${tolerance}`,
      );
    assert.ok(Math.abs(measured.centerX - viewport[0] / 2) <= 1.5, `${label}: horizontal centre`);
    assert.ok(Math.abs(measured.centerY - viewport[1] / 2) <= 1.5, `${label}: vertical centre`);
  }
  console.log(`Sphere aspect smoke passed all ${results.length} WebGL samples.`);
} finally {
  await browser?.close();
  await server.close();
  await rm(temp, { recursive: true, force: true });
}
