import { expect, test } from "@playwright/test";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";
import { regionalWorld } from "../src/generation/regional/WorldDescriptor.js";
import { RailwayPlanner } from "../src/railway/RailwayPlanner.js";

// The new-world start platform and its line come from the production planner.
const planner = new RailwayPlanner(regionalWorld(2026));
const start = planner.start();
const line = planner
  .query({
    minX: (start?.x ?? 0) - 2,
    maxX: (start?.x ?? 0) + 2,
    minY: start?.y ?? 0,
    maxY: (start?.y ?? 0) + 6,
  })
  .find((l) => l.stations[0].x === start?.x);
if (!line) throw Error("Seed 2026 has no start line");
const [home, away] = line.stations;

test.use({ channel: "chromium" });
for (const phone of [false, true]) {
  test(`map shows production railways and named stops (${phone ? "phone" : "desktop"})`, async ({
    page,
  }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `/tilefun/?nogamepad&generation=${encodeURIComponent(JSON.stringify(createDescriptor("regional", 2026)))}`,
    );
    await page.getByRole("button", { name: "New World", exact: true }).click();
    await expect(page.getByTestId("world-menu")).toBeHidden();
    await expect(page.locator("#game")).toHaveAttribute(
      "data-generation",
      JSON.stringify(createDescriptor("regional", 2026)),
    );
    await page.getByRole("button", { name: "Open world map" }).click();
    const map = page.getByTestId("world-map");
    await expect(map).toHaveAttribute("data-settled", "true");
    expect(Number(await map.getAttribute("data-rail-lines"))).toBeGreaterThanOrEqual(1);
    const stops = map.getByRole("group", { name: "Train stops" });
    await expect(
      stops.getByRole("button", { name: `${home.town.name} station`, exact: true }),
    ).toBeVisible();
    await expect(
      stops.getByRole("button", { name: `${away.town.name} station`, exact: true }),
    ).toBeVisible();
    await expect(
      map.getByText("Purple dashed lines: railways · ◇: train stops", { exact: true }),
    ).toBeVisible();
    await stops.getByRole("button", { name: `${away.town.name} station`, exact: true }).click();
    await expect(map).toHaveAttribute("data-x", String(away.x));
    await expect(map).toHaveAttribute("data-y", String(away.y));
    await expect(map).toHaveAttribute("data-settled", "true");
    expect(
      await map.getByTestId("world-map-canvas").evaluate((node) => {
        const canvas = node as HTMLCanvasElement,
          ctx = canvas.getContext("2d");
        if (!ctx) throw Error("Missing map context");
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let purple = 0;
        for (let i = 0; i < pixels.length; i += 4)
          if (pixels[i] === 104 && pixels[i + 1] === 69 && pixels[i + 2] === 147) purple++;
        return purple;
      }),
    ).toBeGreaterThan(80);
    if (phone)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    await page.screenshot({ path: `/tmp/tilefun-rail-map-${phone ? "phone" : "desktop"}.png` });
    await page.keyboard.press("Escape");
    await expect(map).toBeHidden();
    await page.getByRole("button", { name: "Open world map" }).click();
    await expect(
      stops.getByRole("button", { name: `${away.town.name} station`, exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}
