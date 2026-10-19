/** Actual exported meshes through shared engine components, using isolated full Chromium. */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const draft = process.argv.includes("--draft");
const only = process.argv
  .find((arg) => arg.startsWith("--only="))
  ?.slice(7)
  .split(",");
const output = resolve(
  draft ? "data/vehicle-bake/draft-capture" : "public/demos/vehicle-bake/captures",
);
await mkdir(output, { recursive: true });
const manifest = JSON.parse(await readFile("public/demos/vehicle-bake/manifest.json", "utf8"));
const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  cacheDir: resolve("data/vehicle-bake/capture-cache"),
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
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  const address = server.httpServer.address();
  await page.goto(`http://127.0.0.1:${address.port}/tilefun/demos/vehicle-bake/index.html`);
  await page.waitForFunction(() => window.vehicleBakeReady === true);
  const rows = [];
  for (const candidate of manifest.candidates) {
    if (only && !only.includes(candidate.id)) continue;
    const folder = resolve(output, candidate.id);
    await mkdir(folder, { recursive: true });
    const stats = await page.evaluate(async (id) => {
      const api = window.vehicleBake;
      await api.load(api.manifest.candidates.find((c) => c.id === id));
      return api.state.stats;
    }, candidate.id);
    assert.equal(
      stats.triangles,
      candidate.audit.triangles,
      `${candidate.id}: browser/GLB triangle count`,
    );
    const rig = await page.evaluate(() => window.vehicleBake.auditRig());
    const views = [];
    for (const mode of ["study", "engine"]) {
      for (let index = 0; index < 16; index++) {
        const result = await page.evaluate(
          ({ yaw, mode }) => {
            const api = window.vehicleBake;
            const rendered = api.pose(yaw, 0, mode);
            let opaque = 0,
              edge = 0;
            for (let i = 3; i < rendered.pixels.length; i += 4) {
              if (rendered.pixels[i]) {
                opaque++;
                const p = (i - 3) / 4,
                  x = p % 128,
                  y = Math.floor(p / 128);
                if (x === 0 || x === 127 || y === 0 || y === 127) edge++;
              }
            }
            return {
              png: document.querySelector("#low").toDataURL("image/png").split(",")[1],
              stats: rendered.stats,
              opaque,
              edge,
            };
          },
          { yaw: index * 22.5, mode },
        );
        assert.ok(result.opaque > 300, `${candidate.id}: empty ${mode} ${index}`);
        assert.equal(result.edge, 0, `${candidate.id}: clipping ${mode} ${index}`);
        await writeFile(resolve(folder, `${mode}-${index}.png`), Buffer.from(result.png, "base64"));
        views.push({ mode, yaw: index * 22.5, opaque: result.opaque, edgePixels: result.edge });
      }
    }
    for (let index = 0; index < 8; index++) {
      const png = await page.evaluate((index) => {
        const api = window.vehicleBake;
        const radius =
          api.state.asset.object.getObjectByName("Wheel_FL_Roll").userData.wheel_radius;
        api.pose(45, (radius * Math.PI * index) / 4, "study");
        return document.querySelector("#low").toDataURL("image/png").split(",")[1];
      }, index);
      await writeFile(resolve(folder, `roll-${index}.png`), Buffer.from(png, "base64"));
    }
    const wire = await page.evaluate(() => {
      window.vehicleBake.pose(45, 0, "study", true);
      return document.querySelector("#low").toDataURL("image/png").split(",")[1];
    });
    await writeFile(resolve(folder, "wire.png"), Buffer.from(wire, "base64"));
    await page.evaluate(() => window.vehicleBake.pose(45, 0, "study", false));
    const receipt = {
      id: candidate.id,
      glbSha256: candidate.audit.sha256,
      stats,
      rig,
      views,
      engineComponents: [
        "CarMeshAsset",
        "VehicleGeometryBatches",
        "CarPixelOutline",
        "setCarMeshProjection",
      ],
      registration: "Inspection only; no production registry mutation",
      errors: [],
    };
    await writeFile(resolve(folder, "capture.json"), `${JSON.stringify(receipt, null, 2)}\n`);
    rows.push({ id: candidate.id, stats, rig });
  }
  await page.evaluate(async () => {
    const api = window.vehicleBake;
    await api.load(api.manifest.candidates.find((c) => c.id === api.manifest.recommended));
    api.pose(45, 0, "study", false);
  });
  await page.screenshot({ path: resolve(output, "desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: resolve(output, "mobile.png"), fullPage: true });
  assert.deepEqual(errors, []);
  await writeFile(
    resolve(output, "result.json"),
    `${JSON.stringify({ status: "passed", candidates: rows, errors }, null, 2)}\n`,
  );
  console.log(
    JSON.stringify(
      { status: "passed", output, candidates: rows.map((r) => ({ id: r.id, ...r.stats })) },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  await server.close();
}
