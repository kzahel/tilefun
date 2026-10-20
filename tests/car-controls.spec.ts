import { expect, type Page, test } from "@playwright/test";
import type { GameClient } from "../src/client/GameClient.js";
import { projectWorld } from "../src/rendering/Projection.js";
import type { RenderView } from "../src/rendering/RenderFrame.js";
import { worldTap } from "./helpers/worldTap.js";

test.use({ channel: "chromium", hasTouch: true, viewport: { width: 600, height: 800 } });
const state = (page: Page) =>
  page.evaluate(() => {
    const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
    const p = g.remoteView.serverPlayerEntity;
    const car = g.remoteView.serverEntities.find((e) => e.id === p.parentId);
    const other = g.remoteView.serverEntities.find(
      (e) => e.type.startsWith("vehicle-v1:") && e.id !== car?.id,
    );
    const overlap =
      car?.collider && other?.collider
        ? {
            x:
              (car.collider.width + other.collider.width) / 2 -
              Math.abs(car.position.wx - other.position.wx),
            y:
              (car.collider.height + other.collider.height) / 2 -
              Math.abs(car.position.wy - other.position.wy),
          }
        : { x: 0, y: 0 };
    return {
      parent: p.parentId,
      x: car?.position.wx ?? 0,
      y: car?.position.wy ?? 0,
      heading: car?.vehicleHeading ?? 0,
      speed: Math.hypot(car?.velocity?.vx ?? 0, car?.velocity?.vy ?? 0),
      overlap,
    };
  });

for (const renderer of ["canvas", "gpu&meshes"])
  test(`saved car controls, keyboard steering, automatic reverse taps and solid car contact (${renderer})`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`/tilefun/?nogamepad&renderer=${renderer}`);
    await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
    await page.evaluate(async () => {
      const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
      const generation = { type: "flat", version: "flat-v1", seed: 42, preset: "grass" } as const;
      const created = await g.gcSendRequest({
        type: "create-world",
        requestId: g.nextRequestId++,
        name: "Car controls",
        generation,
      });
      await g.gcSendRequest({
        type: "join-realm",
        requestId: g.nextRequestId++,
        worldId: created.meta.id,
        arrival: { x: -50 / 16, y: 0, generation },
      });
    });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
          return (
            Math.abs(g.remoteView.serverPlayerEntity.position.wx + 50) < 1 &&
            [-1, 0].every((x) => [-1, 0].every((y) => !!g.stateView.world.getChunkIfLoaded(x, y)))
          );
        }),
      )
      .toBe(true);
    await page.evaluate(() => {
      const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
      g.transport.send({ type: "set-editor-mode", enabled: true });
      for (const e of g.remoteView.serverEntities)
        if (e.type !== "player") g.transport.send({ type: "edit-delete-entity", entityId: e.id });
      for (const wx of [0, 140])
        g.transport.send({ type: "edit-spawn", entityType: "vehicle-v1:compact-1", wx, wy: 0 });
      g.transport.send({ type: "set-editor-mode", enabled: false });
    });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
          return g.remoteView.serverEntities.filter((e) => e.type.startsWith("vehicle-v1:")).length;
        }),
      )
      .toBe(2);
    await page.getByRole("button", { name: /^Drive car/ }).click();
    await expect.poll(async () => (await state(page)).parent).toBeDefined();
    await page.locator('button[aria-label="Options"]').click();
    await page.getByRole("button", { name: "Tap to move", exact: true }).click();
    await page.getByLabel("Car controls", { exact: true }).selectOption("steering");
    await expect(page.getByRole("status").filter({ hasText: "Car controls saved" })).toBeVisible();
    await page.getByRole("button", { name: "Back to game", exact: true }).click();
    const start = await state(page);
    await page.keyboard.down("ArrowUp");
    await expect.poll(async () => (await state(page)).x).toBeGreaterThan(start.x + 12);
    await page.keyboard.up("ArrowUp");
    await expect.poll(async () => (await state(page)).speed).toBeLessThan(0.1);
    expect((await state(page)).heading).toBeCloseTo(0, 5);
    const forward = await state(page);
    await page.keyboard.down("ArrowDown");
    await expect.poll(async () => (await state(page)).x).toBeLessThan(forward.x - 12);
    await page.keyboard.up("ArrowDown");
    await expect.poll(async () => (await state(page)).speed).toBeLessThan(0.1);
    // Tap targets stay world-relative even with the manual steering preference.
    const beforeTap = await state(page);
    const pose = await page.evaluate(() => {
      const canvas = document.querySelector("#game") as HTMLCanvasElement;
      const g = (canvas as unknown as { __game: GameClient }).__game;
      const car = g.stateView.entities.find((e) => e.id === g.stateView.playerEntity.parentId);
      if (!car) throw Error("Missing car");
      const view = (g.tapMovement as unknown as { view: RenderView }).view;
      const rect = canvas.getBoundingClientRect();
      return {
        view,
        position: car.position,
        z: car.wz ?? 0,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      };
    });
    const point = projectWorld(pose.view, pose.position.wx - 40, pose.position.wy, pose.z);
    const target = {
      x: pose.rect.x + (point.sx * pose.rect.width) / pose.view.viewportWidth,
      y: pose.rect.y + (point.sy * pose.rect.height) / pose.view.viewportHeight,
    };
    await worldTap(page, target.x, target.y);
    await expect.poll(async () => (await state(page)).x).toBeLessThan(beforeTap.x - 20);
    await expect.poll(async () => (await state(page)).speed).toBeLessThan(0.1);
    expect((await state(page)).heading).toBeCloseTo(0, 3);
    // Manual controls keep their own preference while tap destinations are enabled.
    await page.locator('button[aria-label="Options"]').click();
    await page.getByLabel("Car controls", { exact: true }).selectOption("direction");
    await expect(page.getByRole("status").filter({ hasText: "Car controls saved" })).toBeVisible();
    await page.getByRole("button", { name: "Back to game", exact: true }).click();
    await page.keyboard.down("ArrowRight");
    await expect.poll(async () => (await state(page)).x).toBeGreaterThan(75);
    await expect.poll(async () => (await state(page)).speed).toBeLessThan(0.1);
    await page.keyboard.up("ArrowRight");
    const contact = await state(page);
    expect(Math.min(contact.overlap.x, contact.overlap.y)).toBeLessThanOrEqual(0.01);
    await page.screenshot({ path: testInfo.outputPath("car-contact.png") });
    await page.keyboard.down("ArrowLeft");
    await expect.poll(async () => (await state(page)).x).toBeLessThan(contact.x - 12);
    await page.keyboard.up("ArrowLeft");
    await expect.poll(async () => (await state(page)).speed).toBeLessThan(0.1);
    await page.locator('button[aria-label="Options"]').click();
    await page.getByLabel("Car controls", { exact: true }).selectOption("steering");
    await expect(page.getByRole("status").filter({ hasText: "Car controls saved" })).toBeVisible();
    await page.reload();
    await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
    await page.locator('button[aria-label="Options"]').click();
    await expect(page.getByLabel("Car controls", { exact: true })).toHaveValue("steering");
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      const back = await page
        .getByRole("button", { name: "Back to game", exact: true })
        .boundingBox();
      expect(back).not.toBeNull();
      expect((back?.y ?? 0) + (back?.height ?? 0)).toBeLessThanOrEqual(viewport.height - 4);
      await page.screenshot({ path: testInfo.outputPath(`options-${viewport.width}.png`) });
    }
    expect(errors).toEqual([]);
  });
