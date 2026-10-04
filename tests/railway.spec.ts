import { expect, test } from "@playwright/test";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";

test("new regional world opens at a furnished station with one moving native horizontal train", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    `/tilefun/?generation=${encodeURIComponent(JSON.stringify(createDescriptor("regional", 2026)))}`,
  );
  await page.getByPlaceholder("World name...").fill("Railway browser test");
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await expect(page.getByRole("button", { name: "New World", exact: true })).not.toBeVisible();
  await expect(page.locator("#game")).toHaveAttribute(
    "data-generation",
    JSON.stringify(createDescriptor("regional", 2026)),
  );
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  const read = () =>
    page.evaluate(() => {
      const game = (
        document.querySelector("#game") as unknown as {
          __game: import("../src/client/GameClient.js").GameClient;
        }
      ).__game;
      return {
        trains: game.stateView.entities
          .filter((e) => e.type === "train-local-v1")
          .map((e) => ({
            x: e.position.wx,
            y: e.position.wy,
            row: e.sprite?.frameRow,
            flip: e.sprite?.flipX,
          })),
        platforms: game.stateView.props.filter((p) => p.type === "prop-rail-platform-edge").length,
      };
    });
  await expect.poll(async () => (await read()).trains.length).toBe(1);
  await expect.poll(async () => (await read()).platforms).toBeGreaterThan(10);
  const first = (await read()).trains[0];
  expect(first).toBeDefined();
  await page.evaluate(() => {
    const game = (
      document.querySelector("#game") as unknown as {
        __game: import("../src/client/GameClient.js").GameClient;
      }
    ).__game;
    game.debugPanel.setZoom(0.5);
  });
  await page.waitForFunction(() => {
    const game = (
      document.querySelector("#game") as unknown as {
        __game: import("../src/client/GameClient.js").GameClient;
      }
    ).__game;
    if (game.camera.zoom !== 0.5) return false;
    const r = game.camera.getVisibleChunkRange();
    for (let y = r.minCy; y <= r.maxCy; y++)
      for (let x = r.minCx; x <= r.maxCx; x++)
        if (!game.renderer.isTerrainReady(game.stateView.world.chunks.get(x, y))) return false;
    return true;
  });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.screenshot({ path: "test-results/railway-station.png" });
  await expect
    .poll(async () => (await read()).trains[0]?.x, { timeout: 20000 })
    .toBeGreaterThan(first?.x ?? 0);
  const moving = (await read()).trains[0];
  expect(moving?.row).toBe(0);
  expect(moving?.flip ?? false).toBe(false);
  expect(moving?.y).toBe(-2658 * 16);
  expect(errors).toEqual([]);
});
