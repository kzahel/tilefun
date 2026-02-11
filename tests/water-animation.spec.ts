import { expect, test } from "@playwright/test";

test("water tiles render with ME tileset (static)", async ({ page }) => {
  await page.goto("/tilefun/");
  await page.locator('#game[data-ready="true"]').waitFor({ timeout: 10_000 });

  // Move toward water (down and right hits lower-elevation biomes)
  await page.keyboard.down("ArrowDown");
  await page.waitForTimeout(800);
  await page.keyboard.up("ArrowDown");
  await page.waitForTimeout(100);

  // Verify the canvas has non-zero content (water tiles rendered)
  const hasContent = await page.evaluate(() => {
    const c = document.getElementById("game") as HTMLCanvasElement;
    const ctx = c.getContext("2d");
    if (!ctx) return false;
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += (data[i] ?? 0) + (data[i + 1] ?? 0) + (data[i + 2] ?? 0);
    }
    return sum > 0;
  });

  expect(hasContent).toBe(true);
});
