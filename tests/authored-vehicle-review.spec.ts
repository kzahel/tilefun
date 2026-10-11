import { expect, test } from "@playwright/test";

for (const { asset, revision, name } of [
  { asset: "ambulance", revision: "v3", name: "Ambulance" },
  { asset: "police-car", revision: "v2", name: "Police car" },
  { asset: "garbage-truck-orange", revision: "v1", name: "Orange garbage truck" },
  { asset: "fire-truck-ladder-2", revision: "v1", name: "Fire truck · raised ladder" },
  { asset: "car-7", revision: "v1", name: "Car 7" },
  { asset: "car-8", revision: "v1", name: "Car 8" },
  { asset: "car-9", revision: "v1", name: "Car 9" },
  { asset: "car-10", revision: "v1", name: "Car 10" },
  { asset: "car-11", revision: "v1", name: "Car 11" },
  { asset: "sedan-12", revision: "v1", name: "Beige sedan 12" },
  { asset: "car-13", revision: "v1", name: "Car 13" },
  { asset: "car-14", revision: "v1", name: "Car 14" },
  { asset: "car-15", revision: "v1", name: "Car 15" },
  { asset: "car-16", revision: "v1", name: "Car 16" },
  { asset: "car-17", revision: "v1", name: "Car 17" },
  { asset: "car-18", revision: "v1", name: "Car 18" },
  { asset: "car-19", revision: "v1", name: "Car 19" },
  { asset: "car-20", revision: "v1", name: "Car 20" },
  { asset: "car-21", revision: "v1", name: "Car 21" },
  { asset: "car-22", revision: "v1", name: "Car 22" },
  { asset: "car-23", revision: "v1", name: "Car 23" },
  { asset: "car-24", revision: "v1", name: "Car 24" },
  { asset: "car-25", revision: "v1", name: "Car 25" },
  { asset: "car-26", revision: "v1", name: "Car 26" },
  { asset: "bus-1", revision: "v1", name: "Bus 1" },
  { asset: "bus-2", revision: "v1", name: "Bus 2" },
  { asset: "bus-3", revision: "v1", name: "Bus 3" },
  { asset: "bus-4", revision: "v1", name: "Bus 4" },
  { asset: "bus-5", revision: "v1", name: "Bus 5" },
  { asset: "bus-6", revision: "v1", name: "Bus 6" },
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
