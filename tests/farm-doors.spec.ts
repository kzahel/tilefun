import { expect, test } from "@playwright/test";
import type { GameClient } from "../src/client/GameClient.js";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";
import { FarmsteadSource } from "../src/generation/regional/FarmsteadPlanner.js";
import { regionalWorld } from "../src/generation/regional/WorldDescriptor.js";
import { exteriorDoors } from "../src/interiors/BuildingDoors.js";
import { stopLocalWorld } from "./helpers/local-world.js";

test.use({ channel: "chromium" });
test("farmhouse and tiny outbuilding enter and return through the normal door controls", async ({
  page,
}) => {
  const farm = new FarmsteadSource(regionalWorld(2026)).owner(0, 0, "south");
  if (!farm) throw Error("Missing farm");
  const buildings = farm.props.filter(
    (p) => p.propType === "prop-country-house" || p.propType === "prop-shed",
  );
  const generation = createDescriptor("regional", 2026);
  await page.goto("/tilefun/?nogamepad&renderer=gpu&meshes");
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await page.evaluate(
    async ({ generation, x, y }) => {
      const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
      const world = await g.gcSendRequest({
        type: "create-world",
        requestId: g.nextRequestId++,
        name: "Farm doors",
        generation,
      });
      await g.gcSendRequest({
        type: "join-realm",
        requestId: g.nextRequestId++,
        worldId: world.meta.id,
        arrival: { x, y, generation },
      });
    },
    { generation, x: farm.center.x, y: farm.center.y },
  );
  for (const prop of buildings) {
    const door = exteriorDoors({ type: prop.propType, position: { wx: prop.wx, wy: prop.wy } })[0];
    if (!door) throw Error("Missing farm door");
    await page.evaluate(async (outside) => {
      const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
      await g.gcSendRequest({
        type: "rcon",
        requestId: g.nextRequestId++,
        command: `tp ${outside.wx} ${outside.wy}`,
      });
    }, door.outside);
    await page
      .getByRole("button", {
        name: prop.propType === "prop-shed" ? /^Enter outbuilding/ : /^Enter home/,
      })
      .click();
    await expect(page.locator("#game")).toHaveAttribute("data-interior", /interior-v1/);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
          return g.stateView.interior?.buildingType;
        }),
      )
      .toBe(prop.propType);
    if (prop.propType === "prop-shed")
      await page.screenshot({ path: "/tmp/tilefun-farm-outbuilding.png" });
    await page.getByRole("button", { name: /Return to street/ }).click();
    await expect(page.locator("#game")).toHaveAttribute("data-interior", "");
    await expect
      .poll(() =>
        page.evaluate(() => {
          const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
          return g.remoteView.serverPlayerEntity.position;
        }),
      )
      .toEqual(door.outside);
  }
  await stopLocalWorld(page);
});
