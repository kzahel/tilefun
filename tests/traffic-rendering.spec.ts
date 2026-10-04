import { expect, type Locator, test } from "@playwright/test";
import type { TrafficCanvas } from "../src/workshop/TrafficPage.js";

test.use({ channel: "chromium" });

async function expectSettledTerrain(canvas: Locator) {
  // Streaming/autotiling may still publish startup revisions after the first
  // ready frame. Require a full quiet window, not just one empty queue sample.
  await expect(async () => {
    const samples = await canvas.evaluate(async (c: TrafficCanvas) => {
      const result = [];
      for (let i = 0; i < 60; i++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const d = c.__terrainDiagnostics?.();
        if (!d) throw Error("Traffic diagnostics disappeared");
        result.push(d);
      }
      return result;
    });
    for (const d of samples) {
      expect(d.resident).toBeGreaterThan(0);
      expect(d.pending).toBe(0);
      expect(d.building).toBe(0);
      expect(d.rowsLastFrame).toBe(0);
      expect(d.resident).toBe(samples[0]?.resident);
      expect(d.surfaceBytes).toBe(samples[0]?.surfaceBytes);
    }
  }).toPass({ timeout: 10000 });
}

for (const mode of ["canvas", "gpu", "gpu&meshes"]) {
  test(`traffic terrain settles and retains its caches after movement and reset (${mode})`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`/tilefun/workshop.html?renderer=${mode}#/tool/traffic`);
    const canvas = page.getByLabel("Generated traffic playground");
    await expect(canvas).toHaveAttribute("data-ready", "true");
    await expectSettledTerrain(canvas);

    await page.getByRole("button", { name: "Start on roof", exact: true }).click();
    const start = Number(await canvas.getAttribute("data-car-x"));
    await expect
      .poll(() => canvas.getAttribute("data-car-x").then(Number), { timeout: 10000 })
      .toBeGreaterThan(start + 100);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expectSettledTerrain(canvas);

    const previous = await canvas.elementHandle();
    if (!previous) throw Error("Missing traffic canvas");
    await page.getByRole("button", { name: "Reset scene", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-ready", "true");
    expect(
      await previous.evaluate(
        (c: TrafficCanvas) => !c.isConnected && !c.__terrainDiagnostics && !c.dataset.ready,
      ),
    ).toBe(true);
    await previous.dispose();
    await expectSettledTerrain(canvas);
    if (mode.includes("meshes"))
      await expect
        .poll(() => canvas.getAttribute("data-mesh-draws").then(Number))
        .toBeGreaterThan(0);
    await page.getByRole("link", { name: "All tools", exact: true }).first().click();
    await expect(canvas).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
