import { expect, test } from "@playwright/test";

test.use({ channel: "chromium" });
test("GPU consumes the Canvas scene with retained textures and union clips", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/tilefun/renderer-lab.html");
  await expect(page.locator("#gpu")).toHaveAttribute("data-ready", "true");
  const report = () =>
    page
      .locator("#result")
      .textContent()
      .then((text) => JSON.parse(text ?? "{}"));
  expect((await report()).mismatches).toBe(0);
  const cold = await report();
  await page.evaluate(() =>
    (window as unknown as { rendererLab: { draw(): unknown } }).rendererLab.draw(),
  );
  expect((await report()).uploads).toBe(cold.uploads);
  await page.evaluate(() =>
    (
      window as unknown as { rendererLab: { setClips(value: boolean): unknown } }
    ).rendererLab.setClips(true),
  );
  expect((await report()).mismatches).toBe(0);
  await page.evaluate(() =>
    (
      window as unknown as { rendererLab: { changeTexture(): unknown } }
    ).rendererLab.changeTexture(),
  );
  expect((await report()).uploads).toBe(cold.uploads + 1);
  expect((await report()).mismatches).toBe(0);
  expect(errors).toEqual([]);
});

test("GPU host runs the shared game and retains the input/UI canvas", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/tilefun/?renderer=gpu");
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("#game")).toHaveAttribute("data-renderer", "gpu");
  await expect(page.locator("canvas[data-renderer=gpu][aria-hidden=true]")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(250);
  await page.keyboard.up("ArrowRight");
  expect(errors).toEqual([]);
});
