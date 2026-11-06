import { expect, test } from "@playwright/test";

test("ready game fills a nonzero viewport with rendered pixels", async ({ page }) => {
  await page.goto("/tilefun/");
  await page.locator('#game[data-ready="true"]').waitFor({ timeout: 10_000 });
  await expect(page.locator("#game")).toBeVisible();
  const box = await page.locator("#game").boundingBox();
  expect(box?.width).toBeGreaterThan(0);
  expect(box?.height).toBeGreaterThan(0);
  await page.waitForTimeout(100);

  // Sample several points across the canvas — all should have grass pixel content
  const allHaveContent = await page.evaluate(() => {
    const gameCanvas = document.getElementById("game") as HTMLCanvasElement & {
      __game: { renderHost: import("../src/rendering/RenderHost.js").RenderHost };
    };
    const c = gameCanvas.__game.renderHost.captureFrame?.() ?? gameCanvas;
    const ctx = c.getContext("2d");
    if (!ctx) return false;

    const points = [
      [50, 50],
      [c.width - 50, 50],
      [50, c.height - 50],
      [c.width - 50, c.height - 50],
      [Math.floor(c.width / 2), Math.floor(c.height / 2)],
    ];

    for (const [x, y] of points) {
      if (x === undefined || y === undefined) return false;
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      const a = pixel[3] ?? 0;
      const rgb = (pixel[0] ?? 0) + (pixel[1] ?? 0) + (pixel[2] ?? 0);
      if (a === 0 || rgb === 0) return false;
    }
    return true;
  });

  expect(allHaveContent).toBe(true);
});

test("arrow and WASD input keep the game rendering without console or page errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tilefun/");
  await page.locator('#game[data-ready="true"]').waitFor({ timeout: 10_000 });

  // Rapidly scroll in all directions to trigger chunk generation/autotile/caching
  for (const key of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "w", "a", "s", "d"]) {
    await page.keyboard.down(key);
    await page.waitForTimeout(500);
    await page.keyboard.up(key);
  }

  // Diagonal movement
  await page.keyboard.down("ArrowRight");
  await page.keyboard.down("ArrowDown");
  await page.waitForTimeout(500);
  await page.keyboard.up("ArrowRight");
  await page.keyboard.up("ArrowDown");

  await page.waitForTimeout(200);

  // Verify rendering still works
  const hasContent = await page.evaluate(() => {
    const gameCanvas = document.getElementById("game") as HTMLCanvasElement & {
      __game: { renderHost: import("../src/rendering/RenderHost.js").RenderHost };
    };
    const c = gameCanvas.__game.renderHost.captureFrame?.() ?? gameCanvas;
    const ctx = c.getContext("2d");
    if (!ctx) return false;
    const pixel = ctx.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data;
    const a = pixel[3] ?? 0;
    const rgb = (pixel[0] ?? 0) + (pixel[1] ?? 0) + (pixel[2] ?? 0);
    return a > 0 && rgb > 0;
  });

  expect(hasContent).toBe(true);
  expect(errors).toEqual([]);
});

