import { expect, test } from "@playwright/test";

test.use({ channel: "chromium" });
for (const renderer of ["canvas", "gpu"]) {
  test(`character ${renderer} host preserves gameplay, pose inspection and resource lifetime`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `/tilefun/workshop.html?renderer=${renderer}#/tool/character-lab?character=tiger`,
    );
    const canvas = page.getByLabel("Character movement test");
    await expect(canvas).toHaveAttribute("data-ready", "true");
    if (renderer === "gpu") await expect(canvas).toHaveAttribute("data-renderer", "gpu");
    const workers = () => page.workers().filter((w) => w.url().includes("scenario.worker"));
    await expect.poll(() => workers().length).toBe(1);
    const worker = workers()[0];
    await canvas.focus();
    await page.keyboard.down("ArrowRight");
    await expect.poll(async () => Number(await canvas.getAttribute("data-x"))).toBeGreaterThan(3);
    await page.keyboard.up("ArrowRight");
    await expect(canvas).toHaveAttribute("data-moving", "false");
    await expect(canvas).toHaveAttribute("data-camera-x", "0");
    await expect(canvas).toHaveAttribute("data-camera-y", "-12");
    await page.getByRole("button", { name: "Reset position", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-x", "0");
    await expect(canvas).toHaveAttribute("data-y", "8");
    await page.getByLabel("Cycle poses in place", { exact: false }).check();
    await expect(canvas).toHaveAttribute("data-mode", "poses");
    await expect.poll(() => canvas.getAttribute("data-frame")).not.toBe("0");
    await expect(canvas).toHaveAttribute("data-direction", "1");
    await expect(canvas).toHaveAttribute("data-x", "0");
    await expect(canvas).toHaveAttribute("data-y", "8");
    await page.getByLabel("Cycle poses in place", { exact: false }).uncheck();
    await expect(canvas).toHaveAttribute("data-moving", "false");
    await expect(canvas).toHaveAttribute("data-frame", "0");
    for (const zoom of ["1", "4", "2"]) {
      await page.getByLabel("Character zoom", { exact: true }).selectOption(zoom);
      await expect(canvas).toHaveAttribute("width", String(288 * Number(zoom)));
      expect(workers()[0]).toBe(worker);
    }
    await page.getByLabel("Physical height", { exact: true }).fill("19");
    await expect(canvas).toHaveAttribute("data-ready", "true");
    await expect.poll(() => workers().length).toBe(1);
    expect(workers()[0]).not.toBe(worker);
    await expect(page.locator(".character-scroll canvas")).toHaveCount(renderer === "gpu" ? 2 : 1);
    await page
      .locator(".character-scroll")
      .screenshot({ path: `/tmp/tilefun-character-${renderer}.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel("Character zoom", { exact: true }).selectOption("4");
    await page.locator(".character-scroll").evaluate((el) => {
      el.scrollLeft = 180;
    });
    if (renderer === "gpu") {
      await expect
        .poll(async () => {
          const world = await page
            .locator(".character-scroll canvas[aria-hidden=true]")
            .boundingBox();
          return [world?.x, world?.y, world?.width, world?.height];
        })
        .toEqual(await canvas.boundingBox().then((b) => [b?.x, b?.y, b?.width, b?.height]));
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    for (const character of ["cat", "bear", "tiger"]) {
      await page.getByLabel("Character", { exact: true }).selectOption(character);
      await expect(canvas).toHaveAttribute("data-ready", "true");
      await expect.poll(() => workers().length).toBe(1);
      await expect(page.locator(".character-scroll canvas")).toHaveCount(
        renderer === "gpu" ? 2 : 1,
      );
    }
    await page.getByRole("button", { name: "Toggle tool navigation", exact: true }).click();
    await page.getByRole("link", { name: "All tools", exact: true }).click();
    await expect.poll(() => workers().length).toBe(0);
    await expect(page.locator(".character-scroll canvas")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
