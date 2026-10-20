import { expect, test } from "@playwright/test";

test.use({ channel: "chromium" });
for (const backend of ["canvas", "gpu&meshes"]) {
  for (const model of ["compact-1", "rosso-coupe"]) {
    test(`shared rolling turns, reverse steering and stopped heading (${model}, ${backend})`, async ({
      page,
    }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`/tilefun/workshop.html?renderer=${backend}#/tool/traffic`);
      const canvas = page.getByLabel("Generated traffic playground");
      await expect(canvas).toHaveAttribute("data-ready", "true");
      await page.getByLabel("Playground vehicle").selectOption(model);
      await expect(canvas).toHaveAttribute("data-ready", "true");
      await canvas.focus();
      await page.keyboard.down("ArrowLeft");
      await expect(page.getByRole("button", { name: "Drive car · E", exact: true })).toBeVisible();
      await page.keyboard.up("ArrowLeft");
      await page.getByRole("button", { name: "Drive car · E", exact: true }).click();
      await expect(canvas).toHaveAttribute("data-driving", "true");
      const read = async () =>
        canvas.evaluate((c) => {
          const data = (c as HTMLElement).dataset;
          return {
            x: Number(data.carX),
            y: Number(data.carY),
            heading: Number(data.carHeading),
            speed: Number(data.speed),
          };
        });
      const start = await read();
      await canvas.focus();
      await page.keyboard.down("ArrowDown");
      await expect.poll(async () => (await read()).heading).toBeGreaterThan(start.heading + 0.3);
      await page.keyboard.up("ArrowDown");
      await expect.poll(async () => (await read()).speed).toBeLessThan(0.01);
      const forward = await read();
      expect(forward.x).toBeGreaterThan(start.x + 8);
      expect(forward.y).toBeGreaterThan(start.y);
      await page.keyboard.down("r");
      await page.keyboard.down("ArrowDown");
      await expect.poll(async () => (await read()).heading).toBeLessThan(forward.heading - 0.2);
      await page.keyboard.up("ArrowDown");
      await page.keyboard.up("r");
      await expect.poll(async () => (await read()).speed).toBeLessThan(0.01);
      // The admitted speed can be zero one display interval before the
      // interpolated nose reaches that final pose. Let presentation settle.
      await page.waitForTimeout(100);
      const stopped = await read();
      await page.waitForTimeout(250);
      expect((await read()).heading).toBeCloseTo(stopped.heading, 6);
      // World positions round to float32 at authority reconciliation.
      expect((await read()).x).toBeCloseTo(stopped.x, 3);
      await page.getByLabel("Car controls", { exact: true }).selectOption("steering");
      await canvas.focus();
      await page.keyboard.down("ArrowUp");
      await page.keyboard.down("ArrowLeft");
      await expect.poll(async () => (await read()).heading).toBeLessThan(stopped.heading - 0.2);
      await page.keyboard.up("ArrowLeft");
      await page.keyboard.up("ArrowUp");
      await expect.poll(async () => (await read()).speed).toBeLessThan(0.01);
      await page.waitForTimeout(100);
      const nose = await read();
      await page.keyboard.down("ArrowDown");
      await expect
        .poll(async () => {
          const next = await read();
          return (
            (next.x - nose.x) * Math.cos(nose.heading) + (next.y - nose.y) * Math.sin(nose.heading)
          );
        })
        .toBeLessThan(-8);
      await page.keyboard.up("ArrowDown");
      await expect.poll(async () => (await read()).speed).toBeLessThan(0.01);
      await page.screenshot({ path: testInfo.outputPath("rolling-steering.png") });
      expect(errors).toEqual([]);
    });
  }
}
