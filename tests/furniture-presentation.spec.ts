import { expect, test } from "@playwright/test";

test.use({ channel: "chromium" });
for (const renderer of ["canvas", "gpu"]) {
  test(`furniture ${renderer} shares presentation, captures the room and retires old sessions`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const reports: { screenshot: string; playtest: { playerX: number } }[] = [];
    await page.route("**/api/interior-review", (route) => {
      if (route.request().method() === "POST") reports.push(route.request().postDataJSON());
      return route.fulfill({ json: route.request().method() === "GET" ? [] : { saved: true } });
    });
    await page.goto(`/tilefun/furniture-playtest.html?renderer=${renderer}&scene=wardrobe`);
    const ready = page.locator('#app[data-ready="true"]');
    const canvas = page.locator("#room");
    await expect(ready).toBeVisible();
    await expect(canvas).toHaveAttribute("data-renderer", renderer);
    const workers = () => page.workers().filter((w) => w.url().includes("scenario.worker"));
    await expect.poll(() => workers().length).toBe(1);
    await canvas.focus();
    await page.keyboard.down("ArrowRight");
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-player-x")))
      .toBeGreaterThan(85);
    await page.keyboard.up("ArrowRight");
    await page.locator("#home").click();
    await expect(ready).toBeVisible();
    await expect(canvas).toHaveAttribute("data-player-x", "80.000");
    for (const scene of ["bunk", "worktable", "wardrobe"]) {
      const old = workers()[0];
      await page.locator("#scene").selectOption(scene);
      await expect(ready).toBeVisible();
      await expect.poll(() => workers().length).toBe(1);
      expect(workers()[0]).not.toBe(old);
      await expect(page.locator("#viewport canvas")).toHaveCount(renderer === "gpu" ? 2 : 1);
      expect(new URL(page.url()).searchParams.get("renderer")).toBe(renderer);
    }
    const worker = workers()[0];
    await page.setViewportSize({ width: 390, height: 844 });
    await canvas.scrollIntoViewIfNeeded();
    if (renderer === "gpu") {
      await expect
        .poll(async () => {
          const b = await page.locator('#viewport canvas[aria-hidden="true"]').boundingBox();
          return [b?.x, b?.y, b?.width, b?.height];
        })
        .toEqual(await canvas.boundingBox().then((b) => [b?.x, b?.y, b?.width, b?.height]));
    }
    expect(workers()[0]).toBe(worker);
    await page.locator("#collisions").uncheck();
    await page.locator("#report").click();
    await expect.poll(() => reports.length).toBe(1);
    expect(reports[0]?.playtest.playerX).toBe(80);
    // A GPU UI canvas alone is transparent here; the saved room must be opaque
    // and contain atlas color variation, as well as the player.
    const pixels = await page.evaluate(async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d");
      if (!ctx) throw Error("Missing capture context");
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let opaque = 0;
      const colors = new Set<string>();
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 255) opaque++;
        colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
      }
      return { opaque, area: c.width * c.height, colors: colors.size };
    }, reports[0]?.screenshot ?? "");
    expect(pixels.opaque).toBe(pixels.area);
    expect(pixels.colors).toBeGreaterThan(30);
    await page.locator("#viewport").screenshot({ path: `/tmp/tilefun-furniture-${renderer}.png` });
    await page.goto("about:blank");
    await expect.poll(() => workers().length).toBe(0);
    expect(errors).toEqual([]);
  });
}
