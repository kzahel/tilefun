import { expect, test } from "@playwright/test";

test("Three.js debug view renders and releases its WebGL canvas", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tilefun/");
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await page.evaluate(() => {
    const game = (
      document.querySelector("#game") as unknown as {
        __game: { consoleEngine: import("../src/console/ConsoleEngine.js").ConsoleEngine };
      }
    ).__game;
    game.consoleEngine.cvars.get("r_show3d")?.set(true);
  });
  const debug = page.locator("body > canvas:not(#game)");
  await expect(debug).toHaveCount(1);
  await expect(debug).toBeVisible();
  expect(
    await debug.evaluate((canvas) => {
      const gl = (canvas as HTMLCanvasElement).getContext("webgl2");
      return Boolean(
        gl && gl.drawingBufferWidth > 0 && gl.drawingBufferHeight > 0 && !gl.isContextLost(),
      );
    }),
  ).toBe(true);
  await page.evaluate(() => {
    const game = (
      document.querySelector("#game") as unknown as {
        __game: { consoleEngine: import("../src/console/ConsoleEngine.js").ConsoleEngine };
      }
    ).__game;
    game.consoleEngine.cvars.get("r_show3d")?.set(false);
  });
  await expect(debug).toHaveCount(0);
  expect(errors).toEqual([]);
});
