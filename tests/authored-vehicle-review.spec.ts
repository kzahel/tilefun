import { expect, test } from "@playwright/test";

test("retained ambulance review opens its own comparison from Workshop on desktop and phone", async ({
  page,
}) => {
  await page.goto("/tilefun/workshop.html#/review/projection%3Aauthored-ambulance-v1?show=all");
  await expect(page.getByRole("heading", { name: "Ambulance · authored model v1" })).toBeVisible();
  await page.getByRole("link", { name: "Open comparison" }).click();
  await expect(page).toHaveURL(/\/assets\/models\/vehicles\/review\/ambulance-v1\/$/);
  await expect(page.getByRole("heading", { name: "Ambulance v1", exact: true })).toBeVisible();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        page.evaluate(() =>
          [...document.images].every((image) => image.complete && image.naturalWidth),
        ),
      )
      .toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  const response = await page.request.get("/tilefun/assets/models/vehicles/ambulance-v1.glb");
  expect(response.ok()).toBe(true);
  expect((await response.body()).subarray(0, 4).toString()).toBe("glTF");
});
