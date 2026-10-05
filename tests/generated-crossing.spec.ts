import { expect, test } from "@playwright/test";

test.use({ channel: "chromium" });
for (const renderer of ["canvas", "gpu"]) {
  test(`generated bridge supports traversal, moving traffic and reload (${renderer})`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `/tilefun/workshop.html?geometry=generated-100&renderer=${renderer}#/tool/world-geometry`,
    );
    const c = page.getByLabel("World geometry scene");
    await expect(c).toHaveAttribute("data-ready", "true");
    await expect(c).toHaveAttribute("data-generated-seed", "100");
    await expect(c).toHaveAttribute("data-surface-count", "3");
    await expect
      .poll(async () => Number(await c.getAttribute("data-car-z")), { timeout: 12000 })
      .toBeGreaterThan(12);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    let last = "",
      stable = 0;
    await expect
      .poll(
        async () => {
          const z = (await c.getAttribute("data-car-z")) ?? "";
          stable = z === last ? stable + 1 : 0;
          last = z;
          return stable;
        },
        { intervals: [100] },
      )
      .toBeGreaterThanOrEqual(3);
    await page.screenshot({
      path: `/tmp/tilefun-generated-crossing-${renderer}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
    await expect(c).toHaveAttribute("data-reload-count", "1");
    await expect(c).toHaveAttribute("data-car-z", last);
    await expect(c).toHaveAttribute("data-surface-count", "3");
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await c.focus();
    await page.keyboard.down("ArrowUp");
    await expect(c).toHaveAttribute("data-player-z", "96", { timeout: 10000 });
    await expect
      .poll(
        async () =>
          Number(await c.getAttribute("data-player-y")) -
          Number(await c.getAttribute("data-bridge-y")),
        { timeout: 7000 },
      )
      .toBeLessThan(-468);
    await page.keyboard.up("ArrowUp");
    await expect(c).toHaveAttribute("data-player-z", "0");
    await expect
      .poll(
        async () =>
          Number(await c.getAttribute("data-car-y")) -
          Number(await c.getAttribute("data-bridge-y")),
        { timeout: 15000 },
      )
      .toBeLessThan(-478);
    await expect(c).toHaveAttribute("data-car-z", "0");
    await page.getByRole("button", { name: "Start at bridge", exact: true }).click();
    await expect(c).toHaveAttribute("data-player-z", "96");
    await page.screenshot({
      path: `/tmp/tilefun-generated-bridge-above-${renderer}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Start at trackside", exact: true }).click();
    await expect(c).toHaveAttribute("data-player-z", "0");
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
