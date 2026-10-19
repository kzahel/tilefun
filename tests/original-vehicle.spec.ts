import { expect, test } from "@playwright/test";
import type { TrafficCanvas } from "../src/workshop/TrafficPage.js";

test.use({ channel: "chromium" });
for (const failed of [false, true]) {
  test(`coupe shares game/lab GPU registration and drives with ${failed ? "failed-mesh sprite fallback" : "its own mesh"}`, async ({
    page,
  }) => {
    if (failed) await page.route("**/rosso-coupe-v3.glb", (route) => route.abort());
    await page.goto("/tilefun/workshop.html?renderer=gpu&meshes#/tool/traffic");
    const canvas = page.getByLabel("Generated traffic playground");
    await expect(canvas).toHaveAttribute("data-ready", "true");
    await page.getByRole("combobox", { name: "Playground vehicle" }).selectOption("rosso-coupe");
    await expect(canvas).toHaveAttribute("data-ready", "true");
    const status = () =>
      canvas.evaluate((c: TrafficCanvas) => {
        const d = c.__presentationDiagnostics?.().terrain as
          | { gpu?: { vehicleAssets?: Record<string, { state: string; drawMeshes: number }> } }
          | undefined;
        return d?.gpu?.vehicleAssets?.["rosso-coupe-authored-v3"];
      });
    await expect.poll(async () => (await status())?.state).toBe(failed ? "failed" : "ready");
    if (!failed) expect((await status())?.drawMeshes).toBe(5);
    await page.getByRole("button", { name: "Start on roof", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-player-z", "19");
    const before = Number(await canvas.getAttribute("data-car-x"));
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-car-x")))
      .toBeGreaterThan(before + 15);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.screenshot({
      path: `data/vehicle-bake/gameplay-${failed ? "fallback" : "mesh"}.png`,
      fullPage: true,
    });
  });
}
