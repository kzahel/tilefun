/** Actual shared GPU backend: own GLBs, lazy loads, fallback and frame isolation. */
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
  cacheDir: resolve(output, "vite-cache"),
  logLevel: "error",
  server: { port: 0, host: "127.0.0.1" },
  optimizeDeps: { entries: [], include: ["three", "three/addons/loaders/GLTFLoader.js"] },
  plugins: [
    {
      name: "engine-vehicle-probe",
      configureServer(s) {
        s.middlewares.use((req, res, next) => {
          if (req.url !== "/tilefun/__engine_vehicles") return next();
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
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const requested = [];
  page.on("request", (r) => {
    if (r.url().endsWith(".glb")) requested.push(r.url());
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tilefun/__engine_vehicles`);
  const report = await page.evaluate(async () => {
    const { GpuRenderBackend } = await import("/tilefun/src/rendering/GpuRenderBackend.ts");
    const { Camera } = await import("/tilefun/src/rendering/Camera.ts");
    const { AUTHORED_VEHICLE_MESHES } = await import(
      "/tilefun/src/rendering/AuthoredVehicleMeshes.ts"
    );
    const { EntityMeshPose } = await import("/tilefun/src/rendering/EntityMeshPose.ts");
    const { createVehicle } = await import("/tilefun/src/traffic/Vehicle.ts");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    document.body.append(canvas);
    const backend = new GpuRenderBackend(canvas);
    const camera = new Camera();
    camera.setViewport(512, 512);
    camera.zoom = 1;
    backend.meshes.setEnabled(true);
    const sleep = () => new Promise((r) => setTimeout(r, 20));
    const rows = [];
    const poses = new EntityMeshPose();
    try {
      for (const [index, definition] of AUTHORED_VEHICLE_MESHES.entries()) {
        const entity = createVehicle(definition.vehicle, 0, 0);
        entity.id = index + 1;
        const before = JSON.stringify(entity);
        const mesh = poses.evaluate(entity, 0);
        if (mesh?.assetId !== definition.assetId || mesh.radius !== definition.radius)
          throw Error("Own-model registration differs");
        const item = { kind: "sprite", wx: 0, wy: 0, zOffset: 0, mesh };
        backend.beginFrame();
        const cold = backend.meshes.draw(camera, item);
        for (
          let attempt = 0;
          attempt < 500 && backend.meshes.assetStates[definition.assetId]?.state !== "ready";
          attempt++
        ) {
          if (backend.meshes.assetStates[definition.assetId]?.state === "failed")
            throw Error(JSON.stringify(backend.meshes.assetStates));
          await sleep();
        }
        if (backend.meshes.assetStates[definition.assetId]?.state !== "ready")
          throw Error("Model never ready");
        backend.beginFrame();
        const warm = backend.meshes.draw(camera, item);
        if (!warm) throw Error("Ready own GLB was not drawn");
        const pixels = new Uint8Array(
          backend.meshes.target.width * backend.meshes.target.height * 4,
        );
        backend.surface.renderer.readRenderTargetPixels(
          backend.meshes.target,
          0,
          0,
          backend.meshes.target.width,
          backend.meshes.target.height,
          pixels,
        );
        const visible = pixels.filter((v, i) => i % 4 === 3 && v > 0).length;
        if (visible < 100) throw Error("Empty engine body render");
        // A preceding draw may not leak its travel/time/light state into another entity.
        mesh.wheelTravel = 13;
        mesh.emergencyEnabled = true;
        mesh.presentationTime = 0.05;
        backend.meshes.draw(camera, item);
        mesh.wheelTravel = 0;
        mesh.emergencyEnabled = false;
        mesh.presentationTime = 0.55;
        backend.meshes.draw(camera, item);
        const restored = new Uint8Array(pixels.length);
        backend.surface.renderer.readRenderTargetPixels(
          backend.meshes.target,
          0,
          0,
          backend.meshes.target.width,
          backend.meshes.target.height,
          restored,
        );
        if (!pixels.every((v, i) => v === restored[i]))
          throw Error("Absolute per-draw reset differs");
        if (JSON.stringify(entity) !== before)
          throw Error("Presentation changed simulation entity");
        backend.meshes.setEnabled(false);
        backend.beginFrame();
        const disabled = backend.meshes.draw(camera, item);
        if (disabled) throw Error("Disabled mesh should use sprite fallback");
        backend.meshes.setEnabled(true);
        rows.push({
          vehicle: definition.vehicle,
          assetId: mesh.assetId,
          coldDraw: cold,
          readyDraw: warm,
          disabledFallback: !disabled,
          visiblePixels: visible,
          absoluteResetExact: true,
          simulationUnchanged: true,
          ...backend.meshes.assetStates[definition.assetId],
        });
      }
      const unknown = backend.meshes.draw(camera, {
        wx: 0,
        wy: 0,
        zOffset: 0,
        mesh: { assetId: "unregistered-model", radius: 64, orientation: [0, 0, 0, 1] },
      });
      if (unknown) throw Error("Unknown model must fall back");
      backend.dispose();
      if (Object.values(backend.meshes.assetStates).some((s) => s.state !== "disposed" || s.meshes))
        throw Error("Model resource survived disposal");
      return { rows, unknownFallback: !unknown, disposed: true };
    } finally {
      backend.dispose();
    }
  });
  assert.deepEqual(errors, []);
  for (const row of report.rows)
    assert(
      requested.some((url) => url.includes(`/assets/models/vehicles/${row.vehicle}-`)),
      row.vehicle,
    );
  await writeFile(
    resolve(output, "engine-vehicles.json"),
    `${JSON.stringify({ ...report, requested }, null, 2)}\n`,
  );
  console.log(JSON.stringify(report));
} finally {
  await browser?.close();
  await server.close();
}
