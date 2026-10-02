import { expect, test } from "@playwright/test";

const url = "/tilefun/demos/pixel-characters/";

test("gallery publishes completed records and displays both independently authored sizes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url);
  const garden = page.locator("#garden");
  await expect(garden).toHaveAttribute("data-ready", "true");
  const registry = await (await page.request.get(`${url}characters.json`)).json();
  expect(registry.characters.map((record: { id: string }) => record.id).sort()).toEqual([
    "bear",
    "cat",
    "dog",
    "person",
    "squirrel",
  ]);
  await expect(page.locator("#character option")).toHaveCount(registry.characters.length);
  await expect(page.locator("#character")).toHaveValue("cat");
  await expect(garden).toHaveAttribute("data-character", "cat");
  await expect(page.getByRole("link", { name: "Watch all five characters" })).toHaveAttribute(
    "href",
    "roster-preview.gif",
  );
  expect((await page.request.get(`${url}roster-preview.gif`)).ok()).toBe(true);
  await page.locator("#character").selectOption("cat");
  await expect(garden).toHaveAttribute("data-character", "cat");
  await page.locator("#animate").uncheck();
  const front = page.locator('canvas[data-row="0"]');
  const large = await front.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  await page.locator("#sprite-size").selectOption("16");
  await expect(garden).toHaveAttribute("data-size", "16");
  await expect(front).toHaveAttribute("width", "16");
  expect(await front.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())).not.toBe(large);
  // The visible canvas contains the exact native16 source pixels, rather than a scaled 32px sprite.
  expect(
    await front.evaluate(async (canvas: HTMLCanvasElement) => {
      const image = new Image();
      image.src = "cat-16.png";
      await image.decode();
      const expected = document.createElement("canvas");
      expected.width = expected.height = 16;
      expected.getContext("2d")?.drawImage(image, 0, 0, 16, 16, 0, 0, 16, 16);
      return canvas.toDataURL() === expected.toDataURL();
    }),
  ).toBe(true);
  await page.locator("#native-scale").check();
  await expect(front).toHaveCSS("width", "16px");
  await page.locator("#sprite-size").selectOption("32");
  await expect(front).toHaveCSS("width", "32px");
  await expect(page.locator("#sheet-link")).toHaveAttribute("href", "cat-32.png");
  expect(errors).toEqual([]);
  await page.locator("#native-scale").uncheck();
  await page.screenshot({ path: "test-results/pixel-characters-desktop.png", fullPage: true });
});

for (const [character, description] of [
  ["dog", "short wagging tail"],
  ["person", "canvas backpack"],
  ["squirrel", "large bushy curved tail"],
  ["bear", "tiny tail"],
] as const) {
  test(`character selector loads the completed ${character} and renders its own sheets in every direction`, async ({
    page,
  }) => {
    await page.goto(url);
    const garden = page.locator("#garden");
    await expect(garden).toHaveAttribute("data-ready", "true");
    await page.locator("#animate").uncheck();
    const front = page.locator('canvas[data-row="0"]');
    const catPixels = await front.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
    await page.locator("#character").selectOption(character);
    await expect(garden).toHaveAttribute("data-character", character);
    await expect(page.locator("#description")).toContainText(description);
    expect(await front.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())).not.toBe(
      catPixels,
    );
    await expect(page.locator("#contact-link")).toHaveAttribute(
      "href",
      `${character}-contact-sheet.png`,
    );
    await expect(page.locator("#preview-link")).toHaveAttribute("href", `${character}-preview.gif`);
    await page.screenshot({
      path: `test-results/${character}-gallery-desktop.png`,
      fullPage: true,
    });
    for (const size of [16, 32]) {
      await page.locator("#sprite-size").selectOption(String(size));
      await expect(garden).toHaveAttribute("data-size", String(size));
      await expect(page.locator("#sheet-link")).toHaveAttribute("href", `${character}-${size}.png`);
      // Every directional card must use the selected character's real source row.
      await expect
        .poll(() =>
          page.locator("canvas[data-row]").evaluateAll(
            async (canvases, { size, character }) => {
              const image = new Image();
              image.src = `${character}-${size}.png`;
              await image.decode();
              return canvases.every((element) => {
                const canvas = element as HTMLCanvasElement;
                const expected = document.createElement("canvas");
                expected.width = expected.height = size;
                expected
                  .getContext("2d")
                  ?.drawImage(
                    image,
                    0,
                    Number(canvas.dataset.row) * size,
                    size,
                    size,
                    0,
                    0,
                    size,
                    size,
                  );
                return canvas.toDataURL() === expected.toDataURL();
              });
            },
            { size, character },
          ),
        )
        .toBe(true);
    }
    await page.setViewportSize({ width: 360, height: 800 });
    await page.screenshot({ path: `test-results/${character}-gallery-phone.png`, fullPage: true });
    await page.locator("#sprite-size").selectOption("16");
    await page.locator("#native-scale").check();
    await expect(front).toHaveCSS("width", "16px");
    await page.screenshot({
      path: `test-results/${character}-gallery-native16-phone.png`,
      fullPage: true,
    });
    await page.locator("#character").selectOption("cat");
    await expect(garden).toHaveAttribute("data-character", "cat");
    await expect(page.locator("#error")).toBeHidden();
  });
}

