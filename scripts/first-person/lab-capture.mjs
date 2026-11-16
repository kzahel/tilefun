// World geometry lab in both renderers: an isolated Vite server (no game server
// or private data), bundled Chromium, the Workshop's world geometry lab with and
// without `?view=topdown3d`, after pressing one of the fixture's start buttons.
//
//   node scripts/first-person/lab-capture.mjs [FIXTURE=crossing] [START=trackside] [--out=DIR]
//
// Writes `<fixture>-<start>.png` (fixed view) and `<fixture>-<start>-3d.png`.
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const args = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const [fixture = "crossing", start = "trackside"] = args;
const out = path.resolve(
  process.argv.find((arg) => arg.startsWith("--out="))?.slice(6) ??
    path.join(os.tmpdir(), "tilefun-lab-capture"),
);
await mkdir(out, { recursive: true });
const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  cacheDir: path.join(os.tmpdir(), "tilefun-lab-capture-vite"),
  optimizeDeps: { entries: ["workshop.html"], holdUntilCrawlEnd: true },
  plugins: [react()],
  server: { host: "127.0.0.1", port: 0, hmr: false, watch: null },
  logLevel: "error",
});
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}/tilefun`;
  browser = await chromium.launch({ headless: false, channel: "chromium" });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
  page.on("pageerror", (error) => console.log(`page error: ${error.message}`));
  for (const query of ["", "&view=topdown3d"]) {
    await page.goto(`${origin}/workshop.html?geometry=${fixture}${query}#/tool/world-geometry`);
    await page.waitForSelector("canvas", { timeout: 60_000 });
    await page.waitForTimeout(6000);
    await page.getByRole("button", { name: start, exact: true }).click();
    await page.waitForTimeout(3000);
    const file = path.join(out, `${fixture}-${start.replace(/ /g, "-")}${query ? "-3d" : ""}.png`);
    await page.locator("canvas").first().screenshot({ path: file });
    console.log(file);
  }
} finally {
  await browser?.close().catch(() => {});
  await server.close().catch(() => {});
}
