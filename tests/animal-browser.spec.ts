import { expect, test } from "@playwright/test";
import { CONTINUATION_BIRD_PROFILES } from "../src/wildlife/ContinuationBirds.js";
import {
  DISTINCT_FISH_FAUNA_PROFILES,
  DISTINCT_FISH_HUNTER_PROFILES,
} from "../src/wildlife/DistinctFish.js";
import {
  FOREST_HUNTER_PROFILES,
  FOREST_SPECIALIST_PROFILES,
} from "../src/wildlife/ForestSpecialists.js";
import { GREAT_APE_PROFILES } from "../src/wildlife/GreatApes.js";
import { GROUND_PRIMATE_PROFILES } from "../src/wildlife/GroundPrimates.js";
import { GROUND_SPECIALIST_PROFILES } from "../src/wildlife/GroundSpecialists.js";
import { REPTILE_HUNTER_PROFILES } from "../src/wildlife/ReptileHunters.js";
import { SEABIRD_PROFILES } from "../src/wildlife/Seabirds.js";
import { TALL_BIRD_PROFILES } from "../src/wildlife/TallBirds.js";
import { ANIMAL_BROWSER_ENTRIES } from "../src/workshop/AnimalBrowserData.js";

test.use({ channel: "chromium" });
test("browses animated animals by name, family and dates, then runs their real AI scene", async ({
  page,
}) => {
  await page.goto(
    "/tilefun/workshop.html?geometry=nature-tiger&landscape=balanced#/tool/world-geometry",
  );
  const browser = page.locator(".animal-browser"),
    results = page.getByRole("region", { name: "Animal results" });
  await expect(browser).toBeVisible();
  await expect(results.locator("article")).toHaveCount(ANIMAL_BROWSER_ENTRIES.length);
  const added = await results
    .locator("time")
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("datetime") ?? ""));
  expect(added).toEqual([...added].sort().reverse());
  await page.getByLabel("Sort animals", { exact: true }).selectOption("name");
  const names = await results.locator("h3").allTextContents();
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  await page.getByLabel("Find animal", { exact: true }).fill("tiger");
  await expect(results.locator("article")).toHaveCount(1);
  const preview = results.locator("canvas");
  await expect(preview).toHaveAttribute("data-ready", "true");
  const frame = await preview.getAttribute("data-frame");
  await expect.poll(() => preview.getAttribute("data-frame")).not.toBe(frame);
  await page.getByLabel("Animate previews", { exact: true }).uncheck();
  await expect(preview).toHaveAttribute("data-frame", "0");
  await page.getByLabel("Preview animation", { exact: true }).selectOption("action");
  await page.getByLabel("Preview facing", { exact: true }).selectOption("3");
  await expect(preview).toHaveAttribute("data-ready", "true");
  await page.getByLabel("Find animal", { exact: true }).fill("");
  await page.getByLabel("Animal family", { exact: true }).selectOption("Primates");
  await expect(results.locator("article")).toHaveCount(
    ANIMAL_BROWSER_ENTRIES.filter((animal) => animal.family === "Primates").length,
  );
  await results
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "Silverback gorilla", exact: true }) })
    .getByRole("button", { name: "Watch AI", exact: true })
    .click();
  await expect(page.getByLabel("Landscape scene", { exact: true })).toHaveValue("gorilla");
  await expect(page.getByLabel("Natural landscape playground")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect(page).toHaveURL(/geometry=nature-gorilla/);
  await expect(page.getByLabel("Follow selected animal", { exact: true })).toBeChecked();
  await expect
    .poll(async () =>
      JSON.parse(
        (await page.getByLabel("Natural landscape playground").getAttribute("data-fauna-poses")) ??
          "[]",
      ).some((e: { species: string; visible: boolean }) => e.species === "gorilla" && e.visible),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
  await expect(page.getByLabel("Natural landscape playground")).toHaveAttribute(
    "data-reload-count",
    "1",
  );
  await page.screenshot({ path: "data/animal-browser-lab.png", fullPage: true });
});

test("mobile animal search fits the viewport and opens a hunting scene", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tilefun/workshop.html?geometry=nature-forest#/tool/world-geometry");
  await page.getByLabel("Find animal", { exact: true }).fill("t. rex");
  const results = page.getByRole("region", { name: "Animal results" });
  await expect(results.locator("article")).toHaveCount(1);
  await expect(results.locator("canvas")).toHaveAttribute("data-ready", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await results.getByRole("button", { name: "Watch AI", exact: true }).click();
  await expect(page.getByLabel("Landscape scene", { exact: true })).toHaveValue("t-rex");
  await expect(page.getByLabel("Natural landscape playground")).toHaveAttribute(
    "data-ready",
    "true",
  );
});

