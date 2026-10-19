/** Actual GLB capture/rig checks in bundled full Chromium, isolated server. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const rev = process.argv[2] ?? "v1";
const out = resolve(`data/vehicle-bake/c-surface-bake/${rev}`);
await mkdir(out, { recursive: true });
const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  cacheDir: resolve(out, "vite-cache"),
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0, watch: null },
  optimizeDeps: { entries: [], include: ["three", "three/addons/loaders/GLTFLoader.js"] },
  plugins: [
    {
      name: "route-c-probe",
      configureServer(s) {
        s.middlewares.use((q, r, n) => {
          if (q.url?.split("?")[0] !== "/tilefun/__c_surface_probe") return n();
          r.setHeader("Content-Type", "text/html");
          r.end("<!doctype html><html><body></body></html>");
        });
      },
    },
  ],
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({ channel: "chromium", headless: true });
  const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tilefun/__c_surface_probe`);
  const evidence = await page.evaluate(async (rev) => {
    const { THREE: T, GLTFLoader } = await import(
      "/tilefun/scripts/authored-assets/runtime/glb-imports.mjs"
    );
    const gltf = await new GLTFLoader().loadAsync(
      `/tilefun/demos/vehicle-bake/c-surface-bake/${rev}/model.glb`,
    );
    const scene = new T.Scene();
    scene.add(gltf.scene);
    const s = 80 / 4.6;
    const camera = new T.OrthographicCamera(-3.6 * s, 3.6 * s, 3.6 * s, -3.6 * s, 0.1, 1000);
    camera.position.set(
      0,
      12 * Math.sin((50 * Math.PI) / 180) * s,
      12 * Math.cos((50 * Math.PI) / 180) * s,
    );
    camera.lookAt(0, 0, 0);
    const renderer = new T.WebGLRenderer({
      alpha: true,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(512, 512);
    renderer.setClearColor(0, 0);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.NoToneMapping;
    document.body.append(renderer.domElement);
    const meshes = [];
    gltf.scene.traverse((o) => {
      if (o.isMesh) meshes.push(o);
    });
    const materials = [...new Set(meshes.map((o) => o.material))];
    const neutral = new T.Box3().setFromObject(gltf.scene);
    const fixed = gltf.scene.getObjectByName("Body");
    assertLocal(!!fixed, "body exists");
    const bodyMatrix = fixed.matrixWorld.toArray();
    const rigs = [];
    for (const id of ["FL", "FR", "RL", "RR"]) {
      const steer = gltf.scene.getObjectByName(`Wheel_${id}_Steer`);
      const roll = gltf.scene.getObjectByName(`Wheel_${id}_Roll`);
      const wheel = gltf.scene.getObjectByName(`Wheel_${id}_TireHub`);
      assertLocal(steer && roll && wheel, `wheel nodes ${id}`);
      assertLocal(roll.parent === steer && wheel.parent === roll, `rig hierarchy ${id}`);
      assertLocal(steer.userData.steering_enabled === (id[0] === "F"), "steer flag");
      assertLocal(Math.abs(roll.userData.wheel_radius - 0.34 * s) < 1e-5, "radius world units");
      const center = roll.getWorldPosition(new T.Vector3());
      const before = wheel.matrixWorld.toArray();
      const rest = roll.quaternion.clone();
      roll.quaternion.setFromAxisAngle(new T.Vector3(0, 0, -1), Math.PI / 2);
      gltf.scene.updateMatrixWorld(true);
      assertLocal(
        JSON.stringify(before) !== JSON.stringify(wheel.matrixWorld.toArray()),
        "wheel changed",
      );
      assertLocal(
        JSON.stringify(bodyMatrix) === JSON.stringify(fixed.matrixWorld.toArray()),
        "static body",
      );
      roll.quaternion.copy(rest);
      gltf.scene.updateMatrixWorld(true);
      rigs.push({
        id,
        center: center.toArray(),
        radius: roll.userData.wheel_radius,
        parenting: true,
        independentQuarterTurn: true,
      });
    }
    const frames = [];
    for (let i = 0; i < 8; i++) {
      gltf.scene.rotation.y = (i * Math.PI) / 4;
      renderer.render(scene, camera);
      frames.push(renderer.domElement.toDataURL("image/png"));
    }
    const intermediate = [];
    for (const angle of [22.5, 67.5, 112.5, 157.5]) {
      gltf.scene.rotation.y = (angle * Math.PI) / 180;
      renderer.render(scene, camera);
      intermediate.push(renderer.domElement.toDataURL("image/png"));
    }
    gltf.scene.rotation.y = 0;
    const rolls = [];
    for (const angle of [0, 90, 180, 270]) {
      for (const id of ["FL", "FR", "RL", "RR"])
        gltf.scene
          .getObjectByName(`Wheel_${id}_Roll`)
          .quaternion.setFromAxisAngle(new T.Vector3(0, 0, -1), (angle * Math.PI) / 180);
      renderer.render(scene, camera);
      rolls.push(renderer.domElement.toDataURL("image/png"));
    }
    return {
      frames,
      intermediate,
      rolls,
      validation: {
        backend: renderer.getContext().getParameter(renderer.getContext().RENDERER),
        meshCount: meshes.length,
        materialCount: materials.length,
        materials: materials.map((m) => ({
          type: m.type,
          unlit: m.isMeshBasicMaterial,
          map: !!m.map,
          nearest: m.map?.magFilter === T.NearestFilter,
        })),
        rigs,
        neutralBounds: { min: neutral.min.toArray(), max: neutral.max.toArray() },
        triangles: meshes.reduce(
          (n, m) => n + (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3,
          0,
        ),
      },
    };
    function assertLocal(v, m) {
      if (!v) throw Error(m);
    }
  }, rev);
  for (const key of ["frames", "intermediate", "rolls"])
    for (let i = 0; i < evidence[key].length; i++)
      await writeFile(
        resolve(out, `gltf-${key}-${i}-512.png`),
        Buffer.from(evidence[key][i].split(",")[1], "base64"),
      );
  assert.deepEqual(errors, []);
  assert.equal(evidence.validation.meshCount, 5);
  assert.equal(evidence.validation.materialCount, 1);
  assert(evidence.validation.materials.every((m) => m.unlit && m.map && m.nearest));
  await writeFile(
    resolve(out, "gltf-validation.json"),
    JSON.stringify(evidence.validation, null, 2) + "\n",
  );
  console.log(JSON.stringify(evidence.validation, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
