import { expect, test } from "@playwright/test";
import { AUTONOMOUS_ORIGINAL_VEHICLES } from "../src/traffic/AutonomousOriginalVehicles.fixture.js";

test.use({ channel: "chromium" });

for (const family of AUTONOMOUS_ORIGINAL_VEHICLES) {
  for (const backend of ["canvas", "gpu&meshes"]) {
    test(`${family.title} forward and reverse rolling turns preserve stopped heading (${backend})`, async ({
      page,
    }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`/tilefun/workshop.html?renderer=${backend}#/tool/traffic`);
      const canvas = page.getByLabel("Generated traffic playground");
      await expect(canvas).toHaveAttribute("data-ready", "true");
      await page.getByLabel("Playground vehicle").selectOption(family.model);
      await expect(canvas).toHaveAttribute("data-ready", "true");
      await canvas.focus();
      await page.keyboard.down("ArrowLeft");
      await expect(page.getByRole("button", { name: "Drive car · E", exact: true })).toBeVisible();
      await page.keyboard.up("ArrowLeft");
      await page.getByRole("button", { name: "Drive car · E", exact: true }).click();
      await expect(canvas).toHaveAttribute("data-driving", "true");
      const read = () =>
        canvas.evaluate((surface) => {
          const data = (surface as HTMLElement).dataset;
          return {
            x: Number(data.carX),
            y: Number(data.carY),
            heading: Number(data.carHeading),
            speed: Number(data.speed),
          };
        });
      const start = await read();
      // Calibrated long bodies cannot turn into the roadside lamp. Exercise
      // every family toward the clear part of this production street.
      const turnKey = "ArrowUp";
      const turnSign = -1;
      await canvas.focus();
      await page.keyboard.down(turnKey);
      await expect
        .poll(async () => ((await read()).heading - start.heading) * turnSign)
        .toBeGreaterThan(0.3);
      await page.keyboard.up(turnKey);
      await expect.poll(async () => (await read()).speed).toBeLessThan(0.01);
      const forward = await read();
      expect(forward.x).toBeGreaterThan(start.x + 8);
      expect((forward.y - start.y) * turnSign).toBeGreaterThan(0);
      await page.keyboard.down("r");
      await page.keyboard.down(turnKey);
      await expect
        .poll(async () => (forward.heading - (await read()).heading) * turnSign)
        .toBeGreaterThan(0.2);
      await page.keyboard.up(turnKey);
      await page.keyboard.up("r");
      await expect.poll(async () => (await read()).speed).toBeLessThan(0.01);
      // Authority speed reaches zero before the interpolated displayed pose settles.
      await page.waitForTimeout(100);
      const stopped = await read();
      await page.waitForTimeout(250);
      expect((await read()).heading).toBeCloseTo(stopped.heading, 6);
      expect((await read()).x).toBeCloseTo(stopped.x, 3);
      await page.screenshot({ path: testInfo.outputPath(`${family.model}-rolling-steering.png`) });
      expect(errors).toEqual([]);
    });
  }
}
