import { expect, test } from "@playwright/test";
import type { GameClient } from "../src/client/GameClient.js";
import { cityTrainRecipe } from "../src/scenarios/CityTrainRecipe.js";

test.use({ channel: "chromium", hasTouch: true, viewport: { width: 1000, height: 800 } });
test("station recall and assisted train roof riding use ordinary game Worker authority", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const recipe = cityTrainRecipe();
  await page.goto("/tilefun/?nogamepad&renderer=gpu&meshes");
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await page.evaluate(async (recipe) => {
    const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
    const created = await g.gcSendRequest({
      type: "create-world",
      requestId: g.nextRequestId++,
      name: "Train recovery",
      generation: recipe.generation,
    });
    await g.gcSendRequest({
      type: "join-realm",
      requestId: g.nextRequestId++,
      worldId: created.meta.id,
      arrival: {
        generation: recipe.generation,
        x: recipe.player.position.wx / 16,
        y: recipe.player.position.wy / 16,
      },
    });
    g.transport.send({ type: "set-editor-mode", enabled: false });
  }, recipe);
  const state = () =>
    page.evaluate(() => {
      const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
      const p = g.remoteView.serverPlayerEntity;
      const cars = g.remoteView.serverEntities.filter(
        (e) => e.type.startsWith("train-carriage-v1:") || e.type.startsWith("train-curve-proof-v1"),
      );
      const middle = cars.find(
        (e) => e.type === "train-carriage-v1:middle" || e.type === "train-curve-proof-v1",
      );
      return {
        x: p.position.wx,
        y: p.position.wy,
        z: p.wz ?? 0,
        air: p.jumpVZ !== undefined,
        carX: middle?.position.wx ?? 0,
        carY: middle?.position.wy ?? 0,
        count: cars.length,
      };
    });
  const call = page.getByRole("button", { name: /^Call train/ });
  await expect(call).toBeVisible();
  await call.tap();
  await expect(page.getByText("Poof! Your train is here.", { exact: true })).toBeVisible();
  await expect.poll(async () => (await state()).count).toBe(3);
  const start = await state();
  await page.keyboard.down("ArrowDown");
  try {
    await expect
      .poll(async () => (await state()).y, { intervals: [30] })
      .toBeGreaterThan(start.carY - 38);
  } finally {
    await page.keyboard.up("ArrowDown");
  }
  await page.keyboard.down("ArrowRight");
  try {
    await expect
      .poll(async () => (await state()).x, { intervals: [30] })
      .toBeGreaterThan(start.carX - 193);
  } finally {
    await page.keyboard.up("ArrowRight");
  }
  await expect(call).toBeVisible();
  await page.keyboard.press("e");
  await page.keyboard.down("ArrowDown");
  await page.keyboard.down("Space");
  try {
    await expect.poll(async () => (await state()).z, { intervals: [30] }).toBeGreaterThan(44);
    await expect
      .poll(async () => (await state()).y, { intervals: [30] })
      .toBeGreaterThan(start.carY - 2);
  } finally {
    await page.keyboard.up("Space");
    await page.keyboard.up("ArrowDown");
  }
  await expect
    .poll(async () => {
      const p = await state();
      return !p.air && p.z > 43 && p.z < 45;
    })
    .toBe(true);
  const onRoof = await state();
  await expect
    .poll(async () => (await state()).carX, { timeout: 15000 })
    .toBeGreaterThan(onRoof.carX + 20);
  expect((await state()).x).toBeGreaterThan(onRoof.x + 15);
  await page.screenshot({
    path: test.info().outputPath("restored-train-roof.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
  await page.goto("about:blank");
  await expect.poll(() => page.workers().length).toBe(0);
});
