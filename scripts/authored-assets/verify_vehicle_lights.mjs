/** Real GLB tags/materials in full Chromium; off/A/B states and resource isolation. */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const output = resolve(process.argv[2]);
const assetUrl = process.argv[3] ?? "/tilefun/assets/models/vehicles/ambulance-v2.glb";
const root = resolve(process.argv[4] ?? ".");
const pattern = JSON.parse(
  await readFile(
    resolve(root, process.argv[5] ?? "art-source/vehicle-models/ambulance/v2/lights.json"),
    "utf8",
  ),
);
await mkdir(output, { recursive: false });
const server = await createServer({
  root,
  cacheDir: resolve(output, "vite-cache"),
  configFile: false,
  base: "/tilefun/",
  logLevel: "error",
  server: { port: 0, host: "127.0.0.1" },
  optimizeDeps: { entries: [], include: ["three", "three/addons/loaders/GLTFLoader.js"] },
  plugins: [
    {
      name: "light-probe",
      configureServer(s) {
        s.middlewares.use((req, res, next) => {
          if (req.url !== "/tilefun/__light_probe") return next();
          res.setHeader("Content-Type", "text/html");
          res.end("<!doctype html><body style='margin:0'></body>");
        });
      },
    },
  ],
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({ channel: "chromium", headless: true });
  const page = await browser.newPage({ viewport: { width: 384, height: 384 } });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tilefun/__light_probe`);
  const result = await page.evaluate(
    async ({ assetUrl, pattern }) => {
      const { THREE, GLTFLoader } = await import(
        "/tilefun/scripts/authored-assets/runtime/glb-imports.mjs"
      );
      const { VehicleEmergencyLights } = await import(
        "/tilefun/src/rendering/VehicleEmergencyLights.ts"
      );
      const gltf = await new GLTFLoader().loadAsync(assetUrl);
      const source = gltf.scene;
      const fixed = [];
      source.traverse((obj) => {
        if (!obj.isMesh) return;
        const mat = obj.material;
        mat.toneMapped = false;
        if (mat.map) {
          mat.map.minFilter = mat.map.magFilter = THREE.NearestFilter;
          mat.map.generateMipmaps = false;
        }
        if (!obj.userData.tilefun_role)
          fixed.push([obj, mat, mat.color.clone(), mat.emissiveIntensity]);
      });
      const effect = new VehicleEmergencyLights(source, pattern);
      if (effect.count !== pattern.lenses.length)
        throw Error("Exported lens count differs from its light contract");
      const lenses = [];
      source.traverse((obj) => {
        if (obj.userData.tilefun_role === "emergency-light") lenses.push(obj);
      });
      for (const expected of pattern.lenses) {
        const lens = lenses.find((obj) => obj.name === expected.node);
        if (
          !lens ||
          lens.userData.tilefun_group !== expected.group ||
          lens.userData.tilefun_phase !== expected.phase
        )
          throw Error(`Exported lens differs from its light contract: ${expected.node}`);
      }
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#53636b");
      scene.add(source);
      const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
      renderer.setSize(384, 384);
      renderer.toneMapping = THREE.NoToneMapping;
      const camera = new THREE.OrthographicCamera(-76, 76, 76, -76, 0.1, 1000);
      camera.position.set(-90, 90, 110);
      camera.lookAt(0, 24, 0);
      document.body.replaceChildren(renderer.domElement);
      const poses = [];
      const draw = (enabled, time) => {
        effect.setState(enabled, time);
        for (const [obj, mat, color, intensity] of fixed)
          if (
            obj.material !== mat ||
            !mat.color.equals(color) ||
            mat.emissiveIntensity !== intensity
          )
            throw Error("Body/housing paint changed");
        renderer.render(scene, camera);
        const gains = lenses.map((obj) => obj.material.emissiveIntensity ?? obj.material.color.r);
        poses.push({ enabled, time, gains });
        return renderer.domElement.toDataURL("image/png");
      };
      const off = draw(false, 0),
        a = draw(true, 0.05),
        b = draw(true, 0.55),
        reset = draw(false, 0.05);
      if (off !== reset || off === a || off === b || a === b)
        throw Error("Missing visible flash or off-state leaked between draws");
      const names = lenses.map((obj) => obj.name);
      effect.dispose();
      renderer.dispose();
      return {
        names,
        poses,
        bodyAndHousingsUnchanged: true,
        offResetExact: true,
        frames: { off, a, b },
      };
    },
    { assetUrl, pattern },
  );
  assert.equal(result.names.length, pattern.lenses.length);
  for (const [name, data] of Object.entries(result.frames))
    await writeFile(resolve(output, `${name}.png`), Buffer.from(data.split(",")[1], "base64"));
  delete result.frames;
  await writeFile(resolve(output, "light-browser.json"), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result));
} finally {
  await browser?.close();
  await server.close();
}
