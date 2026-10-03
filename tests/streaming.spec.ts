import { expect, test } from "@playwright/test";
import { CURRENT_REGIONAL_VERSION } from "../src/generation/GenerationDescriptor.js";

const version = CURRENT_REGIONAL_VERSION;
test(`${version} prepares terrain before sprinting and revisiting it`, async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const generation = { type: "regional", version, seed: 2026, preset: "temperate-v1" };
  const arrival = {
    x: 300,
    y: 519,
    generation,
  };
  await page.goto(
    `/tilefun/?nogamepad&generation=${encodeURIComponent(JSON.stringify(generation))}&arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
  );
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await page.waitForFunction(({ x, y }) => {
    // biome-ignore lint/suspicious/noExplicitAny: diagnostic hook
    const g = (document.querySelector("#game") as any).__game;
    const d = g.renderer.getDiagnostics();
    return (
      Math.abs(g.stateView.playerEntity.position.wx - x * 16) < 32 &&
      Math.abs(g.stateView.playerEntity.position.wy - y * 16) < 32 &&
      d.resident > 0 &&
      d.pending === 0
    );
  }, arrival);
  const sample = () =>
    page.evaluate(async () => {
      // biome-ignore lint/suspicious/noExplicitAny: diagnostic hook
      const g = (document.querySelector("#game") as any).__game;
      const x = g.stateView.playerEntity.position.wx;
      let incomplete = 0,
        missing = 0,
        maxSurfaces = 0;
      const visited = new Set<string>();
      for (let i = 0; i < 210; i++) {
        await new Promise(requestAnimationFrame);
        // PlayScene restores the simulation camera after rendering. Inspect
        // the same interpolated view that prepared the last frame's caches;
        // its halo can be a column wider at a chunk boundary.
        g.camera.applyInterpolation(g.time.alpha);
        const range = g.camera.getVisibleChunkRange();
        g.camera.restoreActual();
        for (let cy = range.minCy; cy <= range.maxCy; cy++)
          for (let cx = range.minCx; cx <= range.maxCx; cx++) {
            visited.add(`${cx},${cy}`);
            const chunk = g.stateView.world.getChunkIfLoaded(cx, cy);
            if (!chunk) missing++;
            else if (!g.renderer.hasTerrain(chunk)) incomplete++;
          }
        const d = g.renderer.getDiagnostics();
        const haloArea = (range.maxCx - range.minCx + 3) * (range.maxCy - range.minCy + 3);
        if (d.resident > haloArea || d.rowsLastFrame > 128)
          throw Error(
            `Preparation exceeded its work/residency bound: ${JSON.stringify({ range, haloArea, ...d })}`,
          );
        maxSurfaces = Math.max(maxSurfaces, d.surfaceBytes);
      }
      return {
        dx: g.stateView.playerEntity.position.wx - x,
        missing,
        incomplete,
        visited: visited.size,
        maxSurfaces,
      };
    });
  await page.keyboard.down("Shift");
  await page.keyboard.down("ArrowLeft");
  const outward = await sample();
  await page.keyboard.up("ArrowLeft");
  await page.keyboard.down("ArrowRight");
  const back = await sample();
  await page.keyboard.up("ArrowRight");
  await page.keyboard.up("Shift");
  expect(outward.dx).toBeLessThan(-400);
  expect(back.dx).toBeGreaterThan(400);
  expect(outward.visited).toBeGreaterThan(6);
  expect(outward.missing + outward.incomplete + back.missing + back.incomplete).toBe(0);
  expect(errors).toEqual([]);
  await page.screenshot({ path: `/tmp/tilefun-streaming-${version}.png` });
});
