import { expect, test } from "@playwright/test";
import { CURRENT_REGIONAL_VERSION } from "../src/generation/GenerationDescriptor.js";
import { DenseDistrictSource } from "../src/generation/regional/DenseDistrictPlanner.js";
import { regionalWorld } from "../src/generation/regional/WorldDescriptor.js";
import { exteriorDoors } from "../src/interiors/BuildingDoors.js";

test.use({ channel: "chromium" });
for (const renderer of ["canvas", "gpu"])
  for (const [kind, layout, count] of [
    ["condo-bay", "home-v3", 4],
    ["bakery", "restaurant-v3", 5],
    ["butcher", "market-v3", 2],
  ] as const) {
    test(`${renderer}: ${layout} renders furnishings and animated residents in ordinary gameplay`, async ({
      page,
    }) => {
      const lot = new DenseDistrictSource(regionalWorld(2026), true)
        .owner(0, 0)
        ?.blocks.flatMap((b) => b.lots)
        .find((l) => l.buildingType.includes(kind));
      if (!lot) throw new Error("Missing building");
      const door = exteriorDoors({
        type: lot.buildingType,
        position: { wx: lot.anchor.x * 16, wy: lot.anchor.y * 16 },
      })[0];
      if (!door) throw new Error("Missing entrance");
      const generation = {
        type: "regional",
        version: CURRENT_REGIONAL_VERSION,
        seed: 2026,
        preset: "temperate-v1",
      };
      const arrival = { x: door.outside.wx / 16, y: door.outside.wy / 16, generation };
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(
        `/tilefun/?renderer=${renderer}&generation=${encodeURIComponent(JSON.stringify(generation))}&arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
      );
      await page.getByRole("button", { name: "New World", exact: true }).click();
      await expect(page.getByTestId("world-menu")).toBeHidden();
      await page.getByRole("button", { name: /^Enter (shop|apartment)/ }).click();
      await expect(page.locator("#game")).toHaveAttribute("data-interior", /interior-v1/);
      await expect(page.locator('[data-door-fade="true"]')).toHaveAttribute("data-stage", "idle");
      const state = () =>
        page.locator("#game").evaluate((canvas) => {
          const game = (
            canvas as unknown as { __game: import("../src/client/GameClient.js").GameClient }
          ).__game;
          return {
            layout: game.stateView.interior?.layout,
            actors: game.stateView.entities
              .filter(
                (e) => e.type.startsWith("indoor-") || e.type === "wildlife-cat-provisional-v1",
              )
              .map((e) => ({
                type: e.type,
                x: e.position.wx,
                y: e.position.wy,
                frame: e.sprite?.frameCol,
              })),
          };
        });
      await expect.poll(async () => (await state()).actors.length).toBe(count);
      const initial = await state();
      expect(initial.layout).toBe(layout);
      if (kind === "condo-bay")
        expect(initial.actors.some((e) => e.type === "wildlife-cat-provisional-v1")).toBe(true);
      await expect
        .poll(async () => (await state()).actors.map((e) => e.frame), { timeout: 12000 })
        .not.toEqual(initial.actors.map((e) => e.frame));
      await page.screenshot({ path: `/tmp/tilefun-lived-in-${layout}-${renderer}.png` });
      await expect
        .poll(async () => (await state()).actors.map((e) => [e.x, e.y]), { timeout: 14000 })
        .not.toEqual(initial.actors.map((e) => [e.x, e.y]));
      expect(errors).toEqual([]);
    });
  }

test("new lived-in room compositions have registered, renderable review identities", async ({
  page,
}) => {
  for (const room of ["home", "restaurant", "market"]) {
    await page.goto(`/tilefun/workshop.html#/review/lived-in-v3-${room}?show=all`);
    await expect(page.locator('[data-review-ready="true"]')).toBeVisible();
  }
});
