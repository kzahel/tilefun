import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const studyMode = args[0] === "--study";
const [bundle, batchId, reportId = "report", meshId, portable] = studyMode ? args.slice(1) : args;
if (!bundle || ![batchId, reportId].every((id) => /^[a-zA-Z0-9_-]+$/.test(id))) {
  throw Error(
    "Usage: node validate_report.mjs BUNDLE BATCH [REPORT], or --study BUNDLE STUDY REPORT MESHES [PORTABLE]",
  );
}
const batchDir = path.resolve(bundle, studyMode ? "conditioning-studies" : "batches", batchId);
if (studyMode && !/^[a-zA-Z0-9_-]+$/.test(meshId ?? "")) throw Error("Mesh execution ID required");
const batch = JSON.parse(
  await readFile(
    path.join(batchDir, studyMode ? `${meshId}/execution.json` : "batch.json"),
    "utf8",
  ),
);
const pages = [
  path.join(batchDir, reportId, "index.html"),
  ...(studyMode ? batch.cases : batch.assets).map((asset) =>
    path.resolve(bundle, "stage-sheets", asset.run, "stages", "index.html"),
  ),
];
if (studyMode && portable) pages.push(path.resolve(portable, "index.html"));
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
  for (const file of pages) {
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(pathToFileURL(file).href);
      const result = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        brokenImages: [...document.images].filter((image) => !image.complete || !image.naturalWidth)
          .length,
        imageCount: document.images.length,
      }));
      if (result.overflow || result.brokenImages)
        throw Error(`${file} at ${width}: ${JSON.stringify(result)}`);
      checks.push({ file: path.relative(bundle, file), width, ...result });
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
await writeFile(
  path.join(batchDir, reportId, "browser-validation.json"),
  `${JSON.stringify({ browser: "Bundled headless Playwright Chromium", checks, links, errors }, null, 2)}\n`,
  { flag: "wx" },
);
console.log(
  JSON.stringify({
    pages: pages.length,
    viewportChecks: checks.length,
    links,
    errors: errors.length,
  }),
);
