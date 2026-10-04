import { expect, test } from "@playwright/test";

test.use({ channel: "chromium" });
for (const renderer of ["canvas", "gpu"])
  for (const garage of [false, true]) {
    test(`vehicle grades ${garage ? "garage" : "bridge"} (${renderer})`, async ({ page }) => {
      test.setTimeout(60000);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(
        `/tilefun/workshop.html?geometry=car-${garage ? "garage" : "bridge"}&renderer=${renderer}#/tool/world-geometry`,
      );
      const c = page.getByLabel("World geometry scene");
      await expect(c).toHaveAttribute("data-ready", "true");
      await expect
        .poll(async () => Math.abs(Number(await c.getAttribute("data-car-z"))), { timeout: 15000 })
        .toBeGreaterThan(12);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      // Pause stops new steps; wait for the bounded outstanding Worker step to arrive.
      let last = "",
        stable = 0;
      await expect
        .poll(
          async () => {
            const value = (await c.getAttribute("data-car-z")) ?? "";
            stable = value === last ? stable + 1 : 0;
            last = value;
            return stable;
          },
          { intervals: [100] },
        )
        .toBeGreaterThanOrEqual(3);
      const z = last;
      await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
      await expect(c).toHaveAttribute("data-car-z", z ?? "");
      await page.screenshot({
        path: `/tmp/tilefun-car-${garage ? "garage" : "bridge"}-${renderer}.png`,
        fullPage: true,
      });
      await page.getByRole("button", { name: "Resume", exact: true }).click();
      await expect
        .poll(
          async () =>
            (garage ? 1 : -1) * Number(await c.getAttribute(garage ? "data-car-x" : "data-car-y")),
          { timeout: 22000 },
        )
        .toBeGreaterThan(garage ? 90 : 350);
      await expect(c).toHaveAttribute("data-car-z", garage ? "-48" : "0");
      await page.getByRole("button", { name: "Run opposite direction", exact: true }).click();
      await expect(c).toHaveAttribute("data-ready", "true");
      await expect
        .poll(
          async () =>
            (garage ? -1 : 1) * Number(await c.getAttribute(garage ? "data-car-x" : "data-car-y")),
          { timeout: 22000 },
        )
        .toBeGreaterThan(garage ? 280 : 350);
      await expect(c).toHaveAttribute("data-car-z", "0");
      await page.getByRole("link", { name: "All tools", exact: true }).click();
      await expect.poll(() => page.workers().length).toBe(0);
      expect(errors).toEqual([]);
    });
  }
