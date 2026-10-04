import { expect, type Locator, test } from "@playwright/test";
import type { TrafficCanvas } from "../src/workshop/TrafficPage.js";

test.use({ channel: "chromium" });
test.setTimeout(60000);

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
  }).toPass({ timeout: 30000 });
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

    await page
      .getByRole("combobox", { name: "Terrain pacing", exact: true })
      .selectOption("responsive");
    const zoom = page.getByRole("combobox", { name: "Zoom preset", exact: true });
    await zoom.selectOption("0.1");
    await zoom.selectOption("0.25");
    const maxRows = await canvas.evaluate(async (c: TrafficCanvas) => {
      let max = 0;
      for (let i = 0; i < 60; i++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        max = Math.max(max, c.__terrainDiagnostics?.()?.rowsLastFrame ?? 0);
      }
      return max;
    });
    expect(maxRows).toBeLessThanOrEqual(2);
    await expectSettledTerrain(canvas);
    // Return to the lab viewport; reset keeps the selected pacing policy.
    await zoom.selectOption("0.75");

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
        .poll(() =>
          canvas.evaluate((c: TrafficCanvas) => c.__presentationDiagnostics?.().meshDraws ?? 0),
        )
        .toBeGreaterThan(0);
    await page.getByRole("link", { name: "All tools", exact: true }).first().click();
    await expect(canvas).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test("traffic uses interpolated presentation, freezes simulation on pause and resumes", async ({
  page,
}) => {
  await page.goto("/tilefun/workshop.html#/tool/traffic");
  const canvas = page.getByLabel("Generated traffic playground");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Start on roof", exact: true }).click();
  const start = Number(await canvas.getAttribute("data-car-x"));
  await expect
    .poll(() => canvas.getAttribute("data-car-x").then(Number), { timeout: 10000 })
    .toBeGreaterThan(start + 50);
  const samples = await canvas.evaluate(async (c: TrafficCanvas) => {
    const result = [];
    for (let i = 0; i < 90; i++) {
      await new Promise(requestAnimationFrame);
      const d = c.__presentationDiagnostics?.();
      if (!d) throw Error("Missing presentation diagnostics");
      result.push({ ...d, playerX: Number(c.dataset.playerX) });
    }
    return result;
  });
  expect(samples.some((s) => s.alpha > 0 && s.alpha < 1)).toBe(true);
  expect(samples.at(-1)?.steps).toBeGreaterThan(samples[0]?.steps ?? 0);
  expect(samples.some((s) => Math.abs(s.playerX - s.cameraX) > 1)).toBe(true);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const before = await canvas.evaluate((c: TrafficCanvas) => c.__presentationDiagnostics?.().steps);
  await page.waitForTimeout(250);
  expect(await canvas.evaluate((c: TrafficCanvas) => c.__presentationDiagnostics?.().steps)).toBe(
    before,
  );
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect
    .poll(() => canvas.evaluate((c: TrafficCanvas) => c.__presentationDiagnostics?.().steps ?? 0))
    .toBeGreaterThan(before ?? 0);
});

test("embedded GPU surface tracks scrolling/resizing, recovers context and leaves no canvas on exit", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/tilefun/workshop.html?renderer=gpu&meshes#/tool/traffic");
  const canvas = page.getByLabel("Generated traffic playground");
  const world = page.locator("canvas[data-renderer=gpu][aria-hidden=true]");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await expect(world).toHaveCount(1);
  const aligned = async () => {
    const [a, b] = await Promise.all([canvas.boundingBox(), world.boundingBox()]);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    for (const key of ["x", "y", "width", "height"] as const)
      expect(Math.abs((a?.[key] ?? 0) - (b?.[key] ?? 0))).toBeLessThan(1);
  };
  await aligned();
  await page.evaluate(() => window.scrollBy(0, 200));
  await aligned();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(aligned).toPass();
  const extension = await world.evaluateHandle((c: HTMLCanvasElement) =>
    c.getContext("webgl2")?.getExtension("WEBGL_lose_context"),
  );
  await extension.evaluate((e) => e?.loseContext());
  await expect(canvas).toHaveAttribute("data-gpu-device", "lost");
  await extension.evaluate((e) => e?.restoreContext());
  await expect(canvas).toHaveAttribute("data-gpu-device", "ready");
  await expectSettledTerrain(canvas);
  await extension.dispose();
  // Phone layout hides the desktop sidebar; change the SPA route without reload.
  await page.evaluate(() => {
    location.hash = "#/tools";
  });
  await expect(world).toHaveCount(0);
  expect(errors).toEqual([]);
});
