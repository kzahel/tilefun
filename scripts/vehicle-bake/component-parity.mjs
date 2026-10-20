/** Inspect an actual composed GLB through the shared renderer and raw decoder. */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import { createServer } from "vite";

const config = JSON.parse(await readFile(process.argv[2], "utf8"));
const recipe = JSON.parse(await readFile(resolve(config.source, "recipe.json"), "utf8"));
const composition = {
  ...config.composition,
  mountBlenderWorldPixels:
    config.composition.mountBlenderWorldPixels ?? recipe.config.mountBlenderWorldPixels,
};
assert.ok(
  Array.isArray(composition.mountBlenderWorldPixels) &&
    composition.mountBlenderWorldPixels.length === 3 &&
    composition.mountBlenderWorldPixels.every(Number.isFinite),
);
const qa = resolve(config.qa);
const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  cacheDir: resolve(qa, "parity-vite-cache"),
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0, watch: null },
  optimizeDeps: { entries: [] },
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({ channel: "chromium", headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  await page.goto(`${origin}/tilefun/${config.output.replace(/^public\//, "")}/index.html`);
  await page.waitForFunction(() => window.familyReviewReady === true);
  const geometry = await page.evaluate(async ({ component, prefix, mountBlenderWorldPixels }) => {
    const { GLTFLoader } = await import(
      "/tilefun/node_modules/three/examples/jsm/loaders/GLTFLoader.js"
    );
    const standalone = await new GLTFLoader().loadAsync(
      `/tilefun/${component.replace(/^public\//, "")}`,
    );
    const api = window.familyReview;
    api.pose(0, 0, "study");
    const mount = api.state.asset.object.getObjectByName(`${prefix}_Mount`);
    if (!mount) throw Error("Missing component mount");
    standalone.scene.updateMatrixWorld(true);
    mount.updateWorldMatrix(true, true);
    const sourceScene = api.state.asset.object.children[0]?.children[0]?.children[0];
    if (!sourceScene || !sourceScene.getObjectById(mount.id))
      throw Error("Component outside the actual GLB source scene");
    sourceScene.updateWorldMatrix(true, true);
    const inverseScene = sourceScene.matrixWorld.clone().invert();
    const socket = mount.position
      .clone()
      .set(mountBlenderWorldPixels[0], mountBlenderWorldPixels[2], -mountBlenderWorldPixels[1]);
    const expected = [],
      actual = [];
    standalone.scene.traverse((node) => {
      if (node.isMesh) expected.push(node);
    });
    mount.traverse((node) => {
      if (node.isMesh) actual.push(node);
    });
    if (!expected.length || expected.length !== actual.length)
      throw Error("Component mesh inventory changed");
    let vertices = 0,
      channels = 0;
    for (let index = 0; index < expected.length; index++) {
      const left = expected[index],
        right = actual[index];
      const attributes = Object.keys(left.geometry.attributes).sort();
      if (
        JSON.stringify(attributes) !== JSON.stringify(Object.keys(right.geometry.attributes).sort())
      )
        throw Error("Component vertex attributes changed");
      for (const key of attributes) {
        const a = left.geometry.attributes[key].array,
          b = right.geometry.attributes[key].array;
        if (a.length !== b.length || a.some((value, i) => value !== b[i]))
          throw Error(`Component attribute changed: ${key}`);
        channels += a.length;
      }
      const indices = left.geometry.index?.array,
        remapped = right.geometry.index?.array;
      if (
        !!indices !== !!remapped ||
        indices?.length !== remapped?.length ||
        indices?.some((value, i) => value !== remapped[i])
      )
        throw Error("Component triangle indices changed");
      const positions = left.geometry.attributes.position;
      for (let vertex = 0; vertex < positions.count; vertex++) {
        const point = mount.position
          .clone()
          .fromBufferAttribute(positions, vertex)
          .applyMatrix4(left.matrixWorld)
          .add(socket);
        const observed = mount.position
          .clone()
          .fromBufferAttribute(right.geometry.attributes.position, vertex)
          .applyMatrix4(right.matrixWorld)
          .applyMatrix4(inverseScene);
        if (point.distanceTo(observed) > 0.000001)
          throw Error("Component socket/world coordinates changed");
        vertices++;
      }
    }
    standalone.scene.traverse((node) => {
      if (!node.isMesh) return;
      node.geometry.dispose();
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        material.map?.dispose();
        material.dispose();
      }
    });
    mount.visible = false;
    return { meshes: actual.length, vertices, unchangedAttributeChannels: channels };
  }, composition);
  let compared = 0;
  for (const mode of ["study", "engine"])
    for (let index = 0; index < 16; index++) {
      const png = await page.evaluate(
        ({ mode, index }) => {
          window.familyReview.pose(index * 22.5, 0, mode);
          return document.querySelector("#low").toDataURL().split(",")[1];
        },
        { mode, index },
      );
      const frozen = await readFile(
        resolve(
          config.composition.baseCaptures,
          `${config.composition.baseCapturePrefix ?? ""}${mode}-${index}.png`,
        ),
      );
      const decoded = PNG.sync.read(Buffer.from(png, "base64"));
      const expected = PNG.sync.read(frozen);
      assert.equal(decoded.width, expected.width);
      assert.equal(decoded.height, expected.height);
      assert.deepEqual(decoded.data, expected.data, `Base pixels changed: ${mode}/${index}`);
      compared++;
    }
  let combinedViews = 0;
  if (config.composition.combinedCaptures) {
    await page.evaluate((prefix) => {
      window.familyReview.state.asset.object.getObjectByName(`${prefix}_Mount`).visible = true;
    }, config.composition.prefix);
    for (const mode of ["study", "engine"])
      for (let index = 0; index < 16; index++) {
        const png = await page.evaluate(
          ({ mode, index }) => {
            window.familyReview.pose(index * 22.5, 0, mode);
            return document.querySelector("#low").toDataURL().split(",")[1];
          },
          { mode, index },
        );
        const expected = PNG.sync.read(
          await readFile(
            resolve(config.composition.combinedCaptures, `combined-${mode}-${index}.png`),
          ),
        );
        const actual = PNG.sync.read(Buffer.from(png, "base64"));
        assert.equal(actual.width, expected.width);
        assert.equal(actual.height, expected.height);
        assert.deepEqual(actual.data, expected.data, `Combined pixels changed: ${mode}/${index}`);
        combinedViews++;
      }
  }
  assert.deepEqual(errors, []);
  const receipt = {
    status: "passed",
    baseNativePNGsExact: compared,
    combinedNativeRGBAViewsExact: combinedViews,
    componentDecodedGeometryAndSocket: geometry,
    renderer: "Actual CarMeshAsset, shared fixed projection and CarPixelOutline; full Chromium",
  };
  await writeFile(resolve(qa, "component-parity.json"), `${JSON.stringify(receipt, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
} finally {
  await browser?.close();
  await server.close();
}
