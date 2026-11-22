import { expect, test } from "@playwright/test";
import type { GameTestHooks } from "../src/client/GameTestHooks.js";
import { EGG_POSE, FARM_EGG } from "../src/farming/FarmActors.js";
import { ROOSTER } from "../src/farming/FarmFowl.js";
import { FARM_GATE } from "../src/farming/FarmGate.js";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";
import { CORN } from "../src/inventory/Inventory.js";
import { stopLocalWorld } from "./helpers/local-world.js";

test.use({ channel: "chromium", hasTouch: true });

test("finds a town farm, feeds its flock and breaks a newly laid egg", async ({ page }) => {
  test.setTimeout(90_000);
  const generation = createDescriptor("regional", 2026);
  const game = page.locator("#game");
  const action = (name: string) => page.getByRole("button", { name: new RegExp(`^${name}`) });
  await page.goto("/tilefun/?nogamepad");
  await expect(game).toHaveAttribute("data-ready", "true");
  await page.evaluate(async (generation) => {
    const g = (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game;
    const world = await g.gcSendRequest({
      type: "create-world",
      requestId: g.nextRequestId++,
      name: "Town garden",
      generation,
    });
    await g.gcSendRequest({
      type: "join-realm",
      requestId: g.nextRequestId++,
      worldId: world.meta.id,
    });
  }, generation);

  await page.getByRole("button", { name: "Open world map" }).tap();
  const farm = page.getByTestId("world-map-farm").first();
  await expect(farm).toHaveAttribute("data-farm-id", /^town-farm:/);
  await farm.tap();
  await page.getByRole("button", { name: "Travel to selected point" }).tap();
  await expect(page.getByTestId("world-map")).toBeHidden();
  await expect(action("Plant corn")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate((type) => {
        const g = (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game;
        return g.stateView.entities.some((actor) => actor.type === type);
      }, ROOSTER),
    )
    .toBe(true);
  await page.keyboard.press("e");
  await expect(action("Water corn")).toBeVisible();
  await action("Water corn").tap();
  await expect(action("Harvest corn")).toBeVisible({ timeout: 22_000 });
  await action("Harvest corn").tap();
  const hotbar = page.getByRole("group", { name: "Hotbar" });
  const corn = hotbar.getByRole("button", { name: "Corn ×1" });
  await expect(corn).toBeVisible();
  // New players carry the ball, stick and axe ahead of the harvest.
  await expect(hotbar.getByRole("button", { name: "Ball" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await corn.click();
  await expect(corn).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const g = (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game;
        return (g.stateView.serverPlayerEntity.hand ?? 0) & 31;
      }),
    )
    .toBe(CORN);

  // Stage short approaches; the real Play control opens the generated gate.
  const gate = await page.evaluate(async (type) => {
    const g = (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game;
    const gate = g.stateView.props.find((prop) => prop.type === type);
    if (!gate) throw Error("The farm's gate did not stream");
    const { wx, wy } = gate.position;
    await g.gcSendRequest({
      type: "rcon",
      requestId: g.nextRequestId++,
      command: `tp ${wx} ${wy + 22}`,
    });
    return gate.position;
  }, FARM_GATE);
  await action("Open gate").tap();
  await expect(action("Close gate")).toBeVisible();
  await page.evaluate(async ({ wx, wy }) => {
    const g = (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game;
    await g.gcSendRequest({
      type: "rcon",
      requestId: g.nextRequestId++,
      command: `tp ${wx} ${wy - 47}`,
    });
  }, gate);
  await action("Scatter corn").tap();
  await expect(hotbar.getByRole("button", { name: "Empty slot 4" })).toBeVisible();
  await expect(hotbar.getByRole("button", { pressed: true })).toHaveCount(0);

  const fertileEgg = () =>
    page.evaluate(
      ({ type, clip }) => {
        const g = (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game;
        return g.stateView.entities
          .filter((actor) => actor.type === type && actor.sprite?.clip === clip)
          .sort((a, b) => a.position.wy - b.position.wy)[0]?.id;
      },
      { type: FARM_EGG, clip: EGG_POSE.incubating },
    );
  await expect.poll(fertileEgg, { timeout: 30_000 }).toBeDefined();
  const eggId = await fertileEgg();
  await page.evaluate(async (id) => {
    const g = (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game;
    const egg = g.stateView.entities.find((actor) => actor.id === id);
    if (!egg) throw Error("Missing fertile egg");
    const { wx, wy } = egg.position;
    await g.gcSendRequest({
      type: "rcon",
      requestId: g.nextRequestId++,
      command: `tp ${wx} ${wy}`,
    });
  }, eggId);
  await expect(
    page.locator(".farm-control").getByText("Fertile egg · hatching soon"),
  ).toBeVisible();
  await action("Break egg").tap();
  await expect
    .poll(() =>
      page.evaluate((id) => {
        const g = (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game;
        return g.stateView.entities.find((actor) => actor.id === id)?.sprite?.clip;
      }, eggId),
    )
    .toBe(EGG_POSE.broken);
  await stopLocalWorld(page);
});
