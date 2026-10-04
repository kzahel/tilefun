import { expect, test } from "@playwright/test";

test.use({ channel: "chromium" });
for (const renderer of ["canvas", "gpu"]) {
  test(`train carriages follow bridge and tunnel grades (${renderer})`, async ({ page }) => {
    test.setTimeout(100000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `/tilefun/workshop.html?geometry=train-grades&renderer=${renderer}#/tool/world-geometry`,
    );
    const c = page.getByLabel("World geometry scene");
    await expect(c).toHaveAttribute("data-ready", "true");
    await expect(c).toHaveAttribute("data-carriage-count", "3");
    await expect(c).toHaveAttribute("data-player-z", "-96");
    await expect
      .poll(
        async () => {
          const z = ((await c.getAttribute("data-carriage-heights")) ?? "").split(",").map(Number);
          return Math.max(...z) - Math.min(...z);
        },
        { timeout: 16000 },
      )
      .toBeGreaterThan(12);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    let last = "",
      stable = 0;
    await expect
      .poll(
        async () => {
          const z = (await c.getAttribute("data-carriage-heights")) ?? "";
          stable = z === last ? stable + 1 : 0;
          last = z;
          return stable;
        },
        { intervals: [100] },
      )
      .toBeGreaterThanOrEqual(3);
    await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
    await expect(c).toHaveAttribute("data-reload-count", "1");
    await expect(c).toHaveAttribute("data-carriage-count", "3");
    await expect(c).toHaveAttribute("data-player-z", "-96");
    await expect(c).toHaveAttribute("data-carriage-heights", last);
    await page.screenshot({ path: `/tmp/tilefun-train-grade-${renderer}.png`, fullPage: true });
    await page.getByLabel("Train camera").selectOption("overview");
    await expect(c).toHaveAttribute("data-train-camera", "overview");
    await expect(c).toHaveAttribute("data-carriage-heights", last);
    await page.screenshot({ path: `/tmp/tilefun-train-route-${renderer}.png`, fullPage: true });
    await page.getByLabel("Train camera").selectOption("follow");
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await expect(c).toHaveAttribute("data-carriage-heights", "-96.00,-96.00,-96.00", {
      timeout: 23000,
    });
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.screenshot({ path: `/tmp/tilefun-train-tunnel-${renderer}.png`, fullPage: true });
    await page.getByLabel("Visible surfaces").selectOption("all");
    await expect(c).toHaveAttribute("data-visibility", "all");
    await page.screenshot({
      path: `/tmp/tilefun-train-tunnel-covered-${renderer}.png`,
      fullPage: true,
    });
    await expect(c).toHaveAttribute("data-carriage-heights", "-96.00,-96.00,-96.00");
    await page.getByLabel("Visible surfaces").selectOption("auto");
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await expect
      .poll(async () => Number(await c.getAttribute("data-train-vx")), { timeout: 15000 })
      .toBeLessThan(0);
    await expect(c).toHaveAttribute("data-carriage-heights", "0.00,0.00,0.00", { timeout: 25000 });
    await page.getByRole("button", { name: "Run opposite direction", exact: true }).click();
    await expect(c).toHaveAttribute("data-ready", "true");
    await expect(c).toHaveAttribute("data-carriage-count", "3");
    await expect(c).toHaveAttribute("data-player-z", "-96");
    await expect(c).toHaveAttribute("data-carriage-heights", "-96.00,-96.00,-96.00");
    await page.getByRole("link", { name: "All tools", exact: true }).click();
    await expect.poll(() => page.workers().length).toBe(0);
    expect(errors).toEqual([]);
  });
}

test.describe("phone train review", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test("camera and level controls fit without changing the simulation", async ({ page }) => {
    await page.goto("/tilefun/workshop.html?geometry=train-grades#/tool/world-geometry");
    const c = page.getByLabel("World geometry scene");
    await expect(c).toHaveAttribute("data-ready", "true");
    await page.getByRole("button", { name: "Pause", exact: true }).tap();
    await page.getByLabel("Train camera").selectOption("overview");
    await page.getByRole("button", { name: "Start at street", exact: true }).tap();
    await expect(c).toHaveAttribute("data-player-z", "0");
    await page.getByRole("button", { name: "Start at tunnel", exact: true }).tap();
    await expect(c).toHaveAttribute("data-player-z", "-96");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const reverse = page.getByRole("button", { name: "Run opposite direction", exact: true });
    await expect(reverse).toHaveCSS("user-select", "none");
    expect(
      await reverse.evaluate((el) =>
        el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })),
      ),
    ).toBe(false);
  });
});
