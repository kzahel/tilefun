// Tactical 230 slices 1–2 capture: an isolated Vite server, bundled Chromium and a
// fresh regional world at an apartment door. Photographs first person outdoors at
// Near and Far view distance (chosen through Options), then inside the apartment,
// with the fixed view from the same spot. Captures are evidence, not assertions.
//
//   node scripts/first-person/capture-rooms.mjs [--out=DIR] [--headed] [--kind=apartment|shop]
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const option = (name, fallback) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const headed = process.argv.includes("--headed");
const kind = option("kind", "apartment");
const temp = await mkdtemp(path.join(os.tmpdir(), "tilefun-first-person-rooms-"));
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
const report = { output, kind, shots: [], errors: [] };
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
  // The same checkpoint as tests/gameplay-interiors.spec.ts: a dense-district door.
  const arrival = await page.evaluate(async (kind) => {
    const { createDescriptor } = await import("/tilefun/src/generation/GenerationDescriptor.ts");
    const { DenseDistrictSource } = await import(
      "/tilefun/src/generation/regional/DenseDistrictPlanner.ts"
    );
    const { regionalWorld } = await import("/tilefun/src/generation/regional/WorldDescriptor.ts");
    const lot = new DenseDistrictSource(regionalWorld(2026), true)
      .owner(0, 0)
      ?.blocks.flatMap((b) => b.lots)
      .find((l) =>
        kind === "shop" ? l.buildingType.includes("butcher") : l.buildingType.includes("condo"),
      );
    if (!lot) throw new Error(`Missing ${kind} checkpoint`);
    return { x: lot.entrance.x, y: lot.entrance.y, generation: createDescriptor("regional", 2026) };
  }, kind);
  await page.goto(
    `${origin}/?nogamepad&renderer=gpu&meshes&generation=${encodeURIComponent(
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
  const state = () =>
    game(() => {
      const g = document.querySelector("#game").__game;
      const view = document.querySelector('canvas[data-view="first-person"]');
      const camera = g.camera;
      return {
        player: { ...g.stateView.playerEntity.position },
        interior: document.querySelector("#game").dataset.interior ?? "",
        look: { ...g.firstPerson.look },
        viewDistance: g.firstPerson.viewDistance,
        drawing: g.firstPerson.drawing,
        viewShown: !!view && view.style.display !== "none",
        stats: g.firstPerson.viewStats,
        streamedRadius: camera
          ? Math.min(camera.viewportWidth, camera.viewportHeight) / (2 * 3 * camera.zoom)
          : undefined,
        zoom: camera?.zoom,
      };
    });
  const shoot = async (name, setup, settle = 1200) => {
    if (setup) await game(setup);
    await page.waitForTimeout(settle);
    const file = path.join(output, `${name}.png`);
    await page.screenshot({ path: file });
    report.shots.push({ name, file, ...(await state()) });
  };
  const look = (yaw, pitch = -0.08) =>
    `(() => { const l = document.querySelector("#game").__game.firstPerson.look; l.yaw = ${yaw}; l.pitch = ${pitch}; })()`;
  // Options → first person and a view distance, the way a player chooses them.
  const options = async (distance, enable = false) => {
    await page.locator(`button[aria-label="Options"]`).click();
    if (enable)
      await page.getByRole("checkbox", { name: "First-person view (experiment)" }).check();
    await page.getByRole("combobox", { name: "First-person view distance" }).selectOption(distance);
    await page.getByText("View distance saved for this player.").waitFor();
    await page.getByRole("button", { name: "Back to game" }).click();
  };
  const settle = Number(option("settle", "8000"));
  await options("near", true);
  await page.waitForTimeout(settle);
  // Look away from the door, down the street, for the distance comparison.
  await shoot("outdoor-near", look(Math.PI / 2, -0.04));
  await options("far");
  // Fog follows arriving chunks: sample it while Far is still streaming in.
  report.fogWhileStreaming = [];
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(250);
    report.fogWhileStreaming.push((await state()).stats?.fogEnd);
  }
  await page.waitForTimeout(settle);
  await shoot("outdoor-far", look(Math.PI / 2, -0.04));
  report.savedDistance = await game(() =>
    document
      .querySelector("#game")
      .__game.profileStore?.listProfiles?.()
      .then((list) => list),
  );
  // Walk in: the door prompt is the ordinary interact key.
  await game(look(-Math.PI / 2, 0));
  await page.keyboard.press("e");
  await page.waitForFunction(
    () => /interior-v1/.test(document.querySelector("#game").dataset.interior ?? ""),
    undefined,
    { timeout: 20_000 },
  );
  await page.waitForTimeout(3000);
  const headings = { north: -Math.PI / 2, east: 0, south: Math.PI / 2, west: Math.PI };
  for (const [name, yaw] of Object.entries(headings)) await shoot(`room-${name}`, look(yaw, -0.15));
  await shoot("room-down", look(-Math.PI / 2, -1.1));
  // Walk a little further in and look around again.
  await game(look(-Math.PI / 2, 0));
  await page.keyboard.down("w");
  await page.waitForTimeout(900);
  await page.keyboard.up("w");
  await shoot("room-inside-north", look(-Math.PI / 2, -0.2));
  await shoot("room-inside-east", look(0, -0.2));
  await shoot("room-inside-west", look(Math.PI, -0.2));
  // A wall picture, seen from a few steps south of it (hung on its wall's face).
  const picture = await game(() =>
    document
      .querySelector("#game")
      .__game.stateView.props.filter((p) => p.type.endsWith(":wall-picture"))
      .map((p) => ({ ...p.position }))
      .at(0),
  );
  report.picture = picture ?? null;
  if (picture) {
    await game(
      async ({ x, y }) => {
        const g = document.querySelector("#game").__game;
        await g.gcSendRequest({
          type: "rcon",
          requestId: g.nextRequestId++,
          command: `tp ${x} ${y + 56}`,
        });
      },
      { x: picture.wx, y: picture.wy },
    );
    await shoot("room-picture", look(-Math.PI / 2, 0.05), 1500);
  }
  await shoot(
    "room-fixed-view",
    `document.querySelector("#game").__game.consoleEngine.cvars.get("r_firstperson").set(false)`,
  );
} finally {
  await browser?.close();
  await server.close();
  await writeFile(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!process.argv.includes("--keep-temp"))
    await rm(path.join(temp, "vite-cache"), { recursive: true, force: true });
}
