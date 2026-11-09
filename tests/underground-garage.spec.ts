import { expect, type Locator, test } from "@playwright/test";

test.use({ channel: "chromium" });

// Rapier rests bodies within its allowed contact error, so a supported height
// differs from the surface by a small fraction of a pixel.
const expectHeight = (c: Locator, z: number, attribute = "data-player-z") =>
  expect.poll(async () => Number(await c.getAttribute(attribute))).toBeCloseTo(z, 2);

test(`garage descends through terrain, reloads underground and preserves the street`, async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`/tilefun/workshop.html?geometry=garage#/tool/world-geometry`);
  const canvas = page.getByLabel("World geometry scene");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await expect(page.getByLabel("Geometry fixture")).toHaveValue("garage");
  await canvas.focus();
  await page.keyboard.down("ArrowRight");
  await expect(canvas).toHaveAttribute("data-space", "garage", { timeout: 8000 });
  // Space membership changes before the whole footprint clears the ramp.
  // Keep walking until prediction and authority both reach the flat floor.
  await expectHeight(canvas, -48);
  await expectHeight(canvas, -48, "data-server-z");
  await page.keyboard.up("ArrowRight");
  await expect(canvas).toHaveAttribute("data-server-space", "garage");
  await page.getByRole("button", { name: "garage", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-player-x", "80");
  await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-space", "garage");
  await expectHeight(canvas, -48);
  await canvas.screenshot({ path: `/tmp/tilefun-garage-underground.png` });
  await canvas.focus();
  // Record the displayed jump height in the browser. Cross-process polling
  // can miss the entire short ceiling-limited jump on a software GPU runner.
  const jump = await canvas.evaluateHandle((element) => {
    const sample = () => Number(element.getAttribute("data-player-z"));
    const probe = { maxZ: sample(), observer: null as MutationObserver | null };
    probe.observer = new MutationObserver(() => {
      probe.maxZ = Math.max(probe.maxZ, sample());
    });
    probe.observer.observe(element, {
      attributes: true,
      attributeFilter: ["data-player-z"],
    });
    return probe;
  });
  try {
    await page.keyboard.down("Space");
    await expect.poll(() => jump.evaluate((probe) => probe.maxZ)).toBeGreaterThan(-30);
    await page.keyboard.up("Space");
    await expectHeight(canvas, -48);
    expect(await jump.evaluate((probe) => probe.maxZ)).toBeLessThanOrEqual(-20 + 0.001);
  } finally {
    await jump.evaluate((probe) => probe.observer?.disconnect());
    await jump.dispose();
  }
  await page.getByRole("button", { name: "street", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-player-x", "80");
  await expectHeight(canvas, 0);
  await expect(canvas).toHaveAttribute("data-space", "outside");
  await canvas.screenshot({ path: `/tmp/tilefun-garage-street.png` });
  await page.getByLabel("Visible surfaces").selectOption("lower");
  await expect(canvas).toHaveAttribute("data-visibility", "lower");
  await expectHeight(canvas, 0);
  await page.getByRole("button", { name: "garage", exact: true }).click();
  await page.getByLabel("Visible surfaces").selectOption("auto");
  await canvas.focus();
  await page.keyboard.down("ArrowLeft");
  await expect(canvas).toHaveAttribute("data-space", "outside", { timeout: 8000 });
  await expectHeight(canvas, 0);
  await expectHeight(canvas, 0, "data-server-z");
  await page.keyboard.up("ArrowLeft");
  await page.getByLabel("Geometry fixture").selectOption("deck");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await expect(canvas).toHaveAttribute("data-player-x", "-216");
  await expect.poll(() => page.workers().length).toBe(1);
  await page.getByRole("link", { name: "All tools", exact: true }).click();
  await expect.poll(() => page.workers().length).toBe(0);
  expect(errors).toEqual([]);
});

test.describe("garage on a phone", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test("level controls fit and switch spaces with touch", async ({ page }) => {
    await page.goto("/tilefun/workshop.html?geometry=garage#/tool/world-geometry");
    const canvas = page.getByLabel("World geometry scene");
    await expect(canvas).toHaveAttribute("data-ready", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole("button", { name: "garage", exact: true }).tap();
    await expect(canvas).toHaveAttribute("data-space", "garage");
    await expectHeight(canvas, -48);
    await page.screenshot({ path: "/tmp/tilefun-garage-phone.png", fullPage: true });
    await page.getByRole("button", { name: "street", exact: true }).tap();
    await expect(canvas).toHaveAttribute("data-space", "outside");
    await expectHeight(canvas, 0);
  });
});
