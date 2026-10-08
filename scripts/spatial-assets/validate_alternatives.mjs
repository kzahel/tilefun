/** Audit actual links/images and saved model/input/output identities for spatial studies. */

import { createHash } from "node:crypto";
import { access, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const [bundleArg, portableArg] = process.argv.slice(2);
if (!bundleArg) throw Error("Usage: node validate_alternatives.mjs BUNDLE [PORTABLE]");
const bundle = path.resolve(bundleArg);
const digest = async (file) =>
  createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
const result = JSON.parse(await readFile(path.join(bundle, "report/results.json"), "utf8"));
if ((await digest(path.join(bundle, "inputs.json"))) !== result.inputManifestSha256)
  throw Error("Frozen manifest changed");
const audit = [];
for (const item of result.extraArtifacts ?? []) {
  if ((await digest(path.resolve(bundle, item.file))) !== item.sha256)
    throw Error("Study evidence bytes changed");
  audit.push(item.file);
}
const manifest = JSON.parse(await readFile(path.join(bundle, "inputs.json"), "utf8"));
for (const input of manifest.inputs) {
  for (const [field, checksum] of [
    ["input", "cropSha256"],
    ["enlarged", "enlargedSha256"],
  ]) {
    if ((await digest(path.join(bundle, input[field]))) !== input[checksum])
      throw Error("Frozen source pixels changed");
    audit.push(input[field]);
  }
}
for (const entry of await readdir(path.join(bundle, "references"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const root = path.join(bundle, "references", entry.name);
  let record;
  try {
    record = JSON.parse(await readFile(path.join(root, "reference.json"), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") continue;
    throw error;
  }
  if (record.inputManifestSha256 !== result.inputManifestSha256)
    throw Error("Reference source identity changed");
  if ((await digest(path.join(bundle, record.file))) !== record.sha256)
    throw Error("Registered cutout changed");
  if (typeof record.implementationSha256 === "string") {
    const implementation = path.join(
      bundle,
      "implementation/by-sha",
      `${record.implementationSha256}.py`,
    );
    if ((await digest(implementation)) !== record.implementationSha256)
      throw Error("Missing exact mask implementation");
  }
  audit.push(record.file);
}
for (const item of result.generations) {
  const root = path.join(bundle, "references", item.id);
  const recordPath = path.join(root, "generation.json");
  if ((await digest(recordPath)) !== item.recordSha256) throw Error("Generation record changed");
  const record = JSON.parse(await readFile(recordPath, "utf8"));
  if (["started", "running"].includes(record.status)) throw Error("Generation incomplete");
  for (const [name, expected] of Object.entries(record.outputs ?? {})) {
    if ((await digest(path.join(root, name))) !== expected)
      throw Error(`Changed image: ${item.id}/${name}`);
    audit.push(`${item.id}/${name}`);
  }
}
for (const item of result.meshes) {
  const root = path.join(bundle, "runs", item.id);
  const recordPath = path.join(root, "run.json");
  if ((await digest(recordPath)) !== item.runRecordSha256) throw Error("Mesh record changed");
  const record = JSON.parse(await readFile(recordPath, "utf8"));
  if (["started", "running"].includes(record.status)) throw Error("Mesh incomplete");
  const implementationHashes =
    typeof record.implementationSha256 === "string"
      ? [record.implementationSha256]
      : Object.values(record.implementationSha256);
  for (const expected of implementationHashes) {
    const implementation = path.join(bundle, "implementation/by-sha", `${expected}.py`);
    if ((await digest(implementation)) !== expected)
      throw Error("Missing exact runner implementation");
  }
  for (const [name, expected] of Object.entries(record.outputSha256 ?? {})) {
    if ((await digest(path.join(root, name))) !== expected)
      throw Error(`Changed mesh: ${item.id}/${name}`);
    audit.push(`${item.id}/${name}`);
  }
  for (const name of ["export", "export-inspection"]) {
    const exportRoot = path.join(root, name);
    let exportRecord;
    try {
      exportRecord = JSON.parse(await readFile(path.join(exportRoot, "export.json"), "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    if ((await digest(path.join(exportRoot, "candidate.glb"))) !== exportRecord.sha256)
      throw Error("Export geometry/material bytes changed");
    audit.push(`${item.id}/${name}/candidate.glb`);
    try {
      const materialsRoot = path.join(exportRoot, "materials");
      const materials = JSON.parse(await readFile(path.join(materialsRoot, "index.json"), "utf8"));
      if (materials.exportSha256 !== exportRecord.sha256) throw Error("Material parent changed");
      for (const [file, expected] of Object.entries(materials.files)) {
        if ((await digest(path.join(materialsRoot, file))) !== expected)
          throw Error("Material data changed");
        audit.push(`${item.id}/${name}/materials/${file}`);
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  try {
    const sheet = JSON.parse(
      await readFile(path.join(bundle, "stage-sheets", item.id, "stages/sheet.json"), "utf8"),
    );
    for (const panel of sheet.panels.filter((panel) => panel.available)) {
      if ((await digest(path.join(bundle, panel.file))) !== panel.sha256)
        throw Error("Stage panel changed");
      audit.push(`${item.id}/stage/${panel.stage}`);
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
for (const [name, expected] of Object.entries(result.sheetSha256)) {
  if ((await digest(path.join(bundle, "report", name))) !== expected) throw Error("Changed sheet");
}
const reportPath = path.join(bundle, "report/index.html");
const pages = [reportPath];
if (portableArg) pages.push(path.resolve(portableArg, "index.html"));
const browser = await chromium.launch({ headless: true });
const errors = [];
const checks = [];
let links = 0;
try {
  const page = await browser.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) =>
    errors.push(`${request.url()}: ${request.failure()?.errorText}`),
  );
  await page.goto(pathToFileURL(reportPath).href);
  const localLinks = await page
    .locator("a[href]")
    .evaluateAll((anchors) => anchors.map((a) => a.href));
  for (const url of localLinks) {
    if (url.startsWith("file:")) {
      await access(fileURLToPath(url));
      links++;
      if (url.endsWith("/stages/index.html")) pages.push(fileURLToPath(url));
    }
  }
  for (const file of [...new Set(pages)]) {
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(pathToFileURL(file).href);
      const check = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        brokenImages: [...document.images].filter((image) => !image.complete || !image.naturalWidth)
          .length,
        images: document.images.length,
      }));
      if (check.overflow || check.brokenImages)
        throw Error(`${file} at ${width}: ${JSON.stringify(check)}`);
      checks.push({ file: path.relative(bundle, file), width, ...check });
      if (width === 1280) {
        for (const url of await page
          .locator("a[href]")
          .evaluateAll((anchors) => anchors.map((a) => a.href))) {
          if (url.startsWith("file:")) {
            await access(fileURLToPath(url));
            links++;
          }
        }
      }
    }
  }
  if (errors.length) throw Error(errors.join("\n"));
} finally {
  await browser.close();
}
const validation = {
  artifactHashes: audit.length,
  links,
  checks,
  errors,
  browser: "Bundled Playwright Chromium; process closed",
  review: "Integrity and UI checks do not establish art quality",
};
await writeFile(
  path.join(bundle, "report/validation.json"),
  `${JSON.stringify(validation, null, 2)}\n`,
);
console.log(
  JSON.stringify({
    artifactHashes: audit.length,
    links,
    viewportChecks: checks.length,
    errors: errors.length,
  }),
);
