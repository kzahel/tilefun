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
  await expect(page.locator("#character option")).toHaveCount(registry.characters.length);
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

test("character selector switches registry records without needing gallery code changes", async ({
  page,
}) => {
  // A second test-only catalog record exercises future additions without publishing unfinished art.
  const response = await page.request.get(`${url}characters.json`);
  const registry = await response.json();
  const cat = registry.characters.find((record: { id: string }) => record.id === "cat");
  registry.characters.push({
    ...cat,
    id: "cat-test-study",
    name: "Cat test study",
    description: "Selector fixture",
  });
  await page.route("**/pixel-characters/characters.json", (route) =>
    route.fulfill({ json: registry }),
  );
  await page.goto(url);
  const garden = page.locator("#garden");
  await expect(garden).toHaveAttribute("data-ready", "true");
  await page.locator("#character").selectOption("cat-test-study");
  await expect(garden).toHaveAttribute("data-character", "cat-test-study");
  await expect(page.locator("#description")).toHaveText("Selector fixture");
  await page.locator("#character").selectOption("cat");
  await expect(garden).toHaveAttribute("data-character", "cat");
  await expect(page.locator("#error")).toBeHidden();
});

test("keyboard movement covers every direction, stops on release and resets", async ({ page }) => {
  await page.goto(url);
  const garden = page.locator("#garden");
  await expect(garden).toHaveAttribute("data-ready", "true");
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
