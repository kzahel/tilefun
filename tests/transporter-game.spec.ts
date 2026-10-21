import { expect, test } from "@playwright/test";
import type { GameClient } from "../src/client/GameClient.js";
import { chooseVehicleAction } from "./helpers/context-actions.js";
import { flushLocalWorld, stopLocalWorld } from "./helpers/local-world.js";

test.use({ channel: "chromium", hasTouch: true, viewport: { width: 1200, height: 850 } });
test("normal editor, vehicle requests and saved world retain the loaded transporter", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/tilefun/?nogamepad&renderer=gpu&meshes");
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true", { timeout: 60000 });
  await page.evaluate(async () => {
    const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
    const generation = { type: "flat", version: "flat-v1", seed: 42, preset: "grass" } as const;
    const created = await g.gcSendRequest({
      type: "create-world",
      requestId: g.nextRequestId++,
      name: "Car transporter",
      generation,
    });
    await g.gcSendRequest({
      type: "join-realm",
      requestId: g.nextRequestId++,
      worldId: created.meta.id,
      arrival: { x: 12 / 16, y: 44 / 16, generation },
    });
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
        return (
          Math.abs(g.remoteView.serverPlayerEntity.position.wy - 44) < 1 &&
          [-1, 0].every((x) => [-1, 0].every((y) => !!g.stateView.world.getChunkIfLoaded(x, y)))
        );
      }),
    )
    .toBe(true);
  await page.getByTestId("main-menu-toggle").click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.locator('[data-editor-tab="vehicles"]').click();
  await page
    .getByRole("group", { name: "Vehicle picker" })
    .getByRole("button", { name: "Car transporter", exact: true })
    .click();
  await expect(page.getByTestId("editor-selection")).toHaveText("Car transporter");
  // Isolate the contact fixture, then use the production editor command path.
  await page.evaluate(() => {
    const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
    for (const e of g.remoteView.serverEntities)
      if (e.type !== "player") g.transport.send({ type: "edit-delete-entity", entityId: e.id });
    g.transport.send({
      type: "edit-spawn",
      entityType: "vehicle-v1:car-transporter",
      wx: 0,
      wy: 0,
    });
    g.transport.send({ type: "edit-spawn", entityType: "vehicle-v1:beetle", wx: -205, wy: 0 });
  });
  await page.getByRole("button", { name: "Exit editor", exact: true }).click();
  const facts = () =>
    page.evaluate(() => {
      const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
      const truck = g.remoteView.serverEntities.find(
          (e) => e.type === "vehicle-v1:car-transporter",
        ),
        car = g.remoteView.serverEntities.find((e) => e.type === "vehicle-v1:beetle");
      const p = g.remoteView.serverPlayerEntity;
      return {
        parent: p.parentId ?? null,
        truck: truck
          ? {
              id: truck.id,
              x: truck.position.wx,
              load: truck.transportLoadId ?? null,
              ramp: truck.vehicleRamp === 1,
            }
          : null,
        car: car
          ? { id: car.id, x: car.position.wx, z: car.wz ?? 0, owner: car.transportedBy ?? null }
          : null,
      };
    });
  await expect.poll(async () => (await facts()).car).not.toBeNull();
  await chooseVehicleAction(page, "Deploy ramp");
  await page.evaluate(async () => {
    const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
    await g.gcSendRequest({ type: "rcon", requestId: g.nextRequestId++, command: "tp -205 40" });
  });
  await page.getByRole("button", { name: /Drive car/ }).click();
  await page.locator("#game").focus();
  await page.keyboard.down("ArrowRight");
  try {
    await expect
      .poll(async () => (await facts()).car?.x ?? -999, { intervals: [20], timeout: 15000 })
      .toBeGreaterThan(-32);
  } finally {
    await page.keyboard.up("ArrowRight");
  }
  await page.getByRole("button", { name: /Get out/ }).click();
  await chooseVehicleAction(page, "Secure car");
  await chooseVehicleAction(page, "Stow ramp");
  await page.getByRole("button", { name: /Drive transporter/ }).click();
  await page.locator("#game").focus();
  await page.keyboard.down("ArrowRight");
  try {
    await expect.poll(async () => (await facts()).truck?.x ?? 0).toBeGreaterThan(40);
  } finally {
    await page.keyboard.up("ArrowRight");
  }
  await expect.poll(async () => (await facts()).car?.owner).toBe((await facts()).truck?.id);
  await page.screenshot({ path: testInfo.outputPath("main-game-loaded.png") });
  await flushLocalWorld(page);
  await stopLocalWorld(page);
  await page.reload();
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true", { timeout: 60000 });
  await expect
    .poll(async () => {
      const f = await facts();
      return !!f.truck && !!f.car && f.truck.load === f.car.id && f.car.owner === f.truck.id;
    })
    .toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("[data-context-actions]").tap();
  await expect(
    page.getByTestId("context-actions").getByRole("button", { name: "Deploy ramp", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("phone-actions.png") });
  expect(errors).toEqual([]);
});
