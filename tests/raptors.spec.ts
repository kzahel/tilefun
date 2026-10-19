import { expect, test } from "@playwright/test";
import { RAPTOR_PROFILES } from "../src/wildlife/Raptors.js";

test.use({ channel: "chromium" });
for (const animal of RAPTOR_PROFILES)
  for (const renderer of ["canvas", "gpu"]) {
    test(`${animal.species} browser action, visible swoop and durable meal (${renderer})`, async ({
      page,
    }) => {
      test.setTimeout(60_000);
      await page.goto(
        `/tilefun/workshop.html?geometry=nature-tiger&renderer=${renderer}#/tool/world-geometry`,
      );
      await page.getByLabel("Find animal", { exact: true }).fill(animal.label);
      const card = page.locator(`[data-animal="${animal.species}"]`),
        preview = card.locator("canvas");
      await expect(preview).toHaveAttribute("data-ready", "true");
      await page.getByLabel("Preview animation", { exact: true }).selectOption("action");
      await expect(preview).toHaveAttribute("data-clip", "display");
      const frame = await preview.getAttribute("data-frame");
      await expect.poll(() => preview.getAttribute("data-frame")).not.toBe(frame);
      await card.getByRole("button", { name: "Watch AI", exact: true }).click();
      const stage = page.getByLabel("Natural landscape playground");
      await expect(stage).toHaveAttribute("data-ready", "true");
      await expect(page.getByLabel("Follow selected animal", { exact: true })).toBeChecked();
      const poses = async () =>
        JSON.parse((await stage.getAttribute("data-predator-poses")) ?? "[]") as {
          clip: number;
          z: number;
          x: number;
          y: number;
        }[];
      await expect
        .poll(async () => (await poses())[0]?.clip, { timeout: 15000, intervals: [30] })
        .toBe(6);
      await expect
        .poll(async () => (await poses())[0]?.z ?? 0, { intervals: [30] })
        .toBeGreaterThan(3);
      await stage.screenshot({ path: `data/wildlife-147-${animal.species}-${renderer}-swoop.png` });
      await expect
        .poll(async () => (await poses())[0]?.clip, { timeout: 25000, intervals: [30] })
        .toBe(2);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      const before = await poses();
      expect(
        Number(await stage.getAttribute("data-deer-count")) +
          Number(await stage.getAttribute("data-rabbit-count")),
      ).toBe(1);
      await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
      await expect(stage).toHaveAttribute("data-reload-count", "1");
      expect((await poses())[0]?.clip).toBe(2);
      expect((await poses())[0]?.x).toBeCloseTo(before[0]?.x ?? NaN, 3);
      expect((await poses())[0]?.y).toBeCloseTo(before[0]?.y ?? NaN, 3);
      await stage.screenshot({ path: `data/wildlife-147-${animal.species}-${renderer}-feed.png` });
    });
  }
