// Ignored diagnostic texture intervention only. Immutable GLB/atlas remain untouched.

import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { build } from "esbuild";
import { createServer } from "vite";

const dir = "data/vehicle-riders/classic-upright-v3";
const out = `${dir}/eye-removal-control`;
await mkdir(out, { recursive: true });
await mkdir(`${dir}/eye-control-view`, { recursive: true });
for (const name of [
  "index.html",
  "rider.json",
  "rider.glb",
  "synthetic-contact-fixture.glb",
  "identity-reference.png",
  "explorer-upright-control.glb",
])
  await copyFile(`${dir}/author-view/${name}`, `${dir}/eye-control-view/${name}`);
let code = await readFile("scripts/vehicle-riders/classic-upright-v3/viewer.mjs", "utf8");
code = code.replace(
  '"./outline.ts"',
  '"../../../scripts/vehicle-riders/classic-upright-v3/outline.ts"',
);
code = code.replace(
  "  window.riderControl = {",
  "  window.identityDiagnostic = {THREE,renderer,source,rider,outline,camera,gameCamera};\n  window.riderControl = {",
);
code = `import {CarPixelOutline} from "../../../src/rendering/CarPixelOutline.ts";\n${code}`;
code = code.replace(
  "window.identityDiagnostic = {THREE,",
  "window.identityDiagnostic = {sharedOutline:new CarPixelOutline(),THREE,",
);
await writeFile(`${dir}/eye-control-viewer.mjs`, code);
await build({
  entryPoints: [`${dir}/eye-control-viewer.mjs`],
  bundle: true,
  format: "iife",
  outfile: `${dir}/eye-control-view/viewer.js`,
});
const pins = JSON.parse(
  await readFile("art-source/vehicle-riders/classic-upright/v1/retained-files.json", "utf8"),
);
const sha = async (p) =>
  createHash("sha256")
    .update(await readFile(p))
    .digest("hex");
for (const [p, h] of Object.entries(pins))
  if ((await sha(p)) !== h) throw Error(`Changed immutable input: ${p}`);
