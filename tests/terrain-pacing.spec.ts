import { expect, test } from "@playwright/test";
import type { TerrainDiagnostics } from "../src/rendering/RenderFrame.js";

test.use({ channel: "chromium" });
test.setTimeout(60000);

type GameCanvas = HTMLCanvasElement & {
  __game: {
    camera: { zoom: number };
    renderer: { getDiagnostics(): TerrainDiagnostics & { gpu?: { uploadedBytes: number } } };
  };
};

for (const renderer of ["canvas", "gpu"]) {
  test(`zoom shortcuts and terrain pacing survive demand changes (${renderer})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`/tilefun/?nogamepad&renderer=${renderer}`);
    const canvas = page.locator("#game");
    await expect(canvas).toHaveAttribute("data-ready", "true");
    await expect(canvas).toHaveAttribute("data-renderer", renderer);
    await page.getByRole("button", { name: "☰", exact: true }).click();
    await page.getByRole("button", { name: "Debug", exact: true }).click();
    const zoom = page.getByRole("combobox", { name: "Zoom preset", exact: true });
    const pacing = page.getByRole("combobox", { name: "Terrain pacing", exact: true });
    await pacing.selectOption("responsive");
    await canvas.click({ position: { x: 15, y: 600 } });
    for (const [key, value] of [
      ["1", "0.25"],
      ["2", "0.5"],
      ["3", "1"],
      ["4", "2"],
      ["0", "0.1"],
    ]) {
      await page.keyboard.press(key as string);
      await expect(zoom).toHaveValue(value as string);
      await expect
        .poll(() => canvas.evaluate((c: GameCanvas) => c.__game.camera.zoom))
        .toBe(Number(value));
    }
    // Demand reverses before the overview fills. Partial jobs must remain bounded
    // and old retained terrain must not be invalidated just by changing zoom.
    await zoom.selectOption("1");
    await zoom.selectOption("0.25");
    const samples = await canvas.evaluate(async (c: GameCanvas) => {
      const rows: number[] = [];
      let quiet = 0;
      for (let i = 0; i < 1800 && quiet < 60; i++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const d = c.__game.renderer.getDiagnostics();
        rows.push(d.rowsLastFrame);
        quiet = !d.pending && !d.rowsLastFrame ? quiet + 1 : 0;
      }
      return { maxRows: Math.max(...rows), quiet, d: c.__game.renderer.getDiagnostics() };
    });
    expect(samples.maxRows).toBeLessThanOrEqual(2);
    expect(samples.quiet).toBe(60);
    expect(samples.d.resident).toBeGreaterThan(0);
    const warm = await canvas.evaluate(async (c: GameCanvas) => {
      const before = c.__game.renderer.getDiagnostics();
      let rows = 0;
      for (let i = 0; i < 60; i++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        rows += c.__game.renderer.getDiagnostics().rowsLastFrame;
      }
      return { before, after: c.__game.renderer.getDiagnostics(), rows };
    });
    expect(warm.rows).toBe(0);
    expect(warm.after.surfaceBytes).toBe(warm.before.surfaceBytes);
    if (renderer === "gpu")
      expect(warm.after.gpu?.uploadedBytes).toBe(warm.before.gpu?.uploadedBytes);
    await pacing.selectOption("throughput");
    await zoom.selectOption("1");
    expect(errors).toEqual([]);
  });
}
