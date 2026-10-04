import { expect, test } from "@playwright/test";

test.use({ channel: "chromium" });
test("GPU consumes the Canvas scene with retained textures and union clips", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/tilefun/renderer-lab.html");
  await expect(page.locator("#gpu")).toHaveAttribute("data-ready", "true");
  const report = () =>
    page
      .locator("#result")
      .textContent()
      .then((text) => JSON.parse(text ?? "{}"));
  expect((await report()).mismatches).toBe(0);
  const cold = await report();
  await page.evaluate(() =>
    (window as unknown as { rendererLab: { draw(): unknown } }).rendererLab.draw(),
  );
  expect((await report()).uploads).toBe(cold.uploads);
  await page.evaluate(() =>
    (
      window as unknown as { rendererLab: { setClips(value: boolean): unknown } }
    ).rendererLab.setClips(true),
  );
  expect((await report()).mismatches).toBe(0);
  await page.evaluate(() =>
    (
      window as unknown as { rendererLab: { changeTexture(): unknown } }
    ).rendererLab.changeTexture(),
  );
  expect((await report()).uploads).toBe(cold.uploads + 1);
  expect((await report()).mismatches).toBe(0);
  expect(errors).toEqual([]);
});

test("GPU host runs the shared game and retains the input/UI canvas", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/tilefun/?renderer=gpu");
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("#game")).toHaveAttribute("data-renderer", "gpu");
  await expect(page.locator("canvas[data-renderer=gpu][aria-hidden=true]")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(250);
  await page.keyboard.up("ArrowRight");
  expect(errors).toEqual([]);
});

test("optional mesh body rotates, composes in order and falls back atomically", async ({
  page,
}) => {
  await page.goto("/tilefun/renderer-lab.html");
  await expect(page.locator("#gpu")).toHaveAttribute("data-ready", "true");
  const report = () =>
    page
      .locator("#result")
      .textContent()
      .then((text) => JSON.parse(text ?? "{}"));
  await page.evaluate(() =>
    (
      window as unknown as { rendererLab: { setMesh(value: boolean): Promise<unknown> } }
    ).rendererLab.setMesh(true),
  );
  expect((await report()).meshDraws).toBe(1);
  expect((await report()).meshState).toBe("ready");
  const picture = () =>
    page.locator("#gpu").evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  const first = await picture();
  await page.evaluate(() =>
    (window as unknown as { rendererLab: { setYaw(value: number): unknown } }).rendererLab.setYaw(
      Math.PI / 4,
    ),
  );
  expect(await picture()).not.toBe(first);
  const angled = await picture();
  await page.evaluate(() =>
    (
      window as unknown as { rendererLab: { setForeground(value: boolean): unknown } }
    ).rendererLab.setForeground(true),
  );
  expect(await picture()).not.toBe(angled);
  const before = await report();
  await page.evaluate(() =>
    (
      window as unknown as { rendererLab: { setMesh(value: boolean): Promise<unknown> } }
    ).rendererLab.setMesh(false),
  );
  const after = await report();
  expect(after.meshDraws).toBe(before.meshDraws);
  expect(after.mismatches).toBe(0);
  expect(after.targetBytes).toBeLessThanOrEqual(1024 * 1024 * 8);
});

test("shared traffic scenario feeds the same GPU mesh path", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tilefun/workshop.html?renderer=gpu&meshes#/tool/traffic");
  const canvas = page.getByLabel("Generated traffic playground");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await expect
    .poll(() => canvas.getAttribute("data-mesh-draws").then((value) => Number(value)))
    .toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
