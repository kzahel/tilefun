import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import type { TransporterCanvas } from "../src/workshop/TransporterPage.js";
import { chooseVehicleAction } from "./helpers/context-actions.js";

test.use({ channel: "chromium", hasTouch: true });
test("loads, carries and unloads through shared Worker controls with mesh/fallback presentation", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/tilefun/workshop.html?geometry=transporter#/tool/world-geometry");
  const canvas = page.getByLabel("Transporter scene");
  const report = () => canvas.evaluate((c: TransporterCanvas) => c.__transporterDiagnostics?.());
  const capture = async (name: string) => {
    const data = await canvas.evaluate(
      (c: TransporterCanvas) => c.__captureTransporter?.().toDataURL().split(",")[1],
    );
    if (!data) throw Error("No frame");
    await writeFile(testInfo.outputPath(`${name}.png`), Buffer.from(data, "base64"));
    await testInfo.attach(name, { body: Buffer.from(data, "base64"), contentType: "image/png" });
  };
  await expect(canvas).toHaveAttribute("data-ready", "true", { timeout: 60000 });
  await expect
    .poll(async () => (await report())?.meshDraws ?? 0, { timeout: 60000 })
    .toBeGreaterThan(0);
  await chooseVehicleAction(page, "Deploy ramp");
  await expect.poll(async () => (await report())?.truck?.ramp).toBe(true);
  await capture("ramp-deployed");
  await page.getByRole("button", { name: "Stand beside car", exact: true }).click();
  await page.getByRole("button", { name: /Drive car/ }).click();
  await canvas.focus();
  await page.keyboard.down("ArrowRight");
  try {
    await expect
      .poll(async () => (await report())?.car?.z ?? 0, { intervals: [20], timeout: 15000 })
      .toBeGreaterThan(8);
    await capture("ramp-climbing");
    await expect
      .poll(async () => (await report())?.car?.wx ?? -999, { intervals: [20], timeout: 15000 })
      .toBeGreaterThan(-32);
  } finally {
    await page.keyboard.up("ArrowRight");
  }
  await page.getByRole("button", { name: /Get out/ }).click();
  await expect.poll(async () => (await report())?.car?.z ?? 0).toBeCloseTo(24.65, 2);
  await chooseVehicleAction(page, "Secure car");
  await expect.poll(async () => (await report())?.truck?.target).toBe((await report())?.car?.id);
  await chooseVehicleAction(page, "Stow ramp");
  await page.getByRole("button", { name: /Drive transporter/ }).click();
  await canvas.focus();
  await page.keyboard.down("ArrowRight");
  try {
    await expect
      .poll(async () => (await report())?.truck?.wx ?? 0, { timeout: 10000 })
      .toBeGreaterThan(80);
  } finally {
    await page.keyboard.up("ArrowRight");
  }
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  // The button requests a Worker clock fence; exact saved coordinates must be
  // sampled after that acknowledgement, not during a final in-flight tick.
  await expect.poll(async () => (await report())?.authority.clock?.running).toBe(false);
  await capture("loaded-driving");
  const before = await report();
  await page.getByRole("button", { name: "Reload", exact: true }).click();
  await expect(page.getByRole("button", { name: "Reload", exact: true })).toBeEnabled();
  await expect.poll(async () => (await report())?.car?.owner).toBe((await report())?.truck?.id);
  expect((await report())?.car?.wx).toBeCloseTo(before?.car?.wx ?? 0, 3);
  for (const mode of ["canvas", "gpu", "gpu-mesh"]) {
    await page.getByLabel("Transporter renderer").selectOption(mode);
    await expect(page.getByLabel("Transporter renderer")).toBeEnabled();
    await capture(`loaded-${mode}`);
  }
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await chooseVehicleAction(page, "Deploy ramp");
  await chooseVehicleAction(page, "Release car");
  await expect.poll(async () => (await report())?.car?.owner).toBeNull();
  await page.getByRole("button", { name: /Get out/ }).click();
  // The parked truck and car overlap: walking beside the rear half targets the car.
  await page.getByRole("button", { name: "Stand beside car", exact: true }).click();
  await page.getByRole("button", { name: /Drive car/ }).click();
  await canvas.focus();
  await page.keyboard.down("ArrowLeft");
  try {
    await expect.poll(async () => (await report())?.car?.z ?? 99, { timeout: 15000 }).toBe(0);
  } finally {
    await page.keyboard.up("ArrowLeft");
  }
  await capture("unloaded");
  await page.route("**/assets/models/vehicles/car-transporter-v2.glb", (route) => route.abort());
  await page.reload();
  await expect(canvas).toHaveAttribute("data-ready", "true", { timeout: 60000 });
  await page.setViewportSize({ width: 390, height: 844 });
  await chooseVehicleAction(page, "Deploy ramp", true);
  await capture("failed-mesh-ramp");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
