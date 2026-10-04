import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { chromium } from "playwright";

const root = resolve("public");
const output = resolve(process.argv[2] ?? "data/wildlife-campaign-v2/manual-rabbit-01/browser");
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
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(
    `http://127.0.0.1:${server.address().port}/demos/wildlife-v2/rabbit/pilot-v1/index.html`,
  );
  await page.waitForFunction(() => window.rabbitPilot?.ready === true);
  await page.screenshot({ path: `${output}/page.png` });
  await page.selectOption("#clip", "sequence");
  const samples = [];
  // Sample actual requestAnimationFrame playback for two complete 4s sequences.
  // Every sample includes all four facings. The sequence includes two hop loops,
  // an eight-pose action, and its actual transition back to idle.
  const start = Date.now();
  for (const scale of ["1", "4"]) {
    await page.selectOption("#scale", scale);
    await page.click("#reset");
    await page.locator("#playback").screenshot({ path: `${output}/canvas-${scale}x.png` });
    const scaleStart = Date.now();
    while (Date.now() - scaleStart < 8500) {
      const sample = await page.evaluate(() => ({
        time: performance.now(),
        clip: document.querySelector("#playback").dataset.clip,
        pose: Number(document.querySelector("#playback").dataset.pose),
        image: document.querySelector("#playback").toDataURL("image/png").split(",")[1],
      }));
      const filename = `sample-${String(samples.length).padStart(3, "0")}.png`;
      await writeFile(`${output}/${filename}`, Buffer.from(sample.image, "base64"));
      samples.push({ time: sample.time, clip: sample.clip, pose: sample.pose, filename, scale });
      await page.waitForTimeout(90);
    }
  }
  await page.click("#pause");
  const report = {
    browser: browser.version(),
    executable: executablePath,
    errors,
    durationMs: Date.now() - start,
    samples,
  };
  await writeFile(`${output}/capture.json`, `${JSON.stringify(report, null, 2)}\n`);
  if (errors.length) throw new Error(errors.join("\n"));
  for (const scale of ["1", "4"]) {
    for (const clip of ["hop", "action"]) {
      const poses = new Set(
        samples.filter((s) => s.scale === scale && s.clip === clip).map((s) => s.pose),
      );
      if (poses.size !== (clip === "hop" ? 8 : 6))
        throw new Error(`Missing ${clip} poses at ${scale}x`);
    }
  }
  if (
    !samples.some((sample) => sample.clip === "action") ||
    samples.filter((sample) => sample.clip === "idle").length < 4
  )
    throw new Error("Missing action / idle transition samples");
  console.log(
    `Captured ${samples.length} continuous browser samples; ${report.durationMs} ms; no page errors.`,
  );
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
