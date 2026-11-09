import { expect, type Page, test } from "@playwright/test";
import type { GameTestHooks } from "../src/client/GameTestHooks.js";
import { flushLocalWorld, stopLocalWorld, worldRecords } from "./helpers/local-world.js";

test.use({ channel: "chromium", hasTouch: true });
function game(page: Page) {
  return page.evaluate(() => {
    const gc = (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game;
    return gc.stateView.serverEntities
      .filter((e) => e.type.startsWith("vehicle-v1:"))
      .map((e) => ({ id: e.id, type: e.type, paint: e.paintSchemeId, sheet: e.sprite?.sheetKey }));
  });
}

const model = "beetle",
  label = "Beetle-style compact",
  paint = "teal",
  paintLabel = "Lagoon teal";
test(`mobile editor places and reloads ${model}/${paint} on GPU`, async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 600, height: 800 });
  await page.goto("/tilefun/?nogamepad");
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await page.evaluate(async () => {
    const gc = (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game;
    const generation = { type: "flat", version: "flat-v1", seed: 42, preset: "grass" } as const;
    const created = await gc.gcSendRequest({
      type: "create-world",
      requestId: gc.nextRequestId++,
      name: "Painted cars",
      generation,
    });
    await gc.gcSendRequest({
      type: "join-realm",
      requestId: gc.nextRequestId++,
      worldId: created.meta.id,
      arrival: { x: 0, y: 0, generation },
    });
  });
  await page.getByTestId("main-menu-toggle").tap();
  await page.getByRole("button", { name: "Edit", exact: true }).tap();
  await page.locator('[data-editor-tab="vehicles"]').tap();
  await page
    .getByRole("group", { name: "Vehicle picker", exact: true })
    .getByRole("button", { name: label, exact: true })
    .tap();
  const paints = page.getByRole("group", { name: "Vehicle paint", exact: true });
  await paints.getByRole("button", { name: `Paint: ${paintLabel}`, exact: true }).tap();
  await expect(
    paints.getByRole("button", { name: `Paint: ${paintLabel}`, exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const point = await page.evaluate(() => {
    const canvas = document.querySelector("#game") as HTMLCanvasElement;
    const gc = (canvas as unknown as { __game: GameTestHooks }).__game;
    const points = [-160, 0, 160].flatMap((wx) => [-160, 0, 160].map((wy) => ({ wx, wy })));
    const spot = points
      .map((p) => ({
        ...p,
        clearance: Math.min(
          ...gc.stateView.serverEntities.map((e) =>
            Math.hypot(e.position.wx - p.wx, e.position.wy - p.wy),
          ),
        ),
      }))
      .sort((a, b) => b.clearance - a.clearance)[0];
    if (!spot || spot.clearance < 100) throw Error("No clear vehicle footprint");
    gc.camera.zoom = 1 / 3;
    gc.camera.snapTo(spot.wx, spot.wy + 160);
    const p = gc.camera.worldToScreen(spot.wx, spot.wy),
      rect = canvas.getBoundingClientRect();
    return {
      x: rect.left + (p.sx * rect.width) / canvas.width,
      y: rect.top + (p.sy * rect.height) / canvas.height,
    };
  });
  await page.touchscreen.tap(point.x, point.y);
  await expect
    .poll(() => game(page))
    .toEqual([
      expect.objectContaining({
        type: `vehicle-v1:${model}`,
        paint,
        sheet: `vehicle-v1:${model}:paint:${paint}`,
      }),
    ]);
  await flushLocalWorld(page);
  const records = (await worldRecords(page)).filter((r) => r.collection === "traffic");
  expect(records.some((r) => (r.value as { paintSchemeId?: string }).paintSchemeId === paint)).toBe(
    true,
  );
  await page.screenshot({
    path: `data/vehicle-bake/paint-runtime-qa/${model}-editor.png`,
  });
  await page.getByRole("button", { name: "Exit editor", exact: true }).tap();
  const car = await page.evaluate(async () => {
    const gc = (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game;
    const vehicle = gc.stateView.serverEntities.find((e) => e.type.startsWith("vehicle-v1:"));
    if (!vehicle) throw Error("Missing painted car");
    await gc.gcSendRequest({
      type: "rcon",
      requestId: gc.nextRequestId++,
      command: `tp ${vehicle.position.wx} ${vehicle.position.wy - 16}`,
    });
    return { id: vehicle.id, wx: vehicle.position.wx };
  });
  await page.getByRole("button", { name: /^Drive car(?: · [^\s·]{1,3})?$/ }).tap();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const gc = (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game;
        const vehicle = gc.stateView.entities.find(
          (e) => e.id === gc.stateView.playerEntity.parentId,
        );
        return {
          id: vehicle?.id,
          paint: vehicle?.paintSchemeId,
          sheet: vehicle?.sprite?.sheetKey,
        };
      }),
    )
    .toEqual({ id: car.id, paint, sheet: `vehicle-v1:${model}:paint:${paint}` });
  await page.locator("#game").focus();
  // Cars default to relative steering (f1cd9d28): Up drives forward, Right steers.
  await page.keyboard.down("ArrowUp");
  await expect
    .poll(() =>
      page.evaluate((id) => {
        const gc = (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game;
        return gc.stateView.serverEntities.find((e) => e.id === id)?.position.wx ?? 0;
      }, car.id),
    )
    .toBeGreaterThan(car.wx + 30);
  await page.keyboard.up("ArrowUp");
  await flushLocalWorld(page);
  await stopLocalWorld(page);
  await page.goto("/tilefun/?nogamepad");
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await expect
    .poll(() => game(page))
    .toEqual([expect.objectContaining({ paint, sheet: `vehicle-v1:${model}:paint:${paint}` })]);
  await expect(page.getByRole("button", { name: /^Get out(?: · [^\s·]{1,3})?$/ })).toBeVisible();
});
