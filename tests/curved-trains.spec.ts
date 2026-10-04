import { expect, test } from "@playwright/test";

test.use({ channel: "chromium" });
for (const backend of ["canvas", "gpu"]) {
  test(`curved trains turn, reload and reverse through the real Worker (${backend})`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `/tilefun/workshop.html?geometry=train-loop&renderer=${backend}#/tool/world-geometry`,
    );
    const c = page.getByLabel("World geometry scene");
    await expect(c).toHaveAttribute("data-ready", "true");
    await expect(c).toHaveAttribute("data-carriage-count", "3");
    await expect(c).toHaveAttribute(
      "data-carriage-sources",
      "Exterior_Train_Blue_Left,Exterior_Train_Blue_Middle,Exterior_Train_Blue_Right",
    );
    await page.getByLabel("Train camera").selectOption("follow");
    await expect
      .poll(
        async () => {
          const poses = JSON.parse(
            (await c.getAttribute("data-carriage-poses")) ?? "[]",
          ) as number[][];
          return poses.some((p) => (p[2] ?? 0) % 64 > 15 && (p[2] ?? 0) % 64 < 50);
        },
        { timeout: 25000 },
      )
      .toBe(true);
    await expect(c).toHaveAttribute("data-carriage-sources", /Train_Blue_.*_Down/);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(c).toHaveAttribute("data-train-camera", "follow");
    let last = "",
      stable = 0;
    await expect
      .poll(
        async () => {
          const pose = (await c.getAttribute("data-carriage-poses")) ?? "";
          stable = pose === last ? stable + 1 : 0;
          last = pose;
          return stable;
        },
        { intervals: [100] },
      )
      .toBeGreaterThanOrEqual(3);
    const before = await c.getAttribute("data-carriage-poses");
    await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
    await expect(c).toHaveAttribute("data-reload-count", "1");
    await expect(c).toHaveAttribute("data-carriage-poses", before ?? "");
    await page.screenshot({ path: `/tmp/tilefun-train-corner-${backend}.png`, fullPage: true });
    await page.getByLabel("Train camera").selectOption("overview");
    await expect(c).toHaveAttribute("data-train-camera", "overview");
    await page.screenshot({ path: `/tmp/tilefun-train-loop-${backend}.png`, fullPage: true });
    await page.getByRole("button", { name: "Run opposite direction" }).click();
    await expect(c).toHaveAttribute("data-ready", "true");
    await expect(c).toHaveAttribute("data-train-heading", "192");
    await page.getByLabel("Geometry fixture").selectOption("train-winding");
    await expect(c).toHaveAttribute("data-ready", "true");
    await expect(c).toHaveAttribute("data-carriage-count", "3");
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.screenshot({ path: `/tmp/tilefun-train-winding-${backend}.png`, fullPage: true });
    await page.getByRole("link", { name: "All tools", exact: true }).click();
    await expect.poll(() => page.workers().length).toBe(0);
    expect(errors).toEqual([]);
  });
}
test("town loop fits a phone and its controls suppress long taps", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await page.goto("/tilefun/workshop.html?geometry=train-loop#/tool/world-geometry");
    await expect(page.getByLabel("World geometry scene")).toHaveAttribute("data-ready", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const reverse = page.getByRole("button", { name: "Run opposite direction" });
    await expect(reverse).toHaveCSS("user-select", "none");
    expect(
      await reverse.evaluate((el) =>
        el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })),
      ),
    ).toBe(false);
    await page.screenshot({ path: "/tmp/tilefun-train-loop-phone.png", fullPage: true });
  } finally {
    await context.close();
  }
});
