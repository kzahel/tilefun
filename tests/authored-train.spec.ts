import { expect, test } from "@playwright/test";

test.use({ channel: "chromium" });
test("blue train exact review opens its 4×2 and both retained motion comparisons", async ({
  page,
}) => {
  await page.goto("/tilefun/assets/models/trains/review/blue-v3/");
  for (const name of [
    "Four original train compositions",
    "Native train beside authored train",
    "Existing service stops and reverses",
  ]) {
    const image = page.getByRole("img", { name: new RegExp(name) });
    await expect(image).toBeVisible();
    await expect
      .poll(() => image.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0))
      .toBe(true);
  }
  const review = await page.request.get("/tilefun/assets/models/trains/review/blue-v3/review.json");
  const capture = await review.json();
  expect(capture.candidateId).toBe("projection:authored-blue-train-v3");
  await page.goto("/tilefun/workshop.html#/review/projection%3Aauthored-blue-train-v3?show=all");
  await expect(
    page.getByRole("heading", { name: "Blue train · three authored carriages v3", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open comparison" }).click();
  await expect(page).toHaveURL(/assets\/models\/trains\/review\/blue-v3\/$/);
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
