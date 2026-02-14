import { test } from "@playwright/test";

const SETTLE_MS = 1500;

async function waitForGame(page: import("@playwright/test").Page) {
  await page.goto("/tilefun/");
  await page.waitForFunction(() => document.querySelector("canvas")?.dataset.ready === "true", {
    timeout: 10000,
  });
  await page.waitForTimeout(500);
  // Game starts in play mode — toggle to editor mode with Tab
  await page.keyboard.press("Tab");
  await page.waitForTimeout(300);
}

test("editor mode: paint water on grass", async ({ page }) => {
  await waitForGame(page);

  // Game starts in editor mode — select Water terrain via title attribute
  // (buttons show canvas tile previews, not text labels)
  await page.locator('button[title*="Shlw/Grass"]').click();
  await page.waitForTimeout(100);

  // Click center of game canvas to paint
  const canvas = page.locator("#game");
  const box = await canvas.boundingBox();
  if (box) {
    await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
    await canvas.click({
      position: { x: box.width / 2 + 50, y: box.height / 2 },
    });
    await canvas.click({
      position: { x: box.width / 2, y: box.height / 2 + 50 },
    });
  }

  await page.waitForTimeout(SETTLE_MS);
  await page.screenshot({ path: "screenshot-editor-painted.png" });
});

test("editor mode: paint dirt on grass and verify autotile", async ({ page }) => {
  await waitForGame(page);

  // Game starts in editor mode — select DirtWarm terrain via title attribute
  await page.locator('button[title*="DirtW/Grass"]').click();
  await page.waitForTimeout(100);

  // Paint a small cluster of dirt tiles in center
  const canvas = page.locator("#game");
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
