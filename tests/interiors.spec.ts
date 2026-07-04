import { expect, test } from "@playwright/test";

async function waitForGame(page: import("@playwright/test").Page) {
  await page.goto("/tilefun/");
  await page.locator('#game[data-ready="true"]').waitFor({ timeout: 15_000 });
  await page.waitForTimeout(200);
}

async function canvasHasAtlasContent(locator: import("@playwright/test").Locator) {
  return locator.evaluate((canvas) => {
    const c = canvas as HTMLCanvasElement;
    const ctx = c.getContext("2d");
    if (!ctx) return false;
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let atlasPixels = 0;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3] ?? 0;
      if (alpha === 0) continue;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const isChecker = (r === 32 && g === 40 && b === 56) || (r === 21 && g === 27 && b === 40);
      const isDraftBackground = r === 14 && g === 17 && b === 24;
      if (!isChecker && !isDraftBackground) atlasPixels++;
    }
    return atlasPixels > 2000;
  });
}

test("Modern Interiors validation panel renders Generic Home layers", async ({ page }) => {
  await waitForGame(page);

  await page.getByTestId("main-menu-toggle").click();
  await page.getByTestId("open-interiors-catalog").click();

  await expect(page.getByTestId("interior-catalog")).toBeVisible();
  await expect(page.getByTestId("interior-entry-grid").locator("canvas").first()).toBeVisible();

  await expect(await canvasHasAtlasContent(page.getByTestId("interior-prefab-stack"))).toBe(true);
  await expect(await canvasHasAtlasContent(page.getByTestId("interior-prefab-preview"))).toBe(true);
  await expect(await canvasHasAtlasContent(page.getByTestId("interior-generated-room"))).toBe(true);
});
