import { expect, type Page, test } from "@playwright/test";

// Use the full Chromium compositor for native touch scrolling, not headless-shell.
test.use({ channel: "chromium" });

type EditorTestGame = {
  gcSendRequest(message: unknown): Promise<{ meta: { id: string } }>;
  nextRequestId: number;
  stateView: { editorEnabled: boolean; props: { type: string }[] };
  camera: { x: number; y: number };
};

async function openEditor(page: Page) {
  await page.goto("/tilefun/");
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await page.evaluate(async () => {
    const game = (document.querySelector("#game") as unknown as { __game: EditorTestGame }).__game;
    const generation = { type: "flat", version: "flat-v1", seed: 42, preset: "grass" };
    const created = await game.gcSendRequest({
      type: "create-world",
      requestId: game.nextRequestId++,
      name: "Mobile editor",
      generation,
    });
    await game.gcSendRequest({
      type: "join-realm",
      requestId: game.nextRequestId++,
      worldId: created.meta.id,
      arrival: { x: 0, y: 0, generation },
    });
  });
  await page.getByTestId("main-menu-toggle").tap();
  await page.getByRole("button", { name: "Edit", exact: true }).tap();
  await expect(page.getByTestId("editor-panel")).toBeVisible();
}

async function gameState(page: Page) {
  return page.evaluate(() => {
    const game = (document.querySelector("#game") as unknown as { __game: EditorTestGame }).__game;
    return {
      editing: game.stateView.editorEnabled,
      slides: game.stateView.props.filter((prop) => prop.type === "prop-slide").length,
      camera: [game.camera.x, game.camera.y],
    };
  });
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 360, height: 640 },
  { width: 844, height: 390 },
]) {
  test.describe(`mobile editor ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport, screen: viewport, isMobile: true, hasTouch: true });

    test("all palettes stay within half the screen; scrolling and minimizing preserve placement", async ({
      page,
    }, testInfo) => {
      await openEditor(page);
      const panel = page.getByTestId("editor-panel");
      const tabs = page.getByTestId("editor-tabs");
      const palette = page.getByTestId("editor-palette-scroll");
      for (const tab of [
        "natural",
        "road",
        "structure",
        "entities",
        "props",
        "elevation",
        "patterns",
      ]) {
        const button = page.locator(`[data-editor-tab="${tab}"]`);
        await button.tap();
        const bounds = await panel.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds?.height).toBeLessThanOrEqual(viewport.height / 2);
        const row = await tabs.boundingBox();
        const selected = await button.boundingBox();
        expect(row?.height).toBeLessThan(60);
        expect(selected?.x).toBeGreaterThanOrEqual(row?.x ?? 0);
        expect((selected?.x ?? 0) + (selected?.width ?? 0)).toBeLessThanOrEqual(viewport.width);
      }

      await page.locator('[data-editor-tab="props"]').tap();
      const before = await gameState(page);
      const headerBefore = await tabs.boundingBox();
      const scrollBounds = await palette.boundingBox();
      if (!scrollBounds) throw new Error("Missing palette bounds");
      const session = await page.context().newCDPSession(page);
      const x = scrollBounds.x + scrollBounds.width / 2;
      const startY = scrollBounds.y + scrollBounds.height * 0.75;
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y: startY }],
      });
      for (let step = 1; step <= 6; step++) {
        await session.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x, y: startY - (scrollBounds.height * 0.5 * step) / 6 }],
        });
        await page.evaluate(() => new Promise(requestAnimationFrame));
      }
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await expect.poll(() => palette.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      expect(await tabs.boundingBox()).toEqual(headerBefore);
      expect(await gameState(page)).toEqual(before);

      await page.getByTitle("Place Slide (click map)", { exact: true }).tap();
      await expect(page.getByTestId("editor-selection")).toHaveText("Slide");
      await page.screenshot({ path: testInfo.outputPath("expanded.png") });
      await page.touchscreen.tap(viewport.width / 2, 100);
      await expect.poll(async () => (await gameState(page)).slides).toBe(before.slides + 1);

      await page.getByRole("button", { name: "Minimize editor tools", exact: true }).tap();
      await expect(palette).toBeHidden();
      await expect(tabs).toBeHidden();
      await expect(page.getByTestId("editor-selection")).toHaveText("Slide");
      expect((await panel.boundingBox())?.height).toBe(44);
      expect((await gameState(page)).editing).toBe(true);
      // Place in the newly exposed area, clear of the first slide's collider.
      await page.touchscreen.tap(viewport.width / 2 - 100, viewport.height - 100);
      await expect.poll(async () => (await gameState(page)).slides).toBe(before.slides + 2);
      await page.screenshot({ path: testInfo.outputPath("minimized.png") });
      await page.getByRole("button", { name: "Expand editor tools", exact: true }).tap();
      await expect(palette).toBeVisible();
      await page.getByRole("button", { name: "Exit editor", exact: true }).tap();
      await expect(panel).toBeHidden();
      await expect.poll(async () => (await gameState(page)).editing).toBe(false);
    });

    test("Atlas controls fit and closing or choosing a sprite resumes editing", async ({
      page,
    }, testInfo) => {
      await openEditor(page);
      await page.locator('[data-editor-tab="props"]').tap();
      await page.getByTitle("Browse 4800+ sprites from Modern Exteriors", { exact: true }).tap();
      const catalog = page.getByRole("dialog", { name: "Sprite Catalog", exact: true });
      await expect(catalog).toBeVisible();
      for (const control of [
        page.getByRole("button", { name: "Close sprite catalog" }),
        page.getByRole("combobox", { name: "Sprite theme" }),
        page.getByRole("textbox", { name: "Search sprites" }),
      ]) {
        const box = await control.boundingBox();
        expect(box?.x).toBeGreaterThanOrEqual(0);
        expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport.width);
        expect(box?.height).toBeGreaterThanOrEqual(44);
      }
      await expect(page.getByRole("textbox", { name: "Search sprites" })).not.toBeFocused();
      await page.screenshot({ path: testInfo.outputPath("atlas.png") });
      await page.getByRole("button", { name: "Close sprite catalog" }).tap();
      await expect(catalog).toBeHidden();
      // Actual placement proves the modal scene was popped, not merely hidden.
      await page.getByTitle("Place Slide (click map)", { exact: true }).tap();
      await page.touchscreen.tap(viewport.width / 2, 100);
      await expect.poll(async () => (await gameState(page)).slides).toBe(1);
      await page.getByTitle("Browse 4800+ sprites from Modern Exteriors", { exact: true }).tap();
      await catalog.locator('[title*=" — "]').first().tap();
      await expect(catalog).toBeHidden();
      await expect(page.getByTestId("editor-panel")).toBeVisible();
      await expect(page.getByTestId("editor-selection")).not.toHaveText("Slide");
    });
  });
}
