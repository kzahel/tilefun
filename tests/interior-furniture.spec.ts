import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { furnitureSignature } from "../src/interiors/FurnishedInterior.js";
import { furnitureReviewCases } from "../src/interiors/review/FurnitureReviewCases.js";

test("furniture review preserves layered placements and hashes the clean image plus catalog metadata", async ({
  page,
}) => {
  const baseline = JSON.parse(
    readFileSync("tests/fixtures/interior-approved/fingerprints.json", "utf8"),
  ) as { id: string; fp: string; name: string }[];
  const records: Record<string, unknown>[] = baseline.map((r, i) => ({
    id: `good-${i}`,
    caseId: r.id,
    name: r.name,
    sketch: "",
    fingerprint: r.fp,
    verdict: "good",
    note: "",
    createdAt: "2026-09-29T00:00:00Z",
  }));
  const posts: Record<string, unknown>[] = [];
  await page.route("**/api/interior-review", async (route) => {
    if (route.request().method() === "POST") {
      const row = route.request().postDataJSON();
      posts.push(row);
      records.push(row);
      await route.fulfill({ json: { saved: true } });
    } else await route.fulfill({ json: records });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tilefun/interior-review.html?stage=15&unchecked=1");
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.locator('#stage option[value="all"]')).toHaveText(
    "Small → complex — 8 unchecked",
  );
  await expect(page.locator("#case-id")).toHaveText("furniture-bedside");
  await expect(page.locator("#furniture-tools")).toBeVisible();
  const image = await page.locator("#render").evaluate((el) => {
    const c = el as HTMLCanvasElement;
    return {
      width: c.width,
      height: c.height,
      displayWidth: c.getBoundingClientRect().width,
      pixels: Array.from(c.getContext("2d")?.getImageData(0, 0, c.width, c.height).data ?? []),
    };
  });
  expect(image.width).toBe(128);
  expect(image.displayWidth).toBe(256);
  const fixture = furnitureReviewCases()[0];
  if (!fixture?.furniture) throw new Error("Missing fixture");
  const expected = createHash("sha256")
    .update(
      `${fixture.sketch}\n${image.width},${image.height}\n${furnitureSignature(fixture.furniture)}`,
    )
    .update(Buffer.from(image.pixels))
    .digest("hex");
  const plan = page.locator("#plan");
  await expect(plan).toContainText("🛏️");
  await page.locator("#furniture-plan").uncheck();
  await expect(plan).not.toContainText("🛏️");
  await page.locator("#furniture-plan").check();
  const clean = await page
    .locator("#render")
    .evaluate((el) => (el as HTMLCanvasElement).toDataURL());
  await page.locator("#footprints").check();
  await expect(page.locator("#footprint-legend")).toBeVisible();
  expect(
    await page.locator("#render").evaluate((el) => (el as HTMLCanvasElement).toDataURL()),
  ).not.toBe(clean);
  await page.locator("#furniture-tools summary").click();
  await expect(page.locator("#furniture-list")).toContainText("Table lamp on bedside table");
  await page.locator("#good").click();
  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0]?.fingerprint).toBe(expected);
  expect(posts[0]?.furniture).toEqual(fixture.furniture);
  expect(posts[0]?.furnitureCatalogVersion).toBe(1);
  await page.reload();
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.locator('#stage option[value="15"]')).toHaveText(
    "Furniture catalog — 7 unchecked",
  );
  await expect(page.locator("#case-id")).toHaveText("furniture-storage");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
