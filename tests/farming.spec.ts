import { expect, test } from "@playwright/test";
import type { GameTestHooks } from "../src/client/GameTestHooks.js";
import { CHICKEN_FEEDER } from "../src/farming/FarmActors.js";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";
import { stopLocalWorld } from "./helpers/local-world.js";

test.use({ channel: "chromium", hasTouch: true });

test("finds a town farm from the map and plants, waters, harvests and feeds in Play", async ({
  page,
}) => {
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
  await page.keyboard.press("e");
  await expect(action("Water corn")).toBeVisible();
  await action("Water corn").tap();
  await expect(action("Harvest corn")).toBeVisible({ timeout: 22_000 });
  await action("Harvest corn").tap();
  await expect(page.getByTestId("farm-basket")).toHaveText(/🌽 1/);

  // Select the feeder from the streamed farm. Only the walk there is skipped.
  await page.evaluate(async (type) => {
    const g = (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game;
    const feeder = g.stateView.entities.find((e) => e.type === type);
    if (!feeder) throw Error("The farm's feeder did not stream");
    await g.gcSendRequest({
      type: "rcon",
      requestId: g.nextRequestId++,
      command: `tp ${feeder.position.wx} ${feeder.position.wy + 17}`,
    });
  }, CHICKEN_FEEDER);
  await action("Feed chickens").tap();
  await expect(page.getByTestId("farm-basket")).toHaveText(/🌽 0/);
  await stopLocalWorld(page);
});
