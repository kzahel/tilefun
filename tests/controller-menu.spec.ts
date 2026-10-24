import { expect, type Locator, type Page, test } from "@playwright/test";
import type { GameClient } from "../src/client/GameClient.js";

test.use({ channel: "chromium", hasTouch: true });

async function press(page: Page, button: number) {
  // Observe actual render frames so a busy GPU cannot miss a press/release.
  await page.evaluate(async (index) => {
    const frames = async () => {
      for (let n = 0; n < 3; n++)
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    };
    await frames();
    const gp = (window as unknown as { testPad: Gamepad }).testPad;
    Object.assign(gp.buttons[index] ?? {}, { pressed: true, value: 1 });
    await frames();
    Object.assign(gp.buttons[index] ?? {}, { pressed: false, value: 0 });
    await frames();
  }, button);
}
async function focusWithPad(page: Page, name: string) {
  for (let i = 0; i < 25; i++) {
    if (
      await page
        .getByTestId("world-menu")
        .getByRole("button", { name, exact: true })
        .evaluate((e) => e === document.activeElement)
    )
      return;
    await press(page, 13);
  }
  throw Error(`Couldn't reach ${name} with D-pad`);
}
async function pointAt(page: Page, target: Locator) {
  const box = await target.boundingBox();
  if (!box) throw Error("Pointer target is missing");
  await page.evaluate(
    async ({ x, y }) => {
      const pad = (window as unknown as { testPad: Gamepad }).testPad;
      const axes = pad.axes as number[];
      for (let frame = 0; frame < 400; frame++) {
        const pointer = document.querySelector<HTMLElement>('[data-testid="controller-pointer"]');
        const px = pointer ? Number.parseFloat(pointer.style.left) : innerWidth * 0.5;
        const py = pointer ? Number.parseFloat(pointer.style.top) : innerHeight * 0.35;
        const dx = x - px,
          dy = y - py;
        // Ease near the target: a fixed high speed can oscillate across it when
        // real GPU frames are slower than the harness's observation cadence.
        const aim = (delta: number) =>
          Math.abs(delta) < 4 ? 0 : Math.sign(delta) * Math.min(0.6, 0.2 + Math.abs(delta) / 200);
        axes[2] = aim(dx);
        axes[3] = aim(dy);
        if (!axes[2] && !axes[3]) return;
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      axes[2] = axes[3] = 0;
      throw Error("Controller cursor did not reach the control");
    },
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const pad = {
      connected: true,
      mapping: "standard",
      index: 0,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0, touched: false })),
    };
    Object.assign(window, { testPad: pad });
    Object.defineProperty(navigator, "getGamepads", { value: () => [pad] });
  });
});
test("right-stick cursor selects editor tools and map controls with A and RT", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/tilefun/?desktop=1");
  await expect(page.getByTestId("world-menu")).toBeVisible();
  await press(page, 0);
  // The game defaults to editing for a new profile.
  const panel = page.getByTestId("editor-panel");
  if (!(await panel.isVisible())) await press(page, 4);
  // LT can erase immediately, before the right stick or paint trigger has been used.
  await press(page, 6);
  await expect(page.getByTestId("controller-pointer")).toBeVisible();
  const entities = panel.locator('[data-editor-tab="entities"]');
  await pointAt(page, entities);
  await press(page, 7);
  await expect(panel.getByTestId("editor-selection")).toContainText(/Chicken|Chick|Entities/i);
  const vehicles = panel.locator('[data-editor-tab="vehicles"]');
  await pointAt(page, vehicles);
  await press(page, 0);
  await expect(panel.getByTestId("editor-selection")).toContainText(/compact|car|vehicle/i);
  await press(page, 4);
  await press(page, 8);
  const map = page.getByTestId("world-map");
  await expect(map).toBeVisible();
  const before = Number(await map.getAttribute("data-zoom"));
  await pointAt(page, map.getByRole("button", { name: "Zoom in", exact: true }));
  await press(page, 7);
  await expect
    .poll(async () => Number(await map.getAttribute("data-zoom")))
    .toBeGreaterThan(before);
  // Switching back to focus navigation must reclaim A from the old pointer.
  await press(page, 15);
  await expect(map.getByRole("button", { name: "Zoom out", exact: true })).toBeFocused();
  await press(page, 0);
  await expect.poll(async () => Number(await map.getAttribute("data-zoom"))).toBe(before);
  await pointAt(page, map.getByTestId("world-map-canvas"));
  await press(page, 0);
  await expect(map.getByRole("status")).toContainText("Travel to selected point");
  await press(page, 1);
  await expect(map).toBeHidden();
});
test("Deck-sized menu, worlds, text keyboard, character and Options are controller complete", async ({
  page,
}) => {
  // This multi-view flow waits six real render frames for every pad press.
  // Software GPU CI needs its own budget; individual assertions keep theirs.
  test.setTimeout(process.env.CI ? 120000 : 30000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/tilefun/?desktop=1");
  const menu = page.getByTestId("world-menu");
  await expect(menu).toHaveAttribute("data-page", "home");
  await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeFocused();
  await focusWithPad(page, "Worlds");
  await press(page, 0);
  await expect(menu).toHaveAttribute("data-page", "worlds");
  await press(page, 0);
  await expect(menu).toHaveAttribute("data-page", "create");
  await press(page, 0); // focused name opens on-screen keyboard
  const keyboard = page.getByRole("dialog", { name: "World name" });
  await expect(keyboard).toBeVisible();
  await press(page, 0); // first key = 1
  await press(page, 1); // cancel preserves original
  await expect(keyboard).toBeHidden();
  await expect(page.getByLabel("World name", { exact: true })).toHaveValue("");
  await press(page, 0);
  await press(page, 0);
  for (let n = 0; n < 4; n++) await press(page, 13);
  for (let n = 0; n < 9; n++) await press(page, 15);
  await expect(keyboard.getByRole("button", { name: "Done", exact: true })).toBeFocused();
  await press(page, 0);
  await expect(page.getByLabel("World name", { exact: true })).toHaveValue("1");
  await press(page, 13);
  await press(page, 13);
  await press(page, 13);
  await expect(page.getByRole("button", { name: "New World", exact: true })).toBeFocused();
  await press(page, 0);
  await expect(menu).toBeHidden();
  await expect(page.locator("#game")).toHaveAttribute("data-renderer", /gpu/);
  await press(page, 9);
  await expect(menu).toHaveAttribute("data-page", "home");
  await focusWithPad(page, "Worlds");
  await press(page, 0);
  await focusWithPad(page, "Options for 1");
  await press(page, 0);
  await focusWithPad(page, "Delete world…");
  await press(page, 0);
  await expect(page.getByRole("button", { name: "Keep world", exact: true })).toBeFocused();
  await press(page, 1);
  await expect(menu).toHaveAttribute("data-page", "worlds");
  await press(page, 1);
  await focusWithPad(page, "Options");
  await press(page, 0);
  await expect(page.getByTestId("options-dialog")).toBeVisible();
  await press(page, 1);
  await expect(page.getByTestId("options-dialog")).toBeHidden();
  await focusWithPad(page, "Character");
  await press(page, 0);
  await expect(menu).toHaveAttribute("data-page", "character");
  await press(page, 1);
  await expect(menu).toHaveAttribute("data-page", "home");
  await page.screenshot({ path: "/tmp/tilefun-deck-menu.png" });
  await press(page, 9);
  await expect(menu).toBeHidden();
});
test("multiplayer join, validation, public browse and cancellation use controller navigation", async ({
  page,
}) => {
  await page.route("**/rooms", (route) =>
    route.fulfill({
      json: [{ peerId: "test-peer", name: "Family game", hostName: "Parent", playerCount: 1 }],
    }),
  );
  await page.goto("/tilefun/?desktop=1");
  await expect(page.getByTestId("world-menu")).toBeVisible();
  await focusWithPad(page, "Multiplayer");
  await press(page, 0);
  await expect(page.getByRole("button", { name: "Host P2P" })).toBeFocused();
  await press(page, 13);
  await press(page, 0);
  await press(page, 13);
  await press(page, 0);
  await expect(page.getByRole("alert")).toContainText("valid join code");
  await press(page, 1);
  await focusWithPad(page, "Browse Public Games");
  await press(page, 0);
  await expect(page.getByRole("button", { name: /Family game/ })).toBeVisible();
  await press(page, 1);
  await expect(page.getByTestId("world-menu")).toHaveAttribute("data-page", "multiplayer");
});

test("controller moves the player, opens the map and edits without leaking held input into menus", async ({
  page,
}) => {
  await page.goto("/tilefun/?desktop=1");
  const menu = page.getByTestId("world-menu");
  await expect(menu).toBeVisible();
  await press(page, 0); // resume
  const state = () =>
    page.evaluate(() => {
      const g = (
        document.querySelector("#game") as unknown as {
          __game: {
            stateView: import("../src/client/ClientStateView.js").ClientStateView;
            editorPanel: { visible: boolean };
          };
        }
      ).__game;
      return {
        x: g.stateView.playerEntity.position.wx,
        y: g.stateView.playerEntity.position.wy,
        editing: g.editorPanel.visible,
      };
    });
  if ((await state()).editing) await press(page, 4);
  await expect.poll(async () => (await state()).editing).toBe(false);
  const before = await state();
  await page.evaluate(
    () => ((window as unknown as { testPad: { axes: number[] } }).testPad.axes[0] = 1),
  );
  await expect.poll(async () => (await state()).x).toBeGreaterThan(before.x + 8);
  await press(page, 9); // pause while stick held
  await expect(menu).toBeVisible();
  await page.evaluate(
    () => ((window as unknown as { testPad: { axes: number[] } }).testPad.axes[0] = 0),
  );
  await page.waitForTimeout(100);
  await press(page, 1);
  await expect(menu).toBeHidden();
  await press(page, 8);
  await expect(page.getByRole("button", { name: "Close map", exact: true })).toBeVisible();
  await press(page, 1);
  await expect(page.getByRole("button", { name: "Close map", exact: true })).toBeHidden();
  await press(page, 4);
  await expect.poll(async () => (await state()).editing).toBe(true);
  await press(page, 3);
  await expect(page.getByTestId("editor-panel")).toHaveAttribute("data-menu-root", "true");
  await press(page, 1);
  // Closing the palette returns control to the world rather than toggling Play.
  await expect.poll(async () => (await state()).editing).toBe(true);
  await page.evaluate(() => {
    const canvas = document.querySelector("#game") as unknown as {
      __game: { transport: import("../src/transport/Transport.js").IClientTransport };
    };
    const transport = canvas.__game.transport;
    const send = transport.send.bind(transport);
    Object.assign(window, { paintModes: [] as string[] });
    transport.send = (message) => {
      if (message.type === "edit-terrain-tile")
        (window as unknown as { paintModes: string[] }).paintModes.push(message.paintMode);
      send(message);
    };
  });
  await press(page, 7); // paint a stroke
  await press(page, 6); // erase a stroke
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { paintModes: string[] }).paintModes))
    .toEqual(["positive", "unpaint"]);
  await press(page, 9);
  await expect(menu).toBeVisible();
});

