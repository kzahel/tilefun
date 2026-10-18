import { expect, test } from "@playwright/test";
import { FIERCE_PROFILES } from "../src/wildlife/FierceCreatures.js";

test.use({ channel: "chromium" });
for (const p of FIERCE_PROFILES)
  for (const renderer of ["canvas", "gpu"]) {
    test(`${p.species} displays, sounds its warning, charges and feeds (${renderer})`, async ({
      page,
    }, testInfo) => {
      await page.goto(
        `/tilefun/workshop.html?geometry=nature-${p.species}&renderer=${renderer}#/tool/world-geometry`,
      );
      const canvas = page.getByLabel("Natural landscape playground");
      await expect(canvas).toHaveAttribute("data-ready", "true");
      await page.getByRole("button", { name: "Enable creature sounds", exact: true }).click();
      const poses = async () =>
        JSON.parse((await canvas.getAttribute("data-predator-poses")) ?? "[]") as {
          clip: number;
          x: number;
          y: number;
          z: number;
        }[];
      await expect
        .poll(async () => (await poses())[0]?.clip, { timeout: 10000, intervals: [20] })
        .toBe(3);
      const warning = (await poses())[0];
      await expect
        .poll(async () => Number(await canvas.getAttribute("data-creature-calls")))
        .toBeGreaterThan(0);
      await canvas.screenshot({ path: testInfo.outputPath("warning.png") });
      if (p.fierce?.kind === "griffin") {
        await expect
          .poll(async () => (await poses())[0]?.clip, { timeout: 10000, intervals: [20] })
          .toBe(6);
        expect((await poses())[0]?.z).toBeGreaterThan(8);
        await canvas.screenshot({ path: testInfo.outputPath("swoop.png") });
      }
      await expect
        .poll(async () => (await poses())[0]?.clip, { timeout: 10000, intervals: [20] })
        .toBe(4);
      await expect
        .poll(async () => (await poses())[0]?.clip, { timeout: 20000, intervals: [30] })
        .toBe(2);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      const fed = (await poses())[0];
      expect(
        Math.hypot((fed?.x ?? 0) - (warning?.x ?? 0), (fed?.y ?? 0) - (warning?.y ?? 0)),
      ).toBeGreaterThan(10);
      await canvas.screenshot({ path: testInfo.outputPath("feeding.png") });
      if (["dragon", "griffin", "spider"].includes(p.fierce?.kind ?? "")) {
        const dens = JSON.parse((await canvas.getAttribute("data-fierce-dens")) ?? "[]");
        expect(dens).toHaveLength(1);
        expect(dens[0]?.type).toBe(
          p.fierce?.kind === "dragon"
            ? "prop-dragon-hoard"
            : p.fierce?.kind === "griffin"
              ? "prop-griffin-perch"
              : "prop-spider-web",
        );
        await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
        await expect(canvas).toHaveAttribute("data-reload-count", "1");
        expect(JSON.parse((await canvas.getAttribute("data-fierce-dens")) ?? "[]")).toEqual(dens);
      }
      await page.getByText("Who can eat whom?", { exact: true }).click();
      await expect(
        page
          .getByRole("row")
          .filter({ has: page.getByRole("cell", { name: "T. rex", exact: true }) }),
      ).toContainText("dire wolf");
    });
  }
