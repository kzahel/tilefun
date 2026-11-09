import { expect, test } from "@playwright/test";

test.use({ channel: "chromium" });
test("embedded GPU surface tracks scrolling/resizing, recovers context and leaves no canvas on exit", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/tilefun/workshop.html#/tool/traffic");
  const canvas = page.getByLabel("World geometry scene");
  const world = page.locator("canvas[data-renderer=gpu][aria-hidden=true]");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await expect(world).toHaveCount(1);
  const aligned = async () => {
    const [a, b] = await Promise.all([canvas.boundingBox(), world.boundingBox()]);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    for (const key of ["x", "y", "width", "height"] as const)
      expect(Math.abs((a?.[key] ?? 0) - (b?.[key] ?? 0))).toBeLessThan(1);
  };
  await aligned();
  await page.evaluate(() => window.scrollBy(0, 200));
  await aligned();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(aligned).toPass();
  const extension = await world.evaluateHandle((c: HTMLCanvasElement) =>
    c.getContext("webgl2")?.getExtension("WEBGL_lose_context"),
  );
  await extension.evaluate((e) => e?.loseContext());
  await expect(canvas).toHaveAttribute("data-gpu-device", "lost");
  await extension.evaluate((e) => e?.restoreContext());
  await expect(canvas).toHaveAttribute("data-gpu-device", "ready");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await extension.dispose();
  // Phone layout hides the desktop sidebar; change the SPA route without reload.
  await page.evaluate(() => {
    location.hash = "#/tools";
  });
  await expect(world).toHaveCount(0);
  expect(errors).toEqual([]);
});
