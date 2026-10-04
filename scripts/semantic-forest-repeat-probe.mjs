/** Source-only forest phase comparisons; writes disposable evidence, never atlas or review data. */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { transformWithOxc } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(process.argv[2] ?? resolve(tmpdir(), "tilefun-forest-phase"));
const source = await readFile(resolve(root, "public/assets/tilesets/me-complete.png"));
const fingerprint = createHash("sha256").update(source).digest("hex");
if (fingerprint !== "1429a07733836963fc6f1bf703bba59e2e766152bea54a9e936a65089c2d0737")
  throw new Error("Forest source changed; review the probe coordinates before using it.");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chromium", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1632, height: 1100 } });
  await page.setContent(`<style>
    body { background:#e8e6df;color:#233930;font:16px sans-serif;margin:20px }
    h1 { font-size:24px } h2 { font-size:19px;margin:14px 0 8px }
    h3 { font-size:16px;margin:0 0 8px } p { margin:8px 0 18px }
    .row { display:flex;gap:16px } section { width:512px }
    canvas { image-rendering:pixelated;display:block }
  </style>`);
  const review = await transformWithOxc(
    await readFile(resolve(root, "src/art/reviewCanvas.ts"), "utf8"),
    "reviewCanvas.ts",
  );
  await page.addScriptTag({
    type: "module",
    content: `${review.code}\nwindow.reviewContext2D=reviewContext2D;`,
  });
  await page.waitForFunction(() => typeof window.reviewContext2D === "function");
  const measurements = await page.evaluate(
    async (src) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      const specs = [
        { id: "F02", name: "Forest 1", rect: [2512, 1600, 128, 112] },
        { id: "F05", name: "Forest 2 · stump", rect: [2512, 1712, 128, 80] },
        { id: "F08", name: "Forest 3", rect: [2512, 1792, 112, 80] },
      ];
      // Derive the opaque bottom-row modal color, rather than sampling a shadow.
      for (const spec of specs) {
        const [, , width, height] = spec.rect;
        const sample = document.createElement("canvas");
        sample.width = width;
        sample.height = height;
        const ctx = window.reviewContext2D(sample);
        ctx.drawImage(image, ...spec.rect, 0, 0, width, height);
        const pixels = ctx.getImageData(0, height - 1, width, 1).data;
        const counts = new Map();
        for (let x = 0; x < width; x++) {
          const rgba = [...pixels.slice(x * 4, x * 4 + 4)];
          if (rgba[3] !== 255) continue;
          const rgb = rgba.slice(0, 3).join(",");
          counts.set(rgb, (counts.get(rgb) ?? 0) + 1);
        }
        spec.bottomColors = [...counts].sort((a, b) => b[1] - a[1]);
        spec.ground = `rgb(${spec.bottomColors[0][0]})`;
        if (spec.bottomColors[0][0] !== "71,151,87") throw new Error("Ground sample changed.");
      }
      const make = (spec, title, phases, strideY, background = spec.ground) => {
        const [, , width, height] = spec.rect;
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = (phases.length - 1) * strideY + height;
        const ctx = window.reviewContext2D(canvas);
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Complete rows, ordered back to front. Extra copies beyond both edges
        // make the phase change independent of the demonstration's crop boundary.
        phases.forEach((phase, row) => {
          for (let x = -width + phase; x < canvas.width; x += width)
            ctx.drawImage(image, ...spec.rect, x, row * strideY, width, height);
        });
        canvas.style.width = `${canvas.width * 2}px`;
        canvas.style.height = `${canvas.height * 2}px`;
        const section = document.createElement("section");
        const heading = document.createElement("h3");
        heading.textContent = title;
        const detail = document.createElement("p");
        detail.textContent = `Row offsets: ${phases.join(", ")} px · vertical step: ${strideY}px`;
        section.append(heading, canvas, detail);
        return section;
      };
      window.drawGrass = () => {
        document.body.innerHTML =
          "<h1>Forest 2: correcting the preview background</h1><p>Same unchanged source sprites, full 128 × 80px repetition. Only the background fill changes.</p>";
        const row = document.createElement("div");
        row.className = "row";
        row.append(
          make(specs[1], "Previous probe · shadow green #37854e", [0, 0], 80, "#37854e"),
          make(specs[1], "Corrected · ground green #479757", [0, 0], 80),
        );
        document.body.append(row);
      };
      const records = [];
      document.body.innerHTML =
        "<h1>Forest rows: breaking the vertical pattern</h1><p>Unchanged source sprites · matching ground green · rows overlap by drawing back to front · interior crops, without edge caps.</p>";
      for (const spec of specs) {
        const heading = document.createElement("h2");
        heading.textContent = `${spec.name} (${spec.id})`;
        const width = spec.rect[2];
        const choices = [
          ["Aligned rows", [0, 0, 0, 0, 0]],
          ["Alternating half-width", [0, width / 2, 0, width / 2, 0]],
          ["Varied offsets · 16px grid", [0, 48, 16, 96, 32]],
        ];
        const row = document.createElement("div");
        row.className = "row";
        for (const [name, phases] of choices) {
          row.append(make(spec, name, phases, 48));
          records.push({ id: spec.id, name, phases, horizontalStride: width, verticalStride: 48 });
        }
        document.body.append(heading, row);
      }
      return { specs, records };
    },
    `data:image/png;base64,${source.toString("base64")}`,
  );
  await page.screenshot({ path: resolve(output, "phase-comparison.png"), fullPage: true });
  await page.evaluate(() => window.drawGrass());
  await page.setViewportSize({ width: 1080, height: 560 });
  await page.screenshot({ path: resolve(output, "f05-ground-correction.png"), fullPage: true });
  await writeFile(
    resolve(output, "measurements.json"),
    `${JSON.stringify({ fingerprint, ...measurements }, null, 2)}\n`,
  );
  console.log(`Forest phase evidence: ${output}`);
} finally {
  await browser.close();
}
