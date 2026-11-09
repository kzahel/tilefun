import { expect, type Page, test } from "@playwright/test";
import type { RemoteStateView } from "../src/client/ClientStateView.js";
import type { GameTestHooks } from "../src/client/GameTestHooks.js";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";
import { session } from "./helpers/p2pSession.js";

test.use({ channel: "chromium" });
const state = (page: Page) =>
  page.evaluate(() => {
    const game = (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game;
    const view = game.stateView as RemoteStateView;
    return {
      physics: !!view.physicsState,
      editor: view.editorEnabled,
      player: { ...view.serverPlayerEntity.position },
      predicted: { ...view.playerEntity.position },
      npcs: view.serverEntities
        .filter((e) => e.type === "chicken")
        .map((e) => ({ id: e.id, ...e.position })),
    };
  });
async function play(page: Page) {
  if ((await state(page)).editor) {
    if (!(await page.getByTestId("world-menu").isVisible()))
      await page.getByTestId("main-menu-toggle").click();
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(async () => (await state(page)).editor).toBe(false);
  } else if (await page.getByTestId("world-menu").isVisible())
    await page.getByRole("button", { name: "Resume", exact: true }).click();
}

test("ordinary Worker game uses persistent NPC contacts and prediction", async ({ page }) => {
  // Physics contacts and prediction, not rendering.
  await page.goto(
    `/tilefun/?nogamepad&generation=${encodeURIComponent(JSON.stringify(createDescriptor("flat", 2026)))}`,
  );
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await expect.poll(async () => (await state(page)).physics).toBe(true);
  if (!(await state(page)).editor) {
    await page.getByTestId("main-menu-toggle").click();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect.poll(async () => (await state(page)).editor).toBe(true);
  }
  const before = await state(page);
  await page.evaluate(
    ({ x, y }) => {
      const game = (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game;
      for (const actor of game.stateView.entities)
        if (actor.type === "chicken")
          game.transport.send({ type: "edit-delete-entity", entityId: actor.id });
      game.transport.send({ type: "edit-spawn", entityType: "chicken", wx: x + 14, wy: y });
    },
    { x: before.player.wx, y: before.player.wy },
  );
  await expect.poll(async () => (await state(page)).npcs.length).toBe(1);
  await play(page);
  const npc = (await state(page)).npcs[0];
  if (!npc) throw Error("Missing NPC");
  await page.evaluate(({ wx, wy }) => {
    const game = (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game;
    game.transport.send({ type: "player-interact", wx, wy });
  }, npc);
  await page.keyboard.down("d");
  await page.waitForTimeout(650);
  await page.keyboard.up("d");
  await expect.poll(async () => ((await state(page)).npcs[0]?.wx ?? 0) - npc.wx).toBeGreaterThan(3);
  await expect
    .poll(async () => {
      const s = await state(page);
      return Math.hypot(s.player.wx - s.predicted.wx, s.player.wy - s.predicted.wy);
    })
    .toBeLessThan(0.5);
  await page.screenshot({ path: test.info().outputPath("realm-game-npc-push.png") });
});

test("P2P host and delayed guest use the shared default and converge after reversals", async ({
  browser,
}) => {
  test.setTimeout(90000);
  const { host, guest, dispose } = await session(browser, false);
  try {
    for (const page of [host, guest]) {
      await expect.poll(async () => (await state(page)).physics).toBe(true);
      await play(page);
    }
    await guest.evaluate(() => {
      const game = (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game;
      for (const [key, value] of [
        ["cl_netem_tx_latency_ms", 50],
        ["cl_netem_rx_latency_ms", 50],
        ["cl_netem_tx_jitter_ms", 20],
        ["cl_netem_rx_jitter_ms", 20],
      ] as const)
        game.consoleEngine.cvars.get(key)?.set(value);
    });
    const before = (await state(guest)).player;
    await guest.keyboard.down("d");
    await guest.waitForTimeout(500);
    await guest.keyboard.up("d");
    await guest.keyboard.down("a");
    await guest.waitForTimeout(100);
    await guest.keyboard.up("a");
    await guest.keyboard.down("d");
    await guest.waitForTimeout(300);
    await guest.keyboard.up("d");
    await expect.poll(async () => (await state(guest)).player.wx - before.wx).toBeGreaterThan(8);
    await expect
      .poll(
        async () => {
          const s = await state(guest);
          return Math.hypot(s.player.wx - s.predicted.wx, s.player.wy - s.predicted.wy);
        },
        { timeout: 10000 },
      )
      .toBeLessThan(0.75);
    await guest.screenshot({ path: test.info().outputPath("realm-delayed-guest.png") });
  } finally {
    await dispose();
  }
});
