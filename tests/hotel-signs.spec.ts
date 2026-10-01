import { expect, test } from "@playwright/test";
import type { ArtNote } from "../src/art/ArtNotes.js";
import { buildingVisualBounds } from "../src/generation/regional/BuildingRecipes.js";
import {
  CITY_BUILDING_PREFABS,
  hotelPrefabType,
} from "../src/generation/regional/CityBuildingPrefabs.js";

const URL = "/tilefun/building-lab.html";
for (const floors of [3, 4, 6]) {
  test(`hotel ${floors}: full top and optional sign pixels survive switching and reload`, async ({
    page,
  }) => {
    await page.route("**/tilefun/api/art-notes", (route) => route.fulfill({ json: [] }));
    await page.goto(`${URL}?scene=single&prefab=${hotelPrefabType(floors, "none")}`);
    await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
    for (const sign of ["none", "roof", "side"] as const) {
      const type = hotelPrefabType(floors, sign);
      const prefab = CITY_BUILDING_PREFABS.find((p) => p.type === type);
      if (!prefab) throw new Error("Missing hotel recipe");
      await page.locator("#hotel-sign").selectOption(sign);
      await expect(page.locator("#prefab")).toHaveValue(type);
      await expect(page).toHaveURL(new RegExp(`prefab=${type}$`));
      await page.reload();
      await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
      await expect(page.locator("#hotel-sign")).toHaveValue(sign);
      const bounds = buildingVisualBounds(prefab);
      const pieces = prefab.parts.filter(
        (p) => p.frameRow * 16 === 1824 || p.frameRow * 16 === 1744 || p.frameCol * 16 === 2192,
      );
      const result = await page.locator("#building").evaluate(
        async (el, { bounds, pieces }) => {
          const canvas = el as HTMLCanvasElement;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Missing preview context");
          const image = await createImageBitmap(
            await (await fetch("assets/tilesets/me-complete.png")).blob(),
          );
          const source = new OffscreenCanvas(image.width, image.height);
          const src = source.getContext("2d");
          if (!src) throw new Error("Missing source context");
          src.drawImage(image, 0, 0);
          image.close();
          const baseline = canvas.height - 128;
          let checked = 0;
          const failures: string[] = [];
          for (const p of pieces) {
            for (let y = 0; y < p.spriteHeight; y += 4)
              for (let x = 0; x < p.spriteWidth; x += 4) {
                // The optional rooftop base deliberately covers the center
                // parapet. Check exposed roof art and the sign itself.
                if (
                  pieces.some((s) => s.frameRow * 16 === 1744) &&
                  p.frameRow * 16 === 1824 &&
                  x >= 64 &&
                  x < 208 &&
                  y < 24
                )
                  continue;
                const expected = [
                  ...src.getImageData(p.frameCol * 16 + x, p.frameRow * 16 + y, 1, 1).data,
                ];
                if (expected[3] !== 255) continue;
                const destX = (p.dx - p.spriteWidth / 2 + x - bounds.minX + 24) * 2;
                const destY = baseline + (p.dy - p.spriteHeight + y) * 2;
                for (const dx of [0, 1])
                  for (const dy of [0, 1]) {
                    const actual = [...ctx.getImageData(destX + dx, destY + dy, 1, 1).data];
                    checked++;
                    if (JSON.stringify(actual) !== JSON.stringify(expected))
                      failures.push(`${x},${y}: ${actual} vs ${expected}`);
                  }
              }
          }
          // Above the left column is atlas gutter, not a car accessory.
          const roof = pieces.find((p) => p.frameRow * 16 === 1824);
          if (!roof) throw new Error("Missing hotel top");
          for (let y = 0; y < 16; y += 4)
            for (let x = 0; x < 16; x += 4) {
              const actual = [
                ...ctx.getImageData(
                  (-136 + x - bounds.minX + 24) * 2,
                  baseline + (roof.dy - 48 + y) * 2,
                  1,
                  1,
                ).data,
              ];
              if (JSON.stringify(actual) !== JSON.stringify([32, 48, 42, 255]))
                failures.push(`Contaminated roof gutter: ${actual}`);
            }
          // The detached panels are omitted. The rooftop sign can cover
          // part of the left panel's old location; sample the exposed areas.
          for (const panelX of [-88, 72])
            for (let y = 0; y < 16; y += 4)
              for (let x = 0; x < 32; x += 4) {
                if (pieces.some((s) => s.frameRow * 16 === 1744) && panelX === -88 && x >= 16)
                  continue;
                const actual = [
                  ...ctx.getImageData(
                    (panelX + x - bounds.minX + 24) * 2,
                    baseline + (roof.dy - 48 + y) * 2,
                    1,
                    1,
                  ).data,
                ];
                if (JSON.stringify(actual) !== JSON.stringify([32, 48, 42, 255]))
                  failures.push(`Detached roof panel: ${actual}`);
              }
          return { checked, failures };
        },
        { bounds, pieces },
      );
      expect(result.checked).toBeGreaterThan(1000);
      expect(result.failures).toEqual([]);
      if (floors === 3)
        await page.locator("#building").screenshot({ path: `/tmp/tilefun-hotel-${sign}.png` });
    }
    await page.locator("#prefab").selectOption("prop-city-v1-condo-bay-3");
    await expect(page.locator("#hotel-options")).toBeHidden();
  });
}

test("hotel sign variants own their drafts and approvals; mobile review stays in view", async ({
  page,
}) => {
  const saved: ArtNote[] = [];
  await page.route("**/tilefun/api/art-notes", async (route) => {
    if (route.request().method() === "POST") {
      saved.push(route.request().postDataJSON());
      return route.fulfill({ json: { saved: true } });
    }
    return route.fulfill({ json: saved });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${URL}?scene=single&prefab=${hotelPrefabType(3, "none")}`);
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await page.locator("#building-note").fill("No sign draft");
  await page.locator("#hotel-sign").selectOption("side");
  await expect(page.locator("#building-note")).toHaveValue("");
  await page.locator("#building-note").fill("Side sign review");
  await page.locator("#hotel-sign").selectOption("none");
  await expect(page.locator("#building-note")).toHaveValue("No sign draft");
  await page.locator("#hotel-sign").selectOption("side");
  await expect(page.locator("#building-note")).toHaveValue("Side sign review");
  for (const id of ["hotel-sign", "building", "approve-building", "reject-building"]) {
    const b = await page.locator(`#${id}`).boundingBox();
    expect(b?.y).toBeGreaterThanOrEqual(0);
    expect((b?.y ?? 1000) + (b?.height ?? 0)).toBeLessThanOrEqual(844);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/tilefun-hotel-review-phone.png", fullPage: true });
  await page.locator("#approve-building").click();
  await expect(page.locator("#queue-sync")).toHaveText("Server inbox up to date.");
  expect(saved[0]?.buildingReview?.prefabIds).toEqual([hotelPrefabType(3, "side")]);
  expect(saved[0]?.rect).toEqual([1904, 1824, 336, 464]);
  await page.locator("#prefab").selectOption(hotelPrefabType(3, "side"));
  await expect(page.locator("#review-verdict")).toContainText("Approved");
  await page.locator("#hotel-sign").selectOption("roof");
  await expect(page.locator("#review-verdict")).toContainText("Unchecked");
  await page.locator("#hotel-sign").selectOption("none");
  await expect(page.locator("#review-verdict")).toContainText("Unchecked");
});
