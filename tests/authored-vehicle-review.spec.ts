import { expect, test } from "@playwright/test";

for (const { asset, revision, name } of [
  { asset: "ambulance", revision: "v1", name: "Ambulance" },
  { asset: "ambulance", revision: "v2", name: "Ambulance" },
  { asset: "police-car", revision: "v1", name: "Police car" },
  { asset: "fire-truck-ladder-1", revision: "v1", name: "Fire truck · stowed ladder" },
  { asset: "fire-truck-ladder-1", revision: "v2", name: "Fire truck · stowed ladder" },
  { asset: "garbage-truck-green", revision: "v1", name: "Green garbage truck" },
  { asset: "compact-3", revision: "v1", name: "Cyan compact" },
  { asset: "compact-5", revision: "v1", name: "Orange compact" },
  { asset: "compact-6", revision: "v1", name: "Silver compact" },
  { asset: "unindexed-sedan-red", revision: "v1", name: "Red sedan" },
  { asset: "unindexed-sedan-beige", revision: "v1", name: "Beige sedan" },
  { asset: "unindexed-sedan-cyan", revision: "v1", name: "Cyan sedan" },
  { asset: "unindexed-sedan-orange", revision: "v1", name: "Orange sedan" },
  { asset: "unindexed-sedan-silver", revision: "v1", name: "Silver sedan" },
  { asset: "unindexed-sedan-olive", revision: "v1", name: "Olive sedan" },
  { asset: "unindexed-sedan-dark", revision: "v1", name: "Dark sedan" },
])
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
    const response = await page.request.get(
      `/tilefun/assets/models/vehicles/${asset}-${revision}.glb`,
    );
    expect(response.ok()).toBe(true);
    expect((await response.body()).subarray(0, 4).toString()).toBe("glTF");
  });
