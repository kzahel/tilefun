import { expect, type Page, test } from "@playwright/test";

test.use({ channel: "chromium" });

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
test("Deck-sized menu, worlds, text keyboard, character and Options are controller complete", async ({
  page,
}) => {
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
