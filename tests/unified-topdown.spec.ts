import { expect, type Page, test } from "@playwright/test";

// The unified top-down view (renderer unification): play's default where WebGL
// runs on a GPU. The suite's headless browser rasterises in software, where the
// classic view stays the default, so this spec asks for the unified one.
type GameCanvas = HTMLCanvasElement & {
  __game: { firstPerson: { drawing3d: boolean; topDown: boolean } };
};

const drawing3d = (page: Page) =>
  page.locator("#game").evaluate((c: GameCanvas) => c.__game.firstPerson.drawing3d);
// Building mode's panel offers the way back to play.
const building = (page: Page) =>
  page.getByRole("button", { name: "Play", exact: true }).isVisible();

test("play and building mode draw through the unified view; ?view=fixed keeps the classic one", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/tilefun/?nogamepad&view=topdown3d");
  await page.locator('#game[data-ready="true"]').waitFor();
  await expect.poll(() => drawing3d(page)).toBe(true);
  // Building mode keeps drawing in 3D, its overlays on the UI canvas above.
  await page.locator("#game").click({ position: { x: 20, y: 300 } });
  await expect
    .poll(async () => {
      if (!(await building(page))) await page.keyboard.press("Tab");
      return building(page);
    })
    .toBe(true);
  await expect.poll(() => drawing3d(page)).toBe(true);
  expect(errors).toEqual([]);

  await page.goto("/tilefun/?nogamepad&view=fixed");
  await page.locator('#game[data-ready="true"]').waitFor();
  await page.waitForTimeout(500);
  expect(
    await page.locator("#game").evaluate((c: GameCanvas) => c.__game.firstPerson.topDown),
  ).toBe(false);
  expect(await drawing3d(page)).toBe(false);
});
