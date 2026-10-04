import { expect, test } from "@playwright/test";

test.use({ channel: "chromium" });
for (const renderer of ["canvas", "gpu"]) {
  test(`road bridge clears a real moving train (${renderer})`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `/tilefun/workshop.html?geometry=crossing&renderer=${renderer}#/tool/world-geometry`,
    );
    const canvas = page.getByLabel("World geometry scene");
    await expect(canvas).toHaveAttribute("data-ready", "true");
    await canvas.focus();
    await page.keyboard.down("ArrowUp");
    await expect(canvas).toHaveAttribute("data-support", "road-bridge", { timeout: 7000 });
    await page.keyboard.up("ArrowUp");
    await page.getByRole("button", { name: "Start at bridge", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-player-z", "64");
    await expect
      .poll(async () => Math.abs(Number(await canvas.getAttribute("data-train-x"))), {
        timeout: 15000,
        intervals: [50],
      })
      .toBeLessThan(50);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-train-z", "0");
    await canvas.locator("..").screenshot({ path: `/tmp/tilefun-crossing-${renderer}-bridge.png` });
    const x = Number(await canvas.getAttribute("data-train-x"));
    await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-player-z", "64");
    await expect
      .poll(async () => Math.abs(Number(await canvas.getAttribute("data-train-x")) - x))
      .toBeLessThan(5);
    await page.getByRole("button", { name: "Start at trackside", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-player-z", "0");
    await page.getByLabel("Visible surfaces").selectOption("lower");
    await canvas.locator("..").screenshot({ path: `/tmp/tilefun-crossing-${renderer}-lower.png` });
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-train-x")))
      .toBeGreaterThan(100);
    await page.getByLabel("Geometry fixture").selectOption("garage");
    await expect(canvas).toHaveAttribute("data-ready", "true");
    await expect(canvas).toHaveAttribute("data-player-x", "-216");
    await expect.poll(() => page.workers().length).toBe(1);
    expect(errors).toEqual([]);
  });
}

test("crossing controls fit a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tilefun/workshop.html?geometry=crossing#/tool/world-geometry");
  await expect(page.getByLabel("World geometry scene")).toHaveAttribute("data-ready", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/tilefun-crossing-phone.png", fullPage: true });
});