test("F3 toggles debug overlay", async ({ page }, testInfo) => {
  // Keep terrain and background colors fixed while measuring collision lines.
  const generation = { type: "flat", version: "flat-v1", seed: 42, preset: "grass" };
  await page.goto(`/tilefun/?generation=${encodeURIComponent(JSON.stringify(generation))}`);
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await expect(page.getByTestId("world-menu")).toBeHidden();
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("#game")).toHaveAttribute("data-generator", "flat");

  // Capture top-left pixels BEFORE debug toggle
  const pixelsBefore = await page.evaluate(() => {
    const gameCanvas = document.getElementById("game") as HTMLCanvasElement & {
      __game: { renderHost: import("../src/rendering/RenderHost.js").RenderHost };
    };
    const c = gameCanvas.__game.renderHost.captureFrame?.() ?? gameCanvas;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    const data = ctx.getImageData(5, 5, 180, 55).data;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += (data[i] ?? 0) + (data[i + 1] ?? 0) + (data[i + 2] ?? 0);
    }
    return sum;
  });

  // Toggle debug overlay via F3
  await page.keyboard.press("F3");
  const panel = page.getByLabel("Debug panel", { exact: true });
  await expect(panel).toBeVisible();
  await expect(panel.getByLabel("Vehicle bodies", { exact: true })).toBeChecked();
  await expect(panel.getByLabel("Search bounds", { exact: true })).not.toBeChecked();
  await expect(
    panel.getByRole("option", { name: "GPU + 3D car (default)", exact: true }),
  ).toHaveCount(1);
  const bluePixels = () =>
    page.evaluate(() => {
      const canvas = document.querySelector("#game") as HTMLCanvasElement & {
        __game: { renderHost: import("../src/rendering/RenderHost.js").RenderHost };
      };
      const image = canvas.__game.renderHost.captureFrame?.() ?? canvas;
      const data = image.getContext("2d")?.getImageData(0, 0, image.width, image.height).data;
      let count = 0;
      if (data)
        for (let i = 0; i < data.length; i += 4) {
          // #66baff actor edges are 1px strokes that usually straddle two pixels,
          // so count strong sky-blue blends rather than the exact opaque color.
          // The stationary player's box alone gives ~230; grass, HUD and sprites none.
          const r = data[i] ?? 0,
            g = data[i + 1] ?? 0,
            b = data[i + 2] ?? 0;
          if (b >= 200 && g >= 140 && r <= 140 && b - r >= 90) count++;
        }
      return count;
    });
  // Keep the successful sample: a fresh capture may belong to another frame.
  let withBodies = 0;
  await expect
    .poll(async () => {
      withBodies = await bluePixels();
      return withBodies;
    })
    .toBeGreaterThan(0);
  await panel.getByLabel("People & objects", { exact: true }).uncheck();
  let withoutBodies = 0;
  await expect
    .poll(async () => {
      withoutBodies = await bluePixels();
      return withoutBodies;
    })
    .toBeLessThan(withBodies);
  await panel.getByLabel("People & objects", { exact: true }).check();
  await expect.poll(bluePixels).toBeGreaterThan(withoutBodies);
  await testInfo.attach("collision-layers", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await panel.getByText("Other diagnostics", { exact: true }).click();
  await panel.getByLabel("Performance & network", { exact: true }).check();
  await page.waitForTimeout(200);

  // Check that top-left area changed (dark background + green text drawn)
  const pixelsAfter = await page.evaluate(() => {
    const gameCanvas = document.getElementById("game") as HTMLCanvasElement & {
      __game: { renderHost: import("../src/rendering/RenderHost.js").RenderHost };
    };
    const c = gameCanvas.__game.renderHost.captureFrame?.() ?? gameCanvas;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    const data = ctx.getImageData(5, 5, 180, 55).data;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += (data[i] ?? 0) + (data[i + 1] ?? 0) + (data[i + 2] ?? 0);
    }
    return sum;
  });

  // The debug overlay should change the pixel content in the top-left area
  expect(pixelsBefore).not.toBeNull();
  expect(pixelsAfter).not.toBeNull();
  expect(pixelsAfter).not.toBe(pixelsBefore);
  // F3 still closes the panel while one of its controls has keyboard focus.
  await panel.getByLabel("People & objects", { exact: true }).focus();
  await page.keyboard.press("F3");
  await expect(panel).toBeHidden();
});

