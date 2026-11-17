import { expect, test } from "@playwright/test";
import type { GeometryCanvas } from "../src/workshop/WorldGeometryPage.js";

test.use({ channel: "chromium" });
type PeakCanvas = GeometryCanvas & { __peakCarZ?: number };
test("jump park opens on the default 3D mesh renderer and launches a boosted car", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // No renderer parameter: labs default to GPU + 3D vehicle meshes.
  await page.goto("/tilefun/workshop.html?geometry=car-jumps#/tool/world-geometry");
  const c = page.getByLabel("World geometry scene");
  await expect(c).toHaveAttribute("data-ready", "true");
  await expect(c).toHaveAttribute("data-renderer", "gpu");
  expect(page.workers().map((w) => w.url())).toContainEqual(
    expect.stringContaining("recipe-world"),
  );
  await expect(page.getByRole("button", { name: /^Get out/ })).toBeVisible();
  await expect
    .poll(() =>
      c.evaluate((canvas: GeometryCanvas) => canvas.__presentationDiagnostics?.().meshDraws ?? 0),
    )
    .toBeGreaterThan(0);
  // Airtime above the threshold is well under a second; record every published
  // frame's height in the page instead of sampling it from the test runner.
  await c.evaluate((canvas: PeakCanvas) => {
    canvas.__peakCarZ = 0;
    new MutationObserver(() => {
      canvas.__peakCarZ = Math.max(canvas.__peakCarZ ?? 0, Number(canvas.dataset.carZ));
    }).observe(canvas, { attributeFilter: ["data-car-z"] });
  });
  await c.focus();
  await page.keyboard.down("Shift");
  await page.keyboard.down("ArrowUp");
  try {
    // The kicker lip tops out at 48px; a boosted rally hatchback flies well above it.
    await expect
      .poll(() => c.evaluate((canvas: PeakCanvas) => canvas.__peakCarZ ?? 0), {
        timeout: 30000,
      })
      .toBeGreaterThan(70);
  } finally {
    await page.keyboard.up("ArrowUp");
    await page.keyboard.up("Shift");
  }
  expect(errors).toEqual([]);
});
