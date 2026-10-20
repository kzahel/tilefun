/** Actual shared viewer: 128/224 centered native crop parity in BOTH cameras. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const base = "data/vehicle-bake/camper-van";
const cfg = JSON.parse(await readFile(`${base}/author-config.json`, "utf8"));
const sha = createHash("sha256")
  .update(await readFile("public/demos/vehicle-bake/camper-van/v1/model.glb"))
  .digest("hex");
const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  cacheDir: resolve(base, "crop-parity-vite-cache"),
  logLevel: "error",
  server: { port: 0, host: "127.0.0.1", watch: null },
  optimizeDeps: { entries: [] },
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({ channel: "chromium", headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1050 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const address = server.httpServer.address();
  await page.goto(`http://127.0.0.1:${address.port}/tilefun/${cfg.output}/index.html`);
  await page.waitForFunction(() => window.familyReviewReady === true);
  const views = [];
  for (const mode of ["study", "engine"]) {
    for (let index = 0; index < 16; index++) {
      const row = await page.evaluate(
        ({ mode, index }) => {
          const api = window.familyReview;
          api.setNativeSize(128);
          const small = api.pose(index * 22.5, 0, mode).pixels;
          api.setNativeSize(224);
          const large = api.pose(index * 22.5, 0, mode).pixels;
          let mismatchedChannels = 0;
          let boundaryMismatchedChannels = 0;
          for (let y = 0; y < 128; y++)
            for (let x = 0; x < 128; x++)
              for (let c = 0; c < 4; c++)
                if (small[(y * 128 + x) * 4 + c] !== large[((y + 48) * 224 + x + 48) * 4 + c])
                  if (x === 0 || y === 0 || x === 127 || y === 127) boundaryMismatchedChannels++;
                  else mismatchedChannels++;
          return {
            mode,
            yaw: index * 22.5,
            comparedPixels: 126 * 126,
            excludedFrameBoundary: 1,
            centeredOffset: [48, 48],
            mismatchedChannels,
            boundaryMismatchedChannels,
            fullFrameMismatchedChannels: mismatchedChannels + boundaryMismatchedChannels,
          };
        },
        { mode, index },
      );
      assert.equal(row.mismatchedChannels, 0, `${mode} ${index} native crop differs`);
      views.push(row);
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(
    `${base}/both-camera-native-parity.json`,
    `${JSON.stringify(
      {
        status: "passed",
        glbSha256: sha,
        browser: "bundled full Chromium",
        browserVersion: browser.version(),
        nativeSizes: [128, 224],
        views,
        fixedDensity: true,
        resizedOrRefitted: false,
        errors,
        meaning:
          "Both cameras/all32 headings retain exact centered126-square interior RGBA crops at unchanged density. Raw128 frame-boundary mismatches are retained separately: tall camper silhouettes can touch the128 frame and change outline neighbor tests there. Native224 is the qualified uncut viewport. No model/camera fitting or rescaling.",
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await browser?.close();
  await server.close();
}
