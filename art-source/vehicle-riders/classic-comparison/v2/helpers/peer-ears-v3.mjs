/** Independent actual semantic-index ear removal; v3 only, ignored outputs. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const d = "data/vehicle-riders/classic-v3-peer/v3";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const comparison = JSON.parse(await readFile(`${d}/comparison.json`, "utf8"));
const map = JSON.parse(await readFile(`${d}/triangle-owners.json`, "utf8"));
assert.equal(map.riderSha256, comparison.riderSha256);
for (const [p, h] of Object.entries(comparison.inputHashes))
  assert.equal(sha(await readFile(p)), h, p);
const ears = Object.fromEntries(
  ["left", "right"].map((side) => [
    side,
    map.triangles.flatMap((name, i) => (name === `RiderClassic pointed ear ${side}` ? [i] : [])),
  ]),
);
assert.ok(ears.left.length && ears.right.length);
assert.equal(new Set([...ears.left, ...ears.right]).size, ears.left.length + ears.right.length);
await mkdir(`${d}/ear-controls`, { recursive: true });
const browser = await chromium.launch({ channel: "chromium", headless: true });
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
  const result = await page.evaluate((ears) => {
    const { rider, THREE, renderer, source } = window.outlineIdentity;
    const meshes = [];
    rider.traverse((o) => {
      if (o.isMesh) meshes.push(o);
    });
    if (meshes.length !== 1) throw Error("Expected one actual rider mesh");
    const geometry = meshes[0].geometry;
    const saved = geometry.index;
    const attrs = Object.fromEntries(Object.entries(geometry.attributes));
    const beforeAttributes = Object.fromEntries(
      Object.entries(attrs).map(([k, v]) => [k, Array.from(v.array)]),
    );
    const controls = {};
    for (const [name, ids] of Object.entries({ ...ears, both: [...ears.left, ...ears.right] })) {
      const removed = new Set(ids),
        kept = [];
      for (let i = 0; i < saved.count; i += 3)
        if (!removed.has(i / 3)) kept.push(saved.array[i], saved.array[i + 1], saved.array[i + 2]);
      if (kept.length !== saved.count - ids.length * 3) throw Error("Unexpected ear index count");
      controls[name] = new THREE.BufferAttribute(new saved.array.constructor(kept), 1);
    }
    const encode = (pixels) => {
      const c = document.createElement("canvas");
      c.width = c.height = 224;
      c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(pixels), 224, 224), 0, 0);
      return c.toDataURL().split(",")[1];
    };
    function capture(mode, yaw, index) {
      geometry.setIndex(index);
      window.riderControl.render(yaw, mode, "rider", false);
      const gpu = new Uint8Array(224 * 224 * 4),
        raw = new Uint8Array(gpu.length);
      renderer.readRenderTargetPixels(source, 0, 0, 224, 224, gpu);
      for (let y = 0; y < 224; y++)
        raw.set(gpu.subarray((223 - y) * 896, (224 - y) * 896), y * 896);
      const c = window.outlineComparisonLast;
      return {
        raw,
        violet: c.sourceTopPixels.slice(),
        common: c.commonTopPixels.slice(),
        geometry: window.comparisonGeometry(),
      };
    }
    const rows = [];
    try {
      for (const mode of ["study", "engine"])
        for (let i = 0; i < 16; i++) {
          const baseline = capture(mode, i * 22.5, saved);
          const row = { mode, yaw: i * 22.5, removed: {}, pngs: {} };
          for (const [name, index] of Object.entries(controls)) {
            const removed = capture(mode, i * 22.5, index),
              reset = capture(mode, i * 22.5, saved);
            const receipt = {
              alphaLoss: {},
              rgbaChanged: {},
              resetExact: true,
              onlyDeclaredEarIndicesRemoved: true,
            };
            for (const kind of ["raw", "violet", "common"]) {
              const a = baseline[kind],
                b = removed[kind],
                loss = [];
              let changed = 0;
              if (a.some((v, n) => v !== reset[kind][n]))
                throw Error("Ear removal reset changed actual baseline");
              for (let n = 0; n < a.length; n += 4) {
                if (b[n + 3] && !a[n + 3]) throw Error("Ear removal adds occupied pixels");
                if (a[n + 3] && !b[n + 3]) loss.push([(n / 4) % 224, Math.floor(n / 4 / 224)]);
                if ([0, 1, 2, 3].some((k) => a[n + k] !== b[n + k])) changed++;
              }
              receipt.alphaLoss[kind] = loss;
              receipt.rgbaChanged[kind] = changed;
              row.pngs[`${name}-removed-${kind}`] = encode(b);
            }
            if (JSON.stringify(baseline.geometry) !== JSON.stringify(reset.geometry))
              throw Error("Reset geometry differs");
            row.removed[name] = receipt;
          }
          for (const [name, attr] of Object.entries(attrs)) {
            if (
              geometry.attributes[name] !== attr ||
              attr.array.some((v, n) => v !== beforeAttributes[name][n])
            )
              throw Error("Attribute buffer changed");
          }
          rows.push(row);
        }
    } finally {
      geometry.setIndex(saved);
    }
    return {
      rows,
      all32ResetsExact: true,
      attributesPointerAndBytesUnchanged: true,
      onlyDeclaredEarIndicesRemoved: true,
      originalIndexRestored: geometry.index === saved,
    };
  }, ears);
  for (const r of result.rows) {
    const i = Math.round(r.yaw / 22.5);
    for (const [name, data] of Object.entries(r.pngs))
      await writeFile(`${d}/ear-controls/${name}-${r.mode}-${i}.png`, Buffer.from(data, "base64"));
    delete r.pngs;
    for (const control of Object.values(r.removed)) {
      assert.deepEqual(control.alphaLoss.raw, control.alphaLoss.violet);
      assert.deepEqual(control.alphaLoss.raw, control.alphaLoss.common);
    }
    if ([67.5, 90, 112.5].includes(r.yaw))
      for (const side of ["left", "right"]) assert.ok(r.removed[side].alphaLoss.raw.length > 0);
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  for (const [p, h] of Object.entries(comparison.inputHashes))
    assert.equal(sha(await readFile(p)), h, p);
  const receipt = {
    status: "passed-independent-v3-ear-removal",
    humanApproval: false,
    sourceChanged: false,
    glbSha256: comparison.riderSha256,
    nativeSize: 224,
    worldDensity: 80 / 4.6,
    triangleOwnersFromActualMasterAndDecodedGLB: true,
    removedTrianglesPerEar: { left: ears.left.length, right: ears.right.length },
    all32BothStrokeAlphaLossIdentical: true,
    frontAndNearfrontBothEarsSilhouettePositiveBothCameras: true,
    requests,
    errors,
    noActualBikeQualification: true,
    ...result,
  };
  await writeFile(`${d}/ear-control.json`, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(
    JSON.stringify({
      status: receipt.status,
      frontNear: result.rows
        .filter((r) => [67.5, 90, 112.5].includes(r.yaw))
        .map((r) => ({
          mode: r.mode,
          yaw: r.yaw,
          left: r.removed.left.alphaLoss.raw.length,
          right: r.removed.right.alphaLoss.raw.length,
        })),
    }),
  );
} finally {
  await browser.close();
}
