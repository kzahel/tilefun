import { expect, type Locator, test } from "@playwright/test";

test.use({ channel: "chromium" });

// Rapier rests bodies within its allowed contact error, so a supported height
// differs from the surface by a small fraction of a pixel.
const expectHeight = (c: Locator, z: number) =>
  expect.poll(async () => Number(await c.getAttribute("data-player-z"))).toBeCloseTo(z, 2);

for (const renderer of ["canvas", "gpu"]) {
  // The staged car is parked since 8f405aaf; generated traffic is not part of this lab.
  test(`generated bridge supports traversal and reload (${renderer})`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `/tilefun/workshop.html?geometry=generated-100&renderer=${renderer}#/tool/world-geometry`,
    );
    const c = page.getByLabel("World geometry scene");
    await expect(c).toHaveAttribute("data-ready", "true");
    await expect(c).toHaveAttribute("data-generated-seed", "100");
    await expect(c).toHaveAttribute("data-surface-count", "3");
    await page.screenshot({
      path: `/tmp/tilefun-generated-crossing-${renderer}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
    await expect(c).toHaveAttribute("data-reload-count", "1");
    await expect(c).toHaveAttribute("data-surface-count", "3");
    await c.focus();
    await page.keyboard.down("ArrowUp");
    // Walking speed covers the 950px crossing in about 15 s of simulated time:
    // about 7 s up to the deck and 8 s over and down the far ramp.
    await expect
      .poll(async () => Number(await c.getAttribute("data-player-z")), { timeout: 15_000 })
      .toBeCloseTo(96, 2);
    await expect
      .poll(
        async () =>
          Number(await c.getAttribute("data-player-y")) -
          Number(await c.getAttribute("data-bridge-y")),
        { timeout: 15_000 },
      )
      .toBeLessThan(-468);
    await page.keyboard.up("ArrowUp");
    await expectHeight(c, 0);
    await page.getByRole("button", { name: "bridge", exact: true }).click();
    await expectHeight(c, 96);
    await page.screenshot({
      path: `/tmp/tilefun-generated-bridge-above-${renderer}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "trackside", exact: true }).click();
    await expectHeight(c, 0);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.getByRole("link", { name: "All tools", exact: true }).click();
    await expect.poll(() => page.workers().length).toBe(0);
    expect(errors).toEqual([]);
  });
}

test("seeded crossings are selectable and fit phone review", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tilefun/workshop.html?geometry=generated-42#/tool/world-geometry");
  const c = page.getByLabel("World geometry scene");
  for (const seed of [42, 3]) {
    await page.getByLabel("Geometry fixture").selectOption(`generated-${seed}`);
    await expect(c).toHaveAttribute("data-ready", "true");
    await expect(c).toHaveAttribute("data-generated-seed", String(seed));
    await expect(c).toHaveAttribute("data-surface-count", "3");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `/tmp/tilefun-generated-crossing-phone-${seed}.png`,
      fullPage: true,
    });
  }
});
