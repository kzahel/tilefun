import { expect, type Page, test } from "@playwright/test";
import type { Entity } from "../src/entities/Entity.js";
import {
  CURRENT_REGIONAL_VERSION,
  type GenerationDescriptor,
} from "../src/generation/GenerationDescriptor.js";
import { DenseDistrictSource } from "../src/generation/regional/DenseDistrictPlanner.js";
import { regionalWorld } from "../src/generation/regional/WorldDescriptor.js";
import type { TapMovement } from "../src/input/TapMovement.js";
import { exteriorDoors } from "../src/interiors/BuildingDoors.js";
import type { PlayerProfileStore } from "../src/persistence/PlayerProfileStore.js";
import type { Camera } from "../src/rendering/Camera.js";
import { projectWorld } from "../src/rendering/Projection.js";
import type { RenderView } from "../src/rendering/RenderFrame.js";
import type { ClientMessage, ServerMessage } from "../src/shared/protocol.js";
import { ACTIVE_PROFILE_KEY } from "../src/shared/storageKeys.js";

type TestGame = {
  gcSendRequest(message: unknown): Promise<{ meta: { id: string } }>;
  nextRequestId: number;
  tapMovement: Pick<TapMovement, "target" | "resolve"> & { view: RenderView; plane: number };
  camera: Camera;
  debugPanel: { zoom: number; paused: boolean };
  stateView: {
    invincibilityTimer: number;
    playerEntity: Entity;
    entities: Entity[];
    world: { getCollision(tx: number, ty: number): number };
  };
  transport: { send(message: ClientMessage): void };
  netEmulatedTransport: { messageHandler(message: ServerMessage): void };
  profile: { id: string };
  profileStore: PlayerProfileStore;
};

test.use({
  channel: "chromium",
  isMobile: true,
  hasTouch: true,
  viewport: { width: 600, height: 800 },
});

async function start(
  page: Page,
  renderer = "canvas",
  destination?: { generation: GenerationDescriptor; x: number; y: number },
  mode = "Tap to move",
) {
  await page.goto(`/tilefun/?nogamepad&renderer=${renderer}`);
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await page.evaluate(async (destination) => {
    const g = (document.querySelector("#game") as unknown as { __game: TestGame }).__game;
    const generation = destination?.generation ?? {
      type: "flat",
      version: "flat-v1",
      seed: 42,
      preset: "grass",
    };
    const created = await g.gcSendRequest({
      type: "create-world",
      requestId: g.nextRequestId++,
      name: "Tap walking",
      generation,
    });
    await g.gcSendRequest({
      type: "join-realm",
      requestId: g.nextRequestId++,
      worldId: created.meta.id,
      arrival: { x: destination?.x ?? 0, y: destination?.y ?? 0, generation },
    });
  }, destination);
  await expect.poll(async () => (await state(page)).id).not.toBe(-1);
  await page.locator('button[aria-label="Options"]').tap();
  await page.getByRole("button", { name: mode, exact: true }).tap();
  await expect(page.getByRole("status").filter({ hasText: "Movement saved" })).toBeVisible();
  await page.getByRole("button", { name: "Back to game", exact: true }).tap();
}
async function state(page: Page) {
  return page.evaluate(() => {
    const g = (document.querySelector("#game") as unknown as { __game: TestGame }).__game;
    const p = g.stateView.playerEntity;
    return {
      id: p.id,
      ...p.position,
      z: p.wz ?? 0,
      invincibility: g.stateView.invincibilityTimer,
      target: g.tapMovement.target,
      interactions: Number(document.querySelector("#game")?.getAttribute("data-interactions") ?? 0),
    };
  });
}
async function point(page: Page, dx: number, dy = 0, entityType: string | null = null) {
  const pose = await page.evaluate(
    ({ entityType }) => {
      const c = document.querySelector("#game") as HTMLCanvasElement;
      const g = (c as unknown as { __game: TestGame }).__game;
      const entity = entityType
        ? g.stateView.entities
            .filter((e) => e.type === entityType && e.wanderAI?.befriendable)
            .sort((a, b) => {
              const p = g.stateView.playerEntity.position;
              return (
                Math.hypot(a.position.wx - p.wx, a.position.wy - p.wy) -
                Math.hypot(b.position.wx - p.wx, b.position.wy - p.wy)
              );
            })[0]
        : g.stateView.playerEntity;
      if (!entity) throw new Error("Missing target entity");
      const rect = c.getBoundingClientRect();
      return {
        p: entity.position,
        view: g.tapMovement.view,
        plane: g.tapMovement.plane,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        canvasWidth: c.width,
        canvasHeight: c.height,
      };
    },
    { entityType },
  );
  const screen = projectWorld(pose.view, pose.p.wx + dx, pose.p.wy + dy, pose.plane);
  return {
    x: pose.left + (screen.sx * pose.width) / pose.canvasWidth,
    y: pose.top + (screen.sy * pose.height) / pose.canvasHeight,
  };
}
async function tapOffset(page: Page, dx: number, dy = 0) {
  const p = await point(page, dx, dy);
  await page.touchscreen.tap(p.x, p.y);
}

