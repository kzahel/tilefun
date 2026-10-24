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
  await page.goto("/tilefun/");
  await page.locator('#game[data-ready="true"]').waitFor({ timeout: 10_000 });
  await page.waitForTimeout(200);

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
  await expect(panel.getByLabel("Driving bodies", { exact: true })).toBeChecked();
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
          // The blue debug body edges, including antialiasing against the ground.
          if (
            (data[i] ?? 0) >= 65 &&
            (data[i] ?? 0) <= 120 &&
            (data[i + 1] ?? 0) >= 145 &&
            (data[i + 1] ?? 0) <= 200 &&
            (data[i + 2] ?? 0) >= 220
          )
            count++;
        }
      return count;
    });
  await expect.poll(bluePixels).toBeGreaterThan(0);
  const withBodies = await bluePixels();
  await panel.getByLabel("People & objects", { exact: true }).uncheck();
  await expect.poll(bluePixels).toBeLessThan(withBodies);
  const withoutBodies = await bluePixels();
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
