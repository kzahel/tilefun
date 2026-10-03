import { expect, test } from "@playwright/test";
import { DenseDistrictSource } from "../src/generation/regional/DenseDistrictPlanner.js";
import { regionalWorld } from "../src/generation/regional/WorldDescriptor.js";
import { exteriorDoors } from "../src/interiors/BuildingDoors.js";

for (const kind of ["butcher", "condo-bay"]) {
  test(`${kind}: walk between entrances, exit at the selected door and reload indoors`, async ({
    page,
  }) => {
    const lot = new DenseDistrictSource(regionalWorld(2026), true)
      .owner(0, 0)
      ?.blocks.flatMap((b) => b.lots)
      .find((l) => l.buildingType.includes(kind));
    if (!lot) throw new Error("Missing building");
    const doors = exteriorDoors({
      type: lot.buildingType,
      position: { wx: lot.anchor.x * 16, wy: lot.anchor.y * 16 },
    });
    const secondary = doors[1];
    if (!secondary) throw new Error("Missing second entrance");
    const generation = {
      type: "regional",
      version: "regional-v5",
      seed: 2026,
      preset: "temperate-v1",
    };
    const arrival = { x: secondary.outside.wx / 16, y: secondary.outside.wy / 16, generation };
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `/tilefun/?generation=${encodeURIComponent(JSON.stringify(generation))}&arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
    );
    await page.getByRole("button", { name: "New World", exact: true }).click();
    await page.getByRole("button", { name: /^Enter (shop|apartment)/ }).click();
    await expect(page.locator("#game")).toHaveAttribute("data-interior", /interior-v1/);
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
    expect(before.interior?.layout).toBe(kind === "butcher" ? "shop-v2" : "apartment-v2");
    const entry = before.interior?.doors?.find((d) => d.id === secondary.id);
    const exit = before.interior?.doors?.find((d) => d.id === "street");
    if (!entry || !exit) throw new Error("Missing room doors");
    await expect.poll(async () => (await state()).player).toEqual(entry.arrival);
    await page.screenshot({ path: `/tmp/tilefun-building-${kind}-interior.png` });
    // Traverse the shared hall with real input and collision; no teleporting across walls.
    const direction = exit.arrival.wx > entry.arrival.wx ? "ArrowRight" : "ArrowLeft";
    await page.keyboard.down(direction);
    await expect
      .poll(async () => Math.abs((await state()).player.wx - exit.arrival.wx))
      .toBeLessThan(15);
    await page.keyboard.up(direction);
    await page.getByRole("button", { name: /Return to street/ }).click();
    await expect(page.locator("#game")).toHaveAttribute("data-interior", "");
    await expect
      .poll(async () => {
        const outside = (await state()).player;
        return Math.hypot(outside.wx - exit.outside.wx, outside.wy - exit.outside.wy);
      })
      .toBeLessThan(2);
    await page.getByRole("button", { name: /^Enter (shop|apartment)/ }).click();
    await expect(page.locator("#game")).toHaveAttribute("data-interior", /interior-v1/);
    await page.goto("/tilefun/");
    await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
    await expect(page.locator("#game")).toHaveAttribute("data-interior", /interior-v1/);
    expect((await state()).interior).toEqual(before.interior);
    await expect.poll(async () => (await state()).player).toEqual(exit.arrival);
    expect(errors).toEqual([]);
  });
}

test("all four playable layouts have usable Workshop previews", async ({ page }) => {
  for (const id of ["butcher", "bay-apartment", "shop", "apartment"]) {
    await page.goto(`/tilefun/workshop.html#/review/building-layout-v2-${id}?show=all`);
    // ReviewPage verifies the rendered fingerprint before enabling review.
    await expect(page.locator('[data-review-ready="true"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Looks right ✓", exact: true })).toBeEnabled();
  }
});
