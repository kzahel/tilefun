/** Self-contained textured GLB inspector, with captured novel views. */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";

const [bundle, runId, inspectionId = "inspection", exportId = "export"] = process.argv.slice(2);
if (
  !bundle ||
  !runId ||
  ![runId, inspectionId, exportId].every((id) => /^[a-zA-Z0-9_-]+$/.test(id))
) {
  throw new Error("Usage: node scripts/spatial-assets/render_export.mjs BUNDLE RUN_ID");
}
const scripts = path.dirname(fileURLToPath(import.meta.url));
const directory = path.resolve(bundle, "runs", runId, exportId);
const bytes = await readFile(path.join(directory, "candidate.glb"));
const record = JSON.parse(await readFile(path.join(directory, "export.json"), "utf8"));
if (createHash("sha256").update(bytes).digest("hex") !== record.sha256)
  throw new Error("Export hash changed");
const output = path.join(directory, inspectionId);
await mkdir(output);
const compiled = await build({
  entryPoints: [path.join(scripts, "mesh_viewer.js")],
  bundle: true,
  write: false,
  format: "iife",
  minify: true,
});
const script =
  "window.meshBase64=" +
  JSON.stringify(bytes.toString("base64")) +
  ";" +
  compiled.outputFiles[0].text;
let html = await readFile(path.join(scripts, "mesh_viewer.html"), "utf8");
for (const [key, value] of Object.entries({
  RUN_ID: runId,
  TRIANGLES: record.triangles.toLocaleString(),
  TEXTURE_SIZE: record.textureSize,
  HASH: record.sha256,
})) {
  html = html.replaceAll(`__${key}__`, String(value));
}
html = html.replace("__BUNDLE__", () => script.replaceAll("</script", "<\\/script"));
await writeFile(path.join(output, "viewer.html"), html);
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 950 } });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.setContent(html);
  await page.waitForFunction(() => window.ready || window.failure, undefined, { timeout: 30000 });
  const failure = await page.evaluate(() => window.failure);
  if (failure) throw new Error(failure);
  for (const name of ["front", "back", "side", "top", "oblique", "opposite"]) {
    await page.evaluate((name) => window.setView(name), name);
    await page.locator("canvas").screenshot({ path: path.join(output, `${name}.png`) });
  }
  await page.locator("#wire").check();
  await page.locator("canvas").screenshot({ path: path.join(output, "wireframe.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#views").selectOption("side");
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
    throw new Error("Mobile overflow");
  if (errors.length) throw new Error(errors.join("\n"));
  await writeFile(
    path.join(output, "inspection.json"),
    `${JSON.stringify(
      {
        run: runId,
        exportSha256: record.sha256,
        renderer:
          "Three.js PBR materials, orthographic cameras, GLB Y up, hemisphere + directional studio lights",
        views: ["front", "back", "side", "top", "oblique", "opposite"],
        validation:
          "Bundled headless Chromium loaded GLB/textures; camera and wireframe controls exercised; mobile width checked; no page errors",
        review: "Unreviewed diagnostic export; novel-view quality requires visual inspection",
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await browser.close();
}
console.log(JSON.stringify({ run: runId, viewer: path.join(output, "viewer.html") }));
