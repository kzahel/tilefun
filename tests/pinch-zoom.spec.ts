import { expect, type Page, test } from "@playwright/test";
import type { PlayerProfileStore } from "../src/persistence/PlayerProfileStore.js";

type TestGame = {
  gcSendRequest(message: unknown): Promise<{ meta: { id: string } }>;
  nextRequestId: number;
  debugPanel: { zoom: number; setZoom(zoom: number): void };
  stateView: { playerEntity: { id: number } };
  touchJoystick: { isActive(): boolean; getMovement(): { dx: number; dy: number } };
  tapMovement: { target: unknown };
  touchButtons: { jumpPressed: boolean };
  profile: { id: string };
  profileStore: PlayerProfileStore;
};

test.use({
  channel: "chromium",
  isMobile: true,
  hasTouch: true,
  viewport: { width: 600, height: 800 },
});
async function state(page: Page) {
  return page.evaluate(() => {
    const g = (document.querySelector("#game") as unknown as { __game: TestGame }).__game;
    return {
      zoom: g.debugPanel.zoom,
      joystick: g.touchJoystick.isActive(),
      movement: g.touchJoystick.getMovement(),
      target: g.tapMovement.target,
      jump: g.touchButtons.jumpPressed,
    };
  });
}
async function start(page: Page, renderer: string) {
  await page.goto(`/tilefun/?nogamepad&renderer=${renderer}`);
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await page.evaluate(async () => {
    const g = (document.querySelector("#game") as unknown as { __game: TestGame }).__game;
    const generation = { type: "flat", version: "flat-v1", seed: 42, preset: "grass" };
    const created = await g.gcSendRequest({
      type: "create-world",
      requestId: g.nextRequestId++,
      name: "Pinch zoom",
      generation,
    });
    await g.gcSendRequest({
      type: "join-realm",
      requestId: g.nextRequestId++,
      worldId: created.meta.id,
      arrival: { x: 0, y: 0, generation },
    });
    g.debugPanel.setZoom(1);
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (document.querySelector("#game") as unknown as { __game: TestGame }).__game.stateView
            .playerEntity.id,
      ),
    )
    .not.toBe(-1);
}
async function enable(page: Page, mode = "Joystick") {
  await page.locator('button[aria-label="Options"]').tap();
  await page.getByRole("button", { name: mode, exact: true }).tap();
  await expect(page.getByRole("status").filter({ hasText: "Movement saved" })).toBeVisible();
  const checkbox = page.getByRole("checkbox", { name: "Two-finger pinch to zoom" });
  if (!(await checkbox.isChecked())) {
    await checkbox.check();
    await expect(
      page.getByRole("status").filter({ hasText: "Zoom preference saved" }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Back to game", exact: true }).tap();
}
for (const renderer of ["canvas", "gpu"]) {
  test(`pinch preference, world zoom and joystick/button protection (${renderer})`, async ({
    page,
  }) => {
    await start(page, renderer);
    await page.locator('button[aria-label="Options"]').tap();
    await expect(
      page.getByRole("checkbox", { name: "Two-finger pinch to zoom" }),
    ).not.toBeChecked();
    await page.getByRole("button", { name: "Back to game", exact: true }).tap();
    const session = await page.context().newCDPSession(page);
    const touch = (
      type: "touchStart" | "touchMove" | "touchEnd" | "touchCancel",
      points: { id: number; x: number; y: number }[],
    ) => session.send("Input.dispatchTouchEvent", { type, touchPoints: points });
    const a = { id: 1, x: 180, y: 350 };
    const b = { id: 2, x: 300, y: 350 };
    await touch("touchStart", [a, b]);
    await touch("touchMove", [a, { ...b, x: 420 }]);
    expect((await state(page)).zoom).toBe(1);
    await touch("touchEnd", []);
    await enable(page);
    await touch("touchStart", [a, b]);
    await touch("touchMove", [a, { ...b, x: 420 }]);
    await expect.poll(async () => (await state(page)).zoom).toBe(2);
    expect((await state(page)).joystick).toBe(false);
    await touch("touchMove", [a, { ...b, x: 240 }]);
    await expect.poll(async () => (await state(page)).zoom).toBe(0.5);
    await touch("touchEnd", [a]);
    await touch("touchMove", [{ ...a, x: 230 }]);
    expect((await state(page)).joystick).toBe(false);
    await touch("touchEnd", []);
    // A dragged joystick plus a second world finger must continue moving without zoom.
    await touch("touchStart", [a]);
    await touch("touchMove", [{ ...a, x: 230 }]);
    await touch("touchStart", [{ ...a, x: 230 }, b]);
    await touch("touchMove", [
      { ...a, x: 230 },
      { ...b, x: 420 },
    ]);
    expect((await state(page)).zoom).toBe(0.5);
    expect((await state(page)).movement.dx).toBeGreaterThan(0);
    await touch("touchEnd", []);
    // The keypad's jump touch is never a pinch finger, even with a neutral joystick.
    const jump = { id: 2, x: 548, y: 748 };
    await touch("touchStart", [a, jump]);
    await touch("touchMove", [{ ...a, x: 230 }, jump]);
    expect((await state(page)).zoom).toBe(0.5);
    expect((await state(page)).jump).toBe(true);
    expect((await state(page)).movement.dx).toBeGreaterThan(0);
    await touch("touchEnd", []);
    await page.reload();
    await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
    await page.locator('button[aria-label="Options"]').tap();
    await expect(page.getByRole("checkbox", { name: "Two-finger pinch to zoom" })).toBeChecked();
    await page.getByRole("checkbox", { name: "Two-finger pinch to zoom" }).uncheck();
    await expect(
      page.getByRole("status").filter({ hasText: "Zoom preference saved" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Back to game", exact: true }).tap();
    const before = (await state(page)).zoom;
    await touch("touchStart", [a, b]);
    await touch("touchMove", [a, { ...b, x: 420 }]);
    expect((await state(page)).zoom).toBe(before);
    await touch("touchEnd", []);
    await page.reload();
    await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
    await page.locator('button[aria-label="Options"]').tap();
    await expect(
      page.getByRole("checkbox", { name: "Two-finger pinch to zoom" }),
    ).not.toBeChecked();
    await session.detach();
  });
  test(`pinch cancels world movement and Options cancels pinch (${renderer})`, async ({ page }) => {
    await start(page, renderer);
    for (const mode of ["Tap to move"]) {
      await enable(page, mode);
      const session = await page.context().newCDPSession(page);
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          { id: 1, x: 180, y: 350 },
          { id: 2, x: 300, y: 350 },
        ],
      });
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { id: 1, x: 180, y: 350 },
          { id: 2, x: 420, y: 350 },
        ],
      });
      expect((await state(page)).target).toBeNull();
      const zoom = (await state(page)).zoom;
      await page
        .locator('button[aria-label="Options"]')
        .evaluate((b: HTMLButtonElement) => b.click());
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { id: 1, x: 180, y: 350 },
          { id: 2, x: 500, y: 350 },
        ],
      });
      expect((await state(page)).zoom).toBe(zoom);
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.getByRole("button", { name: "Back to game", exact: true }).tap();
      expect((await state(page)).target).toBeNull();
      await session.detach();
    }
  });
}

test("Options keeps the checkbox and Back button visible in portrait and landscape", async ({
  page,
}) => {
  await start(page, "canvas");
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.locator('button[aria-label="Options"]').tap();
    const checkbox = page.getByRole("checkbox", { name: "Two-finger pinch to zoom" });
    await expect(checkbox).toBeInViewport();
    const back = page.getByRole("button", { name: "Back to game", exact: true });
    const box = await back.boundingBox();
    expect((box?.y ?? Infinity) + (box?.height ?? Infinity)).toBeLessThanOrEqual(viewport.height);
    await checkbox.setChecked(!(await checkbox.isChecked()));
    await expect(
      page.getByRole("status").filter({ hasText: "Zoom preference saved" }),
    ).toBeVisible();
    const savedBox = await back.boundingBox();
    expect((savedBox?.y ?? Infinity) + (savedBox?.height ?? Infinity)).toBeLessThanOrEqual(
      viewport.height,
    );
    await page.screenshot({ path: `/tmp/tilefun-pinch-options-${viewport.width}.png` });
    await page.getByRole("button", { name: "Back to game", exact: true }).tap();
  }
});
