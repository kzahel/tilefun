/** Normal GameClient/Worker capture. Supply an isolated dev/preview server. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { chromium, expect } from "@playwright/test";
import type { GameClient } from "../../src/client/GameClient.js";

const base = process.argv.find((arg) => arg.startsWith("--base-url="))?.slice(11);
assert.ok(base, "Provide --base-url=http://127.0.0.1:PORT for an isolated server");
const output = resolve(
  process.argv.find((arg) => arg.startsWith("--output="))?.slice(9) ??
    "data/3d-investigation/truck-bed-gameplay",
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
      name: "Truck bed capture",
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
  await page
    .getByRole("group", { name: "Vehicle picker" })
    .getByRole("button", { name: "Construction dump truck", exact: true })
    .click();
  await expect(page.getByTestId("editor-selection")).toHaveText("Construction dump truck");
  const point = await page.evaluate(() => {
    const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
    const point = [-200, -120, 120, 200]
      .flatMap((wx) => [-200, -120, 120, 200].map((wy) => ({ wx, wy })))
      .map((p) => ({
        ...p,
        clearance: Math.min(
          ...g.stateView.entities.map((e) =>
            Math.hypot(e.position.wx - p.wx, e.position.wy - p.wy),
          ),
        ),
      }))
      .sort((a, b) => b.clearance - a.clearance)[0];
    if (!point || point.clearance < 100) throw Error("No clear loaded truck footprint");
    g.camera.zoom = 1 / 3;
    g.camera.snapTo(point.wx, point.wy + 160);
    const p = g.camera.worldToScreen(point.wx, point.wy);
    const canvas = document.querySelector("#game") as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    return {
      ...point,
      x: rect.left + (p.sx * rect.width) / canvas.width,
      y: rect.top + (p.sy * rect.height) / canvas.height,
    };
  });
  await page.mouse.click(point.x, point.y);
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          (
            document.querySelector("#game") as unknown as { __game: GameClient }
          ).__game.stateView.entities.some((e) => e.type === "vehicle-v1:dump-truck"),
        ),
      { timeout: 15000 },
    )
    .toBe(true);
  await page.evaluate(({ wx, wy }) => {
    const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
    g.transport.send({
      type: "edit-spawn",
      entityType: "wildlife-resource-fruit-v1",
      wx: wx - 20,
      wy: wy + 42,
    });
  }, point);
  await page.getByRole("button", { name: "Exit editor", exact: true }).click();
  await page.evaluate(async ({ wx, wy }) => {
    const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
    await g.gcSendRequest({
      type: "rcon",
      requestId: g.nextRequestId++,
      command: `tp ${wx - 20} ${wy + 43}`,
    });
  }, point);
  await page.getByRole("button", { name: "Load cargo", exact: true }).click();
  await page.getByRole("button", { name: "Ride in bed", exact: true }).click();
  const state = () =>
    page.evaluate(() => {
      const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
      const truck = g.remoteView.serverEntities.find((e) => e.type === "vehicle-v1:dump-truck");
      const cargo = g.remoteView.serverEntities.find(
        (e) => e.type === "wildlife-resource-fruit-v1",
      );
      return {
        playerZ: g.remoteView.serverPlayerEntity.wz,
        playerPosition: g.remoteView.serverPlayerEntity.position,
        parent: g.remoteView.serverPlayerEntity.parentId,
        truck: truck && {
          id: truck.id,
          bed: truck.vehicleBed,
          tilt: truck.vehicleBedTilt ?? 0,
          position: truck.position,
          wz: truck.wz,
        },
        cargo: cargo && { id: cargo.id, wz: cargo.wz, parent: cargo.parentId },
        diagnostics: g.renderer.getDiagnostics(),
      };
    });
  await expect.poll(async () => (await state()).playerZ).toBeCloseTo((400 / 23) * 1.25);
  await page.locator("#game").focus();
  await page.keyboard.down("ArrowRight");
  await page.keyboard.down("ArrowUp");
  try {
    await expect
      .poll(async () => (await state()).playerPosition.wx - point.wx)
      .toBeGreaterThan(-22);
    await expect.poll(async () => (await state()).playerPosition.wy - point.wy).toBeLessThan(-3);
  } finally {
    await page.keyboard.up("ArrowRight");
    await page.keyboard.up("ArrowUp");
  }
  await expect
    .poll(
      async () =>
        ((await state()).diagnostics as { gpu?: { vehicleBedDraws?: number } }).gpu
          ?.vehicleBedDraws ?? 0,
    )
    .toBeGreaterThan(0);
  await page.evaluate(() => {
    const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
    g.camera.zoom = 1;
    g.camera.requestSnap();
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const canvas = document.querySelector("#game") as HTMLCanvasElement;
        const g = (canvas as unknown as { __game: GameClient }).__game;
        const p = g.stateView.playerEntity.position;
        return Math.abs(g.camera.worldToScreen(p.wx, p.wy).sx - canvas.width / 2);
      }),
    )
    .toBeLessThan(30);
  await page.screenshot({ path: resolve(output, "main-game.png") });
  const facts = await state();
  assert.equal(facts.truck?.bed, true);
  assert.equal(facts.parent, undefined);
  assert.equal(facts.cargo?.parent, undefined);
  assert.ok(Math.abs((facts.cargo?.wz ?? 0) - (facts.playerZ ?? 0)) < 0.1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Climb out", exact: true }).tap();
  await page.getByRole("button", { name: "Ride in bed", exact: true }).tap();
  await expect.poll(async () => (await state()).playerZ).toBeCloseTo((400 / 23) * 1.25);
  const controls = await page.locator("[data-vehicle-control]").boundingBox();
  assert.ok(
    controls &&
      controls.x >= 0 &&
      controls.x + controls.width <= 390 &&
      controls.y >= 0 &&
      controls.y + controls.height <= 844,
  );
  await page.screenshot({ path: resolve(output, "mobile-game.png") });
  await page.getByRole("button", { name: "Tip bed", exact: true }).tap();
  await expect.poll(async () => (await state()).truck?.tilt ?? 0).toBeGreaterThan(0.28);
  await page.screenshot({ path: resolve(output, "mobile-game-tipping.png") });
  await page.getByRole("button", { name: "Lower bed", exact: true }).tap();
  await expect.poll(async () => (await state()).truck?.tilt ?? 99).toBe(0);
  assert.deepEqual(errors, []);
  await writeFile(
    resolve(output, "main-game.json"),
    `${JSON.stringify({ schema: "tilefun-truck-bed-game-capture-v1", facts, errors }, null, 2)}\n`,
  );
  console.log(
    "Normal game: editor placement, real cargo request, independent bed boarding and GPU composition pass.",
  );
} finally {
  await browser.close();
}
