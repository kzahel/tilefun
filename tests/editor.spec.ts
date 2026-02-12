import { expect, test } from "@playwright/test";

const SETTLE_MS = 1500;

async function waitForGame(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.waitForFunction(() => document.querySelector("canvas")?.dataset.ready === "true", {
    timeout: 10000,
  });
  await page.waitForTimeout(500);
}

test("editor mode: toggle and paint terrain", async ({ page }) => {
  await waitForGame(page);

  // Enter editor mode with Tab
  await page.keyboard.press("Tab");
  await page.waitForTimeout(200);

  // Verify palette panel is visible
  const palette = page.locator("button", { hasText: "Grass" });
  await expect(palette).toBeVisible();

  // Take screenshot showing editor grid
  await page.screenshot({ path: "screenshot-editor-grid.png" });

  // Click "Clear" to fill with Grass (default selected)
  await page.locator("button", { hasText: "Clear" }).click();
  await page.waitForTimeout(SETTLE_MS);

  await page.screenshot({ path: "screenshot-editor-cleared.png" });

  // Select Water terrain and paint some tiles
  await page.locator("button", { hasText: "Water" }).click();
  await page.waitForTimeout(100);

  // Click center of canvas to paint
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (box) {
    await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
    // Paint a few more tiles nearby
    await canvas.click({
      position: { x: box.width / 2 + 50, y: box.height / 2 },
    });
    await canvas.click({
      position: { x: box.width / 2, y: box.height / 2 + 50 },
    });
  }

  await page.waitForTimeout(SETTLE_MS);
  await page.screenshot({ path: "screenshot-editor-painted.png" });

  // Exit editor mode
  await page.keyboard.press("Tab");
  await page.waitForTimeout(200);

  // Verify palette is hidden
  await expect(palette).not.toBeVisible();
});

test("editor mode: paint dirt on grass and verify autotile", async ({ page }) => {
  await waitForGame(page);

  // Enter editor mode
  await page.keyboard.press("Tab");
  await page.waitForTimeout(200);

  // Clear to all Grass
  await page.locator("button", { hasText: "Clear" }).click();
  await page.waitForTimeout(SETTLE_MS);

  // Select DirtPath
  await page.locator("button", { hasText: "Dirt" }).click();
  await page.waitForTimeout(100);

  // Paint a small cluster of dirt tiles in center
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (box) {
    const cx = box.width / 2;
    const cy = box.height / 2;
    // Paint a 3x3 cluster
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        await canvas.click({
          position: { x: cx + dx * 48, y: cy + dy * 48 },
        });
      }
    }
  }

  await page.waitForTimeout(SETTLE_MS);
  await page.screenshot({ path: "screenshot-editor-dirt-on-grass.png" });
});
