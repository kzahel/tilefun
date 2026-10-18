import { expect, test } from "@playwright/test";
import { CURRENT_REGIONAL_VERSION } from "../src/generation/GenerationDescriptor.js";
import { DenseDistrictSource } from "../src/generation/regional/DenseDistrictPlanner.js";
import { shoppingSceneryPlacements } from "../src/generation/regional/ShoppingScenery.js";
import { regionalWorld } from "../src/generation/regional/WorldDescriptor.js";
import { exteriorDoors } from "../src/interiors/BuildingDoors.js";

for (const [kind, type] of [
  ["bakery", "prop-shopping-v1-1"],
  ["ice-cream", "prop-shopping-v1-3"],
]) {
  test(`mall ${kind}: walk in and out, reenter and reload the same shop`, async ({ page }) => {
    const center = new DenseDistrictSource(regionalWorld(2026), true).owner(0, 0)
      ?.shoppingCenters?.[0];
    if (!center) throw new Error("Missing mall");
    const shop = shoppingSceneryPlacements(center).find((p) => p.propType === type);
    if (!shop) throw new Error("Missing storefront");
    const door = exteriorDoors({ type: shop.propType, position: { wx: shop.wx, wy: shop.wy } })[0];
    if (!door) throw new Error("Missing mall door");
    const generation = {
      type: "regional",
      version: CURRENT_REGIONAL_VERSION,
      seed: 2026,
      preset: "temperate-v1",
    };
    const arrival = { x: door.outside.wx / 16, y: (door.outside.wy + 48) / 16, generation };
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `/tilefun/?generation=${encodeURIComponent(JSON.stringify(generation))}&arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
    );
    await page.getByRole("button", { name: "New World", exact: true }).click();
    await expect(page.getByRole("button", { name: "New World", exact: true })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
    const game = page.locator("#game");
    await expect(game).toHaveAttribute("data-ready", "true");
    await page.waitForFunction(() => {
      const game = (
        document.querySelector("#game") as unknown as {
          __game: import("../src/client/GameClient.js").GameClient;
        }
      ).__game;
      const p = game.stateView.playerEntity.position;
      return (
        !game.stateView.editorEnabled &&
        game.renderer.isTerrainReady(
          game.stateView.world.chunks.get(Math.floor(p.wx / 256), Math.floor(p.wy / 256)),
        )
      );
    });
    await page.screenshot({ path: `/tmp/tilefun-mall-${kind}-street.png` });
    await page.keyboard.down("ArrowUp");
    const fade = page.locator('[data-door-fade="true"]');
    await page.waitForFunction(
      () =>
        document.querySelector('[data-door-fade="true"]')?.getAttribute("data-stage") === "depart",
    );
    await page.keyboard.up("ArrowUp");
    await expect(game).toHaveAttribute("data-interior", /interior-v1/);
    await expect(fade).toHaveAttribute("data-stage", "idle");
    const state = () =>
      page.evaluate(() => {
        const game = (
          document.querySelector("#game") as unknown as {
            __game: import("../src/client/GameClient.js").GameClient;
          }
        ).__game;
        return {
          interior: game.stateView.interior,
          player: (game.stateView as import("../src/client/ClientStateView.js").RemoteStateView)
            .serverPlayerEntity.position,
        };
      });
    const before = await state();
    expect(before.interior?.featureId).toBe(shop.featureId);
    expect(before.interior?.layout).toBe("restaurant-v3");
    await page.screenshot({ path: `/tmp/tilefun-mall-${kind}-interior.png` });
    // Leave the arrival latch, then physically walk out through the entrance.
    await page.keyboard.down("ArrowUp");
    const inside = before.interior?.doors?.[0]?.inside;
    if (!inside) throw new Error("Missing interior entrance");
    await expect.poll(async () => (await state()).player.wy).toBeLessThan(inside.wy - 40);
    await page.keyboard.up("ArrowUp");
    await page.keyboard.down("ArrowDown");
    await page.waitForFunction(
      () =>
        document.querySelector('[data-door-fade="true"]')?.getAttribute("data-stage") === "depart",
    );
    await page.keyboard.up("ArrowDown");
    await expect(game).toHaveAttribute("data-interior", "");
    await expect(fade).toHaveAttribute("data-stage", "idle");
    await expect.poll(async () => (await state()).player).toEqual(door.outside);
    await page.getByRole("button", { name: /^Enter shop/ }).click();
    await expect(game).toHaveAttribute("data-interior", /interior-v1/);
    await page.goto("/tilefun/");
    await expect(game).toHaveAttribute("data-ready", "true");
    await expect(game).toHaveAttribute("data-interior", /interior-v1/);
    expect((await state()).interior).toEqual(before.interior);
    await page.getByRole("button", { name: /Return to street/ }).click();
    await expect(game).toHaveAttribute("data-interior", "");
    await expect.poll(async () => (await state()).player).toEqual(door.outside);
    expect(errors).toEqual([]);
  });
}
