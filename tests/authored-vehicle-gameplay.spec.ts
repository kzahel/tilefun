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

test("every additional sedan loads its own GLB in shared traffic", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/tilefun/workshop.html?renderer=gpu&meshes#/tool/traffic");
  const canvas = page.getByLabel("Generated traffic playground");
  for (const color of ["red", "beige", "cyan", "orange", "silver", "olive", "dark"]) {
    const vehicle = `unindexed-sedan-${color}`;
    await page.getByLabel("Playground vehicle", { exact: true }).selectOption(vehicle);
    await expect(canvas).toHaveAttribute("data-ready", "true");
    await expect
      .poll(() =>
        canvas.evaluate((c: TrafficCanvas, id) => {
          const gpu = c.__presentationDiagnostics?.().terrain as unknown as {
            gpu?: { vehicleAssets?: Record<string, { state: string; meshes: number }> };
          };
          return gpu?.gpu?.vehicleAssets?.[id];
        }, `${vehicle}-authored-v1`),
      )
      .toMatchObject({ state: "ready", meshes: 32 });
    expect(
      await canvas.evaluate(
        (c: TrafficCanvas) => c.__presentationDiagnostics?.().meshEligibleVehicleTypes,
      ),
    ).toContain(`vehicle-v1:${vehicle}`);
    await expect
      .poll(() =>
        canvas.evaluate((c: TrafficCanvas) => c.__presentationDiagnostics?.().meshDraws ?? 0),
      )
      .toBeGreaterThan(0);
  }
});

test("every bus loads its own GLB in shared traffic", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/tilefun/workshop.html?renderer=gpu&meshes#/tool/traffic");
  const canvas = page.getByLabel("Generated traffic playground");
  for (const number of [1, 2, 3, 4, 5, 6]) {
    const vehicle = `bus-${number}`;
    await page.getByLabel("Playground vehicle", { exact: true }).selectOption(vehicle);
    await expect(canvas).toHaveAttribute("data-ready", "true");
    await expect
      .poll(() =>
        canvas.evaluate((c: TrafficCanvas, id) => {
          const gpu = c.__presentationDiagnostics?.().terrain as unknown as {
            gpu?: { vehicleAssets?: Record<string, { state: string; meshes: number }> };
          };
          return gpu?.gpu?.vehicleAssets?.[id];
        }, `${vehicle}-authored-v1`),
      )
      .toMatchObject({ state: "ready", meshes: 39 });
    expect(
      await canvas.evaluate(
        (c: TrafficCanvas) => c.__presentationDiagnostics?.().meshEligibleVehicleTypes,
      ),
    ).toContain(`vehicle-v1:${vehicle}`);
    await expect
      .poll(() =>
        canvas.evaluate((c: TrafficCanvas) => c.__presentationDiagnostics?.().meshDraws ?? 0),
      )
      .toBeGreaterThan(0);
  }
});

test("every large car loads its own GLB in shared traffic", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/tilefun/workshop.html?renderer=gpu&meshes#/tool/traffic");
  const canvas = page.getByLabel("Generated traffic playground");
  for (let number = 7; number <= 26; number++) {
    const vehicle = number === 12 ? "sedan-12" : `car-${number}`;
    await page.getByLabel("Playground vehicle", { exact: true }).selectOption(vehicle);
    await expect(canvas).toHaveAttribute("data-ready", "true");
    await expect
      .poll(() =>
        canvas.evaluate((c: TrafficCanvas, id) => {
          const gpu = c.__presentationDiagnostics?.().terrain as unknown as {
            gpu?: { vehicleAssets?: Record<string, { state: string; meshes: number }> };
          };
          return gpu?.gpu?.vehicleAssets?.[id];
        }, `${vehicle}-authored-v1`),
      )
      .toMatchObject({ state: "ready", meshes: 34 });
    expect(
      await canvas.evaluate(
        (c: TrafficCanvas) => c.__presentationDiagnostics?.().meshEligibleVehicleTypes,
      ),
    ).toContain(`vehicle-v1:${vehicle}`);
    await expect
      .poll(() =>
        canvas.evaluate((c: TrafficCanvas) => c.__presentationDiagnostics?.().meshDraws ?? 0),
      )
      .toBeGreaterThan(0);
  }
});

for (const vehicle of [
  "compact-6",
  "unindexed-sedan-dark",
  "bus-6",
  "car-7",
  "car-15",
  "car-24",
  "garbage-truck-green",
  "garbage-truck-orange",
  "fire-truck-ladder-2",
  "police-car",
  "ambulance",
]) {
  test(`failed ${vehicle} fetch keeps the traffic scene and sprite fallback available`, async ({
    page,
  }) => {
    const revision = vehicle === "ambulance" ? "v3" : vehicle === "police-car" ? "v2" : "v1";
    await page.route(`**/assets/models/vehicles/${vehicle}-${revision}.glb`, (route) =>
      route.abort(),
    );
    await page.goto("/tilefun/workshop.html?renderer=gpu&meshes#/tool/traffic");
    await page.getByLabel("Playground vehicle", { exact: true }).selectOption(vehicle);
    const canvas = page.getByLabel("Generated traffic playground");
    await expect(canvas).toHaveAttribute("data-ready", "true");
    await expect
      .poll(() =>
        canvas.evaluate((c: TrafficCanvas, id) => {
          const gpu = c.__presentationDiagnostics?.().terrain as unknown as {
            gpu?: { vehicleAssets?: Record<string, { state: string; meshes: number }> };
          };
          return gpu?.gpu?.vehicleAssets?.[id];
        }, `${vehicle}-authored-${revision}`),
      )
      .toMatchObject({ state: "failed", meshes: 0 });
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-ready", "true");
  });
}
