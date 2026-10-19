/** Own capture driver; unchanged compiled shared viewer and actual GLB. */

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = path.resolve("public"),
  out = path.resolve("public/demos/vehicle-bake/beetle/v1");
const quick = process.argv.includes("--quick");
await fs.mkdir(path.join(out, "engine"), { recursive: true });
const server = http.createServer(async (req, res) => {
  try {
    const p = path.resolve(
      root,
      `.${decodeURIComponent(new URL(req.url, "http://localhost").pathname)}`,
    );
    if (!p.startsWith(root + path.sep)) throw Error("outside");
    const types = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".json": "application/json",
      ".css": "text/css",
      ".glb": "model/gltf-binary",
      ".png": "image/png",
    };
    res.setHeader("Content-Type", types[path.extname(p)] ?? "application/octet-stream");
    res.end(await fs.readFile(p));
  } catch {
    res.statusCode = 404;
    res.end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
let browser;
try {
  browser = await chromium.launch({
    channel: "chromium",
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/demos/vehicle-bake/index.html`);
  await page.waitForFunction(() => window.vehicleBakeReady);
  await page.evaluate(async () =>
    window.vehicleBake.load({
      id: "beetle--v1",
      title: "Cream rounded classic compact",
      glb: "beetle/v1/model.glb",
      atlas: "beetle/v1/atlas.png",
      report: "beetle/v1/report.json",
      method: "Original semantic surface-authored Beetle family",
    }),
  );
  const rig = await page.evaluate(() => window.vehicleBake.auditRig());
  const samples = [];
  for (const mode of quick ? ["study"] : ["study", "engine"])
    for (let i = 0; i < (quick ? 8 : 16); i++) {
      const yaw = i * (quick ? 45 : 22.5);
      const result = await page.evaluate(
        ({ yaw, mode }) => {
          const render = window.vehicleBake.pose(yaw, 0, mode);
          let opaque = 0,
            edge = 0;
          render.pixels.forEach((v, i) => {
            if (i % 4 === 3 && v) {
              opaque++;
              const p = (i - 3) / 4,
                x = p % 128,
                y = Math.floor(p / 128);
              if (x === 0 || x === 127 || y === 0 || y === 127) edge++;
            }
          });
          return {
            png: document.querySelector("#low").toDataURL("image/png").split(",")[1],
            stats: render.stats,
            opaque,
            edge,
          };
        },
        { yaw, mode },
      );
      if (result.edge || result.opaque < 300) throw Error(`Empty/clipped ${mode} ${yaw}`);
      await fs.writeFile(
        path.join(out, "engine", `${mode}-${i}.png`),
        Buffer.from(result.png, "base64"),
      );
      samples.push({ mode, yaw, opaque: result.opaque, edge: result.edge });
    }
  if (!quick) {
    for (let i = 0; i < 8; i++) {
      const png = await page.evaluate((i) => {
        window.vehicleBake.pose(45, (6.782608695652176 * Math.PI * i) / 4, "study");
        return document.querySelector("#low").toDataURL("image/png").split(",")[1];
      }, i);
      await fs.writeFile(path.join(out, "engine", `roll-${i}.png`), Buffer.from(png, "base64"));
    }
    const wire = await page.evaluate(() => {
      window.vehicleBake.pose(45, 0, "study", true);
      return document.querySelector("#low").toDataURL("image/png").split(",")[1];
    });
    await fs.writeFile(path.join(out, "engine/wire.png"), Buffer.from(wire, "base64"));
  }
  const stats = await page.evaluate(() => window.vehicleBake.state.stats);
  const glbSha256 = createHash("sha256")
    .update(await fs.readFile(path.join(out, "model.glb")))
    .digest("hex");
  const receipt = {
    status: "passed",
    glbSha256,
    quick,
    stats,
    rig,
    samples,
    errors,
    rollPhasesDegrees: quick ? [] : [0, 45, 90, 135, 180, 225, 270, 315],
    components: [
      "Unmodified compiled shared viewer.js",
      "CarMeshAsset",
      "CarPixelOutline",
      "VehicleGeometryBatches",
      "setCarMeshProjection",
      "createWheelRig",
    ],
    browser: "bundled full Playwright Chromium / SwiftShader",
  };
  if (errors.length) throw Error(JSON.stringify(errors));
  await fs.writeFile(
    path.join(out, quick ? "quick-capture.json" : "engine/capture.json"),
    `${JSON.stringify(receipt, null, 2)}\n`,
  );
  console.log(JSON.stringify(receipt, null, 2));
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}
