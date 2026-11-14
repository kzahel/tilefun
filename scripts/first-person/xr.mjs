// Tactical 252 evidence: play in a headset, on an emulated one. An isolated Vite
// server, bundled Chromium and a fresh regional world; Meta's WebXR emulator
// (IWER) stands in for the headset. For each mode the session is started and
// ended, the emulated head and controllers are moved, and the page's picture of
// the session is saved.
//
//   node scripts/first-person/xr.mjs [--out=DIR] [--headed] [--modes=eye,tabletop,screen]
//
// This checks the browser contract (a session starts, drives the game loop,
// takes controller input and gives the loop back). It says nothing about a real
// headset's frame pacing or comfort: `scripts/first-person/xr-quest.mjs` runs on one.
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const option = (name, fallback) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const modes = option("modes", "eye,tabletop,screen").split(",");
const temp = await mkdtemp(path.join(os.tmpdir(), "tilefun-xr-"));
const output = path.resolve(option("out", path.join(os.tmpdir(), "tilefun-xr")));
await mkdir(output, { recursive: true });
const emulator = await readFile(
  fileURLToPath(import.meta.resolve("iwer/build/iwer.min.js")),
  "utf8",
);

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
const report = { output, date: new Date().toISOString(), errors: [], console: [], modes: {} };
/** A check of the contract this script exists for; a failure fails the run. */
const expect = (ok, what) => {
  if (!ok) report.errors.push(what);
};
const game = (page, fn, arg) =>
  page.evaluate(
    ([source, value]) =>
      new Function("g", "arg", `return (${source})(g, arg)`)(
        document.querySelector("#game").__game,
        value,
      ),
    [fn.toString(), arg],
  );
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}/tilefun`;
  browser = await chromium.launch({
    headless: !process.argv.includes("--headed"),
    channel: "chromium",
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (error) => report.errors.push(error.message));
  // Kept for reading; only page errors and failed checks below fail the run.
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning")
      report.console.push(`${message.type()}: ${message.text()}`);
  });
  // A Quest 3 with its Touch Plus controllers, standing at the room's origin.
  await page.addInitScript(`${emulator};
    {
      const device = new IWER.XRDevice(IWER.metaQuest3, { stereoEnabled: true });
      device.installRuntime({ polyfillLayers: true, forceInstall: true });
      device.position.set(0, 1.6, 0);
      window.__headset = device;
    }`);
  await page.goto(`${origin}/tools.html`);
  const generation = await page.evaluate(async () => {
    const { createDescriptor } = await import("/tilefun/src/generation/GenerationDescriptor.ts");
    return createDescriptor("regional", 2026);
  });
  const arrival = { x: 300, y: 519, generation };
  await page.goto(
    `${origin}/?generation=${encodeURIComponent(JSON.stringify(generation))}&arrival=${encodeURIComponent(
      JSON.stringify(arrival),
    )}`,
  );
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector("#game");
      return canvas?.dataset.ready === "true" && !canvas.__game.mainMenu.visible;
    },
    undefined,
    { timeout: 120_000 },
  );
  await page.waitForTimeout(2500);
  report.supported = await game(page, (g) => g.xr.supported);
  const position = () =>
    game(page, (g) => {
      const p = g.stateView.playerEntity.position;
      return { x: p.wx, y: p.wy };
    });
  for (const mode of modes) {
    const cell = {};
    report.modes[mode] = cell;
    const before = await game(page, (g) => ({
      elapsed: g.time.elapsed,
      firstPerson: g.firstPerson.active,
      size: [g.canvas.width, g.canvas.height],
    }));
    cell.offered = await game(page, (g, m) => g.xr.modes.includes(m), mode);
    if (!cell.offered) {
      // The emulator has no quad layers, so no headset screen.
      console.log(`${mode}: not offered by this browser`);
      continue;
    }
    cell.entered = await game(page, (g, m) => g.xr.enter(m), mode);
    if (!cell.entered) {
      report.errors.push(`${mode}: the session did not start`);
      continue;
    }
    // Chunks, ground pages and vehicle meshes settle.
    await page
      .waitForFunction(
        (m) => {
          const g = document.querySelector("#game").__game;
          if (g.xr.stats.frames < 30) return false;
          return m === "screen" || (g.firstPerson.viewStats?.builds === 0 && g.xr.stats.posed > 30);
        },
        mode,
        { timeout: 60_000, polling: 250 },
      )
      .catch(() => report.errors.push(`${mode}: did not settle`));
    // A tabletop is looked down at.
    const look = (yawDegrees, pitchDegrees) =>
      page.evaluate(
        ([yaw, pitch]) => {
          const y = (yaw * Math.PI) / 360,
            p = (pitch * Math.PI) / 360;
          // Yaw about the room's up, then pitch about the head's own right.
          window.__headset.quaternion.set(
            Math.cos(y) * Math.sin(p),
            Math.sin(y) * Math.cos(p),
            -Math.sin(y) * Math.sin(p),
            Math.cos(y) * Math.cos(p),
          );
        },
        [yawDegrees, pitchDegrees],
      );
    const down = mode === "tabletop" ? -55 : 0;
    await look(0, down);
    await page.waitForTimeout(1500);
    cell.mode = await game(page, (g) => g.xr.mode);
    cell.immersive = await game(page, (g) => g.xr.immersive);
    await page.screenshot({ path: path.join(output, `${mode}.png`) });
    // The left stick walks the player forward: where the head looks.
    const from = await position();
    await page.evaluate(() => window.__headset.controllers.left.updateAxes("thumbstick", 0, -1));
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.__headset.controllers.left.updateAxes("thumbstick", 0, 0));
    const to = await position();
    cell.walked = { dx: +(to.x - from.x).toFixed(1), dy: +(to.y - from.y).toFixed(1) };
    if (mode !== "screen") {
      // A flick of the right stick is one snap turn to the right.
      const yaw = () => game(page, (g) => g.firstPerson.look.yaw);
      const facing = await yaw();
      await page.evaluate(() => window.__headset.controllers.right.updateAxes("thumbstick", 1, 0));
      await page.waitForTimeout(400);
      await page.evaluate(() => window.__headset.controllers.right.updateAxes("thumbstick", 0, 0));
      await page.waitForTimeout(200);
      cell.snapTurnDegrees = +(((await yaw()) - facing) * (180 / Math.PI)).toFixed(1);
      // The head turns left and tips down a little: the look follows it.
      await look(40, down);
      await page.waitForTimeout(600);
      cell.headTurnDegrees = +(((await yaw()) - facing) * (180 / Math.PI)).toFixed(1);
      await page.screenshot({ path: path.join(output, `${mode}-turned.png`) });
      await look(0, 0);
    }
    Object.assign(
      cell,
      await game(page, (g) => ({
        frames: g.xr.stats.frames,
        inputs: g.xr.stats.inputs,
        pacing: g.xr.pacing(),
        view: g.firstPerson.viewStats,
        drawn3d: g.firstPerson.drawing3d,
        firstPersonDuring: g.firstPerson.active,
        contextLost: g.renderHost.renderer.surface?.lost ?? false,
      })),
    );
    await game(page, (g) => g.xr.exit());
    await page.waitForFunction(() => !document.querySelector("#game").__game.xr.mode, undefined, {
      timeout: 10_000,
    });
    await page.waitForTimeout(800);
    const after = await game(page, (g) => ({
      elapsed: g.time.elapsed,
      firstPerson: g.firstPerson.active,
      size: [g.canvas.width, g.canvas.height],
      world: [
        g.renderHost.renderer.surface.canvas.width,
        g.renderHost.renderer.surface.canvas.height,
      ],
    }));
    const then = await game(page, (g) => g.time.elapsed);
    await page.waitForTimeout(500);
    cell.pageLoopBack = (await game(page, (g) => g.time.elapsed)) > then;
    cell.restored = {
      firstPerson: after.firstPerson === before.firstPerson,
      size:
        String(after.size) === String(before.size) && String(after.world) === String(before.size),
    };
    await page.screenshot({ path: path.join(output, `${mode}-after.png`) });
    console.log(`${mode}: ${JSON.stringify(cell)}`);
    expect(cell.mode === mode, `${mode}: the session was not presenting when measured`);
    expect(Math.hypot(cell.walked.dx, cell.walked.dy) > 20, `${mode}: the left stick did not walk`);
    expect(cell.inputs === 2, `${mode}: the session saw ${cell.inputs} controllers, not 2`);
    if (mode !== "screen") {
      expect(cell.drawn3d && cell.view?.calls > 0, `${mode}: nothing was drawn to the eyes`);
      expect(
        Math.abs(cell.snapTurnDegrees - 30) < 1,
        `${mode}: a flick turned ${cell.snapTurnDegrees}°`,
      );
      // A 40° turn of the head to the left, after the 30° snap to the right.
      expect(Math.abs(cell.headTurnDegrees + 10) < 2, `${mode}: the look did not follow the head`);
    }
    expect(!cell.contextLost, `${mode}: graphics were lost`);
    expect(cell.pageLoopBack, `${mode}: the page's loop did not come back`);
    expect(cell.restored.firstPerson, `${mode}: the seat's own view choice changed`);
    expect(cell.restored.size, `${mode}: the canvases were not sized back to the page`);
  }
  // A menu over play ends the session and remembers the mode.
  if (modes.includes("eye") && report.modes.eye?.entered) {
    await game(page, (g) => g.xr.enter("eye"));
    await page.waitForFunction(() => document.querySelector("#game").__game.xr.stats.frames > 20);
    await page.waitForTimeout(300);
    // The upper right face button is the pad's menu button.
    await page.evaluate(() => window.__headset.controllers.right.updateButtonValue("b-button", 1));
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__headset.controllers.right.updateButtonValue("b-button", 0));
    await page
      .waitForFunction(() => !document.querySelector("#game").__game.xr.mode, undefined, {
        timeout: 10_000,
      })
      .catch(() => report.errors.push("pause did not end the session"));
    report.pause = await game(page, (g) => ({
      mode: g.xr.mode,
      resume: g.xr.resume,
      menu: g.mainMenu.visible,
    }));
    await page.screenshot({ path: path.join(output, "paused.png") });
    // The paused menu offers the headset's modes; Resume is the user's gesture
    // that goes back into the session it left.
    report.pause.offers = await page.evaluate(() =>
      [...document.querySelectorAll("button")]
        .map((button) => button.textContent.trim())
        .filter((label) => label.startsWith("Headset:")),
    );
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await page
      .waitForFunction(() => document.querySelector("#game").__game.xr.mode === "eye", undefined, {
        timeout: 10_000,
      })
      .catch(() => report.errors.push("Resume did not enter the session again"));
    report.pause.resumed = await game(page, (g) => g.xr.mode);
    await game(page, (g) => g.xr.exit());
    console.log(`pause: ${JSON.stringify(report.pause)}`);
    expect(
      report.pause.menu && report.pause.mode === null,
      "B did not end the session for the menu",
    );
    expect(report.pause.resume === "eye", "the paused mode was not remembered");
    expect(
      report.pause.offers.includes("Headset: tabletop") &&
        report.pause.offers.includes("Headset: stay on this page"),
      `the paused menu offers ${JSON.stringify(report.pause.offers)}`,
    );
    expect(report.pause.resumed === "eye", "Resume did not go back into the session");
  }
} finally {
  await writeFile(path.join(output, "xr.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nReport and pictures: ${output}`);
  if (report.errors.length) {
    console.log(`FAILED:\n  ${[...new Set(report.errors)].join("\n  ")}`);
    process.exitCode = 1;
  } else console.log("All checks passed.");
  await browser?.close().catch(() => {});
  await server.close().catch(() => {});
  await rm(temp, { recursive: true, force: true });
}