for (const [facing, direction] of ["Front", "Back", "Left", "Right"].entries()) {
  test(`every animal has a visible animated locomotion preview facing ${direction}`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.goto(
      "/tilefun/workshop.html?geometry=nature-tiger&landscape=balanced#/tool/world-geometry",
    );
    await page.getByLabel("Preview facing", { exact: true }).selectOption(String(facing));
    const search = page.getByLabel("Find animal", { exact: true });
    for (const animal of ANIMAL_BROWSER_ENTRIES) {
      expect(
        animal.locomotion?.count,
        `${animal.name} has an authored travel clip`,
      ).toBeGreaterThan(1);
      await search.fill(animal.name);
      const canvas = page.locator(`[data-animal="${animal.id}"] canvas`);
      await canvas.scrollIntoViewIfNeeded();
      await expect(canvas, animal.name).toHaveAttribute("data-ready", "true");
      await expect(canvas, animal.name).toHaveAttribute("data-clip", animal.locomotion?.name ?? "");
      const before = await canvas.evaluate((c) => {
        const ctx = (c as HTMLCanvasElement).getContext("2d");
        const pixels = ctx?.getImageData(
          0,
          0,
          (c as HTMLCanvasElement).width,
          (c as HTMLCanvasElement).height,
        ).data;
        return {
          image: (c as HTMLCanvasElement).toDataURL(),
          visible: pixels?.some((v, i) => i % 4 === 3 && v > 0),
        };
      });
      expect(before.visible, `${animal.name} paints visible pixels`).toBe(true);
      await expect
        .poll(() => canvas.evaluate((c) => (c as HTMLCanvasElement).toDataURL()), {
          message: `${animal.name} ${direction} travel pixels advance`,
          timeout: 5000,
          intervals: [40, 80, 120],
        })
        .not.toBe(before.image);
    }
  });
}

for (const animal of [
  ...CONTINUATION_BIRD_PROFILES,
  ...GREAT_APE_PROFILES,
  ...GROUND_PRIMATE_PROFILES,
  ...DISTINCT_FISH_FAUNA_PROFILES,
  ...GROUND_SPECIALIST_PROFILES,
  ...SEABIRD_PROFILES,
  ...TALL_BIRD_PROFILES,
  ...FOREST_SPECIALIST_PROFILES,
]) {
  test(`${animal.species} opens from the browser as visible moving natural wildlife`, async ({
    page,
  }) => {
    await page.goto(
      "/tilefun/workshop.html?geometry=nature-tiger&landscape=balanced#/tool/world-geometry",
    );
    await page.getByLabel("Find animal", { exact: true }).fill(animal.label);
    const card = page.locator(`[data-animal="${animal.species}"]`);
    await expect(card.locator("canvas")).toHaveAttribute("data-ready", "true");
    if (!animal.hop) {
      await page.getByLabel("Preview animation", { exact: true }).selectOption("action");
      await expect(card.locator("canvas")).toHaveAttribute("data-clip", "action");
      const frame = await card.locator("canvas").getAttribute("data-frame");
      await expect.poll(() => card.locator("canvas").getAttribute("data-frame")).not.toBe(frame);
    }
    await card.getByRole("button", { name: "Watch AI", exact: true }).click();
    await expect(page.getByLabel("Landscape scene", { exact: true })).toHaveValue(animal.species);
    const stage = page.getByLabel("Natural landscape playground");
    await expect(stage).toHaveAttribute("data-ready", "true");
    const poses = async () =>
      (
        JSON.parse((await stage.getAttribute("data-fauna-poses")) ?? "[]") as {
          species: string;
          visible: boolean;
          x: number;
          y: number;
          z: number;
        }[]
      ).filter((p) => p.species === animal.species);
    await expect.poll(async () => (await poses()).some((p) => p.visible)).toBe(true);
    const before = await poses();
    await expect
      .poll(
        async () =>
          (await poses()).some(
            (p) =>
              p.visible &&
              (animal.hop ? p.z > 2 : p.z === 0) &&
              before.some((b) => Math.hypot(b.x - p.x, b.y - p.y) > 1),
          ),
        { timeout: 12000, intervals: [30] },
      )
      .toBe(true);
    await page.screenshot({ path: `data/wildlife-147-${animal.species}-lab.png` });
  });
}

for (const animal of [
  ...DISTINCT_FISH_HUNTER_PROFILES,
  ...REPTILE_HUNTER_PROFILES,
  ...FOREST_HUNTER_PROFILES,
]) {
  test(`${animal.species} browser display opens a real moving shared hunter`, async ({ page }) => {
    await page.goto(
      "/tilefun/workshop.html?geometry=nature-tiger&landscape=balanced#/tool/world-geometry",
    );
    await page.getByLabel("Find animal", { exact: true }).fill(animal.label);
    const card = page.locator(`[data-animal="${animal.species}"]`),
      preview = card.locator("canvas");
    await page.getByLabel("Preview animation", { exact: true }).selectOption("action");
    await expect(preview).toHaveAttribute("data-ready", "true");
    await expect(preview).toHaveAttribute("data-clip", "display");
    const frame = await preview.getAttribute("data-frame");
    await expect.poll(() => preview.getAttribute("data-frame")).not.toBe(frame);
    await card.getByRole("button", { name: "Watch AI", exact: true }).click();
    const stage = page.getByLabel("Natural landscape playground");
    await expect(stage).toHaveAttribute("data-ready", "true");
    await expect(page.getByLabel("Landscape scene", { exact: true })).toHaveValue(animal.species);
    const poses = async () =>
      (
        JSON.parse((await stage.getAttribute("data-predator-poses")) ?? "[]") as {
          type: string;
          frame: number;
          x: number;
          y: number;
        }[]
      ).filter((p) => p.type === `wildlife-${animal.species}-predator-v1`);
    await expect.poll(async () => (await poses()).length).toBe(1);
    const before = await poses();
    await expect
      .poll(
        async () =>
          (await poses()).some(
            (p) => p.frame > 4 && before.some((b) => Math.hypot(b.x - p.x, b.y - p.y) > 1),
          ),
        { timeout: 15000, intervals: [30] },
      )
      .toBe(true);
    await page.screenshot({ path: `data/wildlife-147-${animal.species}-lab.png` });
  });
}
