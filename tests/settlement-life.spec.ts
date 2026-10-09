import { expect, test } from "@playwright/test";

test.use({ channel: "chromium" });
test.describe.configure({ mode: "parallel" });
for (const renderer of ["canvas", "gpu"]) {
  test(`connected farmstead contains farmhouse, crops and durable pasture (${renderer})`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `/tilefun/workshop.html?geometry=nature-farmstead&landscape=thicket&renderer=${renderer}#/tool/world-geometry`,
    );
    const c = page.getByLabel("Natural landscape playground");
    await expect(c).toHaveAttribute("data-ready", "true");
    await expect(c).toHaveAttribute("data-farm-house-count", "1");
    const poses = async () =>
      JSON.parse((await c.getAttribute("data-fauna-poses")) ?? "[]") as {
        id: number;
        species: string;
        x: number;
        y: number;
        clip: number;
        frame: number;
      }[];
    expect(
      (await poses()).filter((p) => ["cow", "sheep", "goat", "piglet"].includes(p.species)).length,
    ).toBeGreaterThanOrEqual(6);
    await expect
      .poll(async () => (await poses()).some((p) => p.clip === 1 && p.frame >= 3), {
        timeout: 12000,
      })
      .toBe(true);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(c).toHaveAttribute("data-authority-running", "false");
    const before = await poses();
    await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
    await expect(c).toHaveAttribute("data-reload-count", "1");
    await expect(c).toHaveAttribute("data-terrain-pending", "0");
    const after = await poses();
    expect(after.length).toBe(before.length);
    for (const p of before) {
      const r = after.find(
        (r) => r.species === p.species && Math.abs(r.x - p.x) < 0.01 && Math.abs(r.y - p.y) < 0.01,
      );
      expect(r?.x).toBeCloseTo(p.x, 3);
      expect(r?.y).toBeCloseTo(p.y, 3);
      expect(r?.clip).toBe(p.clip);
      expect(r?.frame).toBe(p.frame);
    }
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `/tmp/tilefun-farmstead-${renderer}.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
  for (const id of ["village-pets", "city-pets"]) {
    test(`${id} has moving saved cats and dogs (${renderer})`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(
        `/tilefun/workshop.html?geometry=nature-${id}&landscape=thicket&renderer=${renderer}#/tool/world-geometry`,
      );
      const c = page.getByLabel("Natural landscape playground");
      await expect(c).toHaveAttribute("data-ready", "true");
      await expect(c).toHaveAttribute("data-pet-count", "2");
      const poses = async () =>
        (
          JSON.parse((await c.getAttribute("data-fauna-poses")) ?? "[]") as {
            id: number;
            species: string;
            x: number;
            y: number;
            clip: number;
            frame: number;
          }[]
        ).filter((p) => ["cat", "dog"].includes(p.species));
      expect((await poses()).map((p) => p.species).sort()).toEqual(["cat", "dog"]);
      await expect
        .poll(async () => (await poses()).some((p) => p.clip === 1 && p.frame >= 3), {
          timeout: 12000,
        })
        .toBe(true);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await expect(c).toHaveAttribute("data-authority-running", "false");
      const before = await poses();
      await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
      await expect(c).toHaveAttribute("data-reload-count", "1");
      await expect(c).toHaveAttribute("data-terrain-pending", "0");
      const after = await poses();
      expect(after.length).toBe(before.length);
      for (const p of before) {
        const r = after.find(
          (r) =>
            r.species === p.species && Math.abs(r.x - p.x) < 0.01 && Math.abs(r.y - p.y) < 0.01,
        );
        expect(r?.x).toBeCloseTo(p.x, 3);
        expect(r?.y).toBeCloseTo(p.y, 3);
        expect(r?.clip).toBe(p.clip);
        expect(r?.frame).toBe(p.frame);
      }
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: `/tmp/tilefun-${id}-${renderer}.png`, fullPage: true });
      expect(errors).toEqual([]);
    });
  }
}