const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  cacheDir: resolve(`${dir}/eye-control-cache`),
  logLevel: "error",
  optimizeDeps: { entries: [] },
  server: { host: "127.0.0.1", port: 0, watch: null },
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({ channel: "chromium", headless: true });
  const page = await browser.newPage();
  await page.goto(
    `http://127.0.0.1:${server.httpServer.address().port}/tilefun/${dir}/eye-control-view/index.html`,
  );
  await page.waitForFunction(() => window.riderReady);
  const evidence = await page.evaluate(() => {
    const d = window.identityDiagnostic,
      { THREE, renderer, source, rider, outline, sharedOutline } = d;
    const meshes = [];
    rider.traverse((o) => {
      if (o.isMesh) meshes.push(o);
    });
    if (meshes.length !== 1) throw Error("Expected immutable single rider mesh");
    const material = meshes[0].material,
      original = material.map;
    const atlas = document.createElement("canvas");
    atlas.width = atlas.height = 256;
    const ctx = atlas.getContext("2d");
    ctx.drawImage(original.image, 0, 0);
    const image = ctx.getImageData(0, 0, 256, 256);
    let changedTexels = 0;
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 256; x++) {
        const front = x < 128 && y >= 18 && y < 40 && [3, 4, 11, 12].includes(Math.floor(x / 8));
        const side = y >= 186 && y < 198 && ((x >= 34 && x < 44) || (x >= 148 && x < 158));
        if (!front && !side) continue;
        const i = (y * 256 + x) * 4;
        if (image.data[i] !== 92 || image.data[i + 1] !== 78 || image.data[i + 2] !== 146)
          throw Error("Eye-only region selected non-eye paint");
        image.data.set([243, 242, 192, 255], i);
        changedTexels++;
      }
    ctx.putImageData(image, 0, 0);
    // Texture.clone shares Source; a fresh Source is essential to preserve baseline.
    const removed = new THREE.CanvasTexture(atlas);
    for (const key of [
      "flipY",
      "colorSpace",
      "magFilter",
      "minFilter",
      "generateMipmaps",
      "wrapS",
      "wrapT",
      "premultiplyAlpha",
      "unpackAlignment",
    ])
      removed[key] = original[key];
    removed.offset.copy(original.offset);
    removed.repeat.copy(original.repeat);
    removed.center.copy(original.center);
    removed.rotation = original.rotation;
    removed.needsUpdate = true;
    const collarCanvas = document.createElement("canvas");
    collarCanvas.width = collarCanvas.height = 256;
    const collarCtx = collarCanvas.getContext("2d");
    collarCtx.drawImage(original.image, 0, 0);
    const collarImage = collarCtx.getImageData(0, 0, 256, 256);
    let collarRemovedTexels = 0;
    for (let i = 0; i < collarImage.data.length; i += 4) {
      const a = collarImage.data;
      if (
        (a[i] === 118 && a[i + 1] === 109 && a[i + 2] === 170) ||
        (a[i] === 234 && a[i + 1] === 225 && a[i + 2] === 120)
      ) {
        a.set([243, 242, 192, 255], i);
        collarRemovedTexels++;
      }
    }
    collarCtx.putImageData(collarImage, 0, 0);
    const collarRemoved = removed.clone();
    collarRemoved.source = new THREE.Source(collarCanvas);
    collarRemoved.needsUpdate = true;
    const read = (target) => {
      const data = new Uint8Array(224 * 224 * 4);
      renderer.readRenderTargetPixels(target, 0, 0, 224, 224, data);
      return data;
    };
    const encode = (data) => {
      const c = document.createElement("canvas");
      c.width = c.height = 224;
      const x = c.getContext("2d"),
        im = x.createImageData(224, 224);
      for (let y = 0; y < 224; y++)
        im.data.set(data.subarray((223 - y) * 224 * 4, (224 - y) * 224 * 4), y * 224 * 4);
      x.putImageData(im, 0, 0);
      return c.toDataURL().split(",")[1];
    };
    const render = (mode, index, texture) => {
      material.map = texture;
      window.riderControl.render(index * 22.5, mode, "rider", false);
      const raw = read(source),
        violet = read(outline.target);
      sharedOutline.render(renderer, source);
      return { raw, violet, shared: read(sharedOutline.target) };
    };
    const rows = [];
    try {
      for (const mode of ["study", "engine"])
        for (let index = 0; index < 16; index++) {
          const baseline = render(mode, index, original),
            control = render(mode, index, removed),
            reset = render(mode, index, original),
            collarControl = render(mode, index, collarRemoved),
            collarReset = render(mode, index, original),
            row = {
              mode,
              index,
              yaw: index * 22.5,
              counts: {},
              pixels: {},
              images: {},
              baselineResetExact: true,
              collarResetExact: true,
              collarRemovalPixels: {},
            };
          for (const kind of ["raw", "violet", "shared"]) {
            const points = [],
              a = baseline[kind],
              b = control[kind];
            if (a.some((v, i) => v !== reset[kind][i]))
              throw Error("Reset did not restore exact baseline");
            if (a.some((v, i) => v !== collarReset[kind][i]))
              throw Error("Collar reset did not restore exact baseline");
            const collarPoints = [];
            for (let i = 0; i < a.length; i += 4) {
              const b = collarControl[kind];
              if (a[i + 3] !== b[i + 3]) throw Error("Collar removal changed geometry occupancy");
              if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2])
                collarPoints.push({
                  pixel: [(i / 4) % 224, 223 - Math.floor(i / 4 / 224)],
                  original: Array.from(a.slice(i, i + 4)),
                  collarRemoved: Array.from(b.slice(i, i + 4)),
                });
            }
            row.collarRemovalPixels[kind] = collarPoints;
            for (let i = 0; i < a.length; i += 4) {
              if (a[i + 3] !== b[i + 3]) throw Error("Eye removal changed silhouette occupancy");
              if (a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2]) continue;
              const x = (i / 4) % 224,
                y = 223 - Math.floor(i / 4 / 224);
              points.push({
                pixel: [x, y],
                original: Array.from(a.slice(i, i + 4)),
                eyeRemoved: Array.from(b.slice(i, i + 4)),
              });
            }
            row.counts[kind] = points.length;
            row.collarColors ??= {};
            row.collarColors[kind] = { n: 0, l: 0 };
            for (let i = 0; i < a.length; i += 4) {
              if (a[i] === 118 && a[i + 1] === 109 && a[i + 2] === 170 && a[i + 3])
                row.collarColors[kind].n++;
              if (a[i] === 234 && a[i + 1] === 225 && a[i + 2] === 120 && a[i + 3])
                row.collarColors[kind].l++;
            }
            row.pixels[kind] = points;
            row.images[`original-${kind}`] = encode(a);
            row.images[`removed-${kind}`] = encode(b);
            row.images[`collar-removed-${kind}`] = encode(collarControl[kind]);
          }
          const outer = [];
          for (let i = 0; i < baseline.raw.length; i += 4) {
            if (
              baseline.raw[i + 3] &&
              (baseline.raw[i] !== baseline.shared[i] ||
                baseline.raw[i + 1] !== baseline.shared[i + 1] ||
                baseline.raw[i + 2] !== baseline.shared[i + 2])
            )
              outer.push([(i / 4) % 224, 223 - Math.floor(i / 4 / 224)]);
          }
          row.sharedOuterStrokeChangedPixels = outer.length;
          row.sharedEyeLostAtSilhouette = row.pixels.raw
            .filter(
              (p) =>
                !row.pixels.shared.some(
                  (q) => q.pixel[0] === p.pixel[0] && q.pixel[1] === p.pixel[1],
                ),
            )
            .map((p) => p.pixel);
          if (index === 4 || index === 0) {
            row.graySurfaceHits = [];
            const cam = mode === "study" ? d.camera : d.gameCamera;
            cam.updateMatrixWorld();
            const ray = new THREE.Raycaster();
            for (let i = 0; i < baseline.raw.length; i += 4) {
              if (
                baseline.raw[i] !== 221 ||
                baseline.raw[i + 1] !== 213 ||
                baseline.raw[i + 2] !== 222
              )
                continue;
              const x = (i / 4) % 224,
                y = 223 - Math.floor(i / 4 / 224);
              const a = new THREE.Vector3((x + 0.5) / 112 - 1, 1 - (y + 0.5) / 112, -1).unproject(
                  cam,
                ),
                b = new THREE.Vector3((x + 0.5) / 112 - 1, 1 - (y + 0.5) / 112, 1).unproject(cam);
              ray.set(a, b.sub(a).normalize());
              const h = ray.intersectObjects(meshes, false)[0];
              if (h) {
                const p = h.object.worldToLocal(h.point.clone());
                row.graySurfaceHits.push({
                  pixel: [x, y],
                  atlas: [Math.floor(h.uv.x * 256), Math.floor(h.uv.y * 256)],
                  source: [p.x, -p.z, p.y],
                  normal: Array.from(h.face.normal),
                });
              }
            }
          }
          rows.push(row);
        }
    } finally {
      material.map = original;
      removed.dispose();
      collarRemoved.dispose();
      sharedOutline.dispose();
    }
    return {
      changedTexels,
      collarRemovedTexels,
      collarOnlyCreamReplacement: true,
      eyeOnlyCreamReplacement: true,
      geometryAndOccupancyUnchanged: true,
      rows,
    };
  });
  for (const row of evidence.rows) {
    for (const [name, png] of Object.entries(row.images))
      await writeFile(`${out}/${row.mode}-${row.index}-${name}.png`, Buffer.from(png, "base64"));
    delete row.images;
  }
  for (const [p, h] of Object.entries(pins))
    if ((await sha(p)) !== h) throw Error(`Changed immutable input: ${p}`);
  await writeFile(
    `${out}/evidence.json`,
    `${JSON.stringify(
      {
        ...evidence,
        status: "passed-eye-only-diagnostic",
        riderSha256: await sha("public/demos/vehicle-riders/classic-upright/v3/rider.glb"),
        atlasSha256: await sha("public/demos/vehicle-riders/classic-upright/v3/atlas.png"),
        CarMeshAssetUsed: false,
        humanVerdictClaimed: false,
        immutablePinsVerified: Object.keys(pins).length,
        sharedOutlineSha256: await sha("src/rendering/CarPixelOutline.ts"),
      },
      null,
      2,
    )}\n`,
  );
  console.log(
    JSON.stringify(
      {
        changedTexels: evidence.changedTexels,
        rows: evidence.rows.map((r) => ({
          mode: r.mode,
          yaw: r.yaw,
          ...r.counts,
          sharedEyesLost: r.sharedEyeLostAtSilhouette.length,
        })),
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  await server.close();
}
