import { expect, test } from "@playwright/test";

test.use({ channel: "chromium" });
type Pose = {
  id: number;
  type: string;
  x: number;
  y: number;
  z: number;
  clip: number;
  parent: number;
  visible: boolean;
};
for (const animal of ["capuchin", "raccoon", "cat"]) {
  test(`${animal} action pixels, real Worker and saved pose`, async ({ page }) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `/tilefun/workshop.html?geometry=nature-behavior-${animal}#/tool/world-geometry`,
    );
    const canvas = page.getByLabel("Natural landscape playground");
    await expect(canvas).toHaveAttribute("data-ready", "true");
    await canvas.scrollIntoViewIfNeeded();
    const poses = async (): Promise<Pose[]> =>
      JSON.parse((await canvas.getAttribute("data-work-actors")) ?? "[]");
    const species = animal === "capuchin" ? "capuchin-monkey" : animal;
    await expect
      .poll(
        async () => {
          const all = await poses(),
            a = all.find((p) => p.type === `wildlife-${species}-provisional-v1`);
          if (!a?.visible) return false;
          return animal === "capuchin"
            ? a.clip === 4 && a.z > 6 && a.z < 31
            : animal === "raccoon"
              ? all.some((p) => p.parent === a.id)
              : a.clip === 5 && a.z > 1;
        },
        { timeout: 35000, intervals: [30] },
      )
      .toBe(true);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-authority-running", "false");
    const before = (await poses()).filter((p) => p.type === `wildlife-${species}-provisional-v1`);
    await canvas.screenshot({ path: `data/wildlife-161-${animal}.png` });
    await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-reload-count", "1");
    const stable = (rows: Pose[]) =>
      rows
        .filter((p) => p.type === `wildlife-${species}-provisional-v1`)
        .map(({ x, y, z, clip, type }) => ({ x, y, z, clip, type }));
    expect(stable(await poses())).toEqual(stable(before));
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await expect
      .poll(
        async () => {
          const all = await poses(),
            a = all.find((p) => p.type === `wildlife-${species}-provisional-v1`);
          return (
            !!a?.visible &&
            (animal === "capuchin"
              ? // Crown traversal is deferred by the 205 physics reset: a canopy
                // blocks the climb, which times out and falls back to the ground.
                a.clip !== 4 && Math.abs(a.z) < 0.5
              : animal === "raccoon"
                ? a.clip === 5 && a.y < 120
                : a.clip === 6)
          );
        },
        { timeout: 35000, intervals: [30] },
      )
      .toBe(true);
    await canvas.screenshot({ path: `data/wildlife-161-${animal}-outcome.png` });
    expect(errors).toEqual([]);
  });
}
