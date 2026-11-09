import { expect, test } from "@playwright/test";
import { FIERCE_PROFILES } from "../src/wildlife/FierceCreatures.js";

test.use({ channel: "chromium" });
// Behavior/audio/persistence only; wildlife drawing is covered by animal-browser
// and gpu-renderer specs.
for (const p of FIERCE_PROFILES)
  test(`${p.species} displays, sounds its warning, charges and feeds`, async ({
    page,
  }, testInfo) => {
    await page.goto(`/tilefun/workshop.html?geometry=nature-${p.species}#/tool/world-geometry`);
    const canvas = page.getByLabel("Natural landscape playground");
    await expect(canvas).toHaveAttribute("data-ready", "true");
    await page.getByRole("button", { name: "Enable creature sounds", exact: true }).click();
    // Record each published predator clip change. A slow software-GPU frame
    // or poll can otherwise alias the 1.28 s warning display and brief charge.
    // Only the scene canvas created by the reset below counts.
    await page.evaluate(() => {
      const seen = new Map<Element, { clip: number; x: number; y: number; z: number }[]>();
      Object.assign(window, { predatorClips: () => [...seen.values()].at(-1) ?? [] });
      new MutationObserver((records) => {
        for (const r of records) {
          const target = r.target as HTMLElement,
            first = JSON.parse(target.dataset.predatorPoses ?? "[]")[0];
          const clips = seen.get(target) ?? [];
          seen.set(target, clips);
          if (first && first.clip !== clips.at(-1)?.clip) clips.push(first);
        }
      }).observe(document.body, { subtree: true, attributeFilter: ["data-predator-poses"] });
    });
    // The warning starts immediately; restart after opting into sound, as in food-chain.
    const original = await canvas.elementHandle();
    await page.getByRole("button", { name: "Reset scene", exact: true }).click();
    await page.waitForFunction((old) => !old?.isConnected, original);
    await expect(canvas).toHaveAttribute("data-ready", "true");
    const poses = async () =>
      JSON.parse((await canvas.getAttribute("data-predator-poses")) ?? "[]") as {
        clip: number;
        x: number;
        y: number;
        z: number;
      }[];
    const history = () =>
      page.evaluate(() =>
        (
          window as unknown as {
            predatorClips: () => { clip: number; x: number; y: number; z: number }[];
          }
        ).predatorClips(),
      );
    const after = async (clip: number, previous = -1) => {
      const all = await history();
      const i = all.findIndex((p, index) => index > previous && p.clip === clip);
      return i < 0 ? undefined : { index: i, pose: all[i] };
    };
    await expect.poll(async () => (await after(3)) !== undefined, { timeout: 10000 }).toBe(true);
    const warning = await after(3);
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-creature-calls")))
      .toBeGreaterThan(0);
    await canvas.screenshot({ path: testInfo.outputPath("warning.png") });
    let previous = warning?.index ?? -1;
    if (p.fierce?.kind === "griffin") {
      await expect
        .poll(async () => (await after(6, previous)) !== undefined, { timeout: 10000 })
        .toBe(true);
      const swoop = await after(6, previous);
      expect(swoop?.pose?.z).toBeGreaterThan(8);
      previous = swoop?.index ?? previous;
      await canvas.screenshot({ path: testInfo.outputPath("swoop.png") });
    }
    await expect
      .poll(async () => (await after(4, previous)) !== undefined, { timeout: 10000 })
      .toBe(true);
    await expect
      .poll(async () => (await poses())[0]?.clip, { timeout: 20000, intervals: [30] })
      .toBe(2);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    const fed = (await poses())[0];
    expect(
      Math.hypot((fed?.x ?? 0) - (warning?.pose?.x ?? 0), (fed?.y ?? 0) - (warning?.pose?.y ?? 0)),
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
