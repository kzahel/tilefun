import { expect, test } from "@playwright/test";
import type { TowingCanvas } from "../src/workshop/TowingPage.js";

test.use({ channel: "chromium" });
test("wheel-lift towing shares Worker controls, reload and sprite fallbacks", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    "/tilefun/workshop.html?geometry=towing&renderer=gpu&meshes#/tool/world-geometry",
  );
  const canvas = page.getByLabel("Towing scene");
  const report = () => canvas.evaluate((c: TowingCanvas) => c.__towingDiagnostics?.());
  const capture = async (name: string) => {
    const data = await canvas.evaluate(
      (c: TowingCanvas) => c.__captureTowing?.().toDataURL().split(",")[1],
    );
    if (!data) throw Error("Missing towing capture");
    await testInfo.attach(name, { body: Buffer.from(data, "base64"), contentType: "image/png" });
  };
  await expect(canvas).toHaveAttribute("data-ready", "true", { timeout: 60000 });
  await expect
    .poll(async () => (await report())?.meshDraws ?? 0, { timeout: 60000 })
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Attach car", exact: true }).click();
  await expect.poll(async () => (await report())?.truck?.target).toBe((await report())?.car?.id);
  await capture("attached");
  await page.getByRole("button", { name: /Drive car/ }).click();
  await canvas.focus();
  await page.keyboard.down("ArrowRight");
  const start = (await report())?.truck?.wx ?? 0;
  try {
    await expect.poll(async () => (await report())?.truck?.wx ?? 0).toBeGreaterThan(start + 45);
  } finally {
    await page.keyboard.up("ArrowRight");
  }
  await expect(page.getByRole("button", { name: "Release car", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect.poll(async () => (await report())?.authority.clock?.running).toBe(false);
  await capture("towing");
  const before = await report();
  await page.getByRole("button", { name: "Reload", exact: true }).click();
  await expect.poll(async () => (await report())?.truck?.target).toBe((await report())?.car?.id);
  expect((await report())?.car?.wx).toBeCloseTo(before?.car?.wx ?? 0, 3);
  for (const mode of ["canvas", "gpu", "gpu-mesh"]) {
    await page.getByLabel("Towing renderer").selectOption(mode);
    await expect(page.getByLabel("Towing renderer")).toBeEnabled();
    await capture(mode);
    expect((await report())?.car?.owner).toBe((await report())?.truck?.id);
  }
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(page.getByRole("button", { name: "Release car", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Release car", exact: true }).click();
  await expect.poll(async () => (await report())?.car?.owner).toBeNull();
  // Reset and force the actual new GLB to fail; the retained wheel-lift fallback remains usable.
  await page.route("**/assets/models/vehicles/tow-truck-v2.glb", (route) => route.abort());
  await page.reload();
  await expect(canvas).toHaveAttribute("data-ready", "true", { timeout: 60000 });
  await page.getByRole("button", { name: "Attach car", exact: true }).click();
  await expect.poll(async () => (await report())?.car?.owner).toBe((await report())?.truck?.id);
  await capture("failed-truck-model");
  expect(errors).toEqual([]);
});
