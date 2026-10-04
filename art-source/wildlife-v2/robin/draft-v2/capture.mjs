import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { chromium } from "playwright";

const root = resolve("public");
const output = resolve("data/wildlife-campaign-v2/background-01-worker/robin-browser-draft-v2");
await mkdir(output, { recursive: true });
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
};
const server = createServer(async (request, response) => {
  const path = resolve(
    root,
    `.${decodeURIComponent(new URL(request.url, "http://localhost").pathname)}`,
  );
  if (!path.startsWith(root + sep)) {
    response.writeHead(403).end();
    return;
  }
  try {
    response.setHeader("Content-Type", mime[extname(path)] ?? "application/octet-stream");
    response.end(await readFile(path));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
let browser;
try {
  const executablePath = resolve(
    "data/wildlife-tools/browsers/chromium-1243/chrome-win64/chrome.exe",
  );
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({
    viewport: { width: 2000, height: 1300 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(
    `http://127.0.0.1:${server.address().port}/demos/wildlife-v2/robin/draft-v2/index.html`,
  );
  await page.waitForFunction(() => window.robinDraft?.ready === true);
  const samples = [];
  const durations = {};
  for (const scale of [1, 4]) {
    await page.selectOption("#scale", String(scale));
    await page.selectOption("#clip", "sequence");
    await page.click("#reset");
    await page.locator("#playback").screenshot({ path: `${output}/scene-${scale}x.png` });
    const start = Date.now();
    while (Date.now() - start < 11200) {
      const sample = await page.evaluate(() => {
        const canvas = document.querySelector("#playback");
        return {
          time: performance.now(),
          clip: canvas.dataset.clip,
          pose: Number(canvas.dataset.pose),
          sequenceIndex: Number(canvas.dataset.sequenceIndex),
          image: canvas.toDataURL("image/png").split(",")[1],
        };
      });
      const filename = `${scale}x-sample-${String(samples.length).padStart(3, "0")}.png`;
      await writeFile(`${output}/${filename}`, Buffer.from(sample.image, "base64"));
      samples.push({ ...sample, image: undefined, filename, scale });
      await page.waitForTimeout(65);
    }
    durations[scale] = Date.now() - start;
  }
  await page.click("#pause");
  const report = { browser: browser.version(), executablePath, errors, durations, samples };
  await writeFile(`${output}/capture.json`, `${JSON.stringify(report, null, 2)}\n`);
  if (errors.length) throw new Error(errors.join("\n"));
  for (const scale of [1, 4]) {
    for (const [clip, count] of [
      ["hop", 8],
      ["flap", 8],
      ["action", 6],
      ["idle", 1],
    ]) {
      const poses = new Set(
        samples.filter((s) => s.scale === scale && s.clip === clip).map((s) => s.pose),
      );
      if (poses.size !== count)
        throw new Error(`Missing ${scale}x ${clip} poses: ${poses.size}/${count}`);
    }
  }
  console.log(
    `CONTINUOUS_ROBIN_CAPTURE_OK ${samples.length} samples ${JSON.stringify(durations)} ms`,
  );
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