test("failed saving keeps the session open and the recovery dialog works with B", async ({
  page,
}) => {
  await page.goto("/tilefun/?desktop=1");
  await expect(page.getByTestId("world-menu")).toBeVisible();
  await page.evaluate(() => {
    const g = (
      document.querySelector("#game") as unknown as {
        __game: { netEmulatedTransport: { base: { flush(): Promise<void> } } };
      }
    ).__game;
    g.netEmulatedTransport.base.flush = async () => {
      throw Error("Controlled save failure");
    };
  });
  await focusWithPad(page, "Multiplayer");
  await press(page, 0);
  await press(page, 0);
  const recovery = page.getByRole("alertdialog", { name: "Couldn't save" });
  await expect(recovery).toBeVisible();
  await expect(recovery).toContainText("Controlled save failure");
  await press(page, 1);
  await expect(recovery).toBeHidden();
  await expect(page).not.toHaveURL(/host=/);
  await expect(page.getByTestId("world-menu")).toHaveAttribute("data-page", "multiplayer");
});

test("B opens normal vehicle actions, A confirms and back never leaks driving or jump", async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  await page.goto("/tilefun/?desktop=1");
  await expect(page.getByTestId("world-menu")).toBeVisible();
  await press(page, 0);
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await page.evaluate(async () => {
    const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
    const generation = { type: "flat", version: "flat-v1", seed: 42, preset: "grass" } as const;
    const created = await g.gcSendRequest({
      type: "create-world",
      requestId: g.nextRequestId++,
      name: "Controller towing",
      generation,
    });
    await g.gcSendRequest({
      type: "join-realm",
      requestId: g.nextRequestId++,
      worldId: created.meta.id,
      arrival: { x: 0, y: 40 / 16, generation },
    });
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
        return (
          Math.abs(g.remoteView.serverPlayerEntity.position.wy - 40) < 1 &&
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
    g.transport.send({ type: "edit-spawn", entityType: "vehicle-v1:tow-truck", wx: 0, wy: 0 });
    g.transport.send({ type: "edit-spawn", entityType: "vehicle-v1:beetle", wx: -104, wy: 0 });
    g.transport.send({ type: "set-editor-mode", enabled: false });
  });
  const facts = () =>
    page.evaluate(() => {
      const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
      const p = g.remoteView.serverPlayerEntity;
      const truck = g.remoteView.serverEntities.find((e) => e.type === "vehicle-v1:tow-truck");
      return {
        target: truck?.towTargetId ?? null,
        parent: p.parentId ?? null,
        z: p.wz ?? 0,
        x: p.position.wx,
        y: p.position.wy,
      };
    });
  const launcher = page.locator("[data-context-actions]");
  const menu = page.getByTestId("context-actions");
  await expect(launcher).toBeVisible();
  await expect(page.getByRole("button", { name: "Attach car", exact: true })).toBeHidden();
  await press(page, 1);
  await expect(menu).toBeVisible();
  await expect(launcher).toContainText("B");
  await expect(menu.getByRole("button", { name: "Attach car", exact: true })).toBeFocused();
  await press(page, 1);
  await expect(menu).toBeHidden();
  expect((await facts()).target).toBeNull();
  // Exercise the same menu with keyboard and touch-sized mouse access too.
  await page.keyboard.press("q");
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await press(page, 1);
  await press(page, 0);
  await expect(menu).toBeHidden();
  await expect.poll(async () => (await facts()).target).not.toBeNull();
  expect((await facts()).z).toBe(0);
  await press(page, 3); // Y still boards, B does not exit.
  await expect.poll(async () => (await facts()).parent).not.toBeNull();
  await press(page, 1);
  await expect(menu).toBeVisible();
  const stopped = await facts();
  await page.evaluate(() => {
    (window as unknown as { testPad: Gamepad }).testPad.axes[0] = 1;
  });
  await page.waitForTimeout(150);
  expect((await facts()).x).toBeCloseTo(stopped.x, 1);
  await page.evaluate(() => {
    (window as unknown as { testPad: Gamepad }).testPad.axes[0] = 0;
  });
  await press(page, 1);
  await expect(menu).toBeHidden();
  expect((await facts()).parent).toBe(stopped.parent);
  // Resize the actual HUD: both interaction buttons stay clear of the movement area.
  await page.setViewportSize({ width: 390, height: 844 });
  await launcher.tap();
  await expect(menu.getByRole("button", { name: "Release car", exact: true })).toBeVisible();
  const actionsImage = testInfo.outputPath("phone-actions.png");
  await page.screenshot({ path: actionsImage });
  await testInfo.attach("phone-actions", { path: actionsImage, contentType: "image/png" });
  await menu.getByRole("button", { name: "Release car", exact: true }).tap();
  await expect.poll(async () => (await facts()).target).toBeNull();
  await expect(launcher).toHaveText("Actions");
  const hudImage = testInfo.outputPath("phone-hud.png");
  await page.screenshot({ path: hudImage });
  await testInfo.attach("phone-hud", { path: hudImage, contentType: "image/png" });
});
