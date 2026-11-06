import { expect, type Locator, type Page, test } from "@playwright/test";
import type { RenderPass, RenderView, TerrainDiagnostics } from "../src/rendering/RenderFrame.js";

test.use({ channel: "chromium" });
test.setTimeout(60000);

type GameCanvas = HTMLCanvasElement & {
  __game: {
    camera: { zoom: number };
    renderer: {
      getDiagnostics(): TerrainDiagnostics & {
        gpu?: { uploadedBytes: number };
      };
      submit(view: RenderView, pass: RenderPass): void;
      surface?: { drawImage(image: CanvasImageSource, x: number, y: number): void };
    };
  };
};

async function openDebug(page: Page, renderer: "canvas" | "gpu") {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/tilefun/?nogamepad&renderer=${renderer}`);
  const canvas = page.locator("#game");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await expect(canvas).toHaveAttribute("data-renderer", renderer);
  await page.getByRole("button", { name: "☰", exact: true }).click();
  await page.getByRole("button", { name: "Debug", exact: true }).click();
  const zoom = page.getByRole("combobox", { name: "Zoom preset", exact: true });
  const pacing = page.getByRole("combobox", { name: "Terrain pacing", exact: true });
  await pacing.selectOption("responsive");
  return { canvas, zoom, pacing };
}

/** Frames until terrain preparation stays quiet, with the most rows prepared in one frame. */
function settle(canvas: Locator) {
  return canvas.evaluate(async (c: GameCanvas) => {
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
}

/** Sixty warm frames, attributing backend uploads to terrain submission. */
function warm(canvas: Locator) {
  return canvas.evaluate(async (c: GameCanvas) => {
    const backend = c.__game.renderer;
    const before = backend.getDiagnostics();
    const submit = backend.submit;
    let terrainUploadedBytes = 0;
    let terrainPasses = 0;
    // Attribute uploads to terrain submission; traffic can introduce new
    // sprite pages after terrain preparation has already settled.
    backend.submit = function (view, pass) {
      const uploadedBefore = this.getDiagnostics().gpu?.uploadedBytes ?? 0;
      submit.call(this, view, pass);
      if (pass.kind === "terrain") {
        terrainPasses++;
        terrainUploadedBytes += (this.getDiagnostics().gpu?.uploadedBytes ?? 0) - uploadedBefore;
      }
    };
    // A previously unseen sprite page may arrive while terrain is warm.
    // Force that unrelated upload so the terrain-only assertion below is
    // exercised independently of traffic timing or the runner's speed.
    const lateSprite = document.createElement("canvas");
    lateSprite.width = lateSprite.height = 8;
    let rows = 0;
    try {
      for (let i = 0; i < 60; i++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (i === 30) backend.surface?.drawImage(lateSprite, -16, -16);
        rows += backend.getDiagnostics().rowsLastFrame;
      }
      return {
        before,
        after: backend.getDiagnostics(),
        rows,
        terrainUploadedBytes,
        terrainPasses,
      };
    } finally {
      backend.submit = submit;
    }
  });
}

// Zoom input and row pacing live in the shared raster backend, so the Canvas case
// owns them; the GPU case keeps only its upload contract at a cheaper overview.
test("zoom shortcuts and terrain pacing survive demand changes", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const { canvas, zoom, pacing } = await openDebug(page, "canvas");
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
  const samples = await settle(canvas);
  expect(samples.maxRows).toBeLessThanOrEqual(2);
  expect(samples.quiet).toBe(60);
  expect(samples.d.resident).toBeGreaterThan(0);
  const result = await warm(canvas);
  expect(result.rows).toBe(0);
  expect(result.after.surfaceBytes).toBe(result.before.surfaceBytes);
  expect(result.terrainPasses).toBeGreaterThan(0);
  await pacing.selectOption("throughput");
  await zoom.selectOption("1");
  expect(errors).toEqual([]);
});

test("warm GPU terrain submits without re-uploading after a demand change", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const { canvas, zoom } = await openDebug(page, "gpu");
  await zoom.selectOption("1");
  await zoom.selectOption("0.5");
  const samples = await settle(canvas);
  expect(samples.maxRows).toBeLessThanOrEqual(2);
  expect(samples.quiet).toBe(60);
  const result = await warm(canvas);
  expect(result.rows).toBe(0);
  expect(result.after.surfaceBytes).toBe(result.before.surfaceBytes);
  expect(result.terrainPasses).toBeGreaterThan(0);
  expect(result.terrainUploadedBytes).toBe(0);
  expect(result.after.gpu?.uploadedBytes).toBeGreaterThan(result.before.gpu?.uploadedBytes ?? 0);
  expect(errors).toEqual([]);
});
