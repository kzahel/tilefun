import { expect, test } from "@playwright/test";

test.use({ channel: "chromium" });
type Pose = {
  id: number;
  type: string;
  x: number;
  y: number;
  z: number;
  clip: number;
  visible: boolean;
};
for (const renderer of ["canvas", "gpu"]) {
  for (const animal of ["rabbit", "robin", "meerkat"]) {
    test(`${animal} production behavior and reload (${renderer})`, async ({ page }) => {
      test.setTimeout(90_000);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(
        `/tilefun/workshop.html?geometry=nature-behavior-${animal}&renderer=${renderer}#/tool/world-geometry`,
      );
      const canvas = page.getByLabel("Natural landscape playground");
      await expect(canvas).toHaveAttribute("data-ready", "true");
      await expect(page.getByLabel("Landscape zoom")).toHaveValue(
        animal === "rabbit" ? "2" : animal === "robin" ? "1" : "1.4",
      );
      const poses = async (): Promise<Pose[]> =>
        JSON.parse((await canvas.getAttribute("data-work-actors")) ?? "[]");
      await expect
        .poll(async () => {
          const animals = (await poses()).filter((p) => p.type.includes(animal));
          return animals.length > 0 && animals.every((p) => p.visible);
        })
        .toBe(true);
      const action = animal === "rabbit" ? 3 : 4;
      await expect
        .poll(
          async () => (await poses()).some((p) => p.type.includes(animal) && p.clip === action),
          { timeout: 30_000, intervals: [50] },
        )
        .toBe(true);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await expect(canvas).toHaveAttribute("data-authority-running", "false");
      const before = (await poses()).filter((p) => p.type.includes(animal));
      expect(before.every((p) => p.visible)).toBe(true);
      await canvas.screenshot({ path: `data/wildlife-157-${animal}-action-${renderer}.png` });
      await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
      await expect(canvas).toHaveAttribute("data-reload-count", "1");
      const stable = (values: Pose[]) =>
        values
          .filter((p) => p.type.includes(animal))
          .map((p) => ({ type: p.type, x: p.x, y: p.y, z: p.z, clip: p.clip }))
          .sort((a, b) => a.x - b.x || a.y - b.y);
      expect(stable(await poses())).toEqual(stable(before));
      await page.getByRole("button", { name: "Resume", exact: true }).click();
      if (animal === "meerkat") {
        await page.getByRole("button", { name: "Place tiger nearby", exact: true }).click();
        await expect
          .poll(async () => (await poses()).some((p) => p.type.includes(animal) && p.clip === 5), {
            timeout: 30_000,
            intervals: [30],
          })
          .toBe(true);
        await canvas.screenshot({ path: `data/wildlife-157-${animal}-alarm-${renderer}.png` });
        await expect
          .poll(
            async () =>
              (await poses()).filter((p) => p.type.includes(animal) && p.clip === 3).length,
            { timeout: 20_000, intervals: [30] },
          )
          .toBeGreaterThanOrEqual(2);
      } else {
        await expect
          .poll(
            async () =>
              !(await poses()).some((p) =>
                p.type.includes(animal === "rabbit" ? "resource-greens" : "resource-seed"),
              ),
            { timeout: 45_000, intervals: [50] },
          )
          .toBe(true);
        if (animal === "robin")
          await expect
            .poll(
              async () =>
                (await poses()).some(
                  (p) => p.type.includes("robin") && p.z > 20 && p.clip === 0 && p.visible,
                ),
              { timeout: 20_000 },
            )
            .toBe(true);
        await canvas.screenshot({ path: `data/wildlife-157-${animal}-complete-${renderer}.png` });
      }
      expect(errors).toEqual([]);
    });
  }
}

test("animal browser exposes all behavior demonstrations", async ({ page }) => {
  await page.goto("/tilefun/workshop.html?geometry=nature-behavior-rabbit#/tool/world-geometry");
  await page.getByLabel("Behavior progress").selectOption("demonstrations");
  await expect(page.getByRole("button", { name: "Demonstrate behavior", exact: true })).toHaveCount(
    11,
  );
  await page.getByLabel("Behavior progress").selectOption("verified");
  await expect(page.getByRole("button", { name: "Demonstrate behavior", exact: true })).toHaveCount(
    11,
  );
});
