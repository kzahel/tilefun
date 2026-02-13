import { test } from "@playwright/test";

const ZOOM_LEVELS = [0.5, 0.2];
const SETTLE_MS = 2000;

async function waitForGame(page: import("@playwright/test").Page) {
  await page.goto("/tilefun/");
  await page.waitForFunction(() => document.querySelector("canvas")?.dataset.ready === "true", {
    timeout: 10000,
  });
  await page.waitForTimeout(500);
}

async function setZoom(page: import("@playwright/test").Page, zoom: number) {
  await page.keyboard.press("F3");
  await page.waitForTimeout(100);
  await page.evaluate((z) => {
    const slider = document.querySelector('input[type="range"]') as HTMLInputElement | null;
    if (slider) {
      slider.value = String(z);
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, zoom);
  await page.waitForTimeout(SETTLE_MS);
  // Hide debug panel for clean screenshot
  await page.keyboard.press("F3");
  await page.waitForTimeout(200);
}

for (const zoom of ZOOM_LEVELS) {
  test(`screenshot at zoom ${zoom}`, async ({ page }) => {
    await waitForGame(page);
    await setZoom(page, zoom);
    await page.screenshot({ path: `screenshot-zoom-${zoom}.png` });
  });
}
