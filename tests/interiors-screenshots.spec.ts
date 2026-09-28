import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { expect, test } from "@playwright/test";

const CAPTURE_DIR = "test-results/interiors";

test("capture source atlas geometry grids", () => {
  execFileSync("node", ["scripts/capture-interiors-source-grids.mjs"], {
    stdio: "inherit",
  });
});

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

  const prefabDifferences = await page.evaluate(() => {
    const stack = document.querySelector<HTMLCanvasElement>(
      '[data-testid="interior-prefab-stack"]',
    );
    const preview = document.querySelector<HTMLCanvasElement>(
      '[data-testid="interior-prefab-preview"]',
    );
    if (!stack || !preview || stack.width !== preview.width || stack.height !== preview.height) {
      return -1;
    }
    const stackPixels = stack.getContext("2d")?.getImageData(0, 0, stack.width, stack.height).data;
    const previewPixels = preview
      .getContext("2d")
      ?.getImageData(0, 0, preview.width, preview.height).data;
    if (!stackPixels || !previewPixels) return -1;
    let differences = 0;
    for (let i = 0; i < stackPixels.length; i++) {
      if (stackPixels[i] !== previewPixels[i]) differences++;
    }
    return differences;
  });
  expect(prefabDifferences).toBe(0);

  await page.getByTestId("interior-catalog").screenshot({
    path: `${CAPTURE_DIR}/generic-home-1-panel.png`,
  });
  await page.getByTestId("interior-prefab-stack").screenshot({
    path: `${CAPTURE_DIR}/generic-home-1-layer-stack.png`,
  });
  await page.getByTestId("interior-prefab-preview").screenshot({
    path: `${CAPTURE_DIR}/generic-home-1-source-preview.png`,
  });
  // Read the canvas bitmap directly: the preview is taller than the scroll pane.
  const roomPng = await page
    .getByTestId("interior-generated-room")
    .evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL("image/png"));
  fs.writeFileSync(
    `${CAPTURE_DIR}/room-grammar-variants.png`,
    Buffer.from(roomPng.split(",")[1], "base64"),
  );

  const study = page.getByTestId("interior-geometry-study");
  await expect(study).toHaveAttribute("data-visible-differences", "1");
  const studyPng = await study.evaluate((canvas) =>
    (canvas as HTMLCanvasElement).toDataURL("image/png"),
  );
  fs.writeFileSync(
    `${CAPTURE_DIR}/generic-home-1-geometry-study.png`,
    Buffer.from(studyPng.split(",")[1], "base64"),
  );

  const layerStudy = page.getByTestId("interior-layer-study");
  await expect(layerStudy).toHaveAttribute("data-overlap-cells", "2");
  const layerPng = await layerStudy.evaluate((canvas) =>
    (canvas as HTMLCanvasElement).toDataURL("image/png"),
  );
  fs.writeFileSync(
    `${CAPTURE_DIR}/generic-home-1-layer-study.png`,
    Buffer.from(layerPng.split(",")[1], "base64"),
  );

  const connectedPng = await page
    .getByTestId("interior-connected-rooms")
    .evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL("image/png"));
  fs.writeFileSync(
    `${CAPTURE_DIR}/connected-room-grammar.png`,
    Buffer.from(connectedPng.split(",")[1], "base64"),
  );

  const variantPng = await page
    .getByTestId("interior-geometry-variant")
    .evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL("image/png"));
  fs.writeFileSync(
    `${CAPTURE_DIR}/generic-home-1-derived-variation.png`,
    Buffer.from(variantPng.split(",")[1], "base64"),
  );
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

test("capture apartments generated from editable floor plans", async ({ page }) => {
  await waitForInteriorsPanel(page, "");
  const picker = page.getByTestId("apartment-example-select");
  for (const id of ["small", "large", "strange", "stepped"]) {
    await picker.selectOption(id);
    await expect(page.getByTestId("apartment-status")).toContainText("all floors reachable");
    const previewSize = await page.getByTestId("apartment-preview").evaluate((canvas) => ({
      bitmapWidth: (canvas as HTMLCanvasElement).width,
      displayWidth: canvas.getBoundingClientRect().width,
    }));
    const sketchWidth = Math.max(
      ...(await page.getByTestId("apartment-sketch").inputValue())
        .split("\n")
        .map((line) => line.length),
    );
    expect(previewSize.bitmapWidth).toBe(sketchWidth * 64 + 64);
    expect(previewSize.displayWidth).toBeGreaterThanOrEqual(previewSize.bitmapWidth);
    const data = await page
      .getByTestId("apartment-preview")
      .evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL("image/png"));
    fs.writeFileSync(
      `${CAPTURE_DIR}/${id}-apartment.png`,
      Buffer.from(data.split(",")[1], "base64"),
    );
  }
  const sketch = page.getByTestId("apartment-sketch");
  const canvas = page.getByTestId("apartment-preview");
  const previous = await canvas.evaluate((item) =>
    (item as HTMLCanvasElement).toDataURL("image/png"),
  );
  await sketch.fill("#########\n#LLL#BBB#\n#LLL#BBB#\n#LLL+BBB#\n#LLL#BBB#\n##+######");
  await expect(page.getByTestId("apartment-status")).toContainText("all floors reachable");
  const custom = await canvas.evaluate((item) =>
    (item as HTMLCanvasElement).toDataURL("image/png"),
  );
  expect(custom).not.toBe(previous);
  fs.writeFileSync(
    `${CAPTURE_DIR}/custom-apartment.png`,
    Buffer.from(custom.split(",")[1], "base64"),
  );
  await sketch.fill("#####\n#LL+#\n#####");
  await expect(picker).toHaveValue("custom");
  await expect(page.getByTestId("apartment-status")).toContainText("Passage");
  await picker.selectOption("small");
  await expect(page.getByTestId("apartment-status")).toContainText("all floors reachable");
});

test("capture branched and offset layered suites", async ({ page }) => {
  await waitForInteriorsPanel(page, "");
  for (const id of ["cross", "offset"]) {
    const canvas = page.getByTestId(`interior-advanced-suite-${id}`);
    await expect(canvas).toHaveAttribute("data-reachable", /[1-9][0-9]*/);
    const data = await canvas.evaluate((item) =>
      (item as HTMLCanvasElement).toDataURL("image/png"),
    );
    fs.writeFileSync(
      `${CAPTURE_DIR}/advanced-suite-${id}.png`,
      Buffer.from(data.split(",")[1], "base64"),
    );
  }
});
