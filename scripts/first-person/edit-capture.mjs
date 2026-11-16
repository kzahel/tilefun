// Building mode in both renderers: an isolated Vite server, bundled Chromium and
// a fresh seed-2026 regional world arriving at a dense-district lot's entrance.
// Tab opens building mode (`--room` enters the building with E first); the
// cursor rests over the view, then the view is captured with and without
// `?view=topdown3d` (plus `--query`).
//
//   node scripts/first-person/edit-capture.mjs [--room] [--query=a=b] [--out=DIR]
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const option = (name, fallback) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const room = process.argv.includes("--room");
const query = option("query", "");
const out = path.resolve(option("out", path.join(os.tmpdir(), "tilefun-edit-capture")));
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
  const fresh = async () => {
    // A context per run: building mode is remembered across loads.
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on("pageerror", (error) => console.log(`page error: ${error.message}`));
    return page;
  };
  let page = await fresh();
  await page.goto(`${origin}/tools.html`);
  const { generation, arrival } = await page.evaluate(async () => {
    const { createDescriptor } = await import("/tilefun/src/generation/GenerationDescriptor.ts");
    const { DenseDistrictSource } = await import(
      "/tilefun/src/generation/regional/DenseDistrictPlanner.ts"
    );
    const { regionalWorld } = await import("/tilefun/src/generation/regional/WorldDescriptor.ts");
    const generation = createDescriptor("regional", 2026);
    const lot = new DenseDistrictSource(regionalWorld(2026), true)
      .owner(0, 0)
      ?.blocks.flatMap((b) => b.lots)
      .find((l) => l.buildingType.includes("condo"));
    if (!lot) throw Error("no condo");
    return { generation, arrival: { x: lot.entrance.x, y: lot.entrance.y, generation } };
  });
  for (const unified of [false, true]) {
    const params = [
      "nogamepad",
      unified ? "view=topdown3d" : "",
      query,
      `generation=${encodeURIComponent(JSON.stringify(generation))}`,
      `arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
    ].filter(Boolean);
    await page.close();
    page = await fresh();
    await page.goto(`${origin}/?${params.join("&")}`);
    await page.getByRole("button", { name: "New World", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector("#game")?.dataset.ready === "true",
      undefined,
      { timeout: 120_000 },
    );
    await page.waitForTimeout(3000);
    if (room) {
      await page.keyboard.press("e");
      await page.waitForFunction(
        () => /interior-v1/.test(document.querySelector("#game")?.dataset.interior ?? ""),
        undefined,
        { timeout: 30_000 },
      );
      await page.waitForTimeout(2000);
    }
    const editing = () =>
      page.evaluate(
        () =>
          document.querySelector("#game").__game.scenes?.current?.constructor?.name === "EditScene",
      );
    for (let i = 0; i < 10 && !(await editing()); i++) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(500);
    }
    if (!(await editing())) throw Error("building mode did not open");
    await page.mouse.move(700, 380);
    await page.waitForTimeout(3000);
    await page.mouse.move(704, 384);
    await page.waitForTimeout(500);
    const file = path.join(out, `edit${room ? "-room" : ""}${unified ? "-3d" : ""}.png`);
    await page.locator("#game").screenshot({ path: file });
    const drawn = await page.evaluate(() => {
      const game = document.querySelector("#game").__game;
      return {
        drawing3d: game.firstPerson?.drawing3d,
        scene: game.scenes?.current?.constructor?.name,
      };
    });
    console.log(file, JSON.stringify(drawn));
  }
} finally {
  await browser?.close().catch(() => {});
  await server.close().catch(() => {});
}
