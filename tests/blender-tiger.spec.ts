import { expect, test } from "@playwright/test";

test("tiger walks in all directions and stops when input is released", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tilefun/demos/blender-tiger/");
  const garden = page.locator("#garden");
  await expect(garden).toHaveAttribute("data-ready", "true");
  await page.locator("#patrol").uncheck();
  await garden.focus();
  for (const [key, direction, axis, sign] of [
    ["ArrowRight", "right", "x", 1],
    ["ArrowLeft", "left", "x", -1],
    ["ArrowDown", "down", "y", 1],
    ["ArrowUp", "up", "y", -1],
  ] as const) {
    const before = Number(await garden.getAttribute(`data-${axis}`));
    await page.keyboard.down(key);
    await expect(garden).toHaveAttribute("data-facing", direction);
    await expect
      .poll(async () => (Number(await garden.getAttribute(`data-${axis}`)) - before) * sign)
      .toBeGreaterThan(1);
    await page.keyboard.up(key);
    await expect(page.locator("#status")).toHaveText(`Standing ${direction}`);
    const stopped = await garden.getAttribute(`data-${axis}`);
    await page.waitForTimeout(150);
    expect(await garden.getAttribute(`data-${axis}`)).toBe(stopped);
  }
  expect(errors).toEqual([]);
});

test("direction buttons move the tiger and the mobile layout fits", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tilefun/demos/blender-tiger/");
  const garden = page.locator("#garden");
  await expect(garden).toHaveAttribute("data-ready", "true");
  const button = page.getByRole("button", { name: "Walk right" });
  const before = Number(await garden.getAttribute("data-x"));
  await button.hover();
  await page.mouse.down();
  await expect(garden).toHaveAttribute("data-facing", "right");
  await expect(page.locator("#patrol")).not.toBeChecked();
  await expect
    .poll(async () => Number(await garden.getAttribute("data-x")) - before)
    .toBeGreaterThan(1);
  await page.mouse.up();
  await expect(page.locator("#status")).toHaveText("Standing right");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/tiger-phone.png", fullPage: true });
});
