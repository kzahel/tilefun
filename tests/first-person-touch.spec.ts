import { expect, type Page, test } from "@playwright/test";
import type { GameTestHooks } from "../src/client/GameTestHooks.js";

test.use({
  channel: "chromium",
  isMobile: true,
  hasTouch: true,
  viewport: { width: 800, height: 600 },
});

async function state(page: Page) {
  return page.locator("#game").evaluate((canvas) => {
    const g = (canvas as HTMLCanvasElement & { __game: GameTestHooks }).__game;
    return {
      drawing: g.firstPerson.drawing,
      look: { ...g.firstPerson.look },
      movement: g.touchJoystick.getMovement(),
      active: g.touchJoystick.isActive(),
      position: { ...g.stateView.playerEntity.position },
      zoom: g.debugPanel.zoom,
    };
  });
}

test("FPS touch joystick moves on the left and looks on the right without pinch takeover", async ({
  page,
}) => {
  await page.goto("/tilefun/?nogamepad&view=fps");
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await page.locator("#game").evaluate(async (canvas) => {
    const g = (canvas as HTMLCanvasElement & { __game: GameTestHooks }).__game;
    const generation = { type: "flat", version: "flat-v1", seed: 42, preset: "grass" } as const;
    const created = await g.gcSendRequest({
      type: "create-world",
      requestId: g.nextRequestId++,
      name: "FPS touch",
      generation,
    });
    await g.gcSendRequest({
      type: "join-realm",
      requestId: g.nextRequestId++,
      worldId: created.meta.id,
      arrival: { x: 0, y: 0, generation },
    });
    await g.gcSendRequest({
      type: "rcon",
      requestId: g.nextRequestId++,
      command: "kill_all chicken",
    });
  });
  await page.locator('button[aria-label="Options"]').tap();
  await page.getByRole("button", { name: "Joystick", exact: true }).tap();
  await expect(page.getByRole("status").filter({ hasText: "Movement saved" })).toBeVisible();
  await page.getByRole("checkbox", { name: "Two-finger pinch to zoom" }).check();
  await expect(page.getByRole("status").filter({ hasText: "Zoom preference saved" })).toBeVisible();
  await page.getByRole("button", { name: "Back to game", exact: true }).tap();
  await expect.poll(async () => (await state(page)).drawing).toBe(true);

  const session = await page.context().newCDPSession(page);
  const touch = (
    type: "touchStart" | "touchMove" | "touchEnd",
    points: { id: number; x: number; y: number }[],
  ) => session.send("Input.dispatchTouchEvent", { type, touchPoints: points });
  const left = { id: 1, x: 100, y: 260 };
  const right = { id: 2, x: 480, y: 260 };
  const before = await state(page);
  // The right finger may arrive first and must never become the movement stick.
  await touch("touchStart", [right]);
  await touch("touchMove", [{ ...right, x: 540, y: 230 }]);
  await expect.poll(async () => (await state(page)).look.yaw).toBeCloseTo(before.look.yaw + 0.24);
  expect((await state(page)).look.pitch).toBeCloseTo(before.look.pitch + 0.12);
  expect((await state(page)).active).toBe(false);
  expect((await state(page)).movement).toEqual({ dx: 0, dy: 0 });
  await touch("touchEnd", []);

  // A neutral left finger plus right drag must retain both roles, even with pinch enabled.
  const neutral = await state(page);
  await touch("touchStart", [left, right]);
  await touch("touchMove", [left, { ...right, x: 540 }]);
  await expect.poll(async () => (await state(page)).look.yaw).toBeCloseTo(neutral.look.yaw + 0.24);
  expect((await state(page)).zoom).toBe(neutral.zoom);
  expect((await state(page)).active).toBe(true);
  await touch("touchMove", [
    { ...left, y: 210 },
    { ...right, x: 540 },
  ]);
  await expect
    .poll(async () => {
      const current = await state(page);
      return Math.hypot(
        current.position.wx - neutral.position.wx,
        current.position.wy - neutral.position.wy,
      );
    })
    .toBeGreaterThan(2);
  expect((await state(page)).movement).toEqual({ dx: 0, dy: -1 });
  // CDP's nonempty touchEnd list names the contacts to lift.
  await touch("touchEnd", [{ ...right, x: 540 }]);
  expect((await state(page)).active).toBe(true);
  await touch("touchEnd", []);
  expect((await state(page)).movement).toEqual({ dx: 0, dy: 0 });
  await session.detach();
});
