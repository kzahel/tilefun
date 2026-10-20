// Actual ear triangle index removal. No GLB, atlas, geometry attribute or prior source writes.

import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { build } from "esbuild";
import { createServer } from "vite";

const D = "data/vehicle-riders/classic-upright-v3",
  V = `${D}/ear-control-view`,
  O = `${D}/ear-removal-control`;
const sha = async (p) =>
  createHash("sha256")
    .update(await readFile(p))
    .digest("hex");
const map = JSON.parse(await readFile(`${D}/ear-triangle-map.json`, "utf8"));
if ((await sha("public/demos/vehicle-riders/classic-upright/v3/rider.glb")) !== map.modelSha256)
  throw Error("Stale actual ear map");
await mkdir(V, { recursive: true });
await mkdir(O, { recursive: true });
for (const name of [
  "index.html",
  "rider.json",
  "rider.glb",
  "synthetic-contact-fixture.glb",
  "identity-reference.png",
  "explorer-upright-control.glb",
])
  await copyFile(`${D}/author-view/${name}`, `${V}/${name}`);
let code = await readFile("scripts/vehicle-riders/classic-upright-v3/viewer.mjs", "utf8");
code = code.replace(
  '"./outline.ts"',
  '"../../../scripts/vehicle-riders/classic-upright-v3/outline.ts"',
);
code = `import {CarPixelOutline} from "../../../src/rendering/CarPixelOutline.ts";\n${code}`;
code = code.replace(
  "  window.riderControl = {",
  "  window.earDiagnostic={THREE,renderer,source,rider,outline,shared:new CarPixelOutline()};\n  window.riderControl = {",
);
await writeFile(`${D}/ear-control-viewer.mjs`, code);
await build({
  entryPoints: [`${D}/ear-control-viewer.mjs`],
  bundle: true,
  format: "iife",
  outfile: `${V}/viewer.js`,
});
const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  cacheDir: resolve(`${D}/ear-control-cache`),
  logLevel: "error",
  optimizeDeps: { entries: [] },
  server: { host: "127.0.0.1", port: 0, watch: null },
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({ channel: "chromium", headless: true });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tilefun/${V}/index.html`);
  await page.waitForFunction(() => window.riderReady);
  const result = await page.evaluate((map) => {
    const { THREE, renderer, source, rider, outline, shared } = window.earDiagnostic;
    const meshes = [];
    rider.traverse((o) => {
      if (o.isMesh) meshes.push(o);
    });
    if (meshes.length !== 1) throw Error("Actual source must remain one mesh");
    const geometry = meshes[0].geometry,
      saved = geometry.index,
      attributes = Object.fromEntries(Object.entries(geometry.attributes));
    if (saved.count !== map.indexCount) throw Error("Actual index inventory mismatch");
    const indices = {};
    for (const [name, ids] of Object.entries({
      left: map.earTriangleIds.left,
      right: map.earTriangleIds.right,
      both: [...map.earTriangleIds.left, ...map.earTriangleIds.right],
    })) {
      const removed = new Set(ids),
        keep = [];
      for (let i = 0; i < saved.count; i += 3)
        if (!removed.has(i / 3)) keep.push(saved.array[i], saved.array[i + 1], saved.array[i + 2]);
      if (keep.length !== saved.count - ids.length * 3) throw Error("Removed wrong triangle count");
      indices[name] = new THREE.BufferAttribute(new saved.array.constructor(keep), 1);
    }
    const read = (t) => {
      const a = new Uint8Array(224 * 224 * 4);
      renderer.readRenderTargetPixels(t, 0, 0, 224, 224, a);
      return a;
    };
    const encode = (a) => {
      const c = document.createElement("canvas");
      c.width = c.height = 224;
      const x = c.getContext("2d"),
        im = x.createImageData(224, 224);
      for (let y = 0; y < 224; y++)
        im.data.set(a.subarray((223 - y) * 896, (224 - y) * 896), y * 896);
      x.putImageData(im, 0, 0);
      return c.toDataURL().split(",")[1];
    };
    const render = (mode, index, idx) => {
      geometry.setIndex(idx);
      window.riderControl.render(index * 22.5, mode, "rider", false);
      const raw = read(source),
        violet = read(outline.target);
      shared.render(renderer, source);
      return { raw, violet, shared: read(shared.target) };
    };
    const rows = [];
    try {
      for (const mode of ["study", "engine"])
        for (let i = 0; i < 16; i++) {
          const original = render(mode, i, saved),
            row = { mode, index: i, yaw: i * 22.5, removed: {}, images: {} };
          for (const kind of ["raw", "violet", "shared"])
            row.images[`original-${kind}`] = encode(original[kind]);
          for (const name of ["left", "right", "both"]) {
            const removed = render(mode, i, indices[name]),
              reset = render(mode, i, saved),
              detail = {
                alphaLoss: {},
                rgbChanged: {},
                exactReset: true,
                onlyDeclaredEarIndicesRemoved: true,
              };
            for (const kind of ["raw", "violet", "shared"]) {
              const a = original[kind],
                b = removed[kind],
                loss = [];
              let rgb = 0;
              if (a.some((v, j) => v !== reset[kind][j]))
                throw Error("Ear reset differs from exact baseline");
              for (let j = 0; j < a.length; j += 4) {
                if (b[j + 3] && !a[j + 3]) throw Error("Removal added occupied pixels");
                if (a[j + 3] && !b[j + 3])
                  loss.push([(j / 4) % 224, 223 - Math.floor(j / 4 / 224)]);
                if (
                  a[j] !== b[j] ||
                  a[j + 1] !== b[j + 1] ||
                  a[j + 2] !== b[j + 2] ||
                  a[j + 3] !== b[j + 3]
                )
                  rgb++;
              }
              detail.alphaLoss[kind] = loss;
              detail.rgbChanged[kind] = rgb;
              row.images[`${name}-removed-${kind}`] = encode(b);
            }
            row.removed[name] = detail;
          }
          if (Object.entries(attributes).some(([k, v]) => geometry.attributes[k] !== v))
            throw Error("Control changed actual attribute buffers");
          rows.push(row);
        }
    } finally {
      geometry.setIndex(saved);
      shared.dispose();
    }
    return {
      rows,
      attributeBuffersUnchanged: true,
      onlyEarIndicesRemoved: true,
      all32ExactResets: true,
    };
  }, map);
  for (const r of result.rows) {
    for (const [name, png] of Object.entries(r.images))
      await writeFile(`${O}/${r.mode}-${r.index}-${name}.png`, Buffer.from(png, "base64"));
    delete r.images;
  }
  const evidence = {
    status: "passed-actual-ear-removal-controls",
    modelSha256: map.modelSha256,
    earTriangleCount: map.earTriangleCount,
    ...result,
    CarMeshAssetUsed: false,
    sharedOutlineSha256: await sha("src/rendering/CarPixelOutline.ts"),
  };
  await writeFile(`${O}/evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(
    JSON.stringify(
      result.rows
        .filter((r) => [3, 4, 5].includes(r.index))
        .map((r) => ({
          mode: r.mode,
          yaw: r.yaw,
          left: r.removed.left.alphaLoss.raw.length,
          right: r.removed.right.alphaLoss.raw.length,
          both: r.removed.both.alphaLoss.raw.length,
        })),
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  await server.close();
}
