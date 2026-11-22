// A unified room of the seed-2026 dense district: an isolated Vite
// server, bundled Chromium and a fresh regional world arriving at a lot's
// entrance; E enters it, then the unified scene is captured (plus `--query`).
//
//   node scripts/first-person/room-capture.mjs [--kind=apartment|shop] [--query=a=b] [--out=DIR]
//     [--sequence] (also frames while entering, then after walking north)
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const option = (name, fallback) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const kind = option("kind", "apartment");
const query = option("query", "");
const out = path.resolve(option("out", path.join(os.tmpdir(), "tilefun-room-capture")));
await mkdir(out, { recursive: true });
const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  cacheDir: path.join(os.tmpdir(), "tilefun-room-capture-vite"),
  optimizeDeps: { entries: ["index.html", "tools.html"], holdUntilCrawlEnd: true },
  plugins: [react()],
  server: { host: "127.0.0.1", port: 0, hmr: false, watch: null },
  logLevel: "error",
});
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}/tilefun`;
  browser = await chromium.launch({ headless: false, channel: "chromium" });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("pageerror", (error) => console.log(`page error: ${error.message}`));
  await page.goto(`${origin}/tools.html`);
  const { generation, arrival } = await page.evaluate(async (wanted) => {
    const { createDescriptor } = await import("/tilefun/src/generation/GenerationDescriptor.ts");
    const { DenseDistrictSource } = await import(
      "/tilefun/src/generation/regional/DenseDistrictPlanner.ts"
    );
    const { regionalWorld } = await import("/tilefun/src/generation/regional/WorldDescriptor.ts");
    const generation = createDescriptor("regional", 2026);
    const lot = new DenseDistrictSource(regionalWorld(2026), true)
      .owner(0, 0)
      ?.blocks.flatMap((b) => b.lots)
      .find((l) =>
        wanted === "shop" ? l.buildingType.includes("butcher") : l.buildingType.includes("condo"),
      );
    if (!lot) throw Error(`no ${wanted}`);
    return { generation, arrival: { x: lot.entrance.x, y: lot.entrance.y, generation } };
  }, kind);
  {
    const params = [
      "nogamepad",
      "view=topdown3d",
      query,
      `generation=${encodeURIComponent(JSON.stringify(generation))}`,
      `arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
    ].filter(Boolean);
    await page.goto("about:blank");
    await page.goto(`${origin}/?${params.join("&")}`);
    await page.getByRole("button", { name: "New World", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector("#game")?.dataset.ready === "true",
      undefined,
      { timeout: 120_000 },
    );
    await page.waitForTimeout(3000);
    const tag = "-3d";
    const shot = (name) =>
      page.locator("#game").screenshot({ path: path.join(out, `${kind}${tag}-${name}.png`) });
    await page.keyboard.press("e");
    if (process.argv.includes("--sequence"))
      for (let i = 0; i < 6; i++) {
        await shot(`enter-${i}`);
        await page.waitForTimeout(120);
      }
    await page.waitForFunction(
      () => /interior-v1/.test(document.querySelector("#game")?.dataset.interior ?? ""),
      undefined,
      { timeout: 30_000 },
    );
    await page.waitForTimeout(4000);
    const file = path.join(out, `${kind}-3d.png`);
    await page.locator("#game").screenshot({ path: file });
    const drawn = await page.evaluate(
      () => document.querySelector("#game").__game.firstPerson?.drawing3d,
    );
    console.log(file, `3D drawing: ${drawn}`);
    if (process.argv.includes("--sequence")) {
      await page.keyboard.down("KeyW");
      await page.waitForTimeout(1600);
      await page.keyboard.up("KeyW");
      await page.waitForTimeout(500);
      await shot("north");
    }
  }
} finally {
  await browser?.close().catch(() => {});
  await server.close().catch(() => {});
}
