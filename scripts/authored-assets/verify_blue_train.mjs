/** Actual blue carriage assets, shared GPU presentation and production rail motion.
 * Captures stay outside live gameplay. No service/physics/spacing edits.
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const output = resolve(process.argv[2]);
const root = resolve(process.argv[3] ?? ".");
await mkdir(output, { recursive: false });
const server = await createServer({
  root,
  configFile: false,
  base: "/tilefun/",
  logLevel: "error",
  cacheDir: resolve(output, "vite-cache"),
  server: { port: 0, host: "127.0.0.1", watch: null },
  optimizeDeps: { entries: [], include: ["three", "three/addons/loaders/GLTFLoader.js"] },
  plugins: [
    {
      name: "train-probe",
      configureServer(s) {
        s.middlewares.use((req, res, next) => {
          if (req.url !== "/tilefun/__blue_train") return next();
          res.setHeader("Content-Type", "text/html");
          res.end("<!doctype html><body style='margin:0'></body>");
        });
      },
    },
  ],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: "chromium", headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tilefun/__blue_train`);
  const frames = [];
  await page.exposeFunction("retainTrainFrame", async (name, data) => {
    await writeFile(resolve(output, name), Buffer.from(data.split(",")[1], "base64"));
    frames.push(name);
  });
  const report = await page.evaluate(async () => {
    const { THREE, GLTFLoader } = await import(
      "/tilefun/scripts/authored-assets/runtime/glb-imports.mjs"
    );
    const { CarMeshAsset } = await import("/tilefun/src/rendering/CarMeshAsset.ts");
    const { AUTHORED_TRAIN_MESHES } = await import("/tilefun/src/rendering/AuthoredTrainMeshes.ts");
    const { EntityMeshPose } = await import("/tilefun/src/rendering/EntityMeshPose.ts");
    const { GpuRenderBackend } = await import("/tilefun/src/rendering/GpuRenderBackend.ts");
    const { Camera } = await import("/tilefun/src/rendering/Camera.ts");
    const { Spritesheet } = await import("/tilefun/src/assets/Spritesheet.ts");
    const { ScenarioSession } = await import("/tilefun/src/scenarios/ScenarioSession.ts");
    const { curvedTrainRecipe } = await import("/tilefun/src/scenarios/CurvedTrainRecipe.ts");
    const results = [];
    for (const definition of AUTHORED_TRAIN_MESHES) {
      const { scene } = await new GLTFLoader().loadAsync(`/tilefun/${definition.path}`);
      const wheels = [];
      scene.traverse((n) => {
        if (/^Wheel_.+_Roll$/.test(n.name)) wheels.push(n);
      });
      if (wheels.length !== 8) throw Error("Expected eight independent train wheels");
      const moving = new Set();
      for (const w of wheels) w.traverse((n) => moving.add(n));
      const asset = new CarMeshAsset(scene, definition.lateralScale);
      try {
        asset.object.updateMatrixWorld(true);
        const rest = wheels.map((w) => w.quaternion.clone());
        const centers = wheels.map((w) => w.getWorldPosition(new THREE.Vector3()));
        const fixed = [];
        scene.traverse((n) => {
          if (!moving.has(n)) fixed.push([n.name, [...n.matrixWorld.elements]]);
        });
        for (const travel of [12, -12, 0, 7, 0]) {
          asset.setTravel(travel);
          asset.object.updateMatrixWorld(true);
          wheels.forEach((w, i) => {
            const expected = rest[i]
              .clone()
              .multiply(
                new THREE.Quaternion().setFromAxisAngle(
                  new THREE.Vector3(...w.userData.roll_axis_gltf).normalize(),
                  -travel / w.userData.wheel_radius,
                ),
              );
            if (
              w.quaternion.angleTo(expected) > 1e-6 ||
              w.getWorldPosition(new THREE.Vector3()).distanceTo(centers[i]) > 1e-5
            )
              throw Error("Independent wheel radius/reset failed");
            if (!w.parent?.parent?.name.startsWith("Bogie_"))
              throw Error("Wheel disconnected from bogie");
          });
          const after = [];
          scene.traverse((n) => {
            if (!moving.has(n)) after.push([n.name, [...n.matrixWorld.elements]]);
          });
          if (JSON.stringify(fixed) !== JSON.stringify(after))
            throw Error("Wheel roll moved train body/bogie/coupler");
        }
        results.push({
          assetId: definition.assetId,
          wheels: wheels.map((w) => w.name),
          signedRoll: true,
          absoluteReset: true,
          fixedBody: true,
          bogieParents: true,
        });
      } finally {
        asset.dispose();
      }
    }
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 560;
    document.body.append(canvas);
    const backend = new GpuRenderBackend(canvas);
    backend.meshes.setEnabled(true);
    const camera = new Camera();
    camera.setViewport(canvas.width, canvas.height);
    camera.zoom = 1 / 3;
    const image = new Image();
    image.src = "/tilefun/assets/tilesets/railway-review-v1.png";
    await image.decode();
    backend.setAssets(new Map([["railway-review-v1", new Spritesheet(image, 16, 16)]]));
    const poses = new EntityMeshPose(false, true);
    const item = (e, mesh) => ({
      kind: "sprite",
      sortKey: e.position.wy,
      wx: e.position.wx,
      wy: e.position.wy,
      zOffset: e.wz ?? 0,
      sheetKey: e.type,
      frameRow: e.sprite.frameRow,
      frameCol: 0,
      spriteWidth: 192,
      spriteHeight: 192,
      flipX: false,
      drawOffsetY: 96,
      hasShadow: false,
      shadowFeetWy: 0,
      shadowWidth: 0,
      shadowTerrainZ: 0,
      flashHidden: false,
      ...(mesh ? { mesh } : {}),
    });
    const draw = (items) => {
      backend.beginFrame();
      backend.submit(camera, { kind: "clear", color: "#53636b" });
      const order = items.map((_, i) => i).sort((a, b) => items[a].sortKey - items[b].sortKey);
      backend.submit(camera, { kind: "scene", items, order });
      return canvas.toDataURL();
    };
    // Request through the actual draw path; loading uses native train crops.
    const cold = AUTHORED_TRAIN_MESHES.map((d, i) =>
      item(
        {
          type: ["train-curve-proof-v1:rear", "train-curve-proof-v1", "train-curve-proof-v1:front"][
            i
          ],
          position: { wx: i * 160, wy: 0 },
          sprite: { frameRow: 0 },
        },
        { assetId: d.assetId, radius: 112, orientation: [0, 0, 0, 1] },
      ),
    );
    draw(cold);
    for (
      let k = 0;
      k < 500 &&
      AUTHORED_TRAIN_MESHES.some((d) => backend.meshes.assetStates[d.assetId]?.state !== "ready");
      k++
    )
      await new Promise((r) => setTimeout(r, 20));
    if (AUTHORED_TRAIN_MESHES.some((d) => backend.meshes.assetStates[d.assetId]?.state !== "ready"))
      throw Error("Train load failed");
    const motion = [];
    try {
      for (const loop of [true, false]) {
        const session = await ScenarioSession.create(curvedTrainRecipe(loop));
        const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
        const headings = new Set();
        const joins = [];
        let reversal = false,
          reloaded = false;
        let count = 0;
        try {
          const service = () => session.realm.railway.services.get("curved-service");
          let lastMovingSign = 0;
          let reversalTick = -1;
          const movingSigns = new Set();
          let reversalSeen = false;
          for (let tick = 0; tick < 1600; tick++) {
            await session.step(idle, 0.1);
            const s = service();
            const cars = s.carriages;
            const before = JSON.stringify(cars);
            const meshes = cars.map((e) => poses.evaluate(e, (tick + 1) * 0.1));
            if (JSON.stringify(cars) !== before)
              throw Error("Presentation mutated train authority");
            cars.forEach((e) => {
              headings.add(Math.floor(((e.sprite.frameRow + 32) % 256) / 64));
            });
            const angle = ((cars[1].sprite.frameRow ?? 0) * Math.PI) / 128;
            const velocity = cars[1].velocity;
            const along = velocity.vx * Math.cos(angle) + velocity.vy * Math.sin(angle);
            if (Math.abs(along) > 0.1) {
              const sign = Math.sign(along);
              movingSigns.add(sign);
              if (lastMovingSign && sign !== lastMovingSign) {
                reversal = true;
                reversalTick = tick;
              }
              lastMovingSign = sign;
            }
            const middle = cars[1];
            camera.snapTo(middle.position.wx, middle.position.wy - 16);
            for (let i = 0; i < 2; i++) {
              const a = cars[i],
                b = cars[i + 1];
              const angleA = 2 * Math.atan2(meshes[i].orientation[2], meshes[i].orientation[3]);
              const angleB =
                2 * Math.atan2(meshes[i + 1].orientation[2], meshes[i + 1].orientation[3]);
              const halfA = i === 0 ? 68 : 80,
                halfB = 80;
              const dx =
                b.position.wx - Math.cos(angleB) * halfB - a.position.wx - Math.cos(angleA) * halfA;
              const dy =
                b.position.wy - Math.sin(angleB) * halfB - a.position.wy - Math.sin(angleA) * halfA;
              joins.push(Math.hypot(dx, dy));
            }
            const hasCurve = cars.some(
              (e) => e.sprite.frameRow % 64 > 12 && e.sprite.frameRow % 64 < 52,
            );
            if (!reloaded && hasCurve) {
              const record = JSON.stringify(s.record),
                carState = JSON.stringify(
                  cars.map((e) => ({
                    id: e.id,
                    p: e.position,
                    row: e.sprite.frameRow,
                    collider: e.collider,
                  })),
                );
              await session.reload();
              if (
                JSON.stringify(service().record) !== record ||
                JSON.stringify(
                  service().carriages.map((e) => ({
                    id: e.id,
                    p: e.position,
                    row: e.sprite.frameRow,
                    collider: e.collider,
                  })),
                ) !== carState
              )
                throw Error("Native mid-bend reload changed poses");
              poses.clear();
              reloaded = true;
            }
            const capture = tick % 24 === 0 || (reversal && !reversalSeen);
            if (capture && count < 66) {
              const prefix = `${loop ? "loop" : "reversal"}-${String(count++).padStart(3, "0")}`;
              await window.retainTrainFrame(`${prefix}-sprite.png`, draw(cars.map((e) => item(e))));
              await window.retainTrainFrame(
                `${prefix}-mesh.png`,
                draw(cars.map((e, i) => item(e, meshes[i]))),
              );
              reversalSeen ||= reversal;
            }
            if (loop && tick > 900 && headings.size === 4 && reloaded) break;
            if (!loop && reversalSeen && tick > Math.max(900, reversalTick + 48) && reloaded) break;
          }
          if (!reloaded || (loop ? headings.size !== 4 : !reversal))
            throw Error("Missing native motion coverage");
          motion.push({
            scenario: loop ? "loop" : "reversal",
            headings: [...headings],
            reversal,
            movingSigns: [...movingSigns],
            reloaded,
            frames: count,
            minRestCouplerEndpointDistance: Math.min(...joins),
            maxRestCouplerEndpointDistance: Math.max(...joins),
            limits:
              "Static rigid couplers; native spacing is unchanged. Endpoint gaps/overlap need moving-art review.",
          });
        } finally {
          await session.close();
          poses.clear();
        }
      }
      backend.meshes.setEnabled(false);
      backend.beginFrame();
      if (backend.meshes.draw(camera, cold[0])) throw Error("Disabled train failed to fall back");
    } finally {
      backend.dispose();
    }
    if (Object.values(backend.meshes.assetStates).some((s) => s.state !== "disposed"))
      throw Error("Resource disposal failed");
    return {
      wheels: results,
      motion,
      disabledFallback: true,
      disposed: true,
      liveTrainDefault: "native-sprites",
    };
  });
  assert.deepEqual(errors, []);
  await writeFile(
    resolve(output, "train-engine.json"),
    `${JSON.stringify({ ...report, frames }, null, 2)}\n`,
  );
  console.log(JSON.stringify(report));
} finally {
  await browser?.close();
  await server.close();
}
