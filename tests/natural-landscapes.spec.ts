import { expect, test } from "@playwright/test";

test.use({ channel: "chromium" });
for (const renderer of ["canvas", "gpu"]) {
  test(`ordinary explorer handoff creates patterned forests by default (${renderer})`, async ({
    page,
  }) => {
    await page.goto("/tilefun/world-explorer.html?seed=2026&x=-73&y=-425&zoom=16&mode=tiles");
    const app = page.locator("#app");
    await expect(app).toHaveAttribute("data-settled", "true");
    await expect(app).not.toHaveAttribute("data-error", /.+/);
    await expect(page.getByLabel("Landscape composition")).toHaveValue("");
    const ids: string[] = JSON.parse((await app.getAttribute("data-prop-ids")) ?? "[]");
    expect(ids.some((id) => id.startsWith("nature:thicket:"))).toBe(true);
    const link = await page
      .getByRole("link", { name: "Play here", exact: true })
      .getAttribute("href");
    if (!link) throw new Error("Missing game handoff");
    const url = new URL(link, page.url());
    url.searchParams.set("renderer", renderer);
    await page.goto(url.href);
    await page.getByPlaceholder("World name...").fill(`Default forest ${renderer}`);
    await page.getByRole("button", { name: "New World", exact: true }).click();
    await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
    await expect
      .poll(() =>
        page.evaluate(() => {
          const g = (
            document.querySelector("#game") as unknown as {
              __game: import("../src/client/GameClient.js").GameClient;
            }
          ).__game;
          return g.stateView.props.filter((p) => p.proceduralId?.startsWith("nature:thicket:"))
            .length;
        }),
      )
      .toBeGreaterThan(0);
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const g = (
              document.querySelector("#game") as unknown as {
                __game: import("../src/client/GameClient.js").GameClient;
              }
            ).__game;
            const p = g.stateView.playerEntity.position;
            const tx = Math.floor(p.wx / 16),
              ty = Math.floor(p.wy / 16);
            const cx = Math.floor(tx / 16),
              cy = Math.floor(ty / 16);
            const chunk = g.stateView.world.getChunkIfLoaded(cx, cy);
            return chunk?.blendBase[(ty - cy * 16) * 16 + tx - cx * 16];
          }),
        { timeout: 10000 },
      )
      .toBe(4);
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const g = (
              document.querySelector("#game") as unknown as {
                __game: import("../src/client/GameClient.js").GameClient;
              }
            ).__game;
            const range = g.camera.getVisibleChunkRange();
            for (let cy = range.minCy; cy <= range.maxCy; cy++)
              for (let cx = range.minCx; cx <= range.maxCx; cx++)
                if (!g.renderer.isTerrainReady(g.stateView.world.getChunkIfLoaded(cx, cy)))
                  return false;
            return true;
          }),
        { timeout: 10000 },
      )
      .toBe(true);
    await page.screenshot({ path: `/tmp/tilefun-default-forest-ready-${renderer}.png` });
  });
}
for (const renderer of ["canvas", "gpu"]) {
  test(`landscape lab shares Worker trees, walking, reload and train travel (${renderer})`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `/tilefun/workshop.html?geometry=nature-forest&landscape=balanced&renderer=${renderer}#/tool/world-geometry`,
    );
    const c = page.getByLabel("Natural landscape playground");
    await expect(c).toHaveAttribute("data-ready", "true");
    await expect.poll(async () => Number(await c.getAttribute("data-trees"))).toBeGreaterThan(30);
    const x = Number(await c.getAttribute("data-x"));
    await c.focus();
    await page.keyboard.down("ArrowRight");
    await expect.poll(async () => Number(await c.getAttribute("data-x"))).toBeGreaterThan(x + 10);
    await page.keyboard.up("ArrowRight");
    await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
    await expect(c).toHaveAttribute("data-reload-count", "1");
    await expect(c).toHaveAttribute("data-ready", "true");
    await expect(c).toHaveAttribute("data-ground-blend", "4");
    await expect(c).toHaveAttribute("data-terrain-pending", "0");
    await c.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `/tmp/tilefun-natural-forest-${renderer}.png`, fullPage: true });
    await page.getByLabel("Landscape composition").selectOption("thicket");
    await expect(c).toHaveAttribute("data-ready", "true");
    await page.getByLabel("Landscape scene").selectOption("pond");
    await expect(c).toHaveAttribute("data-ready", "true");
    await expect(c).toHaveAttribute("data-ground-blend", "4");
    await expect(c).toHaveAttribute("data-terrain-pending", "0");
    await c.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `/tmp/tilefun-natural-pond-${renderer}.png`, fullPage: true });
    await page.getByLabel("Landscape scene").selectOption("train");
    await expect(c).toHaveAttribute("data-ready", "true");
    await page.getByRole("button", { name: "Ride train roof", exact: true }).click();
    await expect(c).toHaveAttribute("data-train-x", /\d/);
    const start = Number(await c.getAttribute("data-train-x"));
    await expect
      .poll(async () => Math.abs(Number(await c.getAttribute("data-train-x")) - start), {
        timeout: 15000,
      })
      .toBeGreaterThan(60);
    await expect(c).toHaveAttribute("data-ground-blend", "4");
    await expect(c).toHaveAttribute("data-terrain-pending", "0");
    await c.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `/tmp/tilefun-natural-train-${renderer}.png`, fullPage: true });
    await page.getByRole("link", { name: "All tools", exact: true }).click();
    await expect.poll(() => page.workers().length).toBe(0);
    expect(errors).toEqual([]);
  });
}
for (const renderer of ["canvas", "gpu"]) {
  test(`native forest patterns render and block the player (${renderer})`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const kit of [1, 2, 3]) {
      await page.goto(
        `/tilefun/workshop.html?geometry=nature-thicket-${kit}&landscape=thicket&renderer=${renderer}#/tool/world-geometry`,
      );
      const c = page.getByLabel("Natural landscape playground");
      await expect(c).toHaveAttribute("data-ready", "true");
      await expect
        .poll(async () => Number(await c.getAttribute("data-thicket-rows")))
        .toBeGreaterThan(3);
      await expect(c).toHaveAttribute("data-ground-blend", "4");
      await expect(c).toHaveAttribute("data-terrain-pending", "0");
      await expect(page.getByRole("button", { name: "Looks good", exact: true })).toBeEnabled();
      if (kit === 1) {
        const start = Number(await c.getAttribute("data-y"));
        await c.focus();
        await page.keyboard.down("ArrowUp");
        await expect
          .poll(async () => Number(await c.getAttribute("data-y")))
          .toBeLessThan(start - 24);
        // Keep asking the real Worker to walk into the front, beyond free travel time.
        await page.waitForTimeout(1000);
        await page.keyboard.up("ArrowUp");
        expect(Number(await c.getAttribute("data-y"))).toBeGreaterThanOrEqual(-429 * 16);
      }
      await c.screenshot({ path: `/tmp/tilefun-thicket-${kit}-${renderer}.png` });
      await page.getByLabel("Landscape zoom").selectOption("0.4");
      await expect(c).toHaveAttribute("data-terrain-pending", "0");
      await c.screenshot({ path: `/tmp/tilefun-thicket-${kit}-${renderer}-wide.png` });
    }
    expect(errors).toEqual([]);
  });
}
test("explorer keeps composition in copied locations and exact tiles, with lab handoff", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    "/tilefun/world-explorer.html?seed=2026&x=-416&y=-512&zoom=16&landscape=balanced",
  );
  await expect(page.locator("#app")).toHaveAttribute("data-settled", "true");
  await expect(page.locator("#app")).not.toHaveAttribute("data-error", /.+/);
  await expect(page.getByLabel("Landscape composition")).toHaveValue("balanced");
  await expect(page.locator("#play-here")).toHaveAttribute("href", /geometry=nature-explore/);
  await page.screenshot({ path: "/tmp/tilefun-natural-explorer-tiles.png", fullPage: true });
  await page.getByLabel("Landscape composition").selectOption("sparse");
  await expect(page).toHaveURL(/landscape=sparse/);
  await expect(page.locator("#app")).toHaveAttribute("data-settled", "true");
  await page.goto("/tilefun/world-explorer.html?seed=2026&x=-350&y=-450&zoom=1&landscape=balanced");
  await expect(page.locator("#app")).toHaveAttribute("data-settled", "true");
  await page.screenshot({ path: "/tmp/tilefun-natural-explorer-map.png", fullPage: true });
  expect(errors).toEqual([]);
});

test.describe("phone landscape review", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test("offers usable controls and the exact registered review from the inbox", async ({
    page,
  }) => {
    await page.goto("/tilefun/workshop.html#/review/nature%3Apond%3Abalanced%3Av1");
    await page.getByRole("link", { name: "Open this playable review" }).click();
    const c = page.getByLabel("Natural landscape playground");
    await expect(c).toHaveAttribute("data-ready", "true");
    await expect(c).toHaveAttribute("data-ground-blend", "4");
    await expect(page.getByRole("button", { name: "Looks good", exact: true })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole("button", { name: "Pause", exact: true }).tap();
    await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeVisible();
    await page.screenshot({ path: "/tmp/tilefun-natural-phone.png", fullPage: true });
  });
});
