import { expect, test } from "@playwright/test";

test.use({ channel: "chromium" });
for (const backend of ["canvas", "gpu"]) {
  test(`geometry lab uses real Worker movement, cutaways and reload (${backend})`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`/tilefun/workshop.html?renderer=${backend}#/tool/world-geometry`);
    const c = page.getByLabel("World geometry scene");
    await expect(c).toHaveAttribute("data-ready", "true");
    await c.focus();
    await page.keyboard.down("ArrowRight");
    await expect(c).toHaveAttribute("data-support", "deck", { timeout: 8000 });
    await page.keyboard.up("ArrowRight");
    await expect(c).toHaveAttribute("data-player-z", "48");
    await expect(c).toHaveAttribute("data-server-z", "48");
    await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
    await expect(c).toHaveAttribute("data-player-z", "48");
    await page.getByRole("button", { name: "Start at passage", exact: true }).click();
    await expect(c).toHaveAttribute("data-player-z", "0");
    await c.focus();
    await page.keyboard.down("Space");
    await expect
      .poll(async () => Number(await c.getAttribute("data-player-z")))
      .toBeGreaterThan(15);
    expect(Number(await c.getAttribute("data-player-z"))).toBeLessThanOrEqual(28.001);
    await page.keyboard.up("Space");
    await expect(c).toHaveAttribute("data-player-z", "0");
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.getByLabel("Visible surfaces").selectOption("lower");
    await expect(c).toHaveAttribute("data-visibility", "lower");
    expect(await c.getAttribute("data-player-z")).toBe("0");
    await page.screenshot({ path: `/tmp/tilefun-geometry-${backend}-cutaway.png`, fullPage: true });
    await page.getByLabel("Visible surfaces").selectOption("all");
    await expect(c).toHaveAttribute("data-visibility", "all");
    expect(await c.getAttribute("data-player-z")).toBe("0");
    await page.screenshot({ path: `/tmp/tilefun-geometry-${backend}-all.png`, fullPage: true });
    await page.getByRole("button", { name: "Reset scene", exact: true }).click();
    await expect(c).toHaveAttribute("data-ready", "true");
    await expect(c).toHaveAttribute("data-player-x", "-216");
    await page.getByRole("link", { name: "All tools", exact: true }).click();
    await expect.poll(() => page.workers().length).toBe(0);
    expect(errors).toEqual([]);
  });
}

test("geometry controls fit a phone and release touch input", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tilefun/workshop.html#/tool/world-geometry");
  const c = page.getByLabel("World geometry scene");
  await expect(c).toHaveAttribute("data-ready", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const right = page.getByRole("button", { name: "→", exact: true });
  await right.dispatchEvent("pointerdown", { pointerId: 1 });
  await expect
    .poll(async () => Number(await c.getAttribute("data-player-x")))
    .toBeGreaterThan(-210);
  await right.dispatchEvent("pointercancel", { pointerId: 1 });
  await page.getByRole("button", { name: "Start at deck", exact: true }).click();
  await expect(c).toHaveAttribute("data-player-z", "48");
  await page.screenshot({ path: "/tmp/tilefun-geometry-phone.png", fullPage: true });
});
