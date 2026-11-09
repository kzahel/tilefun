// Tactical 229 capture: an isolated Vite server, bundled Chromium and a fresh
// regional world, photographed in the experimental first-person view and the
// fixed view from the same spot. Captures are evidence, not image assertions.
//
//   node scripts/first-person/capture.mjs [--out=DIR] [--headed]
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const option = (name, fallback) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const headed = process.argv.includes("--headed");
const temp = await mkdtemp(path.join(os.tmpdir(), "tilefun-first-person-"));
const output = path.resolve(option("out", path.join(temp, "captures")));
await mkdir(output, { recursive: true });

const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  cacheDir: path.join(temp, "vite-cache"),
  optimizeDeps: { entries: ["index.html"] },
  plugins: [react()],
  server: { host: "127.0.0.1", port: 0, hmr: false, watch: null },
  logLevel: "error",
});
let browser;
const report = { output, shots: [], errors: [] };
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}/tilefun`;
  browser = await chromium.launch({ headless: !headed, channel: "chromium" });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("pageerror", (error) => report.errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" || message.text().includes("First-person"))
      report.errors.push(`console: ${message.text()} ${message.location()?.url ?? ""}`);
  });
  await page.goto(`${origin}/tools.html`);
  const arrival = await page.evaluate(async () => {
    const { createDescriptor } = await import("/tilefun/src/generation/GenerationDescriptor.ts");
    return { x: 300, y: 519, generation: createDescriptor("regional", 2026) };
  });
  await page.goto(
    `${origin}/?nogamepad&generation=${encodeURIComponent(
      JSON.stringify(arrival.generation),
    )}&arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
  );
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector("#game");
      const game = canvas?.__game;
      return canvas?.dataset.ready === "true" && game && !game.mainMenu.visible;
    },
    undefined,
    { timeout: 60_000 },
  );
  const game = (fn, arg) => page.evaluate(fn, arg);
  const rcon = (command) =>
    game(async (command) => {
      const g = document.querySelector("#game").__game;
      return g.gcSendRequest({ type: "rcon", requestId: g.nextRequestId++, command });
    }, command);
  for (const command of (option("rcon", "") || "").split(";").filter(Boolean)) await rcon(command);
  // Turn first person on the way a player does: gear → Options → First-person view.
  await page.locator(`button[aria-label="Options"]`).click();
  await page.getByRole("checkbox", { name: "First-person view (experiment)" }).check();
  await page.getByRole("button", { name: "Back to game" }).click();
  await page.waitForTimeout(Number(option("settle", "6000")));
  const shoot = async (name, setup) => {
    if (setup) await game(setup);
    await page.waitForTimeout(1200);
    const file = path.join(output, `${name}.png`);
    await page.screenshot({ path: file });
    const state = await game(() => {
      const g = document.querySelector("#game").__game;
      const view = document.querySelector('canvas[data-view="first-person"]');
      return {
        player: g.stateView.playerEntity.position,
        look: { ...g.firstPerson.look },
        active: g.firstPerson.active,
        viewShown: !!view && view.style.display !== "none",
      };
    });
    report.shots.push({ name, file, ...state });
  };
  const headings = { north: -Math.PI / 2, east: 0, south: Math.PI / 2, west: Math.PI };
  for (const [name, yaw] of Object.entries(headings))
    await shoot(
      `fps-${name}`,
      `(() => { const l = document.querySelector("#game").__game.firstPerson.look; l.yaw = ${yaw}; l.pitch = -0.08; })()`,
    );
  report.viewStats = await game(() => document.querySelector("#game").__game.firstPerson.viewStats);
  await shoot(
    "fixed-view",
    `document.querySelector("#game").__game.consoleEngine.cvars.get("r_firstperson").set(false)`,
  );
  // Camera-relative input: facing east, "forward" (W) must move the player east.
  await game(() =>
    document.querySelector("#game").__game.consoleEngine.cvars.get("r_firstperson").set(true),
  );
  // Controls turn only once a first-person frame is on screen (the view reloads).
  await page.waitForFunction(() => document.querySelector("#game").__game.firstPerson.drawing);
  const position = () =>
    game(() => ({ ...document.querySelector("#game").__game.stateView.playerEntity.position }));
  const walk = async (yaw, key, ms) => {
    await game(
      `(() => { document.querySelector("#game").__game.firstPerson.look.yaw = ${yaw}; })()`,
    );
    const before = await position();
    await page.keyboard.down(key);
    await page.waitForTimeout(ms);
    await page.keyboard.up(key);
    await page.waitForTimeout(400);
    const after = await position();
    return { yaw, key, dx: after.wx - before.wx, dy: after.wy - before.wy };
  };
  report.walks = [
    await walk(0, "w", 700),
    await walk(Math.PI / 2, "w", 700),
    await walk(0, "d", 700),
  ];
  // Another layout: Dvorak types "," on the W key and "." on the E key. Bindings
  // follow physical keys (KeyboardEvent.code), so these still walk and board.
  const layoutKey = (type, code, key) =>
    page.evaluate(
      ([type, code, key]) =>
        window.dispatchEvent(new KeyboardEvent(type, { code, key, bubbles: true })),
      [type, code, key],
    );
  await game(`(() => { document.querySelector("#game").__game.firstPerson.look.yaw = 0; })()`);
  const dvorakStart = await position();
  await layoutKey("keydown", "KeyW", ",");
  await page.waitForTimeout(700);
  await layoutKey("keyup", "KeyW", ",");
  await page.waitForTimeout(400);
  const dvorakEnd = await position();
  report.dvorakWalk = { dx: dvorakEnd.wx - dvorakStart.wx, dy: dvorakEnd.wy - dvorakStart.wy };
  await rcon(`tp ${dvorakStart.wx} ${dvorakStart.wy}`);
  await page.waitForTimeout(600);
  // Board the nearest car with the Dvorak E key and look at the chase camera.
  await layoutKey("keydown", "KeyE", ".");
  await layoutKey("keyup", "KeyE", ".");
  await page.waitForTimeout(1500);
  report.driving = await game(() => {
    const g = document.querySelector("#game").__game;
    return g.stateView.playerEntity.parentId !== undefined;
  });
  if (report.driving) {
    await shoot("drive-chase");
    await page.keyboard.down("w");
    await page.waitForTimeout(1800);
    await shoot("drive-moving");
    await page.keyboard.up("w");
  }
  // The editor draws the fixed view; the first-person canvas must not cover it.
  await page.keyboard.press("Tab");
  await shoot("editor");
  report.editorHidesView = !report.shots.at(-1)?.viewShown;
} finally {
  await browser?.close();
  await server.close();
  await writeFile(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!process.argv.includes("--keep-temp"))
    await rm(path.join(temp, "vite-cache"), { recursive: true, force: true });
}
