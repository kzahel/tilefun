import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { chromium } from "playwright";

const root = resolve("public");
const batch = JSON.parse(await readFile("art-source/wildlife-v2/pet-batch.json", "utf8"));
const output = resolve("data/wildlife-pets-084/browser");
await mkdir(output, { recursive: true });
const server = createServer(async (request, response) => {
  const path = resolve(
    root,
    `.${decodeURIComponent(new URL(request.url, "http://localhost").pathname)}`,
  );
  if (!path.startsWith(root + sep)) return response.writeHead(403).end();
  try {
    response.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".json": "application/json",
        ".png": "image/png",
      }[extname(path)] ?? "application/octet-stream",
    );
    response.end(await readFile(path));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
let browser;
try {
  browser = await chromium.launch({ channel: "chromium", headless: true });
  const results = [];
  const pages = await Promise.all(
    batch.pets.map(async (pet) => {
      const page = await browser.newPage({ viewport: { width: 2800, height: 1400 } });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("response", (r) => {
        if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
      });
      await page.goto(
        `http://127.0.0.1:${server.address().port}/demos/wildlife-v2/${pet.id}/${batch.revision}/index.html`,
      );
      await page.waitForFunction(() => window.petDraft?.ready);
      const metadata = JSON.parse(
        await readFile(`public/demos/wildlife-v2/${pet.id}/${batch.revision}/sprite.json`, "utf8"),
      );
      return { page, pet, errors, metadata };
    }),
  );
  for (const scale of [1, 4]) {
    for (const { page } of pages) {
      await page.selectOption("#scale", String(scale));
      await page.selectOption("#clip", "sequence");
      await page.click("#reset");
    }
    const start = Date.now();
    const samples = new Map(pages.map(({ pet }) => [pet.id, new Map()]));
    while (Date.now() - start < 11000) {
      await Promise.all(
        pages.map(async ({ page, pet }) => {
          const sample = await page.evaluate(() => {
            const c = document.querySelector("#sprites");
            const scene = document.querySelector("#playback");
            return {
              clip: scene.dataset.clip,
              pose: Number(scene.dataset.pose),
              png: c.toDataURL().split(",")[1],
            };
          });
          samples.get(pet.id).set(`${sample.clip}-${sample.pose}`, sample);
        }),
      );
      await new Promise((done) => setTimeout(done, 25));
    }
    for (const { page, pet, errors, metadata } of pages) {
      const seen = samples.get(pet.id);
      assert.deepEqual(errors, []);
      assert.equal(
        seen.size,
        Object.values(metadata.clips).reduce((n, c) => n + c.count, 0),
      );
      for (const [key, sample] of seen)
        await writeFile(
          `${output}/${pet.id}-${scale}x-${key}.png`,
          Buffer.from(sample.png, "base64"),
        );
      await page.evaluate(() => window.petDraft.inspect("idle", 0));
      await page
        .locator("#playback")
        .screenshot({ path: `${output}/${pet.id}-scene-${scale}x.png` });
      // Verify the player's real crop for every chronological pose and all four
      // directions against the exported source; it cannot hide frames offscreen.
      for (const [name, clip] of Object.entries(metadata.clips)) {
        for (let pose = 0; pose < clip.count; pose++) {
          await page.evaluate(([name, pose]) => window.petDraft.inspect(name, pose), [name, pose]);
          const matches = await page.evaluate(
            async ({ name, pose, clip, size }) => {
              const sheet = new Image();
              sheet.src = "sheet.png";
              await sheet.decode();
              const expected = document.createElement("canvas");
              expected.width = size * 4;
              expected.height = size;
              const ctx = expected.getContext("2d");
              ctx.fillStyle = "#879b82";
              ctx.fillRect(0, 0, expected.width, expected.height);
              for (let row = 0; row < 4; row++)
                ctx.drawImage(
                  sheet,
                  (clip.start + pose) * size,
                  row * size,
                  size,
                  size,
                  row * size,
                  0,
                  size,
                  size,
                );
              return (
                document.querySelector("#playback").dataset.clip === name &&
                document.querySelector("#sprites").toDataURL() === expected.toDataURL()
              );
            },
            { name, pose, clip, size: metadata.frameWidth },
          );
          assert.equal(matches, true, `${pet.id} ${name} ${pose}`);
        }
      }
      await page.selectOption("#clip", "walk");
      await page.check("#travel");
      await page.click("#reset");
      await page.waitForTimeout(400);
      await page
        .locator("#playback")
        .screenshot({ path: `${output}/${pet.id}-travel-${scale}x.png` });
      results.push({
        pet: pet.id,
        scale,
        chronologicalPoses: seen.size,
        exactCropChecks: seen.size * 4,
        errors,
      });
    }
  }
  await writeFile(
    `${output}/capture.json`,
    `${JSON.stringify({ browser: browser.version(), results }, null, 2)}\n`,
  );
  console.log(JSON.stringify({ pets: pages.length, results }));
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
