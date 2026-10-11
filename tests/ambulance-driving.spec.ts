import { expect, test } from "@playwright/test";
import type { TrafficCanvas } from "../src/workshop/TrafficPage.js";

test.use({ channel: "chromium" });
for (const backend of ["canvas", "gpu&meshes"]) {
  test(`ambulance uses its own model, switches lights/styles and boosts in shared driving (${backend})`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`/tilefun/workshop.html?renderer=${backend}#/tool/traffic`);
    const canvas = page.getByLabel("Generated traffic playground");
    await expect(canvas).toHaveAttribute("data-ready", "true");
    await page.getByLabel("Playground vehicle").selectOption("ambulance");
    await expect(canvas).toHaveAttribute("data-ready", "true");
    await canvas.focus();
    await page.keyboard.down("ArrowLeft");
    await expect(page.getByRole("button", { name: "Drive car · E", exact: true })).toBeVisible();
    await page.keyboard.up("ArrowLeft");
    await page.getByRole("button", { name: "Drive car · E", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-driving", "true");
    if (backend.includes("meshes")) {
      await expect
        .poll(() =>
          canvas.evaluate((c) => {
            const diagnostics = (c as TrafficCanvas).__presentationDiagnostics?.();
            return (
              diagnostics?.terrain as unknown as {
                gpu?: { ambulanceState: string; ambulanceParts: number };
              }
            )?.gpu;
          }),
        )
        .toMatchObject({ ambulanceState: "ready", ambulanceParts: 56 });
    }
    await page.getByRole("button", { name: "Siren Off", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-emergency-state", "3");
    await page.getByRole("button", { name: "Style: EU two-tone", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-emergency-state", "5");
    await page.getByRole("button", { name: "Style: US wail", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-emergency-state", "1");
    await page.getByRole("button", { name: "Style: Lights only", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-emergency-state", "3");
    await page.screenshot({
      path: `/tmp/tilefun-ambulance-${backend.replaceAll("&", "-")}.png`,
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
