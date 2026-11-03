// Isolated renderer controls, not production rendering modes.
// Run: node scripts/instrumentation/camera-registration.mjs --output=/tmp/tilefun-registration

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url)),
  require = createRequire(new URL("../../package.json", import.meta.url));
const output = path.resolve(
  process.argv.find((a) => a.startsWith("--output="))?.slice("--output=".length) ??
    path.join(os.tmpdir(), "tilefun-camera-registration"),
);
await mkdir(output, { recursive: true });
const { chromium } = require("playwright-core");
const { createServer } = await import(require.resolve("vite"));
const { default: react } = await import(require.resolve("@vitejs/plugin-react"));
const temp = await mkdtemp(path.join(os.tmpdir(), "tilefun-214-"));
for (const k of ["WORKSHOP_AUTH_DIR", "WORKSHOP_DATA_DIR", "ART_NOTES_DIR", "INTERIOR_REVIEW_DIR"])
  process.env[k] = path.join(temp, k);
let browser;
const all = [];
try {
  browser = await chromium.launch({ headless: true, channel: "chromium" });
  for (const mode of ["current", "uniform-floor", "world-composite"]) {
    const server = await createServer({
      root,
      configFile: false,
      base: "/tilefun/",
      cacheDir: path.join(temp, mode),
      optimizeDeps: { entries: ["renderer-lab.html"] },
      plugins: [
        react(),
        {
          name: "diagnostic-floor-control",
          enforce: "pre",
          transform(code, id) {
            if (mode === "uniform-floor" && id.endsWith("/rendering/TerrainFrame.ts")) {
              if (
                !code.includes("Math.round(screen.sx)") ||
                !code.includes("Math.round(screen.sy)")
              )
                throw Error("Terrain rounding control needs updating");
              return code
                .replaceAll("Math.round(screen.sx)", "Math.floor(screen.sx)")
                .replaceAll("Math.round(screen.sy)", "Math.floor(screen.sy)");
            }
          },
        },
      ],
      server: { host: "127.0.0.1", port: 0, hmr: false, watch: null },
      logLevel: "error",
    });
    try {
      await server.listen();
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(
        `http://127.0.0.1:${server.httpServer.address().port}/tilefun/renderer-lab.html`,
      );
      await page.waitForFunction(() => document.querySelector("#gpu")?.dataset.ready === "true");
      for (const snap of mode === "current" ? [false, true] : [mode === "world-composite"]) {
        const result = await page.evaluate(
          ({ snap, mode }) => {
            const rows = [],
              native = CanvasRenderingContext2D.prototype.getImageData;
            const source = document.createElement("canvas"),
              out = document.createElement("canvas");
            source.width = out.width = 385;
            source.height = out.height = 289;
            const sc = source.getContext("2d"),
              oc = out.getContext("2d", { willReadFrequently: true });
            if (!sc || !oc) throw Error("Registration probe requires Canvas2D");
            // Colored, separated landmarks in CameraStabilityProbe isolate placement.
            // Intensity centroids retain subpixel coverage; hard pixel bboxes do not.
            const measure = (data, S, phase) => {
              let om = 0,
                ox = 0,
                rm = 0,
                rx = 0,
                omin = Infinity,
                rmin = Infinity;
              const cut = 192.5 + (102 - 128.13) * S - phase;
              const redX = 192.5 + (80 - 128.13) * S - phase,
                redY = 144.5 + (112 - 128.29) * S + phase;
              for (let y = 0; y < 289; y++)
                for (let x = 0; x < 385; x++) {
                  const i = (y * 385 + x) * 4,
                    R = data[i],
                    G = data[i + 1],
                    B = data[i + 2];
                  if (x < cut) {
                    const w = Math.max(0, B - 24);
                    om += w;
                    ox += w * (x + 0.5);
                    if (R > 225 && G > 80 && G < 160 && B > 40) omin = Math.min(omin, x);
                  }
                  if (
                    x > redX - 4 &&
                    x < redX + 7 * S + 4 &&
                    y > redY - 4 &&
                    y < redY + 11 * S + 4
                  ) {
                    const w = Math.max(0, 76 - G);
                    rm += w;
                    rx += w * (x + 0.5);
                    if (R > 200 && G < 35 && B < 25) rmin = Math.min(rmin, x);
                  }
                }
              if (!om || !rm || !Number.isFinite(omin) || !Number.isFinite(rmin))
                throw Error("Registration landmark is missing");
              return {
                propX: ox / om,
                terrainX: rx / rm,
                relativeX: ox / om - rx / rm,
                relativeIntegerX: omin - rmin,
              };
            };
            CanvasRenderingContext2D.prototype.getImageData = function (...args) {
              const image = native.apply(this, args);
              if (args[0] === 0 && args[1] === 0 && args[2] === 385 && args[3] === 289) {
                const i = rows.length,
                  group = Math.floor(i / 7),
                  phase = [0, 0.2, 0.4, 0.6, 0.8, 1.2, 2.4][i % 7],
                  zoom = [0.4, 0.5, 0.8, 1, 1.3][group % 5],
                  S = 3 * zoom,
                  cx = group % 10 < 5 ? -1 : 0;
                let pixels = image.data;
                // This post-readback blit tests stationary composition only. It is not
                // an engine implementation and does not qualify moving actors or GPU cost.
                if (mode === "world-composite") {
                  const base = cx * 256;
                  const dx =
                    Math.round(192.5 - (base + 128.13) * S - phase) -
                    Math.round(192.5 - (base + 128.13) * S);
                  const dy =
                    Math.round(144.5 - (base + 128.29) * S + phase) -
                    Math.round(144.5 - (base + 128.29) * S);
                  sc.putImageData(image, 0, 0);
                  oc.fillStyle = "#184c18";
                  oc.fillRect(0, 0, 385, 289);
                  oc.imageSmoothingEnabled = true;
                  oc.drawImage(source, -phase - dx, phase - dy);
                  pixels = native.call(oc, 0, 0, 385, 289).data;
                }
                rows.push({
                  group,
                  phase,
                  zoom,
                  renderer: group < 10 ? "canvas" : "gpu",
                  cx,
                  ...measure(pixels, S, phase),
                });
              }
              return image;
            };
            let reports;
            try {
              reports = window.rendererLab.probeCameraStability(snap);
            } finally {
              CanvasRenderingContext2D.prototype.getImageData = native;
            }
            if (reports.length !== 20 || rows.length !== 140)
              throw Error("Camera stability fixture changed: update diagnostic sampling");
            const groups = reports.map((report, group) => {
              const r = rows.filter((x) => x.group === group);
              if (
                r.some(
                  (x) =>
                    x.zoom !== report.zoom || x.renderer !== report.renderer || x.cx !== report.cx,
                )
              )
                throw Error("Camera stability fixture ordering changed");
              const v = r.map((x) => x.relativeX),
                b = r.map((x) => x.relativeIntegerX);
              return {
                ...report,
                relativeRange: Math.max(...v) - Math.min(...v),
                relativeIntegerRange: Math.max(...b) - Math.min(...b),
                rows: r,
              };
            });
            return { mode, snap, groups };
          },
          { snap, mode },
        );
        if (errors.length) throw Error(errors.join("\n"));
        all.push(result);
        console.log(
          JSON.stringify({
            mode,
            snap,
            // The upstream probe sees the source image, before the experimental blit.
            sourceIntegerTranslationMismatches: Math.max(...result.groups.map((x) => x.mismatches)),
            maxRelativeRange: Math.max(...result.groups.map((x) => x.relativeRange)),
            maxIntegerRange: Math.max(...result.groups.map((x) => x.relativeIntegerRange)),
            zoom1: result.groups
              .filter((x) => x.zoom === 1)
              .map((x) => ({
                renderer: x.renderer,
                cx: x.cx,
                relativeRange: x.relativeRange,
                integerRange: x.relativeIntegerRange,
              })),
          }),
        );
        await writeFile(
          path.join(output, "report.json"),
          JSON.stringify({ version: 1, browser: browser.version(), cases: all }, null, 2),
        );
      }
      await page.close();
    } finally {
      await server.close();
    }
  }
} finally {
  await browser?.close();
  await rm(temp, { recursive: true, force: true });
}
