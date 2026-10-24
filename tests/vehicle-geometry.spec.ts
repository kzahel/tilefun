import { expect, test } from "@playwright/test";
import type { GeometryCanvas } from "../src/workshop/WorldGeometryPage.js";

test.use({ channel: "chromium" });
for (const renderer of ["canvas", "gpu"])
  for (const garage of [false, true]) {
    test(`vehicle grades ${garage ? "garage" : "bridge"} (${renderer})`, async ({ page }) => {
      test.setTimeout(60000);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(
        `/tilefun/workshop.html?geometry=car-${garage ? "garage" : "bridge"}&renderer=${renderer}${renderer === "gpu" ? "&meshes" : ""}#/tool/world-geometry`,
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
      if (renderer === "gpu")
        await expect
          .poll(() =>
            c.evaluate(
              (canvas: GeometryCanvas) => canvas.__presentationDiagnostics?.().meshDraws ?? 0,
            ),
          )
          .toBeGreaterThan(0);
      const z = last;
      await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
      await expect(c).toHaveAttribute("data-car-z", z ?? "");
      await page.screenshot({
        path: `/tmp/tilefun-car-${garage ? "garage" : "bridge"}-${renderer}.png`,
        fullPage: true,
      });
      // Full forward/reverse grade routes are stepped in VehicleGeometryRecipe.test.
      await page.getByRole("button", { name: "Run opposite direction", exact: true }).click();
      await expect(c).toHaveAttribute("data-ready", "true");
      await page.getByRole("link", { name: "All tools", exact: true }).click();
      await expect.poll(() => page.workers().length).toBe(0);
      expect(errors).toEqual([]);
    });
  }
