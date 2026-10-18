import { expect, test } from "@playwright/test";
import type { TrafficCanvas } from "../src/workshop/TrafficPage.js";

test.use({ channel: "chromium" });
for (const [model, parts, resource] of [
  ["ambulance", 56, "ambulance-authored-v3"],
  ["fire-truck-ladder-1", 49, "fire-truck-ladder-1-authored-v2"],
  ["police-car", 37, "police-car-authored-v2"],
  ["fire-truck-ladder-2", 49, "fire-truck-ladder-2-authored-v1"],
] as const) {
  for (const backend of ["canvas", "gpu&meshes"]) {
    test(`${model} uses its own model, switches lights/styles and boosts in shared driving (${backend})`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`/tilefun/workshop.html?renderer=${backend}#/tool/traffic`);
      const canvas = page.getByLabel("Generated traffic playground");
      await expect(canvas).toHaveAttribute("data-ready", "true");
      await page.getByLabel("Playground vehicle").selectOption(model);
      await expect(canvas).toHaveAttribute("data-ready", "true");
      await canvas.focus();
      const initialPlayerX = Number(await canvas.getAttribute("data-player-x"));
      await page.keyboard.down("ArrowLeft");
      await expect
        .poll(async () => Number(await canvas.getAttribute("data-player-x")))
        .toBeLessThan(initialPlayerX - 8);
      await expect
        .poll(async () => Number(await canvas.getAttribute("data-speed")))
        .toBeLessThan(0.1);
      await expect(page.getByRole("button", { name: "Drive car · E", exact: true })).toBeVisible();
      await page.keyboard.up("ArrowLeft");
      await page.getByRole("button", { name: "Drive car · E", exact: true }).click();
      await expect(canvas).toHaveAttribute("data-driving", "true");
      await page.getByRole("button", { name: "Horn · H", exact: true }).click();
      if (backend.includes("meshes")) {
        await expect
          .poll(() =>
            canvas.evaluate((c, resource) => {
              const diagnostics = (c as TrafficCanvas).__presentationDiagnostics?.();
              const gpu = (
                diagnostics?.terrain as unknown as {
                  gpu?: { vehicleAssets?: Record<string, { state: string; meshes: number }> };
                }
              )?.gpu;
              return {
                state: gpu?.vehicleAssets?.[resource]?.state,
                parts: gpu?.vehicleAssets?.[resource]?.meshes,
              };
            }, resource),
          )
          .toMatchObject({ state: "ready", parts });
      }
      await page.getByRole("button", { name: "Siren Off", exact: true }).click();
      await expect(canvas).toHaveAttribute("data-emergency-state", "3");
      await canvas.focus();
      await page.keyboard.press("b");
      await expect(canvas).toHaveAttribute("data-emergency-state", "2");
      await page.keyboard.press("b");
      await expect(canvas).toHaveAttribute("data-emergency-state", "3");
      await page.keyboard.press("Space");
      await expect(canvas).toHaveAttribute("data-emergency-state", "5");
      await page.getByRole("button", { name: "Style: US wail", exact: true }).click();
      await expect(canvas).toHaveAttribute("data-emergency-state", "1");
      await page.getByRole("button", { name: "Style: Lights only", exact: true }).click();
      await expect(canvas).toHaveAttribute("data-emergency-state", "3");
      await page.screenshot({
        path: `/tmp/tilefun-${model}-${backend.replaceAll("&", "-")}.png`,
        fullPage: true,
      });
      const before = Number(await canvas.getAttribute("data-car-x"));
      await canvas.focus();
      await page.keyboard.down("ArrowRight");
      await page.keyboard.down("Shift");
      await expect
        .poll(async () => Number(await canvas.getAttribute("data-car-x")))
        .toBeGreaterThan(before + 120);
      await page.keyboard.up("ArrowRight");
      await page.keyboard.up("Shift");
      await page.getByRole("button", { name: "Siren On", exact: true }).click();
      await expect(canvas).toHaveAttribute("data-emergency-state", "2");
      await page.getByRole("button", { name: "Get out · E", exact: true }).click();
      await expect(canvas).toHaveAttribute("data-driving", "false");
      expect(errors).toEqual([]);
    });
  }
}
