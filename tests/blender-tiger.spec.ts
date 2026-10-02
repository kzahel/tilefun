import { expect, test } from "@playwright/test";

test("tiger walks in all directions and stops when input is released", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tilefun/demos/blender-tiger/");
  const garden = page.locator("#garden");
  await expect(garden).toHaveAttribute("data-ready", "true");
  await expect(garden).toHaveAttribute("data-style", "pixels");
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

test("both art styles and native sizes load real sprites and comparison can show actual pixels", async ({
  page,
}) => {
  await page.goto("/tilefun/demos/blender-tiger/");
  const garden = page.locator("#garden");
  await expect(garden).toHaveAttribute("data-ready", "true");
  await page.locator("#patrol").uncheck();
  await page.locator("#animate").uncheck();
  const images = new Set<string>();
  for (const style of ["pixels", "render"]) {
    for (const size of ["32", "16"]) {
      await page.locator("#art-style").selectOption(style);
      await page.locator("#sprite-size").selectOption(size);
      await expect(garden).toHaveAttribute("data-style", style);
      await expect(garden).toHaveAttribute("data-size", size);
      await expect(page.locator("#fps-label")).toHaveText(style === "pixels" ? "4 fps" : "8 fps");
      images.add(await garden.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL()));
    }
  }
  expect(images.size).toBe(4);
  await page.locator("#native-scale").check();
  const comparison = page.locator("canvas[data-compare='0']");
  await expect(comparison).toHaveCSS("width", "80px");
  await page.locator("#art-style").selectOption("pixels");
  await expect(garden).toHaveAttribute("data-style", "pixels");
  // Verify actual displayed pixels match the independently loaded 16px sheet.
  expect(
    await page.locator("canvas[data-row='0']").evaluate(async (canvas: HTMLCanvasElement) => {
      const image = new Image();
      image.src = "tiger-finished-16.png";
      await image.decode();
      const expected = document.createElement("canvas");
      expected.width = expected.height = 32;
      const ctx = expected.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D context unavailable");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, 0, 0, 16, 16, 0, 0, 32, 32);
      return expected.toDataURL() === canvas.toDataURL();
    }),
  ).toBe(true);
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
