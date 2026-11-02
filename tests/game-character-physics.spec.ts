import { expect, test } from "@playwright/test";
import type { RemoteStateView } from "../src/client/ClientStateView.js";
import type { GameClient } from "../src/client/GameClient.js";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";
import { stopLocalWorld } from "./helpers/local-world.js";

test.use({ channel: "chromium" });
test("normal game opts into box/capsule contacts, synchronizes settings and returns to lazy legacy startup", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const backendRequests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("GameCharacterPhysics")) backendRequests.push(r.url());
  });
  await page.goto(
    `/tilefun/?physics=rapier&hull=box&perf&nogamepad&generation=${encodeURIComponent(JSON.stringify(createDescriptor("flat", 2026)))}`,
  );
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  const state = () =>
    page.evaluate(() => {
      const game = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
      const view = game.stateView as RemoteStateView;
      return {
        mode: view.physicsParameters.characterPhysics ?? 0,
        gravity: view.physicsParameters.gravityScale,
        x: view.serverPlayerEntity.position.wx,
        z: view.serverPlayerEntity.wz ?? 0,
        editor: view.editorEnabled,
        box: view.serverPlayerEntity.collider && {
          width: view.serverPlayerEntity.collider.width,
          height: view.serverPlayerEntity.collider.height,
          physicalHeight: view.serverPlayerEntity.collider.physicalHeight,
        },
      };
    });
  await expect.poll(async () => (await state()).mode).toBe(1);
  expect((await state()).box).toEqual({ width: 10, height: 6, physicalHeight: 12 });
  // Remove random fixture animals through normal editing before measuring input.
  const selectMode = async (name: "Edit" | "Play") => {
    await page.getByTestId("main-menu-toggle").click();
    await page.getByRole("button", { name, exact: true }).click();
  };
  if (!(await state()).editor) await selectMode("Edit");
  await expect.poll(async () => (await state()).editor).toBe(true);
  await page.evaluate(() => {
    const game = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
    for (const actor of game.stateView.entities)
      if (actor.type !== "player")
        game.transport.send({ type: "edit-delete-entity", entityId: actor.id });
  });
  await selectMode("Play");
  await expect.poll(async () => (await state()).editor).toBe(false);
  const before = await state();
  await page.keyboard.down("d");
  await page.waitForTimeout(500);
  await page.keyboard.up("d");
  await expect.poll(async () => (await state()).x - before.x).toBeGreaterThan(15);
  const command = async (text: string) =>
    page.evaluate(async (text) => {
      const game = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
      await game.consoleEngine.rconSend?.(text);
    }, text);
  await command("sv_characterphysics 2");
  await expect.poll(async () => (await state()).mode).toBe(2);
  await command("sv_gravity 0.5");
  await expect.poll(async () => (await state()).gravity).toBe(0.5);
  await page.keyboard.down("Space");
  await page.waitForTimeout(80);
  await page.keyboard.up("Space");
  await expect.poll(async () => (await state()).z).toBeGreaterThan(5);
  await expect.poll(async () => (await state()).z, { timeout: 5000 }).toBeLessThan(0.2);
  await page.screenshot({ path: test.info().outputPath("game-rapier-capsule.png") });
  await command("sv_characterphysics 0");
  await expect.poll(async () => (await state()).mode).toBe(0);
  expect(backendRequests.length).toBeGreaterThan(0);
  await stopLocalWorld(page);
  backendRequests.length = 0;
  await page.goto("/tilefun/?perf&nogamepad");
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await expect.poll(async () => (await state()).mode).toBe(0);
  expect(backendRequests).toEqual([]);
  await stopLocalWorld(page);
  expect(errors).toEqual([]);
});

test("geometry lab compares shared box/capsule contacts through the Worker and renderer", async ({
  page,
}) => {
  test.setTimeout(45000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tilefun/workshop.html?physics=rapier&hull=box#/tool/world-geometry");
  const scene = page.getByLabel("World geometry scene");
  const mode = page.getByLabel("Character contacts");
  await expect(mode).toHaveValue("1");
  await expect(scene).toHaveAttribute("data-ready", "true");
  await scene.focus();
  await page.keyboard.down("ArrowRight");
  try {
    await expect
      .poll(async () => Number(await scene.getAttribute("data-server-z")), { timeout: 12000 })
      .toBeGreaterThan(47.8);
  } finally {
    await page.keyboard.up("ArrowRight");
  }
  await expect
    .poll(async () => Number(await scene.getAttribute("data-player-z")))
    .toBeGreaterThan(47.8);
  await page.screenshot({ path: test.info().outputPath("rapier-box-deck.png") });
  await mode.selectOption("2");
  await expect(scene).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Start at passage", exact: true }).click();
  await expect
    .poll(async () => Math.abs(Number(await scene.getAttribute("data-server-z"))))
    .toBeLessThan(0.1);
  await scene.focus();
  await page.keyboard.down("Space");
  try {
    await expect
      .poll(async () => Number(await scene.getAttribute("data-server-z")))
      .toBeGreaterThan(15);
    expect(Number(await scene.getAttribute("data-server-z"))).toBeLessThan(28.1);
  } finally {
    await page.keyboard.up("Space");
  }
  await page.getByRole("link", { name: "All tools", exact: true }).click();
  await expect.poll(() => page.workers().length).toBe(0);
  expect(errors).toEqual([]);
});
