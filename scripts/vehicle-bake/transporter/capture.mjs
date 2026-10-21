import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const output = resolve(process.argv[process.argv.indexOf("--output") + 1]);
await mkdir(output, { recursive: true });
const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  cacheDir: "node_modules/.vite-transporter-capture",
  logLevel: "error",
  optimizeDeps: { entries: ["scripts/vehicle-bake/transporter/Capture.ts"] },
  server: { host: "127.0.0.1", port: 0, watch: null },
  plugins: [
    {
      name: "capture",
      configureServer(s) {
        s.middlewares.use((req, res, next) => {
          if (req.url?.split("?")[0] === "/tilefun/carrier-capture") {
            res.setHeader("Content-Type", "text/html");
            res.end("<!doctype html><title>Car transporter capture</title>");
          } else next();
        });
      },
    },
  ],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: "chromium", headless: true });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tilefun/carrier-capture`);
  const result = await page.evaluate(async () =>
    (await import("/tilefun/scripts/vehicle-bake/transporter/Capture.ts")).captureTransporter(),
  );
  for (const key of ["sheet", "normal"])
    await writeFile(
      resolve(output, `${key}.png`),
      Buffer.from(result[key].split(",")[1], "base64"),
    );
  for (const [i, data] of result.views.entries())
    await writeFile(resolve(output, `view-${i}.png`), Buffer.from(data.split(",")[1], "base64"));
  const sha = async (p) =>
    createHash("sha256")
      .update(await readFile(p))
      .digest("hex");
  await writeFile(
    resolve(output, "capture.json"),
    `${JSON.stringify(
      {
        bounds: result.bounds,
        meshes: result.meshes,
        draws: result.draws,
        modelSha256: await sha("public/assets/models/vehicles/car-transporter-v2.glb"),
        sheetSha256: await sha(resolve(output, "sheet.png")),
        normalSha256: await sha(resolve(output, "normal.png")),
      },
      null,
      2,
    )}\n`,
  );
  console.log(
    JSON.stringify({ output, bounds: result.bounds, meshes: result.meshes, draws: result.draws }),
  );
} finally {
  await browser?.close();
  await server.close();
}
