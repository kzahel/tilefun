/** Exercise the real outline GPU pass, responsive gallery and exported meshes. */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const output = resolve(process.argv[2] ?? "data/authored-assets/pixel-style-browser");
await mkdir(output, { recursive: true });
const fixture = JSON.parse(await readFile(resolve(output, "shader-fixture.json"), "utf8"));
const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  server: { port: 0, host: "127.0.0.1" },
  logLevel: "error",
  optimizeDeps: { entries: [], include: ["three", "three/addons/loaders/GLTFLoader.js"] },
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const errors = [],
  results = [];
let browser;
try {
  browser = await chromium.launch({ channel: "chromium", headless: true });
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    page.on("pageerror", (reason) => errors.push(reason.message));
    page.on("response", (response) => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    await page.goto(`${origin}/tilefun/demos/authored-car/outlined.html`, {
      waitUntil: "networkidle",
    });
    await page.waitForFunction(() => document.documentElement.dataset.shaderReady === "true");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert(
      await page.evaluate(() =>
        [...document.images].every((image) => image.complete && image.naturalWidth),
      ),
    );
    const gpu = await page.evaluate(async (fixture) => {
      const { pixelOutline } = await import(
        "/tilefun/scripts/authored-assets/runtime/pixel-outline.mjs"
      );
      const canvas = document.createElement("canvas");
      const pass = await pixelOutline(canvas);
      const actual = {};
      for (const mode of ["off", "inner", "outer"]) {
        pass.render(fixture.width, fixture.height, new Uint8Array(fixture.input), mode);
        actual[mode] = [...pass.read()];
      }
      pass.dispose();
      return actual;
    }, fixture);
    for (const mode of ["off", "inner", "outer"])
      assert.deepEqual(gpu[mode], fixture.expected[mode], `${mode} GPU/reference bytes differ`);
    for (const mode of ["off", "inner", "outer"]) {
      await page.selectOption("#outline-mode", mode);
      await page
        .locator(".grid")
        .first()
        .screenshot({ path: resolve(output, `shader-${mode}-${width}.png`) });
    }
    await page.selectOption("#outline-mode", "inner");
    await page.screenshot({ path: resolve(output, `gallery-${width}.png`), fullPage: true });
    results.push({
      width,
      images: "loaded",
      overflow: false,
      shaderModes: "GPU bytes equal CPU reference including partial alpha and equal-brightness ink",
    });
    await page.close();
  }
  for (const prefix of ["", "green-"]) {
    const page = await browser.newPage();
    await page.goto(`${origin}/tilefun/demos/authored-car/outlined.html`);
    const glb = await page.evaluate(async (prefix) => {
      const { THREE, GLTFLoader } = await import(
        "/tilefun/scripts/authored-assets/runtime/glb-imports.mjs"
      );
      const asset = await new GLTFLoader().loadAsync(
        `/tilefun/demos/authored-car/v3/${prefix}car.glb`,
      );
      let meshes = 0,
        triangles = 0,
        tires = 0,
        textured = 0;
      asset.scene.traverse((obj) => {
        if (!obj.isMesh) return;
        meshes++;
        triangles += (obj.geometry.index?.count ?? obj.geometry.attributes.position.count) / 3;
        if (obj.name.startsWith("Tire")) tires++;
        if (obj.material.map?.image || obj.material.emissiveMap?.image) textured++;
      });
      const bounds = new THREE.Box3().setFromObject(asset.scene);
      const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
      renderer.setSize(256, 256);
      renderer.toneMapping = THREE.NoToneMapping;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#53636b");
      scene.add(asset.scene);
      const camera = new THREE.OrthographicCamera(-38, 38, 38, -38, 0.1, 1000);
      camera.position.set(-65, 65, 85);
      camera.lookAt(0, 9, 0);
      renderer.render(scene, camera);
      document.body.replaceChildren(renderer.domElement);
      renderer.domElement.id = "mesh-proof";
      const pixels = new Uint8Array(256 * 256 * 4);
      const gl = renderer.getContext();
      gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      const colors = new Set();
      for (let k = 0; k < pixels.length; k += 4)
        colors.add(`${pixels[k]},${pixels[k + 1]},${pixels[k + 2]}`);
      renderer.dispose();
      return {
        meshes,
        triangles,
        tires,
        textured,
        bounds: [bounds.min.toArray(), bounds.max.toArray()],
        colors: colors.size,
      };
    }, prefix);
    assert.equal(glb.meshes, 55);
    assert.equal(glb.triangles, 834);
    assert.equal(glb.tires, 4);
    assert.equal(glb.textured, 55);
    assert(glb.colors > 100);
    assert(Math.abs(glb.bounds[0][1]) < 1e-4);
    assert(Math.abs(glb.bounds[1][2] - 11.9) < 1e-4);
    await page.locator("#mesh-proof").screenshot({ path: resolve(output, `${prefix}glb.png`) });
    results.push({ prefix, glb });
    await page.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(
    resolve(output, "browser.json"),
    `${JSON.stringify({ results, errors }, null, 2)}\n`,
  );
  console.log(JSON.stringify({ results, errors }));
} finally {
  await browser?.close();
  await server.close();
}
