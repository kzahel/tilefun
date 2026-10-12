// Compare current shared loading with an exact saved pre-change CarMeshAsset.ts.
// Native WebGL2 body + outline pixels, actual authored GLBs, no authority overrides.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const option = (key, fallback) =>
  process.argv.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const root = path.resolve(import.meta.dirname, "../..");
const baseline = option("baseline-source", "");
if (!baseline) throw Error("Required: --baseline-source=/path/to/original/CarMeshAsset.ts");
const output = path.resolve(
  option("output", path.join(os.tmpdir(), "tilefun-vehicle-batch-parity")),
);
const endpoint = option("cdp", ""),
  port = Number(option("port", "0"));
const filter = option("models", "").split(",").filter(Boolean);
const diagnose = option("diagnose-parts", "false") === "true";
const dense = option("dense", "false") === "true";
const probePoints = option("probe-points", "")
  .split(",")
  .filter(Boolean)
  .map((point) => {
    if (!/^\d+:\d+$/.test(point)) throw Error("Probe points must be x:y pairs");
    return point.split(":").map(Number);
  });
if (endpoint && !port) throw Error("Physical CDP requires a dedicated --port");
const source = await readFile(baseline, "utf8");
const referenceId = path.join(root, "src/rendering/CarMeshAsset.reference.ts");
const runtimeId = path.join(root, "src/rendering/VehicleBatchParity.runtime.ts");
await mkdir(output, { recursive: true });
const server = await createServer({
  root,
  base: "/tilefun/",
  configFile: false,
  cacheDir: path.join(output, "vite-cache"),
  logLevel: "error",
  optimizeDeps: {
    entries: [],
    include: [
      "three",
      "three/addons/loaders/GLTFLoader.js",
      "three/addons/utils/BufferGeometryUtils.js",
    ],
  },
  plugins: [
    {
      name: "original-vehicle-loader",
      enforce: "pre",
      resolveId(id) {
        if (id.endsWith("/CarMeshAsset.reference.ts")) return referenceId;
        if (id.endsWith("/VehicleBatchParity.runtime.ts")) return runtimeId;
      },
      load(id) {
        if (id === referenceId) return source;
        if (id === runtimeId)
          return `
          export * as THREE from "three";
          export { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
          export { CarMeshAsset } from "./CarMeshAsset.ts";
          export { CarMeshAsset as Original } from "./CarMeshAsset.reference.ts";
          export { AUTHORED_VEHICLE_MESHES } from "./AuthoredVehicleMeshes.ts";
          export { AUTHORED_TRAIN_MESHES } from "./AuthoredTrainMeshes.ts";
          export { setCarMeshProjection } from "./CarMeshProjection.ts";
          export { poseOrientation } from "./MeshPresentation.ts";
          export { CarPixelOutline } from "./CarPixelOutline.ts";
        `;
      },
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url !== "/tilefun/__vehicle-parity.html") return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            '<!doctype html><html><head><title>Vehicle batching parity</title></head><body><canvas id="parity"></canvas></body></html>',
          );
        });
      },
    },
  ],
  server: { host: "127.0.0.1", port, strictPort: true, hmr: false },
});
let browser, context, page;
const errors = [];
try {
  await server.listen();
  browser = endpoint
    ? await chromium.connectOverCDP(endpoint, { noDefaults: true })
    : await chromium.launch({ channel: "chromium", headless: true });
  context = endpoint ? browser.contexts()[0] : await browser.newContext();
  page = await context.newPage();
  await page.bringToFront();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("THREE."))
      errors.push(message.text());
    if (message.text().startsWith("Parity:")) console.log(message.text());
  });
  await page.goto(
    `http://127.0.0.1:${server.httpServer.address().port}/tilefun/__vehicle-parity.html`,
  );
  const report = await page.evaluate(
    async ({ filter, diagnose, probePoints, dense }) => {
      const {
        THREE,
        GLTFLoader,
        CarMeshAsset,
        Original,
        AUTHORED_VEHICLE_MESHES,
        AUTHORED_TRAIN_MESHES,
        setCarMeshProjection,
        poseOrientation,
        CarPixelOutline,
      } = await import("/tilefun/src/rendering/VehicleBatchParity.runtime.ts");
      const renderer = new THREE.WebGLRenderer({
        canvas: document.querySelector("#parity"),
        alpha: true,
        antialias: false,
        preserveDrawingBuffer: true,
      });
      renderer.autoClear = false;
      renderer.setClearColor(0, 0);
      const target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true });
      target.texture.colorSpace = THREE.SRGBColorSpace;
      target.texture.magFilter = target.texture.minFilter = THREE.NearestFilter;
      target.texture.generateMipmaps = false;
      const outline = new CarPixelOutline(),
        camera = new THREE.Camera(),
        scene = new THREE.Scene(),
        loader = new GLTFLoader();
      const poses = [
        ...Array.from({ length: 8 }, (_, i) => [(i * Math.PI) / 4, 0, 0]),
        ...(dense
          ? Array.from({ length: 72 }, (_, i) => i)
              .filter((i) => i % 9 !== 0)
              .map((i) => [(i * Math.PI) / 36, 0, 0])
          : []),
        [0.23, 0.12, -0.06],
        [1.1, -0.12, 0.06],
        [3.7, 0.09, 0.04],
        [5.4, -0.09, -0.04],
      ];
      const models = [...AUTHORED_VEHICLE_MESHES, ...AUTHORED_TRAIN_MESHES].filter(
        (model) => !filter.length || filter.includes(model.assetId),
      );
      if (!models.length) throw Error("No registered models selected");
      const rows = [];
      let totalPairs = 0,
        totalMismatches = 0;
      try {
        for (const model of models) {
          const beforeScene = (await loader.loadAsync(`/tilefun/${model.path}`)).scene;
          const afterScene = (await loader.loadAsync(`/tilefun/${model.path}`)).scene;
          const names = [];
          if (diagnose)
            for (const graph of [beforeScene, afterScene]) {
              let index = 0;
              const material = new THREE.MeshBasicMaterial({
                vertexColors: true,
                toneMapped: false,
              });
              graph.traverse((node) => {
                if (!node.isMesh) return;
                index++;
                if (graph === beforeScene) names[index] = node.name;
                const color = new THREE.Color().setRGB(index / 255, 0, 0, THREE.SRGBColorSpace);
                const values = node.geometry.getAttribute("position").clone();
                for (let i = 0; i < values.count; i++) values.setXYZ(i, color.r, color.g, color.b);
                node.geometry.setAttribute("color", values);
                material.side = node.material.side;
                node.material = material;
              });
            }
          const before = new Original(beforeScene, model.lateralScale);
          const after = new CarMeshAsset(afterScene, model.lateralScale, {
            batch: "vehicle" in model,
            preserveParts: model.batchPreserveParts,
          });
          if (!before.meshCount || !after.drawMeshCount)
            throw Error(`Empty mesh census: ${model.assetId}`);
          const resolution = Math.min(1024, Math.max(1, Math.ceil(model.radius * 2)));
          target.setSize(resolution, resolution);
          setCarMeshProjection(camera.projectionMatrix, model.radius);
          camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
          const bytes = resolution * resolution * 4;
          const a = new Uint8Array(bytes),
            b = new Uint8Array(bytes),
            c = new Uint8Array(bytes),
            d = new Uint8Array(bytes);
          const draw = (asset, body, ink) => {
            scene.add(asset.object);
            renderer.setRenderTarget(target);
            renderer.clear();
            renderer.render(scene, camera);
            const calls = renderer.info.render.calls;
            renderer.readRenderTargetPixels(target, 0, 0, resolution, resolution, body);
            if (!calls || !body.some((value, index) => index % 4 === 3 && value > 0))
              throw Error(`Empty body render: ${model.assetId}`);
            outline.render(renderer, target);
            renderer.readRenderTargetPixels(outline.target, 0, 0, resolution, resolution, ink);
            scene.remove(asset.object);
            return calls;
          };
          const differences = (left, right) => {
            let pixels = 0,
              maxChannel = 0;
            for (let i = 0; i < left.length; i += 4) {
              let changed = false;
              for (let channel = 0; channel < 4; channel++) {
                const delta = Math.abs(left[i + channel] - right[i + channel]);
                maxChannel = Math.max(maxChannel, delta);
                changed ||= delta !== 0;
              }
              if (changed) pixels++;
            }
            return { pixels, maxChannel };
          };
          const row = {
            assetId: model.assetId,
            path: model.path,
            sourceMeshes: before.meshCount,
            drawMeshes: after.drawMeshCount,
            pairs: 0,
            bodyMismatchedPairs: 0,
            outlineMismatchedPairs: 0,
            maxBodyPixels: 0,
            maxOutlinePixels: 0,
            maxChannel: 0,
            beforeDraws: 0,
            afterDraws: 0,
            failures: [],
          };
          try {
            for (const pose of poses)
              for (const travel of [0, 7, -13, 0])
                for (const [enabled, time] of [
                  [false, 0.4],
                  [true, 0.05],
                  [true, 0.55],
                ]) {
                  for (const asset of [before, after]) {
                    asset.object.quaternion.set(...poseOrientation(...pose));
                    asset.setTravel(travel);
                    asset.setEmergency(enabled, time);
                  }
                  row.beforeDraws += draw(before, a, b);
                  row.afterDraws += draw(after, c, d);
                  if (diagnose && travel === 0 && !enabled && probePoints.length) {
                    row.probePoints ??= [];
                    row.probePoints.push({
                      pose,
                      points: probePoints
                        .filter(([x, y]) => x < resolution && y < resolution)
                        .map(([x, y]) => ({
                          x,
                          y,
                          before: names[a[(y * resolution + x) * 4]],
                          after: names[c[(y * resolution + x) * 4]],
                        })),
                    });
                  }
                  const body = differences(a, c),
                    ink = differences(b, d);
                  row.pairs++;
                  row.bodyMismatchedPairs += Number(body.pixels > 0);
                  row.outlineMismatchedPairs += Number(ink.pixels > 0);
                  row.maxBodyPixels = Math.max(row.maxBodyPixels, body.pixels);
                  row.maxOutlinePixels = Math.max(row.maxOutlinePixels, ink.pixels);
                  row.maxChannel = Math.max(row.maxChannel, body.maxChannel, ink.maxChannel);
                  if (
                    (body.pixels || ink.pixels) &&
                    !row.failures.some((failure) => failure.pose[0] === pose[0])
                  )
                    row.failures.push({
                      pose,
                      travel,
                      enabled,
                      time,
                      body,
                      ink,
                      pixels: Array.from({ length: resolution * resolution }, (_, pixel) => pixel)
                        .filter((pixel) =>
                          [0, 1, 2, 3].some(
                            (channel) => a[pixel * 4 + channel] !== c[pixel * 4 + channel],
                          ),
                        )
                        .slice(0, 8)
                        .map((pixel) => ({
                          x: pixel % resolution,
                          y: Math.floor(pixel / resolution),
                          before: [...a.subarray(pixel * 4, pixel * 4 + 4)],
                          after: [...c.subarray(pixel * 4, pixel * 4 + 4)],
                        })),
                      ...(diagnose
                        ? {
                            parts: Array.from(
                              { length: resolution * resolution },
                              (_, pixel) => pixel,
                            )
                              .filter((pixel) => a[pixel * 4] !== c[pixel * 4])
                              .slice(0, 8)
                              .map((pixel) => ({
                                x: pixel % resolution,
                                y: Math.floor(pixel / resolution),
                                before: names[a[pixel * 4]],
                                after: names[c[pixel * 4]],
                              })),
                          }
                        : {}),
                    });
                }
          } finally {
            before.dispose();
            after.dispose();
          }
          rows.push(row);
          totalPairs += row.pairs;
          totalMismatches += row.bodyMismatchedPairs + row.outlineMismatchedPairs;
          console.log(
            `Parity: ${model.assetId}: ${row.sourceMeshes} -> ${row.drawMeshes} draws, ${row.bodyMismatchedPairs}/${row.outlineMismatchedPairs} body/outline mismatches`,
          );
        }
        return {
          schema: "tilefun-vehicle-batch-parity/v1",
          models: rows.length,
          pairs: totalPairs,
          mismatchedPairs: totalMismatches,
          rows,
        };
      } finally {
        outline.dispose();
        target.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
      }
    },
    { filter, diagnose, probePoints, dense },
  );
  report.physical = !!endpoint;
  report.diagnoseParts = diagnose;
  report.dense = dense;
  report.browser = browser.version();
  report.baselineSHA256 = createHash("sha256").update(source).digest("hex");
  report.sourcesSHA256 = {};
  for (const file of [
    "src/rendering/CarMeshAsset.ts",
    "src/rendering/VehicleGeometryBatches.ts",
    "src/rendering/CarPixelOutline.ts",
    "src/rendering/GpuMeshBodies.ts",
    "src/rendering/AuthoredVehicleMeshes.ts",
  ])
    report.sourcesSHA256[file] = createHash("sha256")
      .update(await readFile(path.join(root, file)))
      .digest("hex");
  for (const row of report.rows)
    row.sha256 = createHash("sha256")
      .update(await readFile(path.join(root, "public", row.path)))
      .digest("hex");
  report.pageErrorCount = errors.length;
  await writeFile(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify({
      models: report.models,
      pairs: report.pairs,
      mismatches: report.mismatchedPairs,
      pageErrors: errors.length,
    }),
  );
  if (report.mismatchedPairs || errors.length)
    throw Error("Native vehicle pixel parity failed; see retained report");
} finally {
  await page?.close();
  if (!endpoint) await context?.close();
  await browser?.close();
  await server.close();
}
