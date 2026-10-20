import { expect, test } from "@playwright/test";

test("game-camera vehicle fit is registered and opens its frozen grounded comparisons", async ({
  page,
}) => {
  await page.goto("/tilefun/workshop.html#/review/authored-vehicle-game-fit-v2?show=all");
  await expect(
    page.getByRole("heading", { name: "All vehicles · game-camera fit v2" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open comparison" }).click();
  await expect(page.getByRole("heading", { name: "Vehicle game-camera fit v2" })).toBeVisible();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        page.evaluate(() => [...document.images].every((i) => i.complete && i.naturalWidth)),
      )
      .toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});
