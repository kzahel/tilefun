// Actual Canvas/GPU host composition: static registration and followed actors together.
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
const server = await createServer({
  root,
  configFile: false,
  base: "/tilefun/",
  cacheDir: path.join(temp, "cache"),
  optimizeDeps: { entries: ["renderer-lab.html"] },
  plugins: [react()],
  server: { host: "127.0.0.1", port: 0, hmr: false, watch: null },
  logLevel: "error",
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true, channel: "chromium" });
  const page = await browser.newPage(),
    errors = [];
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tilefun/renderer-lab.html`);
  await page.waitForFunction(() => document.querySelector("#gpu")?.dataset.ready === "true");
  const cases = await page.evaluate(() => window.rendererLab.probeWorldRegistration());
  const failed = cases.filter(
    (r) =>
      r.relativeRange > 0.03 ||
      r.elevationRange > 0.03 ||
      r.actorXRange > 0.03 ||
      r.actorYRange > 0.03 ||
      r.bleed > 1 ||
      r.actorParityError > 2,
  );
  await writeFile(
    path.join(output, "report.json"),
    JSON.stringify({ version: 2, browser: browser.version(), cases, errors }, null, 2),
  );
  console.log(
    JSON.stringify({
      groups: cases.length,
      relativeRangeMax: Math.max(...cases.map((r) => r.relativeRange)),
      elevationRangeMax: Math.max(...cases.map((r) => r.elevationRange)),
      actorXRangeMax: Math.max(...cases.map((r) => r.actorXRange)),
      actorYRangeMax: Math.max(...cases.map((r) => r.actorYRange)),
      actorParityErrorMax: Math.max(...cases.map((r) => r.actorParityError)),
      failed,
      errors,
    }),
  );
  if (cases.length !== 20 || failed.length || errors.length)
    throw Error("World registration qualification failed");
} finally {
  await browser?.close();
  await server.close();
  await rm(temp, { recursive: true, force: true });
}
