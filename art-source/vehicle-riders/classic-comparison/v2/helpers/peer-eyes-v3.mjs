import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const revision = "v3";
const d = "data/vehicle-riders/classic-v3-peer/v3";
const eyeRects = [
  [24, 18, 40, 40],
  [88, 18, 104, 40],
  [34, 186, 44, 198],
  [148, 186, 158, 198],
];
const expectedEyeTexels = eyeRects.reduce((n, [a, b, c, d]) => n + (c - a) * (d - b), 0);
const ownerMap = JSON.parse(await readFile(`${d}/triangle-owners.json`, "utf8"));

const comparison = JSON.parse(await readFile(`${d}/comparison.json`, "utf8"));
const sha = (b) => createHash("sha256").update(b).digest("hex");
for (const [p, h] of Object.entries(comparison.inputHashes))
  assert.equal(sha(await readFile(p)), h, p);
const browser = await chromium.launch({ channel: "chromium", headless: true });
const rows = [];
try {
  const page = await browser.newPage();
  const errors = [],
    requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/^https?:/.test(r.url())) requests.push(r.url());
  });
  await page.goto(pathToFileURL(resolve(`${d}/index.html`)).href);
  await page.waitForFunction(() => window.riderReady === true);
  for (const mode of ["study", "engine"])
    for (let i = 0; i < 16; i++) {
      const record = await page.evaluate(
        async ({ mode, yaw, eyeRects, triangleOwners }) => {
          const { rider, camera, gameCamera, THREE, renderer, source } = window.outlineIdentity;
          const api = window.riderControl;
          api.render(yaw, mode, "rider", false);
          const mesh = [];
          rider.traverse((o) => {
            if (o.isMesh) mesh.push(o);
          });
          if (mesh.length !== 1) throw Error("Expected exact joined Classic mesh");
          const original = mesh[0].material.map;
          const atlas = document.createElement("canvas");
          atlas.width = atlas.height = 256;
          const context = atlas.getContext("2d");
          context.drawImage(original.image, 0, 0);
          const pixels = context.getImageData(0, 0, 256, 256);
          const beforeAtlas = pixels.data.slice();
          let replaced = 0;
          const boxes = eyeRects;
          for (const [xl, yl, xh, yh] of boxes)
            for (let y = yl; y < yh; y++)
              for (let x = xl; x < xh; x++) {
                const p = (y * 256 + x) * 4;
                if (
                  pixels.data[p] !== 92 ||
                  pixels.data[p + 1] !== 78 ||
                  pixels.data[p + 2] !== 146
                )
                  throw Error("Eye rectangle includes other palette role");
                pixels.data.set([243, 242, 192, 255], p);
                replaced++;
              }
          context.putImageData(pixels, 0, 0);
          const control = new THREE.CanvasTexture(atlas);
          control.colorSpace = original.colorSpace;
          control.flipY = original.flipY;
          control.wrapS = original.wrapS;
          control.wrapT = original.wrapT;
          control.magFilter = control.minFilter = THREE.NearestFilter;
          control.generateMipmaps = false;
          function rawTop() {
            const gpu = new Uint8Array(224 * 224 * 4);
            renderer.readRenderTargetPixels(source, 0, 0, 224, 224, gpu);
            const top = new Uint8Array(gpu.length);
            for (let y = 0; y < 224; y++)
              top.set(gpu.subarray((223 - y) * 896, (224 - y) * 896), y * 896);
            return top;
          }
          function snapshot() {
            const c = window.outlineComparisonLast;
            return {
              raw: rawTop(),
              violet: c.sourceTopPixels.slice(),
              common: c.commonTopPixels.slice(),
              geometry: window.comparisonGeometry(),
              violetPNG: c.sourceVioletPNG,
              commonPNG: c.commonVehiclePNG,
            };
          }
          const baseline = snapshot();
          mesh[0].material.map = control;
          api.render(yaw, mode, "rider", false);
          const removed = snapshot();
          mesh[0].material.map = original;
          api.render(yaw, mode, "rider", false);
          const reset = snapshot();
          control.dispose();
          const occupied = (x, y) =>
            x >= 0 && y >= 0 && x < 224 && y < 224 && baseline.raw[(y * 224 + x) * 4 + 3] > 0;
          const points = { raw: [], violet: [], common: [] };
          const interior = { violet: [], common: [] };
          let alphaMismatch = 0;
          for (let n = 0; n < 224 * 224; n++) {
            const p = n * 4,
              x = n % 224,
              y = Math.floor(n / 224);
            if (baseline.raw[p + 3] !== removed.raw[p + 3]) alphaMismatch++;
            for (const key of ["raw", "violet", "common"])
              if ([0, 1, 2].some((k) => baseline[key][p + k] !== removed[key][p + k])) {
                points[key].push([x, y]);
                if (
                  key !== "raw" &&
                  occupied(x - 1, y) &&
                  occupied(x + 1, y) &&
                  occupied(x, y - 1) &&
                  occupied(x, y + 1)
                )
                  interior[key].push([x, y]);
              }
          }
          const cameraNow = mode === "study" ? camera : gameCamera;
          cameraNow.updateMatrixWorld(true);
          rider.updateMatrixWorld(true);
          const raycaster = new THREE.Raycaster();
          const rayRows = [];
          const sampleCanvas = document.createElement("canvas");
          sampleCanvas.width = sampleCanvas.height = 256;
          const sampleContext = sampleCanvas.getContext("2d");
          sampleContext.drawImage(original.image, 0, 0);
          const sample = sampleContext.getImageData(0, 0, 256, 256).data;
          function hitAt(x, y) {
            const xx = (x + 0.5) / 112 - 1,
              yy = 1 - (y + 0.5) / 112;
            const near = new THREE.Vector3(xx, yy, -1).unproject(cameraNow),
              far = new THREE.Vector3(xx, yy, 1).unproject(cameraNow);
            raycaster.ray.set(near, far.sub(near).normalize());
            const hit = raycaster.intersectObject(rider, true)[0];
            if (!hit) return null;
            const uv = hit.uv.clone().applyMatrix3(original.matrix);
            const tx = Math.max(0, Math.min(255, Math.floor(uv.x * 256))),
              ty = Math.max(0, Math.min(255, Math.floor(uv.y * 256)));
            const a = (ty * 256 + tx) * 4;
            return {
              pixel: [x, y],
              texel: [tx, ty],
              color: [...sample.subarray(a, a + 4)],
              owner: triangleOwners[hit.faceIndex],
              triangle: hit.faceIndex,
              world: [hit.point.x, hit.point.y, hit.point.z],
            };
          }
          for (const point of points.raw) {
            const hit = hitAt(...point);
            if (hit) rayRows.push(hit);
          }
          const classify = ([tx, ty]) =>
            ty < 96
              ? tx < 128
                ? "head-front"
                : "head-back"
              : ty >= 176 && ty < 224 && tx < 192
                ? "head-side"
                : ty >= 112 && ty < 176 && tx >= 128 && tx < 192
                  ? "head-top"
                  : ty >= 112 && ty < 224 && tx >= 192
                    ? "ear"
                    : ty >= 112 && ty < 176 && tx < 96
                      ? "torso-collar"
                      : "constant-role-body";
          const surfacePixels = [];
          for (let y = 0; y < 224; y++)
            for (let x = 0; x < 224; x++)
              if (occupied(x, y)) {
                const hit = hitAt(x, y);
                if (hit)
                  surfacePixels.push({
                    pixel: hit.pixel,
                    texel: hit.texel,
                    color: hit.color,
                    owner: hit.owner,
                    chart: classify(hit.texel),
                  });
              }
          function projectUVPoint(u, v) {
            const geometry = mesh[0].geometry,
              pos = geometry.attributes.position,
              uv = geometry.attributes.uv,
              index = geometry.index;
            for (let t = 0; t < index.count; t += 3) {
              const ids = [0, 1, 2].map((k) => index.getX(t + k));
              const a = ids.map((k) => [uv.getX(k) * 256, uv.getY(k) * 256]);
              const den =
                (a[1][0] - a[0][0]) * (a[2][1] - a[0][1]) -
                (a[2][0] - a[0][0]) * (a[1][1] - a[0][1]);
              if (Math.abs(den) < 1e-9) continue;
              const b =
                ((u - a[0][0]) * (a[2][1] - a[0][1]) - (a[2][0] - a[0][0]) * (v - a[0][1])) / den;
              const c =
                ((a[1][0] - a[0][0]) * (v - a[0][1]) - (u - a[0][0]) * (a[1][1] - a[0][1])) / den;
              if (b < -1e-6 || c < -1e-6 || b + c > 1 + 1e-6) continue;
              const point = new THREE.Vector3();
              [1 - b - c, b, c].forEach((w, k) => {
                point.addScaledVector(new THREE.Vector3().fromBufferAttribute(pos, ids[k]), w);
              });
              point.applyMatrix4(mesh[0].matrixWorld);
              const p = point.clone().project(cameraNow);
              const near = new THREE.Vector3(p.x, p.y, -1).unproject(cameraNow),
                far = new THREE.Vector3(p.x, p.y, 1).unproject(cameraNow);
              raycaster.ray.set(near, far.sub(near).normalize());
              const hit = raycaster.intersectObject(rider, true)[0];
              const texel = hit ? [Math.floor(hit.uv.x * 256), Math.floor(hit.uv.y * 256)] : null;
              return {
                atlasPoint: [u, v],
                projectedPixel: [(p.x + 1) * 112, (1 - p.y) * 112],
                firstHitChart: texel ? classify(texel) : null,
                firstHitTexel: texel,
                distanceFromTargetToFirstHitWorld: hit ? hit.point.distanceTo(point) : null,
                targetIsFirstVisibleSurface: hit ? hit.point.distanceTo(point) < 1e-4 : false,
              };
            }
            return null;
          }
          function projectFeature(rect) {
            const geometry = mesh[0].geometry,
              pos = geometry.attributes.position,
              uv = geometry.attributes.uv,
              index = geometry.index;
            const projected = [];
            for (let t = 0; t < index.count; t += 3) {
              let poly = [0, 1, 2].map((k) => {
                const v = index.getX(t + k);
                return {
                  u: uv.getX(v) * 256,
                  v: uv.getY(v) * 256,
                  p: new THREE.Vector3().fromBufferAttribute(pos, v),
                };
              });
              for (const [axis, bound, greater] of [
                ["u", rect[0], true],
                ["u", rect[2], false],
                ["v", rect[1], true],
                ["v", rect[3], false],
              ]) {
                const out = [];
                if (!poly.length) break;
                let prev = poly[poly.length - 1];
                for (const curr of poly) {
                  const pa = greater ? prev[axis] >= bound : prev[axis] <= bound,
                    ca = greater ? curr[axis] >= bound : curr[axis] <= bound;
                  if (pa !== ca) {
                    const w = (bound - prev[axis]) / (curr[axis] - prev[axis]);
                    out.push({
                      u: prev.u + (curr.u - prev.u) * w,
                      v: prev.v + (curr.v - prev.v) * w,
                      p: prev.p.clone().lerp(curr.p, w),
                    });
                  }
                  if (ca) out.push(curr);
                  prev = curr;
                }
                poly = out;
              }
              for (const v of poly) {
                const p = v.p.clone().applyMatrix4(mesh[0].matrixWorld).project(cameraNow);
                projected.push([(p.x + 1) * 112, (1 - p.y) * 112]);
              }
            }
            if (!projected.length) return null;
            const bounds = [
              Math.min(...projected.map((p) => p[0])),
              Math.min(...projected.map((p) => p[1])),
              Math.max(...projected.map((p) => p[0])),
              Math.max(...projected.map((p) => p[1])),
            ];
            return {
              atlasRect: rect,
              projectedBounds: bounds,
              widthPixels: bounds[2] - bounds[0],
              heightPixels: bounds[3] - bounds[1],
              includesOccludedTriangles: true,
            };
          }
          const features = {
            frontEyeLeft: projectFeature(boxes[0]),
            frontEyeRight: projectFeature(boxes[1]),
            sideEyeLeft: projectFeature(boxes[2]),
            sideEyeRight: projectFeature(boxes[3]),
            wholeFrontFaceChart: projectFeature([1, 1, 126, 94]),
            torsoCollar: projectFeature([3, 113, 93, 148]),
          };
          const collarLandmarks = [
            projectUVPoint(24.5, 130.5),
            projectUVPoint(48.5, 140.5),
            projectUVPoint(72.5, 130.5),
          ];
          const unchangedGeometry =
            JSON.stringify(baseline.geometry) === JSON.stringify(removed.geometry) &&
            JSON.stringify(baseline.geometry) === JSON.stringify(reset.geometry);
          const resetExact = ["raw", "violet", "common"].every((k) =>
            baseline[k].every((v, n) => v === reset[k][n]),
          );
          const atlasRestored = sample.every((v, n) => v === beforeAtlas[n]);
          const rawCanvas = document.createElement("canvas");
          rawCanvas.width = rawCanvas.height = 224;
          const rawContext = rawCanvas.getContext("2d");
          rawContext.putImageData(
            new ImageData(new Uint8ClampedArray(baseline.raw), 224, 224),
            0,
            0,
          );
          return {
            mode,
            yaw,
            eyeTexelsRemoved: replaced,
            rawEyePixels: points.raw.length,
            sourceOutlineEyeSurvival: points.violet.length,
            commonOutlineEyeSurvival: points.common.length,
            sourceInteriorEyeSurvival: interior.violet.length,
            commonInteriorEyeSurvival: interior.common.length,
            pixelCoordinates: points,
            interiorPixelCoordinates: interior,
            eyeHitUVs: rayRows,
            projectedFeatureBounds: features,
            surfacePixels,
            collarLandmarks,
            alphaMismatch,
            unchangedGeometry,
            resetExact,
            atlasRestored,
            fixtureHidden: true,
            pngs: {
              "eyes-removed-source-violet": removed.violetPNG,
              "eyes-removed-common-ink": removed.commonPNG,
              "raw-unoutlined": rawCanvas.toDataURL().split(",")[1],
            },
          };
        },
        { mode, yaw: i * 22.5, eyeRects, triangleOwners: ownerMap.triangles },
      );
      assert.equal(record.eyeTexelsRemoved, expectedEyeTexels);
      assert.equal(record.alphaMismatch, 0);
      assert.ok(record.unchangedGeometry && record.resetExact && record.atlasRestored);
      for (const [name, b64] of Object.entries(record.pngs))
        await writeFile(`${d}/captures/${name}-${mode}-${i}.png`, Buffer.from(b64, "base64"));
      delete record.pngs;
      rows.push(record);
    }
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  for (const [p, h] of Object.entries(comparison.inputHashes))
    assert.equal(sha(await readFile(p)), h, p);
  const receipt = {
    status: "complete-agent-diagnostic",
    humanApproval: false,
    sourceChanged: false,
    noActualBike: true,
    riderSha256: comparison.riderSha256,
    outlineComparisonSeparate: "comparison.json",
    all32NativeEyeRemovalControls: true,
    sourceAtlasTexelsChangedOnlyInIgnoredRuntimeCopy: expectedEyeTexels,
    originalAtlasAndGeometryRestoredExactAll32: true,
    revision,
    eyeAtlasRects: eyeRects,
    paletteReplacement: { from: [92, 78, 146, 255], to: [243, 242, 192, 255] },
    rows,
  };
  await writeFile(`${d}/identity-eye-control.json`, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(
    JSON.stringify({
      status: "complete-agent-diagnostic",
      nativeHeadings: 32,
      front: rows
        .filter((r) => r.yaw === 90)
        .map(
          ({
            mode,
            rawEyePixels,
            sourceInteriorEyeSurvival,
            commonInteriorEyeSurvival,
            projectedFeatureBounds,
          }) => ({
            mode,
            rawEyePixels,
            sourceInteriorEyeSurvival,
            commonInteriorEyeSurvival,
            projectedFeatureBounds,
          }),
        ),
    }),
  );
} finally {
  await browser.close();
}