for (const renderer of ["canvas", "gpu"]) {
  test(`first slow world tap keeps its destination through fullscreen; focus loss cancels it (${renderer})`, async ({
    page,
  }) => {
    await start(page, renderer);
    await page.reload();
    await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
    await expect.poll(async () => (await state(page)).id).not.toBe(-1);
    expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
    const p = await point(page, 60);
    const expected = await page.evaluate((p) => {
      const c = document.querySelector("#game") as HTMLCanvasElement;
      const g = (c as unknown as { __game: TestGame }).__game;
      return g.tapMovement.resolve(c, p.x, p.y);
    }, p);
    const session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...p, id: 1 }],
    });
    await page.waitForTimeout(600);
    expect((await state(page)).target).toBeNull();
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(async () => (await state(page)).target).not.toBeNull();
    expect((await state(page)).target).toEqual(expected);
    await expect
      .poll(() => page.evaluate(() => document.fullscreenElement === document.documentElement))
      .toBe(true);
    const other = await page.context().newPage();
    await other.goto("about:blank");
    await other.bringToFront();
    await expect.poll(async () => (await state(page)).target).toBeNull();
    await other.close();
    await page.bringToFront();
    expect((await state(page)).target).toBeNull();
    await tapOffset(page, 30);
    await expect.poll(async () => (await state(page)).target).not.toBeNull();
    await session.detach();
  });

  test(`walks, redirects, arrives and cancels with manual input (${renderer})`, async ({
    page,
  }) => {
    await start(page, renderer);
    const original = await state(page);
    await tapOffset(page, 60);
    await expect.poll(async () => (await state(page)).wx).toBeGreaterThan(original.wx + 8);
    const first = (await state(page)).target;
    expect(first).not.toBeNull();
    await expect(page.locator("#game")).toHaveAttribute("data-tap-destination", /"active":true/);
    const marker = JSON.parse(
      (await page.locator("#game").getAttribute("data-tap-destination")) ?? "{}",
    );
    expect(marker.wx).toBeCloseTo(first?.wx ?? 0, 3);
    await page.evaluate(() => {
      const g = (document.querySelector("#game") as unknown as { __game: TestGame }).__game;
      // Exercise the registered incoming-message path for a co-op traveller.
      g.netEmulatedTransport.messageHandler({
        type: "door-motion",
        phase: "depart",
        self: false,
        actorId: -999,
        actorClientId: "friend",
        realmId: "co-op-test",
        from: { wx: 0, wy: 0 },
        to: { wx: 0, wy: -24 },
        duration: 400,
      });
    });
    expect((await state(page)).target).toEqual(first);
    await tapOffset(page, 0, 40);
    const target = (await state(page)).target;
    expect(target).not.toBeNull();
    await expect.poll(async () => (await state(page)).target).toBeNull();
    const arrived = await state(page);
    expect(Math.hypot(arrived.wx - (target?.wx ?? 0), arrived.wy - (target?.wy ?? 0))).toBeLessThan(
      10,
    );
    await tapOffset(page, 40);
    await page.keyboard.down("ArrowLeft");
    await expect.poll(async () => (await state(page)).target).toBeNull();
    await page.keyboard.up("ArrowLeft");
    await tapOffset(page, 40);
    await tapOffset(page, 0);
    await expect.poll(async () => (await state(page)).target).toBeNull();
    await page.locator('button[aria-label="Options"]').tap();
    await page.getByRole("button", { name: "Joystick", exact: true }).tap();
    await expect(page.getByRole("status").filter({ hasText: "Movement saved" })).toBeVisible();
    await page.getByRole("button", { name: "Back to game" }).tap();
    const beforeDrag = await state(page);
    const session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: 150, y: 300 }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: 200, y: 300 }],
    });
    await expect.poll(async () => (await state(page)).wx).toBeGreaterThan(beforeDrag.wx + 5);
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await session.detach();
  });

  test(`tap walking enters a door and clears the old destination (${renderer})`, async ({
    page,
  }) => {
    const lot = new DenseDistrictSource(regionalWorld(2026), true)
      .owner(0, 0)
      ?.blocks.flatMap((b) => b.lots)
      .find((l) => l.buildingType.includes("butcher"));
    if (!lot) throw new Error("Missing shop");
    const door = exteriorDoors({
      type: lot.buildingType,
      position: { wx: lot.anchor.x * 16, wy: lot.anchor.y * 16 },
    })[1];
    if (!door) throw new Error("Missing second door");
    await start(page, renderer, {
      generation: {
        type: "regional",
        version: CURRENT_REGIONAL_VERSION,
        seed: 2026,
        preset: "temperate-v1",
      },
      x: door.outside.wx / 16,
      y: (door.outside.wy + 48) / 16,
    });
    // Clear the arrival latch, then aim just through the threshold.
    await tapOffset(page, 0, 25);
    await expect.poll(async () => (await state(page)).target).toBeNull();
    const p = await state(page);
    await tapOffset(page, door.outside.wx - p.wx, door.outside.wy - 16 - p.wy);
    const fade = page.locator('[data-door-fade="true"]');
    await expect(fade).toHaveAttribute("data-stage", "depart");
    await expect(page.locator("#game")).toHaveAttribute("data-interior", /interior-v1/);
    await expect(fade).toHaveAttribute("data-stage", "idle");
    expect((await state(page)).target).toBeNull();
  });

  test(`stops at water and preserves animal interaction without duplicate clicks (${renderer})`, async ({
    page,
  }) => {
    await start(page, renderer);
    await page.getByTestId("main-menu-toggle").tap();
    await page.getByRole("button", { name: "Edit", exact: true }).tap();
    await page.evaluate(() => {
      const c = document.querySelector("#game") as HTMLCanvasElement;
      const g = (c as unknown as { __game: TestGame }).__game;
      const p = g.stateView.playerEntity.position;
      g.transport.send({ type: "edit-spawn", entityType: "chicken", wx: p.wx - 35, wy: p.wy });
      g.debugPanel.paused = true;
      for (let ty = -3; ty <= 3; ty++)
        g.transport.send({
          type: "edit-terrain-tile",
          tx: 2,
          ty,
          terrainId: 1,
          paintMode: "positive",
          bridgeDepth: 0,
        });
      const original = g.transport.send.bind(g.transport);
      g.transport.send = (msg) => {
        if (msg.type === "player-interact")
          c.dataset.interactions = String(Number(c.dataset.interactions ?? 0) + 1);
        original(msg);
      };
    });
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const g = (document.querySelector("#game") as unknown as { __game: TestGame }).__game;
          return g.stateView.entities.some((e) => e.type === "chicken" && e.wanderAI?.befriendable);
        }),
      )
      .toBe(true);
    await page.getByTestId("main-menu-toggle").tap();
    await page.getByRole("button", { name: "Play", exact: true }).tap();
    const waterTap = await point(page, 65);
    await page.touchscreen.tap(waterTap.x, waterTap.y);
    await expect
      .poll(async () => {
        const current = await state(page);
        return current.target ? true : JSON.stringify({ current, waterTap });
      })
      .toBe(true);
    await expect.poll(async () => (await state(page)).target, { timeout: 5000 }).toBeNull();
    expect((await state(page)).wx).toBeLessThan(32);
    expect((await state(page)).interactions).toBe(0);
    const chicken = await point(page, 0, 0, "chicken");
    await page.touchscreen.tap(chicken.x, chicken.y);
    await expect.poll(async () => (await state(page)).interactions).toBe(1);
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const g = (document.querySelector("#game") as unknown as { __game: TestGame }).__game;
          return g.stateView.entities.some((e) => e.type === "chicken" && e.wanderAI?.following);
        }),
      )
      .toBe(true);
    expect((await state(page)).target).toBeNull();
    // A short water respawn is smaller than the general teleport distance guard.
    await page.getByTestId("main-menu-toggle").tap();
    await page.getByRole("button", { name: "Edit", exact: true }).tap();
    await page.evaluate(() => {
      const g = (document.querySelector("#game") as unknown as { __game: TestGame }).__game;
      for (let tx = 3; tx <= 8; tx++)
        for (let ty = -3; ty <= 3; ty++)
          g.transport.send({
            type: "edit-terrain-tile",
            tx,
            ty,
            terrainId: 1,
            paintMode: "positive",
            bridgeDepth: 0,
          });
    });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const g = (document.querySelector("#game") as unknown as { __game: TestGame }).__game;
          return g.stateView.world.getCollision(4, 0);
        }),
      )
      .not.toBe(0);
    await page.getByTestId("main-menu-toggle").tap();
    await page.getByRole("button", { name: "Play", exact: true }).tap();
    await tapOffset(page, 65);
    await expect.poll(async () => (await state(page)).target).not.toBeNull();
    const session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: 548, y: 748, id: 1 }],
    });
    await expect.poll(async () => (await state(page)).z).toBeGreaterThan(0);
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForFunction(
      () => {
        const g = (document.querySelector("#game") as unknown as { __game: TestGame }).__game;
        return g.stateView.invincibilityTimer > 0;
      },
      undefined,
      { timeout: 5000 },
    );
    await expect.poll(async () => (await state(page)).target).toBeNull();
    expect((await state(page)).wx).toBeLessThan(32);
    await session.detach();
  });
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`Options fits, owns focus and preserves first-tap fullscreen (${viewport.width}×${viewport.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await start(page);
    await tapOffset(page, 20);
    await page.locator('button[aria-label="Options"]').tap();
    await expect.poll(async () => (await state(page)).target).toBeNull();
    const back = page.getByRole("button", { name: "Back to game" });
    const box = await back.boundingBox();
    expect(box).not.toBeNull();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(viewport.height);
    await expect(page.getByTestId("options-dialog")).toBeVisible();
    expect(await page.evaluate(() => document.fullscreenElement === document.documentElement)).toBe(
      true,
    );
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest(".options-dialog"))).toBe(
      true,
    );
    await page.screenshot({ path: `/tmp/tilefun-options-${viewport.width}.png`, fullPage: true });
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("options-dialog")).toBeHidden();
    await expect(page.locator('button[aria-label="Options"]')).toBeFocused();
    await page.getByTestId("main-menu-toggle").tap();
    await page.getByRole("button", { name: "Options", exact: true }).last().tap();
    await expect(page.getByTestId("options-dialog")).toBeVisible();
    await page.getByRole("button", { name: "Back to game" }).tap();
    await page.getByTestId("main-menu-toggle").tap();
    await page.getByRole("button", { name: "Menu", exact: true }).tap();
    await page
      .getByTestId("world-menu")
      .getByRole("button", { name: "Options", exact: true })
      .tap();
    await expect(page.getByTestId("options-dialog")).toBeVisible();
  });
}

test("reload remembers each local player's choice and storage failures retain the session mode", async ({
  page,
}) => {
  await start(page);
  await page.reload();
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await page.locator('button[aria-label="Options"]').tap();
  await expect(page.getByRole("button", { name: "Tap to move", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const firstId = await page.evaluate(async (key) => {
    const g = (document.querySelector("#game") as unknown as { __game: TestGame }).__game;
    const child = await g.profileStore.createProfile("Second player");
    localStorage.setItem(key, child.id);
    return g.profile.id;
  }, ACTIVE_PROFILE_KEY);
  await page.reload();
  await page.getByText("Second player", { exact: true }).tap();
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await page.locator('button[aria-label="Options"]').tap();
  await expect(page.getByRole("button", { name: "Joystick", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.evaluate(() => {
    const g = (document.querySelector("#game") as unknown as { __game: TestGame }).__game;
    g.profileStore.updateProfile = async () => {
      throw new Error("Storage unavailable");
    };
  });
  await page.getByRole("button", { name: "Tap to move", exact: true }).tap();
  await expect(
    page.getByRole("status").filter({ hasText: "could not be remembered" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to game" }).tap();
  await tapOffset(page, 30);
  await expect.poll(async () => (await state(page)).target).not.toBeNull();
  await page.evaluate(({ key, id }) => localStorage.setItem(key, id), {
    key: ACTIVE_PROFILE_KEY,
    id: firstId,
  });
  await page.reload();
  await page.getByText("Player 1", { exact: true }).tap();
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await page.locator('button[aria-label="Options"]').tap();
  await expect(page.getByRole("button", { name: "Tap to move", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("gesture rejection, claimed Jump, resize targeting and menu cancellation use the real input path", async ({
  page,
}) => {
  await start(page);
  const session = await page.context().newCDPSession(page);
  const location = await point(page, 50);
  const touch = { x: location.x, y: location.y, id: 1 };
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [touch] });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ ...touch, x: touch.x + 40 }],
  });
  await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [touch] });
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  expect((await state(page)).target).toBeNull();
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [touch] });
  await session.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  expect((await state(page)).target).toBeNull();
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [touch] });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [touch, { x: touch.x, y: touch.y + 40, id: 2 }],
  });
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  expect((await state(page)).target).toBeNull();
  await page.evaluate(() => {
    const g = (document.querySelector("#game") as unknown as { __game: TestGame }).__game;
    g.debugPanel.zoom = 1.3;
  });
  await page.setViewportSize({ width: 800, height: 600 });
  await tapOffset(page, 45);
  const target = (await state(page)).target;
  expect(target).not.toBeNull();
  await expect.poll(async () => (await state(page)).wx).toBeGreaterThan(4);
  expect((await state(page)).target).toEqual(target);
  await page.getByTestId("main-menu-toggle").tap();
  expect((await state(page)).target).toBeNull();
  await page.getByTestId("main-menu-toggle").tap();
  const jump = await page.evaluate(() => {
    const c = document.querySelector("#game") as HTMLCanvasElement;
    const r = c.getBoundingClientRect();
    return {
      x: r.left + ((c.width - 52) * r.width) / c.width,
      y: r.top + ((c.height - 52) * r.height) / c.height,
      id: 1,
    };
  });
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [jump] });
  await expect.poll(async () => (await state(page)).z).toBeGreaterThan(0);
  const walking = await point(page, 30);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [jump, { ...walking, id: 2 }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [{ ...walking, id: 2 }],
  });
  await expect.poll(async () => (await state(page)).target).not.toBeNull();
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.getByRole("button", { name: "Open world map" }).tap();
  expect((await state(page)).target).toBeNull();
  await page.getByRole("button", { name: "Close map" }).tap();
  expect((await state(page)).target).toBeNull();
  await session.detach();
});

for (const renderer of ["canvas", "gpu"]) {
  test(`hold movement starts immediately, keeps walking, tolerates fingers and cancels on UI (${renderer})`, async ({
    page,
  }) => {
    await start(page, renderer, undefined, "Hold to move");
    const session = await page.context().newCDPSession(page);
    const right = await point(page, 70);
    const left = await point(page, -70);
    const original = await state(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...right, id: 1 }],
    });
    await expect.poll(async () => (await state(page)).wx).toBeGreaterThan(original.wx + 8);
    // Keep the same screen contact past both the old tap timeout and the original world spot.
    await expect
      .poll(async () => (await state(page)).wx, { timeout: 10000 })
      .toBeGreaterThan(original.wx + 90);
    expect((await state(page)).target).toBeNull();
    const turned = await state(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { ...right, id: 1 },
        { ...left, id: 2 },
      ],
    });
    await expect.poll(async () => (await state(page)).wx).toBeLessThan(turned.wx - 8);
    const resumed = await state(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [{ ...left, id: 2 }],
    });
    await expect.poll(async () => (await state(page)).wx).toBeGreaterThan(resumed.wx + 8);
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(300);
    const stopped = await state(page);
    await page.waitForTimeout(300);
    expect(Math.abs((await state(page)).wx - stopped.wx)).toBeLessThan(1);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...right, id: 3 }],
    });
    await expect.poll(async () => (await state(page)).wx).toBeGreaterThan(stopped.wx + 8);
    // Open via the DOM while a world contact remains down, then keep moving that old contact.
    await page
      .locator('button[aria-label="Options"]')
      .evaluate((b: HTMLButtonElement) => b.click());
    await expect(page.getByRole("button", { name: "Hold to move", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page
      .getByRole("button", { name: "Back to game", exact: true })
      .evaluate((b: HTMLButtonElement) => b.click());
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ ...right, x: right.x - 10, id: 3 }],
    });
    await page.waitForTimeout(300);
    const canceled = await state(page);
    await page.waitForTimeout(300);
    expect(Math.abs((await state(page)).wx - canceled.wx)).toBeLessThan(1);
    await session.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
    await page.reload();
    await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
    await page.locator('button[aria-label="Options"]').tap();
    await expect(page.getByRole("button", { name: "Hold to move", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      const bounds = await page
        .getByRole("button", { name: "Back to game", exact: true })
        .boundingBox();
      expect(bounds).not.toBeNull();
      expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeLessThanOrEqual(viewport.height);
      await page.screenshot({
        path: `/tmp/tilefun-hold-options-${renderer}-${viewport.width}.png`,
      });
    }
    await session.detach();
  });
}
