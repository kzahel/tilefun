/** Verify real GLB wheel parenting, axle math, independent motion and static body. */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const output = resolve(process.argv[2] ?? "data/authored-assets/wheel-rig-check");
const revision = process.argv[3] ?? "v4";
const bundles = revision === "--bundles";
const root = resolve(process.argv[4] ?? ".");
assert(bundles || ["v4", "v5", "v6", "v7", "red-v1"].includes(revision));
const gallery =
  revision === "red-v1"
    ? "red.html"
    : revision === "v7"
      ? "windshield-top.html"
      : revision === "v6"
        ? "windshield-ink.html"
        : revision === "v5"
          ? "windshield.html"
          : "rigged.html";
await mkdir(output, { recursive: true });
const server = await createServer({
  root,
  configFile: false,
  base: "/tilefun/",
  server: { port: 0, host: "127.0.0.1" },
  logLevel: "error",
  optimizeDeps: { entries: [], include: ["three", "three/addons/loaders/GLTFLoader.js"] },
  plugins: [
    {
      name: "vehicle-rig-probe",
      configureServer(probeServer) {
        probeServer.middlewares.use((request, response, next) => {
          if (request.url?.split("?")[0] !== "/tilefun/__vehicle_rig_probe") return next();
          response.setHeader("Content-Type", "text/html");
          response.end(
            "<!doctype html><html><head><title>Vehicle rig verification</title></head><body></body></html>",
          );
        });
      },
    },
  ],
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const results = [];
let browser;
try {
  browser = await chromium.launch({ channel: "chromium", headless: true });
  for (const width of bundles ? [] : [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on("pageerror", (reason) => errors.push(reason.message));
    page.on("response", (response) => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    await page.goto(`${origin}/tilefun/demos/authored-car/${gallery}`, {
      waitUntil: "networkidle",
    });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert(
      await page.evaluate(() =>
        [...document.images].every((image) => image.complete && image.naturalWidth),
      ),
    );
    assert.deepEqual(errors, []);
    await page.screenshot({ path: resolve(output, `gallery-${width}.png`), fullPage: true });
    results.push({ width, images: "loaded", overflow: false });
    await page.close();
  }
  const cases = bundles
    ? JSON.parse(
        await readFile(resolve(root, "art-source/vehicle-models/catalog.json"), "utf8"),
      ).bundles.map((bundle) => ({
        prefix: `${bundle.assetId}-`,
        assetUrl: `/tilefun/${bundle.glb.replace(/^public\//, "")}`,
        geometry: bundle.geometry ?? { meshObjects: 55, triangles: 842 },
      }))
    : (revision === "red-v1" ? [""] : ["", "green-"]).map((prefix) => ({
        prefix,
        assetUrl: `/tilefun/demos/authored-car/${revision}/${prefix}car.glb`,
        geometry: { meshObjects: 55, triangles: revision === "v4" ? 834 : 842 },
      }));
  for (const { prefix, assetUrl, geometry } of cases) {
    const page = await browser.newPage();
    await page.goto(`${origin}/tilefun/__vehicle_rig_probe`, {
      waitUntil: "networkidle",
    });
    const result = await page.evaluate(
      async ({ assetUrl }) => {
        const { THREE, GLTFLoader } = await import(
          "/tilefun/scripts/authored-assets/runtime/glb-imports.mjs"
        );
        const { createWheelRig } = await import(
          "/tilefun/scripts/authored-assets/runtime/wheel-rig.mjs"
        );
        const gltf = await new GLTFLoader().loadAsync(assetUrl);
        const scene = gltf.scene;
        const rig = createWheelRig(scene, THREE);
        const body = scene.getObjectByName("Body");
        const car = scene.getObjectByName("CarRoot");
        if (!body || !car || body.parent !== car) throw new Error("Missing rigid root/body parent");
        scene.updateMatrixWorld(true);
        const fixed = body.children.map((obj) => [obj.name, [...obj.matrixWorld.elements]]);
        const centers = rig.wheels.map((w) => w.roll.getWorldPosition(new THREE.Vector3()));
        function checkFixed() {
          scene.updateMatrixWorld(true);
          if (
            JSON.stringify(fixed) !==
            JSON.stringify(body.children.map((obj) => [obj.name, [...obj.matrixWorld.elements]]))
          )
            throw new Error("Body or fender moved");
          rig.wheels.forEach((wheel, k) => {
            if (wheel.roll.getWorldPosition(new THREE.Vector3()).distanceTo(centers[k]) > 1e-5)
              throw new Error("Wheel orbited instead of spinning");
          });
        }
        const bottomPoints = rig.wheels.map((wheel) => {
          if (
            wheel.roll.parent !== wheel.steer ||
            wheel.steer.parent !== car ||
            wheel.roll.children.length !== 2
          )
            throw new Error("Wrong steer/roll tire+hub hierarchy");
          const tire = wheel.roll.children.find((obj) => obj.name.startsWith("Tire"));
          const attr = tire.geometry.attributes.position;
          let lowest = new THREE.Vector3(0, Infinity, 0),
            local;
          for (let k = 0; k < attr.count; k++) {
            const point = new THREE.Vector3().fromBufferAttribute(attr, k);
            const world = tire.localToWorld(point.clone());
            if (world.y < lowest.y) {
              lowest = world;
              local = point;
            }
          }
          if (Math.abs(lowest.y) > 1e-5) throw new Error("Rest tire is not grounded");
          return { tire, local };
        });
        // Forward is -X: bottom contact rotates toward +X relative to the car.
        for (const wheel of rig.wheels) rig.setWheelTravel(wheel.id, (wheel.radius * Math.PI) / 2);
        checkFixed();
        bottomPoints.forEach(({ tire, local }, k) => {
          const p = tire.localToWorld(local.clone());
          if (
            Math.abs(p.x - centers[k].x - rig.wheels[k].radius) > 1e-4 ||
            Math.abs(p.y - centers[k].y) > 1e-4
          )
            throw new Error("Wrong exported spin axis/sign/radius");
        });
        for (const wheel of rig.wheels) rig.setWheelTravel(wheel.id, (-wheel.radius * Math.PI) / 2);
        checkFixed();
        bottomPoints.forEach(({ tire, local }, k) => {
          if (
            Math.abs(tire.localToWorld(local.clone()).x - centers[k].x + rig.wheels[k].radius) >
            1e-4
          )
            throw new Error("Reverse spin failed");
        });
        rig.setTravel(0);
        const rest = rig.wheels.map((wheel) => wheel.roll.quaternion.clone());
        rig.setWheelTravel("FL", 2);
        checkFixed();
        if (
          rig.wheels[0].roll.quaternion.angleTo(rest[0]) < 0.1 ||
          rig.wheels.slice(1).some((wheel, k) => wheel.roll.quaternion.angleTo(rest[k + 1]) > 1e-6)
        )
          throw new Error("Wheels are not independent");
        rig.setSteering(0.2);
        checkFixed();
        if (
          rig.wheels
            .slice(0, 2)
            .some((wheel) => wheel.steer.quaternion.angleTo(wheel.restSteer) < 0.1) ||
          rig.wheels
            .slice(2)
            .some((wheel) => wheel.steer.quaternion.angleTo(wheel.restSteer) > 1e-6)
        )
          throw new Error("Steering affected wrong assemblies");
        for (let k = -10; k <= 10; k++) {
          rig.setTravel(k * 2.5);
          checkFixed();
        }
        rig.setTravel(0);
        rig.setSteering(0);
        checkFixed();
        let meshes = 0,
          triangles = 0;
        scene.traverse((obj) => {
          if (obj.isMesh) {
            meshes++;
            triangles += (obj.geometry.index?.count ?? obj.geometry.attributes.position.count) / 3;
          }
        });
        const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
        renderer.setSize(384, 384);
        renderer.toneMapping = THREE.NoToneMapping;
        const display = new THREE.Scene();
        display.background = new THREE.Color("#53636b");
        display.add(scene);
        const size = new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3());
        const extent = Math.max(size.x, size.y, size.z) * 0.65;
        const camera = new THREE.OrthographicCamera(-extent, extent, extent, -extent, 0.1, 1000);
        camera.position.set(-65, 65, 85);
        camera.lookAt(0, 10, 0);
        renderer.render(display, camera);
        document.body.replaceChildren(renderer.domElement);
        renderer.domElement.id = "rig-proof";
        renderer.dispose();
        return {
          meshes,
          triangles,
          wheels: rig.wheels.length,
          wheelRadii: rig.wheels.map((wheel) => wheel.radius),
          childrenPerWheel: 2,
          bodyFixed: true,
          centersFixed: true,
          forwardReverseRadius: "verified",
          independentWheel: "verified",
          frontSteeringOnly: "verified",
        };
      },
      { assetUrl },
    );
    assert.equal(result.meshes, geometry.meshObjects);
    assert.equal(result.triangles, geometry.triangles);
    assert.equal(result.wheels, 4);
    await page.locator("#rig-proof").screenshot({ path: resolve(output, `${prefix}rig.png`) });
    results.push({ prefix, ...result });
    await page.close();
  }
  await writeFile(resolve(output, "rig-browser.json"), `${JSON.stringify(results, null, 2)}\n`);
  console.log(JSON.stringify(results));
} finally {
  await browser?.close();
  await server.close();
}
