import { expect, test } from "@playwright/test";
import type { TruckBedCanvas } from "../src/workshop/TruckBedPage.js";

test.use({ channel: "chromium" });

/** GPU/Worker/host lifecycle boundary; geometry and contact cases stay in Node. */
test("bed occupant clips in the shared host and survives backend changes and paused stepping", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(
    "/tilefun/workshop.html?geometry=truck-bed&renderer=gpu&meshes#/tool/world-geometry",
  );
  const canvas = page.locator('canvas[aria-label="Truck bed scene"]');
  const report = () =>
    page.evaluate(() =>
      (
        document.querySelector('canvas[aria-label="Truck bed scene"]') as TruckBedCanvas
      ).__truckBedDiagnostics?.(),
    );
  await expect(canvas).toHaveAttribute("data-ready", "true", { timeout: 60000 });
  await expect
    .poll(async () => (await report())?.bedMeshDraws, { timeout: 60000 })
    .toBeGreaterThan(0);
  const initial = await report();
  expect(initial?.supportId).toBe(initial?.truckId);
  expect(initial?.playerZ).toBeCloseTo(initial?.floorZ ?? 0, 3);
  expect(initial?.predictedZ).toBeCloseTo(initial?.floorZ ?? 0, 3);
  await canvas.focus();
  await page.keyboard.down("ArrowDown");
  try {
    await expect.poll(async () => (await report())?.local?.y).toBeGreaterThan(9);
  } finally {
    await page.keyboard.up("ArrowDown");
  }
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect.poll(async () => (await report())?.authority.clock?.running).toBe(false);
  const stopped = await report();
  expect(stopped?.local?.y).toBeLessThanOrEqual(15.1);
  expect(stopped?.playerZ).toBeCloseTo(stopped?.floorZ ?? 0, 3);
  // Capture the actual GPU canvas through the shared host; no approved snapshot rewrite.
  const capture = async () =>
    Buffer.from(
      await page.evaluate(
        () =>
          (document.querySelector('canvas[aria-label="Truck bed scene"]') as TruckBedCanvas)
            .__captureTruckBed?.()
            .toDataURL()
            .split(",")[1] ?? "",
      ),
      "base64",
    );
  const normal = await capture();
  await testInfo.attach("near-wall", { body: normal, contentType: "image/png" });
  await page.getByRole("checkbox", { name: "Show clipping geometry" }).check();
  const debug = await capture();
  expect(debug.equals(normal)).toBe(false);
  await testInfo.attach("clip-geometry", { body: debug, contentType: "image/png" });
  const beforeStep = await report();
  await page.getByRole("button", { name: "Step", exact: true }).click();
  await expect
    .poll(async () => (await report())?.authority.clock?.ticks)
    .toBe((beforeStep?.authority.clock?.ticks ?? 0) + 1);
  const tick = (await report())?.authority.clock?.ticks;
  for (const mode of ["canvas", "gpu", "gpu-mesh"]) {
    await page.getByLabel("Truck renderer", { exact: true }).selectOption(mode);
    await expect(page.getByLabel("Truck renderer", { exact: true })).toBeEnabled();
    if (mode === "gpu-mesh")
      await expect.poll(async () => (await report())?.bedMeshDraws).toBeGreaterThan(0);
    const current = await report();
    expect(current?.playerId).toBe(initial?.playerId);
    expect(current?.truckId).toBe(initial?.truckId);
    expect(current?.supportId).toBe(initial?.truckId);
    expect(current?.playerZ).toBeCloseTo(current?.floorZ ?? 0, 3);
    expect(current?.authority.clock?.ticks).toBe(tick);
    await testInfo.attach(mode, { body: await capture(), contentType: "image/png" });
  }
  await page.getByRole("checkbox", { name: "Show clipping geometry" }).uncheck();
  await page.getByRole("button", { name: "Stand beside truck", exact: true }).click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  for (let count = 1; count <= 2; count++) {
    await page.getByRole("button", { name: "Load cargo", exact: true }).click();
    await expect.poll(async () => (await report())?.cargoCount).toBe(count);
  }
  await page.getByRole("button", { name: "Ride in bed", exact: true }).click();
  await expect.poll(async () => (await report())?.supportId).toBe(initial?.truckId);
  const boarded = await report();
  await testInfo.attach("loaded-bed", { body: await capture(), contentType: "image/png" });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByLabel("Truck renderer", { exact: true }).selectOption("canvas");
  await expect(page.getByLabel("Truck renderer", { exact: true })).toBeEnabled();
  expect((await report())?.cargoCount).toBe(2);
  await testInfo.attach("loaded-fallback", { body: await capture(), contentType: "image/png" });
  await page.getByLabel("Truck renderer", { exact: true }).selectOption("gpu-mesh");
  await expect.poll(async () => (await report())?.bedMeshDraws).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.getByRole("button", { name: "Drive truck", exact: true }).click();
  await expect.poll(async () => (await report())?.truckPosition?.wx).toBeGreaterThan(15);
  const moving = await report();
  expect(moving?.local?.x).toBeCloseTo(boarded?.local?.x ?? 0, 2);
  expect(moving?.playerZ).toBeCloseTo(moving?.floorZ ?? 0, 3);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Reload", exact: true }).click();
  await expect(page.getByRole("button", { name: "Reload", exact: true })).toBeEnabled();
  expect((await report())?.playerZ).toBeCloseTo(initial?.floorZ ?? 0, 3);
  expect((await report())?.cargoCount).toBe(2);
  expect(errors).toEqual([]);
  // The named canvas itself remains the keyboard surface after GPU replacement.
  await expect(canvas).toBeVisible();
});
