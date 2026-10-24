/** Capture the actual shared Worker/renderer playground, without user-world storage. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { promisify } from "node:util";
import { chromium, expect } from "@playwright/test";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";
import type { TruckBedCanvas } from "../../src/workshop/TruckBedPage.js";
import { chooseVehicleAction } from "../../tests/helpers/context-actions.js";

const output = resolve(
  process.argv.find((arg) => arg.startsWith("--output="))?.slice(9) ??
    "data/3d-investigation/truck-bed",
);
assert.ok(output.startsWith(resolve("data") + sep));
await mkdir(output, { recursive: true });
let base = process.argv.find((arg) => arg.startsWith("--base-url="))?.slice(11);
let server: Awaited<ReturnType<typeof createServer>> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  if (!base) {
    process.env.WORKSHOP_LOCAL_AUTH_BYPASS = "1";
    process.env.WORKSHOP_AUTH_DIR = resolve(output, "server/auth");
    process.env.WORKSHOP_DATA_DIR = resolve(output, "server/workshop");
    process.env.ART_NOTES_DIR = resolve(output, "server/art-notes");
    process.env.INTERIOR_REVIEW_DIR = resolve(output, "server/interior");
    const { privateDataPlugin } = await import("../../src/server/privateDataPlugin.js");
    const { workshopPlugin } = await import("../../src/server/workshopService.js");
    server = await createServer({
      configFile: false,
      base: "/tilefun/",
      cacheDir: "node_modules/.vite-truck-bed-capture",
      logLevel: "error",
      plugins: [react(), privateDataPlugin(resolve(".")), workshopPlugin()],
      server: { port: 0, host: "127.0.0.1", watch: null },
      optimizeDeps: { entries: ["workshop.html"] },
    });
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === "string") throw new Error("Missing capture server");
    base = `http://127.0.0.1:${address.port}`;
  }
  browser = await chromium.launch({ channel: "chromium", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1180, height: 1000 },
    deviceScaleFactor: 1,
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("THREE."))
      errors.push(message.text());
  });
  await page.goto(
    `${base}/tilefun/workshop.html?geometry=truck-bed&renderer=gpu&meshes#/tool/world-geometry`,
    { waitUntil: "commit" },
  );
  const canvas = page.locator('canvas[aria-label="Truck bed scene"]');
  const report = () =>
    page.evaluate(() =>
      (
        document.querySelector('canvas[aria-label="Truck bed scene"]') as TruckBedCanvas
      ).__truckBedDiagnostics?.(),
    );
  const ready = async () => {
    await expect(canvas).toHaveAttribute("data-ready", "true", { timeout: 90000 });
    await expect
      .poll(async () => (await report())?.bedMeshDraws, { timeout: 60000 })
      .toBeGreaterThan(0);
  };
  const pause = async () => {
    const button = page.getByRole("button", { name: "Pause", exact: true });
    if (await button.count()) await button.click();
    await expect.poll(async () => (await report())?.authority.clock?.running).toBe(false);
  };
  const captures: {
    id: string;
    name: string;
    image: string;
    debug: string;
    state: Awaited<ReturnType<typeof report>>;
  }[] = [];
  const capture = async (id: string, name: string) => {
    const image = await page.evaluate(
      () =>
        (document.querySelector('canvas[aria-label="Truck bed scene"]') as TruckBedCanvas)
          .__captureTruckBed?.()
          .toDataURL() ?? "",
    );
    await page.getByRole("checkbox", { name: "Show clipping geometry" }).check();
    const debug = await page.evaluate(
      () =>
        (document.querySelector('canvas[aria-label="Truck bed scene"]') as TruckBedCanvas)
          .__captureTruckBed?.()
          .toDataURL() ?? "",
    );
    await page.getByRole("checkbox", { name: "Show clipping geometry" }).uncheck();
    const state = await report();
    captures.push({ id, name, image, debug, state });
    for (const [suffix, url] of [
      ["normal", image],
      ["debug", debug],
    ]) {
      if (!url) throw new Error("Missing capture");
      await writeFile(
        resolve(output, `${id}-${suffix}.png`),
        Buffer.from(url.split(",")[1] ?? "", "base64"),
      );
    }
    console.log(`${id}: z=${state?.playerZ.toFixed(3)} support=${state?.supportId}`);
  };
  await ready();
  await pause();
  await capture("center-right", "Standing inside the bed");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await canvas.focus();
  await page.keyboard.down("ArrowDown");
  try {
    await expect.poll(async () => (await report())?.local?.y).toBeGreaterThan(14);
  } finally {
    await page.keyboard.up("ArrowDown");
  }
  await pause();
  await capture("near-wall", "Lower body behind the near wall");
  await page.getByRole("checkbox", { name: "Show clipping geometry" }).check();
  await page.screenshot({ path: resolve(output, "playground.png"), fullPage: true });
  await page.getByRole("checkbox", { name: "Show clipping geometry" }).uncheck();
  for (const mode of ["canvas", "gpu"]) {
    await page.getByLabel("Truck renderer", { exact: true }).selectOption(mode);
    await expect(page.getByLabel("Truck renderer", { exact: true })).toBeEnabled();
    await capture(
      `fallback-${mode}`,
      mode === "canvas" ? "Canvas sprite fallback" : "GPU sprite fallback",
    );
  }
  await page.getByLabel("Truck renderer", { exact: true }).selectOption("gpu-mesh");
  await ready();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await canvas.focus();
  await page.keyboard.down(" ");
  try {
    await expect.poll(async () => (await report())?.playerZ).toBeGreaterThan(35);
    await pause();
  } finally {
    await page.keyboard.up(" ");
  }
  await capture("jump", "Jumping above the bed floor");
  for (const [direction, name] of [
    [0, "Down"],
    [2, "Left"],
    [1, "Up"],
  ] as const) {
    await page.getByLabel("Truck heading", { exact: true }).selectOption(String(direction));
    await ready();
    await pause();
    await capture(`heading-${name.toLowerCase()}`, `Bed facing ${name.toLowerCase()}`);
  }
  await page.getByLabel("Truck heading", { exact: true }).selectOption("3");
  await ready();
  await pause();
  await page.getByRole("button", { name: "Stand beside truck", exact: true }).click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  for (let count = 1; count <= 2; count++) {
    await chooseVehicleAction(page, "Load cargo");
    await expect.poll(async () => (await report())?.cargoCount).toBe(count);
  }
  await chooseVehicleAction(page, "Ride in bed");
  await expect.poll(async () => (await report())?.supportId).toBe((await report())?.truckId);
  await pause();
  await capture("loaded-bed", "Game controls: rider and two real cargo identities");
  await page.screenshot({ path: resolve(output, "game-controls.png"), fullPage: true });
  await page.getByLabel("Truck renderer", { exact: true }).selectOption("canvas");
  await expect(page.getByLabel("Truck renderer", { exact: true })).toBeEnabled();
  await capture("loaded-fallback", "Same rider and cargo in Canvas fallback");
  if (process.argv.includes("--tipping")) {
    await page.getByLabel("Truck renderer", { exact: true }).selectOption("gpu-mesh");
    await ready();
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await chooseVehicleAction(page, "Tip bed");
    await expect.poll(async () => (await report())?.bedTilt ?? 0).toBeGreaterThan(0.26);
    await pause();
    await capture("tip-loaded", "Tipping with rider, ball and fruit");
    await page.getByRole("button", { name: "Reload", exact: true }).click();
    await expect(page.getByRole("button", { name: "Reload", exact: true })).toBeEnabled();
    assert.ok(((await report())?.bedTilt ?? 0) > 0.26);
    for (const mode of ["canvas", "gpu"]) {
      await page.getByLabel("Truck renderer", { exact: true }).selectOption(mode);
      await expect(page.getByLabel("Truck renderer", { exact: true })).toBeEnabled();
      await capture(`tip-${mode}`, `Articulated ${mode} fallback`);
    }
    await page.getByLabel("Truck renderer", { exact: true }).selectOption("gpu-mesh");
    await ready();
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await expect.poll(async () => (await report())?.bedTilt ?? 0).toBeGreaterThan(0.83);
    await expect.poll(async () => (await report())?.playerZ ?? 99).toBeLessThan(0.1);
    await pause();
    await capture("tip-discharged", "Raised bed after actual discharge");
    await page.getByRole("button", { name: "Stand beside truck", exact: true }).click();
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await chooseVehicleAction(page, "Lower bed");
    await expect.poll(async () => (await report())?.bedTilt ?? 99).toBe(0);
    await pause();
    await capture("tip-lowered", "Lowered and ready to drive/load again");
  }
  assert.deepEqual(errors, []);
  const paths = [
    "scripts/instrumentation/truck-bed-playground.ts",
    "src/traffic/VehicleBed.ts",
    "src/traffic/VehicleCargo.ts",
    "src/server/VehicleBedControl.ts",
    "src/ui/VehicleControl.ts",
    "src/scenarios/TruckBedRecipe.ts",
    "src/workshop/TruckBedPage.tsx",
    "src/rendering/GpuVehicleContents.ts",
    "src/rendering/VehicleBedPresentation.ts",
    "src/rendering/CollisionDebug.ts",
    "public/assets/models/vehicles/dump-truck-v1.glb",
    "public/assets/models/vehicles/dump-truck-v2.glb",
    "src/traffic/VehicleBedEquipment.ts",
    "src/traffic/VehicleBedSlide.ts",
    "src/rendering/DumpTruckFallback.ts",
    "public/demos/pixel-characters/person-32.png",
  ];
  const hashes = Object.fromEntries(
    await Promise.all(
      paths.map(async (path) => [
        path,
        createHash("sha256")
          .update(await readFile(path))
          .digest("hex"),
      ]),
    ),
  );
  await writeFile(
    resolve(output, "report.json"),
    `${JSON.stringify({ schema: "tilefun-truck-bed-playground-v2", hashes, states: captures.map(({ id, state }) => ({ id, state })), errors, limits: ["Articulated dump bed with loose toys/food; enclosed passenger seats remain future work", "Physical cab/chassis are conservative prisms; walls/floor follow retained source dimensions", "Loaded meshes use actual visual depth; fallbacks use source-derived physical clip geometry", "Character visual depth remains a fixed-camera upright sprite plane", "Captures sample live authority; poses are evidence, not immutable approval snapshots"] }, null, 2)}\n`,
  );
  const gallery = `<!doctype html><meta charset="utf-8"><title>Playable truck bed</title><style>body{background:#17242b;color:#eff5f5;font:16px system-ui;margin:24px}h1{font-size:26px}select,button{font:inherit;padding:8px}img{display:block;width:768px;max-width:100%;image-rendering:pixelated;margin-top:16px}p{max-width:850px;line-height:1.5}</style><h1>Truck-bed gameplay</h1><p>Actual game/lab Worker, player prediction and renderer. Articulated dump-truck mesh and existing character sprite. Lower body clips against the truck while the person can walk, jump and ride.</p><select id="pose"></select> <button id="debug">Show clipping geometry</button><p id="state"></p><img id="view"><p>Green: floor. Red: walls/tailgate. Blue: physical player body. Yellow: sprite plane. White: feet. Gray: cab/chassis. These images were captured from the playable Workshop scene.</p><p>Level-bed gameplay includes loose toys/food. Tip bed opens the rear gate and discharges loose contents; enclosed passenger seats remain next work. Sprite fallbacks use the physical profile as an approximate visual clip; loaded meshes use actual triangles.</p><script>const cases=${JSON.stringify(captures).replaceAll("<", "\\u003c")};const select=document.querySelector('#pose');let debug=false;for(const c of cases)select.add(new Option(c.name,c.id));select.value=cases.some(c=>c.id==='tip-loaded')?'tip-loaded':'loaded-bed';function draw(){const c=cases.find(c=>c.id===select.value);document.querySelector('#view').src=debug?c.debug:c.image;document.querySelector('#state').textContent='Feet height: '+c.state.playerZ.toFixed(2)+' | bed floor: '+c.state.floorZ.toFixed(2)+' | '+(c.state.supportId?'supported by truck':'airborne');}select.onchange=draw;document.querySelector('#debug').onclick=()=>{debug=!debug;draw()};draw();</script>`;
  await writeFile(resolve(output, "index.html"), gallery);
  await page.setContent(gallery);
  await page.screenshot({ path: resolve(output, "overview.png"), fullPage: true });
  if (process.argv.includes("--game")) {
    const result = await promisify(execFile)(
      process.execPath,
      [
        "--import",
        "tsx",
        "scripts/instrumentation/truck-bed-game.ts",
        `--base-url=${base}`,
        `--output=${output}`,
      ],
      {
        windowsHide: true,
        timeout: 120000,
        maxBuffer: 1024 * 1024,
      },
    );
    console.log(result.stdout.trim());
  }
} finally {
  await browser?.close();
  await server?.close();
}