for (const character of ["cat", "dog", "person", "squirrel", "bear"]) {
  test(`${character} keyboard movement covers every direction, stops on release and resets`, async ({
    page,
  }) => {
    await page.goto(url);
    const garden = page.locator("#garden");
    await expect(garden).toHaveAttribute("data-ready", "true");
    await page.locator("#character").selectOption(character);
    await expect(garden).toHaveAttribute("data-character", character);
    await garden.focus();
    for (const [key, facing, axis, sign] of [
      ["ArrowRight", "right", "x", 1],
      ["a", "left", "x", -1],
      ["ArrowDown", "down", "y", 1],
      ["w", "up", "y", -1],
    ] as const) {
      const before = Number(await garden.getAttribute(`data-${axis}`));
      await page.keyboard.down(key);
      await expect(garden).toHaveAttribute("data-facing", facing);
      await expect
        .poll(async () => (Number(await garden.getAttribute(`data-${axis}`)) - before) * sign)
        .toBeGreaterThan(2);
      if (["person", "squirrel", "bear"].includes(character) && key === "ArrowRight") {
        // Real movement must advance through every exported walk pose before looping.
        for (const frame of [1, 2, 3, 0])
          await expect(garden).toHaveAttribute("data-frame", String(frame));
      }
      await page.keyboard.up(key);
      await expect(page.locator("#status")).toHaveText(`Standing ${facing}`);
      const stopped = await garden.getAttribute(`data-${axis}`);
      await page.waitForTimeout(150);
      expect(await garden.getAttribute(`data-${axis}`)).toBe(stopped);
    }
    await page.locator("#reset").click();
    await expect(garden).toHaveAttribute("data-x", "192.00");
    await expect(garden).toHaveAttribute("data-y", "146.00");
    await expect(garden).toHaveAttribute("data-facing", "down");
  });
}

for (const character of ["squirrel", "bear"]) {
  test(`${character} native16 walk plays all four poses at the default four fps`, async ({
    page,
  }) => {
    await page.goto(url);
    const garden = page.locator("#garden");
    await expect(garden).toHaveAttribute("data-ready", "true");
    await page.locator("#character").selectOption(character);
    await expect(garden).toHaveAttribute("data-character", character);
    await page.locator("#sprite-size").selectOption("16");
    await expect(garden).toHaveAttribute("data-size", "16");
    await garden.focus();
    await page.keyboard.down("ArrowLeft");
    await expect(garden).toHaveAttribute("data-facing", "left");
    for (const frame of [1, 2, 3, 0])
      await expect(garden).toHaveAttribute("data-frame", String(frame));
    await page.keyboard.up("ArrowLeft");
    await expect(page.locator("#status")).toHaveText("Standing left");
    await expect(garden).toHaveAttribute("data-frame", "0");
  });
}

test("touch movement releases cleanly and the small mobile layout fits", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 360, height: 800 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto(url);
  const garden = page.locator("#garden");
  await expect(garden).toHaveAttribute("data-ready", "true");
  await expect(garden).toHaveAttribute("data-x", /\d/);
  const before = Number(await garden.getAttribute("data-x"));
  const button = page.getByRole("button", { name: "Walk right" });
  await button.scrollIntoViewIfNeeded();
  const bounds = await button.boundingBox();
  if (!bounds) throw new Error("Missing touch control");
  const session = await context.newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }],
  });
  await expect(garden).toHaveAttribute("data-facing", "right");
  await expect
    .poll(async () => Number(await garden.getAttribute("data-x")) - before)
    .toBeGreaterThan(2);
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(page.locator("#status")).toHaveText("Standing right");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(button).toBeVisible();
  await page.locator("#animate").uncheck();
  await page.screenshot({ path: "test-results/pixel-characters-phone.png", fullPage: true });
  await page.locator("#native-scale").check();
  await page.locator("#sprite-size").selectOption("16");
  await expect(page.locator('canvas[data-row="0"]')).toHaveCSS("width", "16px");
  await page.screenshot({
    path: "test-results/pixel-characters-native16-phone.png",
    fullPage: true,
  });
  await context.close();
});

test("failed sprite loads give a visible error and disable the preview", async ({ page }) => {
  await page.route("**/pixel-characters/cat-32.png", (route) =>
    route.fulfill({ status: 404, body: "missing" }),
  );
  await page.goto(url);
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Reload the gallery");
  await expect(page.locator("#garden")).toHaveAttribute("data-ready", "false");
  await expect(page.locator("#downloads")).toBeHidden();
});
