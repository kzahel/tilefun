import { expect, test } from "@playwright/test";
import { PREDATOR_PROFILES } from "../src/wildlife/Predator.js";

test.use({ channel: "chromium" });
for (const p of PREDATOR_PROFILES.filter((p) => p.expansion?.habitat !== "deep"))
  for (const renderer of ["canvas", "gpu"]) {
    test(`${p.species} hunts and reloads its meal in the shared Worker lab (${renderer})`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(
        `/tilefun/workshop.html?geometry=nature-${p.species}&renderer=${renderer}#/tool/world-geometry`,
      );
      const canvas = page.getByLabel("Natural landscape playground");
      await expect(canvas).toHaveAttribute("data-ready", "true");
      const poses = async () =>
        JSON.parse((await canvas.getAttribute("data-predator-poses")) ?? "[]") as {
          clip: number;
          x: number;
          y: number;
        }[];
      await expect.poll(async () => (await poses()).length).toBe(1);
      await expect
        .poll(async () => (await poses())[0]?.clip, { timeout: 20000, intervals: [30] })
        .toBe(2);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await expect(canvas).toHaveAttribute("data-authority-running", "false");
      const before = await poses();
      const preyBefore =
        Number(await canvas.getAttribute("data-deer-count")) +
        Number(await canvas.getAttribute("data-rabbit-count"));
      expect(preyBefore).toBe(1);
      await canvas.screenshot({ path: `data/predators-132/${p.species}-${renderer}.png` });
      await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
      await expect(canvas).toHaveAttribute("data-reload-count", "1");
      expect((await poses())[0]?.clip).toBe(2);
      expect((await poses())[0]?.x).toBeCloseTo(before[0]?.x ?? NaN, 3);
      expect((await poses())[0]?.y).toBeCloseTo(before[0]?.y ?? NaN, 3);
      expect(
        Number(await canvas.getAttribute("data-deer-count")) +
          Number(await canvas.getAttribute("data-rabbit-count")),
      ).toBe(1);
      expect(errors).toEqual([]);
    });
  }