test.describe("gem HUD", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: "en-US",
  });

  test("zero and collected totals remain visible below Map in Play and Edit across screen sizes", async ({
    page,
  }, testInfo) => {
    await page.goto("/tilefun/?nogamepad");
    await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
    await page.evaluate(async () => {
      const g = (
        document.querySelector("#game") as unknown as {
          __game: import("../src/client/GameTestHooks.js").GameTestHooks;
        }
      ).__game;
      const generation = { type: "flat", version: "flat-v1", seed: 42, preset: "grass" } as const;
      const created = await g.gcSendRequest({
        type: "create-world",
        requestId: g.nextRequestId++,
        name: "Gem HUD",
        generation,
      });
      await g.gcSendRequest({
        type: "join-realm",
        requestId: g.nextRequestId++,
        worldId: created.meta.id,
        arrival: { x: 0, y: 0, generation },
      });
    });
    const hud = page.getByTestId("gem-hud");
    const count = page.getByTestId("gem-count");
    await expect(hud).toBeVisible();
    await expect(count).toHaveText("0");
    const checkPlacement = async () => {
      const rect = await hud.boundingBox();
      const map = await page.getByTestId("open-world-map").boundingBox();
      if (!rect || !map) throw Error("Missing HUD or Map button");
      expect(rect.y).toBeGreaterThanOrEqual(map.y + map.height + 4);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
      expect(await hud.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
    };
    await checkPlacement();
    await page.getByTestId("main-menu-toggle").tap();
    await page.getByRole("button", { name: "Edit", exact: true }).tap();
    await expect(page.getByTestId("editor-panel")).toBeVisible();
    await expect(hud).toBeVisible();
    await checkPlacement();
    // Use the normal Worker editor/collection path, rather than assigning a display value.
    await page.evaluate(() => {
      const g = (
        document.querySelector("#game") as unknown as {
          __game: import("../src/client/GameTestHooks.js").GameTestHooks;
        }
      ).__game;
      const p = g.stateView.playerEntity.position;
      g.transport.send({ type: "edit-spawn", entityType: "gem", wx: p.wx, wy: p.wy });
    });
    await page.getByRole("button", { name: "Exit editor", exact: true }).tap();
    await expect(count).toHaveText("1");
    // Touch enters native fullscreen; restore the window before viewport resizing.
    await page.evaluate(async () => {
      if (document.fullscreenElement) await document.exitFullscreen();
    });
    for (const viewport of [
      { width: 360, height: 640 },
      { width: 844, height: 390 },
      { width: 1280, height: 800 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(hud).toBeVisible();
      await checkPlacement();
    }
    await testInfo.attach("gem-hud", { body: await page.screenshot(), contentType: "image/png" });
    // Renderer replacement must retain this same progress display.
    await page.evaluate(async () => {
      const g = (
        document.querySelector("#game") as unknown as {
          __game: { renderHost: import("../src/rendering/RenderHost.js").RenderHost };
        }
      ).__game;
      await g.renderHost.rendererControl?.select("canvas");
    });
    await expect(count).toHaveText("1");
    await checkPlacement();
    // Check a larger readout without changing the player's authoritative balance.
    await page.evaluate(() => {
      const g = (
        document.querySelector("#game") as unknown as {
          __game: {
            loop: { stop(): void };
            gemHUD: { update(gems: number, buddies: number): void };
          };
        }
      ).__game;
      g.loop.stop();
      g.gemHUD.update(123456, 2);
    });
    await page.setViewportSize({ width: 360, height: 640 });
    await expect(count).toHaveText("123,456");
    await checkPlacement();
    await testInfo.attach("gem-hud-large-readout", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
  });
});

test("startup shows the HTML shell before game code, image progress, and world preparation", async ({
  page,
}) => {
  let releaseScripts!: () => void;
  const scripts = new Promise<void>((resolve) => {
    releaseScripts = resolve;
  });
  let releaseImage!: () => void;
  const image = new Promise<void>((resolve) => {
    releaseImage = resolve;
  });
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() === "script") await scripts;
    if (new URL(route.request().url()).pathname.endsWith("/assets/sprites/player.png")) await image;
    await route.continue();
  });
  try {
    await page.goto("/tilefun/?nogamepad", { waitUntil: "commit" });
    const screen = page.locator("#startup-screen");
    await expect(screen).toBeVisible();
    await expect(page.locator("#startup-stage")).toHaveText("Loading game code…");
    await expect(page.locator("#startup-progress")).not.toHaveAttribute("value");
    await page.evaluate(() => {
      const root = document.getElementById("startup-screen");
      const stages = [root?.dataset.stage];
      (window as unknown as { startupStages: unknown[] }).startupStages = stages;
      if (root)
        new MutationObserver(() => stages.push(root.dataset.stage)).observe(root, {
          attributes: true,
          attributeFilter: ["data-stage"],
        });
    });
    releaseScripts();
    await expect(screen).toHaveAttribute("data-stage", "assets");
    await expect
      .poll(() =>
        page.locator("#startup-progress").evaluate((node) => {
          const bar = node as HTMLProgressElement;
          return bar.value > 0 && bar.value < bar.max;
        }),
      )
      .toBe(true);
    await expect(page.locator("#startup-detail")).toHaveText(/\d+ of \d+ images ready/);
    releaseImage();
    await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
    await expect(screen).toBeHidden();
    const stages = await page.evaluate(
      () => (window as unknown as { startupStages: string[] }).startupStages,
    );
    expect(stages).toContain("profile");
    expect(stages).toContain("server");
    expect(stages).toContain("assets");
    expect(stages).toContain("world");
  } finally {
    releaseScripts();
    releaseImage();
  }
});
