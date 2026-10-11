import { expect, test } from "@playwright/test";
import type { TrafficCanvas } from "../src/workshop/TrafficPage.js";

test.use({ channel: "chromium" });

test("every compact uses its own GLB in the shared traffic presentation", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/tilefun/workshop.html?renderer=gpu&meshes#/tool/traffic");
  const canvas = page.getByLabel("Generated traffic playground");
  for (const number of [1, 2, 3, 4, 5, 6]) {
    await page.getByLabel("Playground vehicle", { exact: true }).selectOption(`compact-${number}`);
    await expect(canvas).toHaveAttribute("data-ready", "true");
    const assetId = `compact-${number}-authored-${number <= 2 ? "v7" : "v1"}`;
    await expect
      .poll(() =>
        canvas.evaluate((c: TrafficCanvas, id) => {
          const gpu = c.__presentationDiagnostics?.().terrain as unknown as {
            gpu?: { vehicleAssets?: Record<string, { state: string; meshes: number }> };
          };
          return gpu?.gpu?.vehicleAssets?.[id];
        }, assetId),
      )
      .toMatchObject({ state: "ready", meshes: 55 });
    expect(
      await canvas.evaluate(
        (c: TrafficCanvas) => c.__presentationDiagnostics?.().meshEligibleVehicleTypes,
      ),
    ).toContain(`vehicle-v1:compact-${number}`);
    await expect
      .poll(() =>
        canvas.evaluate((c: TrafficCanvas) => c.__presentationDiagnostics?.().meshDraws ?? 0),
      )
      .toBeGreaterThan(0);
  }
  expect(errors).toEqual([]);
});

test("failed own-model fetch keeps the traffic scene and sprite fallback available", async ({
  page,
}) => {
  await page.route("**/assets/models/vehicles/compact-6-v1.glb", (route) => route.abort());
  await page.goto("/tilefun/workshop.html?renderer=gpu&meshes#/tool/traffic");
  await page.getByLabel("Playground vehicle", { exact: true }).selectOption("compact-6");
  const canvas = page.getByLabel("Generated traffic playground");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await expect
    .poll(() =>
      canvas.evaluate((c: TrafficCanvas) => {
        const gpu = c.__presentationDiagnostics?.().terrain as unknown as {
          gpu?: { vehicleAssets?: Record<string, { state: string; meshes: number }> };
        };
        return gpu?.gpu?.vehicleAssets?.["compact-6-authored-v1"];
      }),
    )
    .toMatchObject({ state: "failed", meshes: 0 });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-ready", "true");
});
