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
class LooksOnly extends Error {}
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
  // Vehicle meshes are loaded once for the fixed view and first person (249).
  const meshLoads = new Map();
  page.on("request", (request) => {
    const file = new URL(request.url()).pathname;
    if (file.endsWith(".glb")) meshLoads.set(file, (meshLoads.get(file) ?? 0) + 1);
  });
  report.meshLoads = () => ({
    files: meshLoads.size,
    repeated: [...meshLoads].filter(([, count]) => count > 1).map(([file]) => file),
  });
  page.on("console", (message) => {
    if (message.type() === "error" || message.text().includes("First-person"))
      report.errors.push(`console: ${message.text()} ${message.location()?.url ?? ""}`);
  });
  await page.goto(`${origin}/tools.html`);
  const arrival = await page.evaluate(async () => {
    const { createDescriptor } = await import("/tilefun/src/generation/GenerationDescriptor.ts");
    return { generation: createDescriptor("regional", 2026) };
  });
  // --arrival=x,y picks the spot (tiles); the default is the render bench's city.
  const [arrivalX, arrivalY] = option("arrival", "300,519").split(",").map(Number);
  arrival.x = arrivalX;
  arrival.y = arrivalY;
  await page.goto(
    // --query=a=b&c=d adds game URL parameters (e.g. fpshadows=0).
    `${origin}/?nogamepad${option("query", "") ? `&${option("query", "")}` : ""}&generation=${encodeURIComponent(
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
      return {
        player: g.stateView.playerEntity.position,
        look: { ...g.firstPerson.look },
        active: g.firstPerson.active,
        // First person draws on the game's own world canvas (248).
        viewShown: g.firstPerson.drawing,
        webglCanvases: document.querySelectorAll("canvas[data-renderer=gpu]:not(#game)").length,
      };
    });
    report.shots.push({ name, file, ...state });
  };
  // --lift=N raises the eye N world pixels (an overview of shadows and roofs).
  await game(
    `(() => { document.querySelector("#game").__game.firstPerson.lift = ${Number(option("lift", "0"))}; })()`,
  );
  const headings = { north: -Math.PI / 2, east: 0, south: Math.PI / 2, west: Math.PI };
  for (const [name, yaw] of Object.entries(headings))
    await shoot(
      `fps-${name}`,
      `(() => { const l = document.querySelector("#game").__game.firstPerson.look; l.yaw = ${yaw}; l.pitch = ${Number(option("pitch", "-0.08"))}; })()`,
    );
  report.viewStats = await game(() => document.querySelector("#game").__game.firstPerson.viewStats);
  // Forest rows near the player, nearest first, for choosing an --arrival to look at.
  report.forestRows = await game(() => {
    const g = document.querySelector("#game").__game;
    const p = g.stateView.playerEntity.position;
    return g.stateView.props
      .filter((prop) => prop.type.startsWith("pattern:forest-thicket-v1:"))
      .map((prop) => ({
        type: prop.type,
        tile: [Math.round(prop.position.wx / 16), Math.round(prop.position.wy / 16)],
        distance: Math.round(Math.hypot(prop.position.wx - p.wx, prop.position.wy - p.wy)),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 6);
  });
  // --looks-only stops after the four headings (a quick look at one place).
  if (process.argv.includes("--looks-only")) throw new LooksOnly();
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
  // The graphics context is the game's own (248): losing it stops first person,
  // and restoring it brings back the scene and a fresh sun shadow map.
  const context = await game(async () => {
    const g = document.querySelector("#game").__game;
    const gl = g.renderer.surface.renderer.getContext();
    const lose = gl.getExtension("WEBGL_lose_context");
    const frames = (n) =>
      new Promise((resolve) => {
        const step = () => (--n > 0 ? requestAnimationFrame(step) : resolve());
        requestAnimationFrame(step);
      });
    const before = g.firstPerson.viewStats.sunRedraws;
    lose.loseContext();
    await frames(10);
    const drawingWhileLost = g.firstPerson.drawing;
    lose.restoreContext();
    await frames(30);
    return {
      drawingWhileLost,
      drawingAfter: g.firstPerson.drawing,
      sunRedrawn: g.firstPerson.viewStats.sunRedraws > before,
      recoveries: g.renderer.surface.stats.recoveries,
    };
  });
  report.contextLoss = context;
  await shoot("context-restored");
  // Split screen mixes view kinds (249): a keyboard guest joins, then each seat
  // switches between the fixed view and first person on the one canvas.
  const views = () =>
    game(() => {
      const g = document.querySelector("#game").__game;
      return g.device.views.map((view) => ({
        seat: view.seat,
        region: view.region,
        drawn3d: view.drawn3d,
        yaw: view.look?.yaw,
        interestRadius: view.interestRadius,
        interest: view.interestRange(),
      }));
    });
  const setSeats = async (name, host, guest) => {
    await game(
      ([host, guest]) => {
        const g = document.querySelector("#game").__game;
        g.consoleEngine.cvars.get("r_firstperson").set(host);
        g.firstPerson.setSeat(1, guest, -Math.PI / 2);
      },
      [host, guest],
    );
    await page.waitForFunction(
      ([host, guest]) => {
        const [a, b] = document.querySelector("#game").__game.device.views;
        return a?.drawn3d === host && b?.drawn3d === guest;
      },
      [host, guest],
    );
    await shoot(name);
    return views();
  };
  // The Options button still has focus from turning first person on; a focused
  // control keeps its keys.
  await game(() => document.activeElement?.blur());
  await page.keyboard.press("Slash");
  await page.waitForFunction(
    () => document.querySelector("#game").__game.device.views.length === 2,
  );
  await page.waitForTimeout(1500);
  report.split = {
    hostFirstPerson: await setSeats("split-fps-and-top", true, false),
    guestFirstPerson: await setSeats("split-top-and-fps", false, true),
  };
  // A keyboard guest has no look device: its right key turns (away from seat 0's
  // car, which is beside it), then up walks that way.
  const guestBody = () =>
    game(() => {
      const g = document.querySelector("#game").__game;
      const id = g.stateView.seats.entities.get(1);
      const body = g.stateView.entities.find((e) => e.id === id);
      return { ...body.position, yaw: g.device.views[1].look.yaw };
    });
  const before = await guestBody();
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(500);
  await page.keyboard.up("ArrowRight");
  const turned = await guestBody();
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(700);
  await page.keyboard.up("ArrowUp");
  await page.waitForTimeout(300);
  const walked = await guestBody();
  report.split.guestTurn = {
    yawBefore: before.yaw,
    yawAfter: turned.yaw,
    sidestep: Math.hypot(turned.wx - before.wx, turned.wy - before.wy),
    walk: { dx: walked.wx - turned.wx, dy: walked.wy - turned.wy },
    heading: { x: Math.cos(turned.yaw), y: Math.sin(turned.yaw) },
  };
  report.split.bothFirstPerson = await setSeats("split-both-fps", true, true);
  report.split.webglCanvases = await game(
    () => document.querySelectorAll("canvas[data-renderer=gpu]:not(#game)").length,
  );
  // The editor draws the fixed view instead of first person.
  await page.keyboard.press("Tab");
  await shoot("editor");
  report.editorHidesView = !report.shots.at(-1)?.viewShown;
} catch (error) {
  if (!(error instanceof LooksOnly)) throw error;
} finally {
  await browser?.close();
  await server.close();
  report.meshLoads = report.meshLoads?.();
  await writeFile(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!process.argv.includes("--keep-temp"))
    await rm(path.join(temp, "vite-cache"), { recursive: true, force: true });
}
