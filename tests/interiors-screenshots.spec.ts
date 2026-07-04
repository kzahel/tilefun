import fs from "node:fs";
import { expect, test } from "@playwright/test";

const CAPTURE_DIR = "test-results/interiors";

async function waitForInteriorsPanel(page: import("@playwright/test").Page, query: string) {
  fs.mkdirSync(CAPTURE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/tilefun/?panel=interiors&${query}`);
  await page.locator('#game[data-ready="true"]').waitFor({ timeout: 15_000 });
  await expect(page.getByTestId("interior-catalog")).toBeVisible();
  await expect(page.getByTestId("interior-entry-grid").locator("canvas").first()).toBeVisible();
}

test("capture Generic Home 1 layer validation", async ({ page }) => {
  await waitForInteriorsPanel(page, "interiorDesign=generic-home-designs/generic-home-1");

  await page.getByTestId("interior-catalog").screenshot({
    path: `${CAPTURE_DIR}/generic-home-1-panel.png`,
  });
  await page.getByTestId("interior-prefab-stack").screenshot({
    path: `${CAPTURE_DIR}/generic-home-1-layer-stack.png`,
  });
  await page.getByTestId("interior-prefab-preview").screenshot({
    path: `${CAPTURE_DIR}/generic-home-1-source-preview.png`,
  });
});

test("capture room-builder wall candidates", async ({ page }) => {
  await waitForInteriorsPanel(page, "interiorSource=room_builder_tile&interiorCategory=walls");

  await page.getByTestId("interior-catalog").screenshot({
    path: `${CAPTURE_DIR}/room-builder-walls-panel.png`,
  });
  await page.getByTestId("interior-entry-grid").screenshot({
    path: `${CAPTURE_DIR}/room-builder-walls-grid.png`,
  });
});
