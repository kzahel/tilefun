import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { expect, test } from "@playwright/test";

const CAPTURE_DIR = "test-results/interiors";
const SOURCE_ATLAS_DIR = "assets/interiors/1_Interiors/16x16/Room_Builder_subfiles";
const SOURCE_ATLAS_FILES = [
  "Room_Builder_borders_16x16.png",
  "Room_Builder_Baseboards_16x16.png",
  "Room_Builder_3d_walls_16x16.png",
];

test("capture source atlas geometry grids", () => {
  test.skip(
    SOURCE_ATLAS_FILES.some((file) => !fs.existsSync(`${SOURCE_ATLAS_DIR}/${file}`)),
    "Source atlas PNGs are local assets and are not included in the repository",
  );
  execFileSync("node", ["scripts/capture-interiors-source-grids.mjs"], {
    stdio: "inherit",
  });
});

test("capture room-builder wall candidates", async ({ page }) => {
  fs.mkdirSync(CAPTURE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(
    "/tilefun/?panel=interiors&interiorSource=room_builder_tile&interiorCategory=walls",
  );
  await page.locator('#game[data-ready="true"]').waitFor({ timeout: 15_000 });
  await expect(page.getByTestId("interior-catalog")).toBeVisible();
  await page
    .getByTestId("interior-catalog")
    .screenshot({ path: `${CAPTURE_DIR}/room-builder-walls-panel.png` });
  await page
    .getByTestId("interior-entry-grid")
    .screenshot({ path: `${CAPTURE_DIR}/room-builder-walls-grid.png` });
});
