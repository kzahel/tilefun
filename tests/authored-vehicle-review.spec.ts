import { expect, test } from "@playwright/test";

import { AUTHORED_REVIEW_REVISIONS } from "../tests-support/AuthoredVehicleReview.fixture.js";

for (const { asset, revision, name } of AUTHORED_REVIEW_REVISIONS)
  test(`retained ${asset} ${revision} review opens its own comparison from Workshop on desktop and phone`, async ({
    page,
  }) => {
    await page.goto(
      `/tilefun/workshop.html#/review/projection%3Aauthored-${asset}-${revision}?show=all`,
    );
    await expect(
      page.getByRole("heading", { name: `${name} · authored model ${revision}` }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Open comparison" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/assets/models/vehicles/review/${asset}-${revision}/$`),
    );
    await expect(
      page.getByRole("heading", { name: new RegExp(`^${name} ${revision}$`, "i") }),
    ).toBeVisible();
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
  });
