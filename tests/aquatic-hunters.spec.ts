import { expect, test } from "@playwright/test";
import { AQUATIC_HUNTER_PROFILES } from "../src/wildlife/AquaticHunters.js";
import { faunaType } from "../src/wildlife/Fauna.js";
import { predatorType } from "../src/wildlife/Predator.js";

test.use({ channel: "chromium" });
for (const p of AQUATIC_HUNTER_PROFILES)
  for (const renderer of ["canvas", "gpu"]) {
    test(`${p.species} hunts in its real lagoon and saves feeding phase (${renderer})`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(
        `/tilefun/workshop.html?geometry=nature-${p.species}&landscape=thicket&renderer=${renderer}#/tool/world-geometry`,
      );
      const canvas = page.getByLabel("Natural landscape playground");
      await expect(canvas).toHaveAttribute("data-ready", "true");
      await expect(page.getByLabel("Landscape zoom")).toHaveValue("0.4");
      const poses = async () =>
        (
          JSON.parse((await canvas.getAttribute("data-predator-poses")) ?? "[]") as {
            type: string;
            clip: number;
            frame: number;
            x: number;
            y: number;
            z: number;
          }[]
        ).filter((e) => e.type === predatorType(p.species));
      const fish = async () =>
        (
          JSON.parse((await canvas.getAttribute("data-food-web-actors")) ?? "[]") as {
            type: string;
          }[]
        ).filter((e) => e.type === faunaType("fish")).length;
      await expect.poll(async () => (await poses()).length).toBe(1);
      const population = await fish();
      expect(population).toBeGreaterThanOrEqual(3);
      await expect
        .poll(async () => (await poses())[0]?.clip, { timeout: 25000, intervals: [30] })
        .toBe(2);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await expect(canvas).toHaveAttribute("data-authority-running", "false");
      const before = await poses();
      expect(before[0]?.z).toBe(0);
      const remaining = await fish();
      expect(remaining).toBeLessThan(population);
      await canvas.screenshot({
        path: `data/wildlife-147/${p.species}/${p.revision}/lagoon-${renderer}.png`,
      });
      await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
      await expect(canvas).toHaveAttribute("data-reload-count", "1");
      const after = await poses();
      expect(after[0]?.clip).toBe(2);
      expect(after[0]?.frame).toBe(before[0]?.frame);
      expect(after[0]?.x).toBeCloseTo(before[0]?.x ?? NaN, 3);
      expect(after[0]?.y).toBeCloseTo(before[0]?.y ?? NaN, 3);
      expect(await fish()).toBe(remaining);
      expect(errors).toEqual([]);
    });
  }
