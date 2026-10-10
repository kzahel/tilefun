import { expect, test } from "@playwright/test";

test.use({ channel: "chromium" });
for (const mode of ["canvas", "gpu"]) {
  test(`outdoor geometry shares the ${mode} host with fixed framing and bounded lifecycle`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(
      `/tilefun/workshop.html${mode === "gpu" ? "?renderer=gpu&meshes" : ""}#/tool/outdoor?asset=me:1952:128:48:32`,
    );
    const toggle = page.getByText("Placement & collision geometry", { exact: true });
    await toggle.click();
    const canvas = page.getByLabel("Asset movement test", { exact: true });
    await expect(canvas).toHaveAttribute("data-ready", "true");
    if (mode === "gpu") await expect(canvas).toHaveAttribute("data-renderer", "gpu");
    await expect(canvas).toHaveAttribute("data-player-y", "40");
    const cameraY = (await canvas.getAttribute("data-camera-y")) ?? "";
    const workers = () =>
      page.workers().filter((worker) => worker.url().includes("scenario.worker")).length;
    await expect.poll(workers).toBe(1);
    await canvas.focus();
    await page.keyboard.down("ArrowUp");
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-player-y")))
      .toBeLessThan(14);
    await page.keyboard.up("ArrowUp");
    // The published position is predicted; release can precede the next
    // authority reconciliation. Require the same collision bound after settling.
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-player-y")))
      .toBeGreaterThanOrEqual(2.99);
    await expect(canvas).toHaveAttribute("data-camera-x", "0");
    await expect(canvas).toHaveAttribute("data-camera-y", cameraY);
    await page.getByRole("button", { name: "Reset walker", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-player-y", "40");
    await canvas.focus();
    await page.keyboard.down("ArrowLeft");
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-player-x")))
      .toBeLessThan(-10);
    await page.getByLabel("Anchor X", { exact: true }).focus();
    await page.keyboard.up("ArrowLeft");
    await page.waitForTimeout(150);
    const stopped = Number(await canvas.getAttribute("data-player-x"));
    await page.waitForTimeout(150);
    expect(Number(await canvas.getAttribute("data-player-x"))).toBeCloseTo(stopped, 1);
    // Metadata changes rebuild the recipe/assets without accumulating Workers or GPU surfaces.
    const anchor = page.getByLabel("Anchor X", { exact: true });
    const original = Number(await anchor.inputValue());
    for (const value of [original + 1, original]) {
      await anchor.fill(String(value));
      await expect(canvas).toHaveAttribute("data-ready", "true");
      await expect(canvas).toHaveAttribute("data-player-x", "0");
      await expect.poll(workers).toBe(1);
      await expect(page.locator(".geometry-viewport canvas")).toHaveCount(mode === "gpu" ? 2 : 1);
    }
    await expect(canvas).toHaveAttribute("data-camera-y", cameraY);
    await page
      .locator(".geometry-viewport")
      .screenshot({ path: `/tmp/tilefun-outdoor-${mode}.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    // GPU world alignment is published by ResizeObserver after viewport layout.
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    if (mode === "gpu") {
      const ui = await canvas.boundingBox();
      await expect
        .poll(() => page.locator(".geometry-viewport canvas[aria-hidden=true]").boundingBox())
        .toEqual(ui);
      await expect(page.locator(".geometry-viewport canvas[aria-hidden=true]")).toHaveCSS(
        "image-rendering",
        "pixelated",
      );
    }
    for (let i = 0; i < 2; i++) {
      await toggle.click();
      await expect(page.locator(".geometry-viewport canvas")).toHaveCount(0);
      await expect.poll(workers).toBe(0);
      await toggle.click();
      await expect(canvas).toHaveAttribute("data-ready", "true");
      await expect.poll(workers).toBe(1);
    }
    expect(errors).toEqual([]);
  });
}
