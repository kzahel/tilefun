import { expect, test } from "@playwright/test";
import type { TrafficCanvas } from "../src/workshop/TrafficPage.js";

test.use({ channel: "chromium" });
for (const model of ["garbage-truck-green", "garbage-truck-orange"]) {
  for (const renderer of ["canvas", "gpu&meshes"]) {
    test(`${model} owns six-wheel model and silent beacon driving controls (${renderer})`, async ({
      page,
    }) => {
      await page.goto(`/tilefun/workshop.html?renderer=${renderer}#/tool/traffic`);
      await page.getByLabel("Playground vehicle").selectOption(model);
      const canvas = page.getByLabel("Generated traffic playground");
      await expect(canvas).toHaveAttribute("data-ready", "true");
      await canvas.focus();
      await page.keyboard.down("ArrowLeft");
      await expect(page.getByRole("button", { name: "Drive car · E", exact: true })).toBeVisible();
      await page.keyboard.up("ArrowLeft");
      await page.getByRole("button", { name: "Drive car · E", exact: true }).click();
      await expect(canvas).toHaveAttribute("data-driving", "true");
      if (renderer.includes("meshes"))
        await expect
          .poll(() =>
            canvas.evaluate((c: TrafficCanvas, id) => {
              const gpu = c.__presentationDiagnostics?.().terrain as unknown as {
                gpu?: { vehicleAssets?: Record<string, { state: string; meshes: number }> };
              };
              return gpu?.gpu?.vehicleAssets?.[id];
            }, `${model}-authored-v1`),
          )
          .toMatchObject({ state: "ready", meshes: model === "garbage-truck-green" ? 52 : 53 });
      await expect(canvas).toHaveAttribute("data-emergency-state", "0");
      await expect(page.getByRole("button", { name: /^Style:/ })).toHaveCount(0);
      await page.getByRole("button", { name: "Beacon Off", exact: true }).click();
      await expect(canvas).toHaveAttribute("data-emergency-state", "1");
      await canvas.focus();
      await page.keyboard.press("Space");
      await expect(canvas).toHaveAttribute("data-emergency-state", "1");
      await page.keyboard.press("b");
      await expect(canvas).toHaveAttribute("data-emergency-state", "0");
      const before = Number(await canvas.getAttribute("data-car-x"));
      await page.keyboard.down("ArrowRight");
      await page.keyboard.down("Shift");
      await expect
        .poll(async () => Number(await canvas.getAttribute("data-car-x")))
        .toBeGreaterThan(before + 120);
      await page.keyboard.up("ArrowRight");
      await page.keyboard.up("Shift");
      await page.getByRole("button", { name: "Get out · E", exact: true }).click();
      await expect(canvas).toHaveAttribute("data-driving", "false");
    });
  }
}
