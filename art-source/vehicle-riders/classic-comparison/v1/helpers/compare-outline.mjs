/** Read-only Classic source-violet versus unchanged shared vehicle-ink diagnostic.
 * All compilation/captures stay in ignored scratch. No source renderer is edited.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";
import { build } from "esbuild";
import { createServer } from "vite";

const { values } = parseArgs({
  options: { revision: { type: "string", default: "v1" } },
  strict: true,
  allowPositionals: false,
});
const revision = values.revision;
assert.ok(["v1", "v2"].includes(revision), "Unknown revision; use --revision v1|v2 (default v1)");
const d = `data/vehicle-riders/classic-outline-comparison/${revision}`;
const s = `scripts/vehicle-riders/${revision === "v1" ? "classic-upright" : "classic-upright-v2"}`;
const a = `art-source/vehicle-riders/classic-upright/${revision}`;
const o = `public/demos/vehicle-riders/classic-upright/${revision}`;
const importFromScratch = (p) => {
  const path = relative(resolve(d), resolve(p)).replaceAll("\\", "/");
  return path.startsWith(".") ? path : `./${path}`;
};
const sha = (b) => createHash("sha256").update(b).digest("hex");
const inputHashes = {};
async function input(p) {
  const data = await readFile(p);
  inputHashes[p] = sha(data);
  return data;
}
const json = async (p) => JSON.parse((await input(p)).toString("utf8"));
const report = await json(`${a}/report.json`);
assert.ok(
  ["source-pilot-complete", "complete"].includes(report.status),
  `Incomplete ${revision} source report`,
);
assert.equal(report.sourceStage, "complete");
assert.equal(report.sourceImmutable, true);
const expectedTriangles = report.geometry.triangles;
assert.ok(Number.isSafeInteger(expectedTriangles) && expectedTriangles > 0);
if (revision === "v1") assert.equal(expectedTriangles, 1740);
const protectedPins = await json(`${a}/retained-files.json`);
assert.ok(Object.keys(protectedPins).length > 0, "Missing source integrity pins");
for (const [p, h] of Object.entries(protectedPins)) assert.equal(sha(await input(p)), h, p);
const model = await input(`${a}/rider.glb`);
assert.equal(sha(model), report.geometry.sha256);
assert.equal(sha(await input(`${o}/rider.glb`)), sha(model));
const config = await json(`${s}/rider.json`);
assert.equal(config.worldScale, 80 / 4.6);
assert.equal(sha(await input(config.contactProfile.source)), config.contactProfile.sha256);
for (const [p, h] of Object.entries(config.identityInputs)) assert.equal(sha(await input(p)), h);
for (const entry of config.scaleControls) assert.equal(sha(await input(entry.path)), entry.sha256);
const offline = (await input(`${a}/offline.html`)).toString("utf8");
const match = offline.match(/window\.riderOffline=(\{.*?\});<\/script>/s);
assert.ok(match, "Retained exact offline payload missing");
const payload = JSON.parse(match[1]);
assert.deepEqual(payload.config, config);
const embedded = (name) => Buffer.from(payload.assets[name].split(",")[1], "base64");
assert.equal(sha(embedded("rider")), sha(model));
const fixtureRecipe = await json(`${a}/evidence/fixture-recipe.json`);
assert.equal(sha(embedded("fixture")), fixtureRecipe.glbSha256);
const ownOutline = (await input(`${s}/outline.ts`)).toString("utf8");
const commonOutline = (await input("src/rendering/CarPixelOutline.ts")).toString("utf8");
const normalizedOwn = ownOutline
  .replace(/^\/\/ Source-only[^\r\n]*\r?\n/, "")
  .replaceAll("ClassicPixelOutline", "CarPixelOutline")
  .replace("92 / 255, 78 / 255, 146 / 255", "58 / 255, 58 / 255, 80 / 255");
assert.equal(
  normalizedOwn.trim(),
  commonOutline.trim(),
  "Adapters differ beyond class name/comment/ink RGB",
);
await input("src/rendering/CarMeshProjection.ts");
await input("package.json");
await input("package-lock.json");
const referencePNGs = new Map();
for (const mode of ["study", "engine"])
  for (let i = 0; i < 16; i++)
    for (const view of ["rider", "combined", "ruler"])
      referencePNGs.set(
        `${view}-${mode}-${i}`,
        (await input(`${o}/captures/${view}-${mode}-${i}.png`)).toString("base64"),
      );
await mkdir(`${d}/captures`, { recursive: true });
await writeFile(`${d}/exact-fixture.glb`, embedded("fixture"));
await writeFile(`${d}/exact-config.json`, `${JSON.stringify(config, null, 2)}\n`);
let viewer = (await input(`${s}/viewer.mjs`)).toString("utf8");
viewer = viewer.replace(
  'import { ClassicPixelOutline } from "./outline.ts";',
  `import { ClassicPixelOutline } from ${JSON.stringify(importFromScratch(`${s}/outline.ts`))};\nimport { CarPixelOutline } from ${JSON.stringify(importFromScratch("src/rendering/CarPixelOutline.ts"))};`,
);
viewer = viewer.replace(
  'from "../../../src/rendering/CarMeshProjection.ts"',
  `from ${JSON.stringify(importFromScratch("src/rendering/CarMeshProjection.ts"))}`,
);
viewer = viewer.replace(
  "const outline = new ClassicPixelOutline();",
  "const outline = new ClassicPixelOutline();\n  const commonOutline = new CarPixelOutline();",
);
viewer = viewer.replace(
  "  scene.add(car.object);",
  `  scene.add(car.object);
  window.outlineIdentity = { rider, scene, camera, gameCamera, THREE, renderer, source };
  window.comparisonGeometry = () => {
    scene.updateMatrixWorld(true);
    let fingerprint=2166136261, riderTriangles=0;
    const bytes=(array)=>{for(const x of new Uint8Array(array.buffer,array.byteOffset,array.byteLength)){fingerprint^=x;fingerprint=Math.imul(fingerprint,16777619);}};
    scene.traverse(o=>{if(!o.isMesh)return;for(const key of Object.keys(o.geometry.attributes).sort())bytes(o.geometry.attributes[key].array);if(o.geometry.index)bytes(o.geometry.index.array);bytes(new Float64Array(o.matrixWorld.elements));});
    rider.traverse(o=>{if(o.isMesh)riderTriangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
    return {fingerprint:(fingerprint>>>0).toString(16),riderTriangles};
  };`,
);
const marker = "    outline.render(renderer, source);";
assert.equal(viewer.split(marker).length, 2);
viewer = viewer.replace(
  marker,
  `
    const geometryBefore=window.comparisonGeometry();
    const captureStroke=(stroke)=>{
      stroke.render(renderer,source);
      const gpu=new Uint8Array(pixels.length);
      renderer.readRenderTargetPixels(stroke.target,0,0,224,224,gpu);
      const c=document.createElement('canvas');c.width=c.height=224;
      const context=c.getContext('2d');const im=context.createImageData(224,224);
      for(let y=0;y<224;y++)im.data.set(gpu.subarray((223-y)*224*4,(224-y)*224*4),y*224*4);
      context.putImageData(im,0,0);
      return {gpu,png:c.toDataURL().split(',')[1],top:im.data};
    };
    const violet=captureStroke(outline),common=captureStroke(commonOutline),reset=captureStroke(outline);
    const sourceAfter=new Uint8Array(raw.length);renderer.readRenderTargetPixels(source,0,0,224,224,sourceAfter);
    let alphaMismatches=0,maskMismatches=0,rgbChangedPixels=0,rgbChangedChannels=0;
    let sourceVioletPixels=0,sourceVioletChanged=0,sourceVioletToCommonInk=0,commonInkPixels=0;
    let changedAwayFromSilhouette=0,rawAlphaMismatches=0,maximumChannelDelta=0;
    const transitions={},alphaSource=[],alphaCommon=[];
    const occupied=(x,y)=>x>=0&&y>=0&&x<224&&y<224&&raw[(y*224+x)*4+3]>=128;
    for(let i=0;i<raw.length;i+=4){
      const v=violet.gpu.subarray(i,i+4),c=common.gpu.subarray(i,i+4);
      alphaSource.push(v[3]);alphaCommon.push(c[3]);
      if(v[3]!==c[3])alphaMismatches++;
      if(Boolean(v[3])!==Boolean(c[3]))maskMismatches++;
      if(v[3]!==raw[i+3]||c[3]!==raw[i+3])rawAlphaMismatches++;
      const isViolet=v[3]>0&&v[0]===92&&v[1]===78&&v[2]===146;
      const isCommon=c[3]>0&&c[0]===58&&c[1]===58&&c[2]===80;
      if(isViolet)sourceVioletPixels++;if(isCommon)commonInkPixels++;
      const changed=v[0]!==c[0]||v[1]!==c[1]||v[2]!==c[2];
      if(changed){rgbChangedPixels++;if(isViolet)sourceVioletChanged++;if(isViolet&&isCommon)sourceVioletToCommonInk++;
        const x=(i/4)%224,y=Math.floor(i/4/224);
        if(!occupied(x,y)||(occupied(x-1,y)&&occupied(x+1,y)&&occupied(x,y-1)&&occupied(x,y+1)))changedAwayFromSilhouette++;
        const key=[...v.subarray(0,3)].join(',')+' -> '+[...c.subarray(0,3)].join(',');transitions[key]=(transitions[key]??0)+1;
        for(let k=0;k<3;k++){if(v[k]!==c[k])rgbChangedChannels++;maximumChannelDelta=Math.max(maximumChannelDelta,Math.abs(v[k]-c[k]));}
      }
    }
    window.outlineComparisonLast={
      sourceVioletPNG:violet.png,commonVehiclePNG:common.png,sourceTopPixels:violet.top,
      commonTopPixels:common.top,alphaSource,alphaCommon,
      stats:{alphaMismatches,maskMismatches,rawAlphaMismatches,rgbChangedPixels,rgbChangedChannels,
        sourceVioletPixels,sourceVioletChanged,sourceVioletToCommonInk,sourceVioletRetained:sourceVioletPixels-sourceVioletChanged,
        otherSourceRGBChanged:rgbChangedPixels-sourceVioletChanged,commonInkPixels,maximumChannelDelta,changedAwayFromSilhouette,
        transitions,sourceResetExact:reset.gpu.every((x,i)=>x===violet.gpu[i]),
        inputTargetUnchanged:sourceAfter.every((x,i)=>x===raw[i]),geometryBefore,geometryAfter:window.comparisonGeometry()}
    };
    const commonCanvas=document.querySelector('#common-native');
    commonCanvas.getContext('2d').putImageData(new ImageData(common.top,224,224),0,0);
    outline.render(renderer, source);`,
);
viewer = viewer.replace(
  "      outline.dispose();",
  "      outline.dispose();\n      commonOutline.dispose();",
);
await writeFile(`${d}/viewer.mjs`, viewer);
const bundle = await build({
  entryPoints: [`${d}/viewer.mjs`],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  write: false,
  legalComments: "none",
  logLevel: "warning",
});
await writeFile(`${d}/viewer.js`, bundle.outputFiles[0].contents);
let html = (await input(`${s}/index.html`)).toString("utf8");
html = html.replace(
  /<h1>.*?<\/h1>/,
  `<h1>Classic ${revision} outline comparison: SOURCE VIOLET vs COMMON VEHICLE INK</h1><p>Exact same source geometry, atlas, fixture, mount and target. Source violet92/78/146 versus unchanged shared CarPixelOutline58/58/80. This does not establish normal render parity or actual bike fit.</p>`,
);
html = html.replace(
  '<canvas id="native" width="224" height="224"></canvas>',
  '<p>SOURCE VIOLET92/78/146</p><canvas id="native" width="224" height="224"></canvas><p>COMMON VEHICLE INK58/58/80 (unchanged shared pass)</p><canvas id="common-native" width="224" height="224"></canvas>',
);
html = html.replace(
  '<script src="viewer.js"></script>',
  () =>
    `<script>window.riderOffline=${JSON.stringify(payload).replaceAll("<", "\\u003c")};</script><script>${bundle.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script>`,
);
await writeFile(`${d}/index.html`, html);
const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  cacheDir: resolve(d, "vite-cache"),
  logLevel: "error",
  optimizeDeps: { entries: [] },
  server: { host: "127.0.0.1", port: 0, watch: null },
});
await server.listen();
let browser;
const rows = [];
try {
  browser = await chromium.launch({ channel: "chromium", headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
  const errors = [],
    requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/^https?:/.test(r.url()) && !r.url().startsWith("http://127.0.0.1:"))
      requests.push(r.url());
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tilefun/${d}/index.html`);
  await page.waitForFunction(() => window.riderReady === true);
  for (const mode of ["study", "engine"])
    for (let i = 0; i < 16; i++)
      for (const view of ["rider", "combined", "visible-mask", "ruler"]) {
        const ref = view === "visible-mask" ? null : referencePNGs.get(`${view}-${mode}-${i}`);
        const result = await page.evaluate(
          async ({ mode, yaw, view, ref }) => {
            window.riderControl.render(yaw, mode, view, false);
            const c = window.outlineComparisonLast;
            const digest = async (a) =>
              [...new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(a)))]
                .map((v) => v.toString(16).padStart(2, "0"))
                .join("");
            let originalSourceRGBAMismatches = null;
            if (ref) {
              const image = new Image();
              image.src = `data:image/png;base64,${ref}`;
              await image.decode();
              const canvas = document.createElement("canvas");
              canvas.width = canvas.height = 224;
              const ctx = canvas.getContext("2d");
              ctx.drawImage(image, 0, 0);
              originalSourceRGBAMismatches = ctx
                .getImageData(0, 0, 224, 224)
                .data.reduce((n, v, i) => n + Number(v !== c.sourceTopPixels[i]), 0);
            }
            return {
              mode,
              yaw,
              view,
              stats: {
                ...c.stats,
                originalSourceRGBAMismatches,
                sourceAlphaSha256: await digest(c.alphaSource),
                commonAlphaSha256: await digest(c.alphaCommon),
              },
              sourceVioletPNG: c.sourceVioletPNG,
              commonVehiclePNG: c.commonVehiclePNG,
            };
          },
          { mode, yaw: i * 22.5, view, ref },
        );
        const p = result.stats;
        assert.equal(p.alphaMismatches, 0);
        assert.equal(p.maskMismatches, 0);
        assert.equal(p.rawAlphaMismatches, 0);
        assert.equal(p.sourceAlphaSha256, p.commonAlphaSha256);
        assert.equal(p.changedAwayFromSilhouette, 0);
        assert.equal(p.sourceResetExact, true);
        assert.equal(p.inputTargetUnchanged, true);
        assert.deepEqual(p.geometryBefore, p.geometryAfter);
        assert.equal(p.geometryBefore.riderTriangles, expectedTriangles);
        if (ref)
          assert.equal(
            p.originalSourceRGBAMismatches,
            0,
            `${view}/${mode}/${i}: source baseline changed`,
          );
        result.files = {};
        for (const [key, prefix] of [
          ["sourceVioletPNG", "source-violet"],
          ["commonVehiclePNG", "common-vehicle-ink"],
        ]) {
          const filename = `${prefix}-${view}-${mode}-${i}.png`;
          const bytes = Buffer.from(result[key], "base64");
          await writeFile(`${d}/captures/${filename}`, bytes);
          result.files[prefix] = { path: `${d}/captures/${filename}`, sha256: sha(bytes) };
          delete result[key];
        }
        rows.push(result);
      }
  assert.ok(
    rows.filter((r) => r.view === "rider").every((r) => r.stats.rgbChangedPixels > 0),
    "Expected RGB differences absent",
  );
  await page.evaluate(() => window.riderControl.render(90, "engine", "rider", false));
  await page.screenshot({ path: `${d}/desktop.png`, fullPage: true });
  const offlinePage = await browser.newPage();
  const offlineRequests = [];
  offlinePage.on("request", (r) => {
    if (/^https?:/.test(r.url())) offlineRequests.push(r.url());
  });
  offlinePage.on("pageerror", (e) => errors.push(e.message));
  await offlinePage.goto(pathToFileURL(resolve(`${d}/index.html`)).href);
  await offlinePage.waitForFunction(() => window.riderReady === true);
  await offlinePage.evaluate(() => window.riderControl.render(90, "engine", "rider", false));
  assert.deepEqual(offlineRequests, []);
  assert.deepEqual(requests, []);
  assert.deepEqual(errors, []);
  for (const [p, h] of Object.entries(inputHashes)) assert.equal(sha(await readFile(p)), h, p);
  const sum = (key) => rows.filter((r) => r.view === "rider").reduce((n, r) => n + r.stats[key], 0);
  const receipt = {
    status: "complete",
    revision,
    outputDirectory: d,
    sourceDirectory: a,
    sourceScripts: s,
    referenceRGBAFrameCount: referencePNGs.size,
    agentQAOnly: true,
    humanApproval: false,
    riderSha256: sha(model),
    riderTriangles: expectedTriangles,
    fixtureSha256: sha(embedded("fixture")),
    sourceVioletRGB: [92, 78, 146],
    commonVehicleInkRGB: [58, 58, 80],
    outlineAdaptersIdenticalExceptClassCommentAndInk: true,
    sharedCarPixelOutlineUsedUnchanged: true,
    nativeSize: 224,
    radius: 112,
    worldDensity: 80 / 4.6,
    oneSharedRawDepthTargetForBothStrokes: true,
    riderMount: [0, 0, 0],
    projectionGeometryYawMountUnchanged: true,
    rider32: {
      rgbChangedPixels: sum("rgbChangedPixels"),
      sourceVioletPixels: sum("sourceVioletPixels"),
      sourceVioletChanged: sum("sourceVioletChanged"),
      sourceVioletToCommonInk: sum("sourceVioletToCommonInk"),
      sourceVioletRetained: sum("sourceVioletRetained"),
      otherSourceRGBChanged: sum("otherSourceRGBChanged"),
    },
    alphaMasksIdenticalAll128Comparisons: true,
    visibleFixtureOcclusionMask32Identical: true,
    originalSourceVioletRiderCombinedRuler96RGBAPixelExact: true,
    RGBParityClaim: false,
    originalSourceBytesUnchanged: true,
    protectedClassicFiles: Object.keys(protectedPins).length,
    inputHashes,
    bundledFullChromium: browser.version(),
    externalRequests: requests,
    offlineRequests,
    errors,
    rows,
    noActualBike: true,
    CarMeshAssetUsed: false,
    normalQualification: false,
    limitation:
      "Outline color comparison only. Exact source violet baseline is reproduced; common vehicle RGB is deliberately different. No actual bike fit, production identity approval or normal runtime parity is established.",
  };
  await writeFile(`${d}/comparison.json`, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(
    JSON.stringify({
      status: "complete",
      revision,
      riderHeadings: 32,
      strokePairs: rows.length,
      rider32: receipt.rider32,
      alphaMaskMismatches: 0,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
