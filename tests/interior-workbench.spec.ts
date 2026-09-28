import fs from "node:fs";
import { expect, test } from "@playwright/test";

test("indoor workbench paints plans and tiles, records flags, and exports a reproducible fixture", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/tilefun/interior-workbench.html?fixture=small");
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.getByTestId("workbench-status")).toContainText("Small apartment");
  await expect(page.getByTestId("plan-canvas")).toBeVisible();
  await expect(page.getByTestId("render-canvas")).toBeVisible();

  await page.locator('[data-tool="plan"]').click();
  await page.locator('[data-plan-brush="L"]').click();
  await page.locator("#plan-shape").selectOption("rectangle");
  const planBox = await page.getByTestId("plan-canvas").boundingBox();
  if (!planBox) throw new Error("Plan canvas is missing");
  await page.mouse.move(planBox.x + 80, planBox.y + 80);
  await page.mouse.down();
  await page.mouse.move(planBox.x + 112, planBox.y + 112);
  await page.mouse.up();
  const painted = await page.getByTestId("sketch-text").inputValue();
  expect(painted.split("\n")[1]?.[1]).toBe("L");
  expect(painted.split("\n")[2]?.[2]).toBe("L");
  await page.getByRole("button", { name: "Undo" }).click();
  const restored = await page.getByTestId("sketch-text").inputValue();
  expect(restored.split("\n")[1]?.[1]).toBe("B");

  await page.locator('[data-tool="tile"]').click();
  await page.getByTestId("render-canvas").click({ position: { x: 112, y: 48 } });
  await expect(page.getByTestId("selection-details")).toContainText("Override");

  await page.locator('[data-tool="note"]').click();
  const renderBox = await page.getByTestId("render-canvas").boundingBox();
  if (!renderBox) throw new Error("Render canvas is missing");
  await page.mouse.move(renderBox.x + 112, renderBox.y + 48);
  await page.mouse.down();
  await page.mouse.move(renderBox.x + 144, renderBox.y + 80);
  await page.mouse.up();
  await page.locator("#issue-category").selectOption("bad-join");
  await page.locator("#issue-reason").fill("Upper wall junction needs the source corner tile");
  await page.getByTestId("add-issue").click();
  await expect(page.getByTestId("issue-list")).toContainText("Upper wall junction");

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-fixture").click();
  const download = await downloadPromise;
  const file = await download.path();
  if (!file) throw new Error("Export did not create a file");
  const exported = JSON.parse(fs.readFileSync(file, "utf8"));
  expect(exported.id).toBe("small");
  expect(exported.overrides).toHaveLength(1);
  expect(exported.issues[0].category).toBe("bad-join");
  expect(exported.issues[0].width).toBe(2);
  expect(exported.issues[0].height).toBe(2);
  expect(exported.issues[0].snapshot.tiles.wall.length).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByTestId("issue-list")).toBeEmpty();
  await page.locator("#import-file").setInputFiles(file);
  await expect(page.getByTestId("issue-list")).toContainText("Upper wall junction");
  await page.getByRole("button", { name: "Duplicate" }).click();
  await expect(page.locator("#fixture-name")).toHaveValue("Small apartment copy");
  await expect(page.getByTestId("workbench-status")).toContainText("1 tile overrides · 1 flags");
  await page.getByTestId("fixture-select").selectOption("small");

  await page.reload();
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.getByTestId("issue-list")).toContainText("Upper wall junction");
  fs.mkdirSync("test-results/interiors", { recursive: true });
  await page.screenshot({ path: "test-results/interiors/indoor-workbench-desktop.png" });
});

test("phone layout switches between the plan and the rendered zone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tilefun/interior-workbench.html?fixture=strange");
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.getByTestId("render-canvas")).toBeVisible();
  await expect(page.getByTestId("plan-canvas")).toBeHidden();
  await page.locator('[data-view-button="plan"]').click();
  await expect(page.getByTestId("plan-canvas")).toBeVisible();
  await expect(page.getByTestId("render-canvas")).toBeHidden();
  await page.locator('[data-view-button="split"]').click();
  await expect(page.getByTestId("plan-canvas")).toBeVisible();
  await expect(page.getByTestId("render-canvas")).toBeVisible();
  fs.mkdirSync("test-results/interiors", { recursive: true });
  await page.screenshot({
    path: "test-results/interiors/indoor-workbench-phone.png",
    fullPage: true,
  });
});

test("new enclosed rooms persist locally and custom fixtures can be deleted", async ({ page }) => {
  await page.goto("/tilefun/interior-workbench.html");
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await page.getByRole("button", { name: "New room" }).click();
  await expect(page.getByTestId("workbench-status")).toContainText("Untitled room");
  await expect(page.getByTestId("workbench-status")).not.toHaveClass(/error/);
  await expect(page.getByTestId("render-canvas")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset" })).toBeDisabled();
  const id = await page.getByTestId("fixture-select").inputValue();
  await page.reload();
  await expect(page.getByTestId("fixture-select")).toHaveValue(id);
  await expect(page.getByTestId("workbench-status")).toContainText("Untitled room");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByTestId("fixture-select")).toHaveValue("small");
  await page.reload();
  await expect(page.getByTestId("fixture-select").locator(`option[value="${id}"]`)).toHaveCount(0);
});
