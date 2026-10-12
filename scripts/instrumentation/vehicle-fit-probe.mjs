import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const root = path.resolve(import.meta.dirname, "../..");
const output = path.resolve(process.argv[2] ?? path.join(os.tmpdir(), "tilefun-vehicle-fit"));
await mkdir(output, { recursive: true });
const server = await createServer({
  root,
  base: "/tilefun/",
  configFile: false,
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0, hmr: false },
  plugins: [
    {
      name: "vehicle-fit-page",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url !== "/tilefun/__vehicle-fit") return next();
          res.setHeader("Content-Type", "text/html");
          res.end("<!doctype html><body></body>");
        });
      },
    },
  ],
  optimizeDeps: {
    entries: [],
    include: [
      "three",
      "three/addons/loaders/GLTFLoader.js",
      "three/addons/utils/BufferGeometryUtils.js",
    ],
  },
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({ channel: "chromium", headless: true });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tilefun/__vehicle-fit`);
  const result = await page.evaluate(async () => {
    const THREE = await import("/tilefun/node_modules/three/build/three.module.js");
    const { GLTFLoader } = await import(
      "/tilefun/node_modules/three/examples/jsm/loaders/GLTFLoader.js"
    );
    const { CarMeshAsset } = await import("/tilefun/src/rendering/CarMeshAsset.ts");
    const { AUTHORED_VEHICLE_MESHES, vehicleMeshHeightScale } = await import(
      "/tilefun/src/rendering/AuthoredVehicleMeshes.ts"
    );
    const { setCarMeshProjection } = await import("/tilefun/src/rendering/CarMeshProjection.ts");
    const { vehicleView } = await import("/tilefun/src/traffic/Vehicle.ts");
    const { Direction } = await import("/tilefun/src/entities/Entity.ts");
    const bank = (await import("/tilefun/src/traffic/vehicles-v1.json")).default;
    const source = await new Promise((ok, fail) => {
      const im = new Image();
      im.onload = () => ok(im);
      im.onerror = fail;
      im.src = "/tilefun/assets/tilesets/me-complete.png";
    });
    const c = document.createElement("canvas");
    c.width = source.width;
    c.height = source.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(source, 0, 0);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    const target = new THREE.WebGLRenderTarget(1, 1);
    target.texture.colorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene(),
      camera = new THREE.Camera();
    renderer.setClearColor(0, 0);
    const bounds = (pixels, w, h, cutoff = 220) => {
      let l = w,
        r = -1,
        t = h,
        b = -1;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
          if (pixels[(y * w + x) * 4 + 3] >= cutoff) {
            l = Math.min(l, x);
            r = Math.max(r, x);
            t = Math.min(t, y);
            b = Math.max(b, y);
          }
      return { w: r - l + 1, h: b - t + 1, l, r, t, b };
    };
    const selections = [
      "compact-1",
      "unindexed-sedan-red",
      "bus-1",
      "car-7",
      "car-15",
      "car-24",
      "police-car",
      "ambulance",
      "garbage-truck-green",
      "fire-truck-ladder-1",
    ];
    const gallery = document.createElement("canvas");
    gallery.width = 1024;
    gallery.height = selections.length * 256;
    const g = gallery.getContext("2d");
    g.fillStyle = "#e2e9df";
    g.fillRect(0, 0, gallery.width, gallery.height);
    g.imageSmoothingEnabled = false;
    const rows = [];
    for (const def of AUTHORED_VEHICLE_MESHES) {
      const gltf = await new GLTFLoader().loadAsync(`/tilefun/${def.path}`);
      const asset = new CarMeshAsset(gltf.scene, def.lateralScale, {
        heightScale: vehicleMeshHeightScale(def.vehicle),
        contactShadow: true,
        batch: true,
        preserveParts: def.batchPreserveParts,
      });
      scene.add(asset.object);
      const side = [];
      const fit = vehicleMeshHeightScale(def.vehicle);
      const before = new CarMeshAsset(
        (await new GLTFLoader().loadAsync(`/tilefun/${def.path}`)).scene,
        def.lateralScale,
      );
      const ground = [];
      for (const [dir, yaw] of [
        ["west", 0],
        ["east", Math.PI],
        ["south", Math.PI / 2],
        ["north", -Math.PI / 2],
      ]) {
        const view = bank.views.find((v) => v.vehicleId === def.vehicle && v.direction === dir);
        const [x, y, w, h] = view.rect;
        const native = ctx.getImageData(x, y, w, h);
        const src = bounds(native.data, w, h);
        const n = def.radius * 2;
        target.setSize(n, n);
        setCarMeshProjection(camera.projectionMatrix, def.radius);
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
        asset.object.rotation.z = yaw;
        renderer.setRenderTarget(target);
        renderer.clear();
        renderer.render(scene, camera);
        const bytes = new Uint8Array(n * n * 4);
        renderer.readRenderTargetPixels(target, 0, 0, n, n, bytes);
        const mesh = bounds(bytes, n, n);
        scene.remove(asset.object);
        scene.add(before.object);
        before.object.rotation.z = yaw;
        renderer.clear();
        renderer.render(scene, camera);
        renderer.readRenderTargetPixels(target, 0, 0, n, n, bytes);
        const baseline = bounds(bytes, n, n);
        scene.remove(before.object);
        scene.add(asset.object);
        side.push({ dir, src, baseline, mesh, ratio: mesh.h / src.h });
      }
      for (let yaw = 0; yaw < Math.PI * 2; yaw += Math.PI / 4)
        for (const travel of [0, 7, -13, 0]) {
          asset.object.rotation.z = yaw;
          asset.setTravel(travel);
          asset.object.updateMatrixWorld(true);
          let min = Infinity;
          gltf.scene.traverse((node) => {
            if (!/^Wheel_.+_Roll$/.test(node.name)) return;
            let bottom = Infinity;
            node.traverse((part) => {
              if (!part.isMesh) return;
              const p = part.geometry.attributes.position;
              for (let i = 0; i < p.count; i++)
                bottom = Math.min(
                  bottom,
                  new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(part.matrixWorld).z,
                );
            });
            min = Math.min(min, bottom);
            if (bottom < -0.001 || bottom > 0.15)
              throw Error(`${def.vehicle} wheel ${node.name} floats/intersects ground: ${bottom}`);
          });
          ground.push({ yaw, travel, minZ: min });
        }
      const row = selections.indexOf(def.vehicle);
      if (row >= 0) {
        const view = vehicleView(`vehicle-v1:${def.vehicle}`, Direction.Right);
        const [x, y, w, h] = view.rect;
        const collider = view.metadata.colliders[0];
        const ax = view.metadata.anchor[0] + collider.offsetX;
        const ay = view.metadata.anchor[1] + collider.offsetY - collider.height / 2;
        for (let cell = 0; cell < 4; cell++) {
          const cx = cell * 256 + 128,
            cy = row * 256 + 150;
          g.strokeStyle = "#b4c4b0";
          g.lineWidth = 1;
          for (let offset = -112; offset <= 112; offset += 16) {
            g.beginPath();
            g.moveTo(cx - 112, cy + offset);
            g.lineTo(cx + 112, cy + offset);
            g.stroke();
            g.beginPath();
            g.moveTo(cx + offset, cy - 112);
            g.lineTo(cx + offset, cy + 106);
            g.stroke();
          }
          g.fillStyle = "#20372a";
          g.font = "13px sans-serif";
          g.fillText(
            `${def.vehicle}: ${["sprite", "before", "fitted", "diagonal fitted"][cell]}`,
            cell * 256 + 8,
            row * 256 + 22,
          );
          if (cell === 0) g.drawImage(source, x, y, w, h, cx - ax, cy - ay, w, h);
          else {
            scene.remove(asset.object);
            const body = cell === 1 ? before : asset;
            body.object.rotation.z = cell === 3 ? Math.PI / 4 : 0;
            body.setTravel(0);
            scene.add(body.object);
            const n = def.radius * 2;
            renderer.setRenderTarget(target);
            renderer.clear();
            renderer.render(scene, camera);
            const bytes = new Uint8Array(n * n * 4);
            renderer.readRenderTargetPixels(target, 0, 0, n, n, bytes);
            const tile = document.createElement("canvas");
            tile.width = tile.height = n;
            const tc = tile.getContext("2d");
            const data = tc.createImageData(n, n);
            for (let yy = 0; yy < n; yy++)
              data.data.set(bytes.subarray((n - 1 - yy) * n * 4, (n - yy) * n * 4), yy * n * 4);
            tc.putImageData(data, 0, 0);
            g.drawImage(tile, cx - def.radius, cy - def.radius);
            scene.remove(body.object);
            scene.add(asset.object);
          }
          g.fillStyle = "#bd4235";
          g.fillRect(cx - 2, cy - 2, 4, 4);
        }
      }
      // Test the contact cue itself, not just its geometry/plane coordinates.
      // The game's positive-Y-down projection reverses a plain XY disc's winding.
      asset.object.children[0].visible = false;
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, camera);
      const shadowBytes = new Uint8Array(target.width * target.height * 4);
      renderer.readRenderTargetPixels(target, 0, 0, target.width, target.height, shadowBytes);
      const shadowPixels = shadowBytes.filter(
        (value, index) => index % 4 === 3 && value > 0,
      ).length;
      asset.object.children[0].visible = true;
      if (shadowPixels < 100) throw Error(`Invisible contact shadow: ${def.vehicle}`);
      rows.push({ vehicle: def.vehicle, heightScale: fit, views: side, ground, shadowPixels });
      scene.remove(asset.object);
      asset.dispose();
      before.dispose();
    }
    renderer.dispose();
    target.dispose();
    return { rows, gallery: gallery.toDataURL("image/png").split(",")[1] };
  });
  const report = result.rows;
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await writeFile(path.join(output, "comparison.png"), Buffer.from(result.gallery, "base64"));
  const failures = report.flatMap((r) =>
    r.views
      .slice(0, 2)
      .filter((v) => Math.abs(v.mesh.h - v.src.h) > 1)
      .map((v) => `${r.vehicle}:${v.dir}`),
  );
  if (failures.length) throw Error(`Height mismatch: ${failures.join(",")}`);
  console.log(
    `Qualified ${report.length} own models: native side heights within 1px, all 8 headings / 4 wheel phases grounded.`,
  );
} finally {
  await browser?.close();
  await server.close();
}
