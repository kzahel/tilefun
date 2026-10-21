/** Ordinary GameClient/Worker editor, authority requests, touch and persistence. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { chromium, expect } from "@playwright/test";
import type { GameClient } from "../../src/client/GameClient.js";
import { chooseVehicleAction } from "../../tests/helpers/context-actions.js";
import { flushLocalWorld, stopLocalWorld } from "../../tests/helpers/local-world.js";

const base = process.argv.find((a) => a.startsWith("--base-url="))?.slice(11);
assert.ok(base, "Supply an isolated loopback server");
const output = resolve(
  process.argv.find((a) => a.startsWith("--output="))?.slice(9) ??
    "data/3d-investigation/towing-game",
);
assert.ok(output.startsWith(resolve("data") + sep));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chromium", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 850 }, hasTouch: true });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/tilefun/?nogamepad&renderer=gpu&meshes`);
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true", { timeout: 60000 });
  await page.evaluate(async () => {
    const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
    const generation = { type: "flat", version: "flat-v1", seed: 42, preset: "grass" } as const;
    const created = await g.gcSendRequest({
      type: "create-world",
      requestId: g.nextRequestId++,
      name: "Towing capture",
      generation,
    });
    await g.gcSendRequest({
      type: "join-realm",
      requestId: g.nextRequestId++,
      worldId: created.meta.id,
      arrival: { x: 0, y: 0, generation },
    });
    await g.gcSendRequest({
      type: "set-player-model",
      requestId: g.nextRequestId++,
      model: "character-person-v1",
    });
  });
  await page.getByTestId("main-menu-toggle").click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.locator('[data-editor-tab="vehicles"]').click();
  const picker = page.getByRole("group", { name: "Vehicle picker" });
  await picker.getByRole("button", { name: "Tow truck", exact: true }).click();
  const point = await page.evaluate(() => {
    const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
    const obstacles = [...g.stateView.entities, ...g.stateView.props];
    const choices = [-320, -240, 240, 320]
      .flatMap((wx) => [-240, 240].map((wy) => ({ wx, wy })))
      .filter((p) => {
        for (let cy = Math.floor((p.wy - 28) / 256); cy <= Math.floor((p.wy + 48) / 256); cy++)
          for (let cx = Math.floor((p.wx - 156) / 256); cx <= Math.floor((p.wx + 64) / 256); cx++)
            if (!g.stateView.world.getChunkIfLoaded(cx, cy)) return false;
        return true;
      })
      .map((p) => ({
        ...p,
        clearance: Math.min(
          ...obstacles.map(
            (e) =>
              Math.hypot(e.position.wx - (p.wx - 48), e.position.wy - p.wy) -
              Math.max(e.collider?.width ?? 0, e.collider?.height ?? 0) / 2,
          ),
        ),
      }))
      .sort((a, b) => b.clearance - a.clearance);
    const best = choices[0];
    if (!best || best.clearance < 160) throw Error("No clear loaded towing staging area");
    return best;
  });
  // Send the same normal placement command after checking both editor entries.
  const place = async (wx: number, wy: number, model: string) =>
    page.evaluate(
      ({ wx, wy, model }) => {
        const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
        g.transport.send({ type: "edit-spawn", entityType: `vehicle-v1:${model}`, wx, wy });
      },
      { wx, wy, model },
    );
  await place(point.wx, point.wy, "tow-truck");
  const facts = () =>
    page.evaluate(() => {
      const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game,
        entities = g.remoteView.serverEntities,
        truck = entities.find((e) => e.type === "vehicle-v1:tow-truck"),
        car = entities.find((e) => e.type === "vehicle-v1:beetle");
      return {
        truck: truck
          ? {
              id: truck.id,
              target: truck.towTargetId ?? null,
              wx: truck.position.wx,
              wy: truck.position.wy,
              heading: truck.vehicleHeading,
            }
          : null,
        car: car
          ? { id: car.id, owner: car.towedBy ?? null, wx: car.position.wx, wy: car.position.wy }
          : null,
        parent: g.remoteView.serverPlayerEntity.parentId ?? null,
      };
    });
  await expect.poll(async () => !!(await facts()).truck).toBe(true);
  await picker.getByRole("button", { name: "Beetle-style compact", exact: true }).click();
  await place(point.wx - 104, point.wy, "beetle");
  await expect.poll(async () => !!(await facts()).car).toBe(true);
  await page.getByRole("button", { name: "Exit editor", exact: true }).click();
  await page.evaluate(async ({ wx, wy }) => {
    const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
    await g.gcSendRequest({
      type: "rcon",
      requestId: g.nextRequestId++,
      command: `tp ${wx} ${wy + 40}`,
    });
    g.camera.zoom = 1;
    g.camera.requestSnap();
  }, point);
  await chooseVehicleAction(page, "Attach car");
  await expect.poll(async () => (await facts()).car?.owner).toBe((await facts()).truck?.id);
  await page.getByRole("button", { name: /Drive car/ }).click();
  await page.locator("#game").focus();
  await page.keyboard.down("ArrowRight");
  const start = (await facts()).truck?.wx ?? 0;
  try {
    await expect.poll(async () => (await facts()).truck?.wx ?? 0).toBeGreaterThan(start + 45);
  } finally {
    await page.keyboard.up("ArrowRight");
  }
  await expect(page.locator('[data-tow-action="release"]')).toHaveJSProperty("hidden", false);
  await page.screenshot({ path: resolve(output, "main-game.png") });
  await flushLocalWorld(page);
  await stopLocalWorld(page);
  await page.reload();
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true", { timeout: 60000 });
  await expect
    .poll(async () => {
      const f = await facts();
      return !!f.truck && !!f.car && f.car.owner === f.truck.id && f.truck.target === f.car.id;
    })
    .toBe(true);
  await expect(page.locator('[data-tow-action="release"]')).toHaveJSProperty("hidden", false);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('[data-tow-action="release"]')).toHaveJSProperty("hidden", false);
  await page.screenshot({ path: resolve(output, "mobile-game.png") });
  const controls = await page.locator("[data-vehicle-control]").boundingBox();
  assert.ok(
    controls &&
      controls.x >= 0 &&
      controls.x + controls.width <= 390 &&
      controls.y >= 0 &&
      controls.y + controls.height <= 844,
  );
  await chooseVehicleAction(page, "Release car", true);
  await expect.poll(async () => (await facts()).car?.owner).toBeNull();
  await writeFile(
    resolve(output, "main-game.json"),
    `${JSON.stringify({ facts: await facts(), errors }, null, 2)}\n`,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Normal game: editor placement, real tow requests, driven pair, reload and phone release pass.",
  );
} finally {
  await browser.close();
}
