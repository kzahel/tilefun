import { expect, test } from "@playwright/test";
import { CITY_BUILDING_PREFABS } from "../src/generation/regional/CityBuildingPrefabs.js";

const URL = "/tilefun/building-lab.html";
test("composes every candidate through shared gameplay recipes and renderer", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(URL);
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  for (const prefab of CITY_BUILDING_PREFABS) {
    await page.locator("#prefab").selectOption(prefab.type);
    await expect(page.locator("#recipe-id")).toHaveText(prefab.type);
    await expect(page.locator("#building")).toHaveAttribute(
      "data-parts",
      String(prefab.parts.length),
    );
    const alpha = await page.locator("#building").evaluate((el) => {
      const c = el as HTMLCanvasElement;
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("No canvas");
      const pixels = ctx.getImageData(0, 0, c.width, c.height).data;
      let count = 0;
      for (let i = 0; i < pixels.length; i += 4)
        if (pixels[i] !== 32 || pixels[i + 1] !== 48 || pixels[i + 2] !== 42) count++;
      return count;
    });
    expect(alpha).toBeGreaterThan(1000);
    if (
      ["prop-city-v1-condo-bay-3", "prop-city-v1-bakery-3", "prop-city-v1-hotel-3"].includes(
        prefab.type,
      )
    )
      await page.screenshot({ path: `/tmp/tilefun-${prefab.type}.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
});
for (const scene of ["residential", "mixed", "hotel"]) {
  test(`shared ${scene} frontage and recipe navigation`, async ({ page }) => {
    await page.goto(`${URL}?scene=${scene}`);
    await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
    expect(Number(await page.locator("#building").getAttribute("data-prefabs"))).toBeGreaterThan(1);
    await page.locator("#geometry").check();
    await page.screenshot({ path: `/tmp/tilefun-city-block-${scene}.png`, fullPage: true });
    const label = await page.locator("#block-buildings button").nth(1).textContent();
    await page.locator("#block-buildings button").nth(1).click();
    await expect(page.locator("#scene")).toHaveValue("single");
    await expect(page.locator("#name")).toHaveText(label ?? "");
    const url = page.url();
    await page.reload();
    expect(page.url()).toBe(url);
    await expect(page.locator("#source-link")).toHaveAttribute(
      "href",
      /art-workbench.html\?sheet=me-complete&rect=/,
    );
  });
}
test("phone building showcase and workbench links fit without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${URL}?scene=mixed`);
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/tilefun-city-block-phone.png", fullPage: true });
});
