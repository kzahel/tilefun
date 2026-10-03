import { writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { ArtNote } from "../src/art/ArtNotes.js";
import { COMMERCIAL_REVIEW_CASES } from "../src/art/DenseDistrictShowcase.js";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";
import {
  CommercialDistrictSource,
  commercialDistrictSurfaceAt,
} from "../src/generation/regional/CommercialDistrictPlanner.js";
import { regionalWorld } from "../src/generation/regional/WorldDescriptor.js";

const url = "/tilefun/building-lab.html?run=commercial",
  ready = '#app[data-ready="true"]';
const plan = new CommercialDistrictSource(regionalWorld(2026)).owner(0, 0);
if (!plan) throw new Error("Missing commercial checkpoint");
const _bayCell = commercialDistrictSurfaceAt(plan, 319, 514);
test("commercial batch is indexed, fits phone review and pauses independently", async ({
  page,
}) => {
  const rows: ArtNote[] = [];
  await page.route("**/api/art-notes", (r) => {
    if (r.request().method() === "POST") rows.push(r.request().postDataJSON());
    return r.fulfill({ json: r.request().method() === "POST" ? { saved: true } : rows });
  });
  await page.goto("/tilefun/workshop.html");
  await expect(page.locator('[data-batch="commercial"]')).toContainText("1 unchecked");
  await page.goto("/tilefun/workshop.html#/tool/districts");
  await expect(
    page.getByRole("heading", { name: "Commercial streets & parking", exact: true }),
  ).toBeVisible();
  await page.goto(url);
  await expect(page.locator(ready)).toBeVisible();
  await expect(page.locator("#review-progress")).toContainText("1/4");
  for (const c of COMMERCIAL_REVIEW_CASES) {
    await page.locator("#district-case").selectOption(c.id);
    await expect(page.locator("#recipe-id")).toHaveText(c.id);
    expect(Number(await page.locator("#building").getAttribute("data-chunks"))).toBeLessThanOrEqual(
      81,
    );
    const png = await page
      .locator("#building")
      .evaluate((c) => (c as HTMLCanvasElement).toDataURL());
    writeFileSync(`/tmp/tilefun-${c.id}.png`, Buffer.from(png.split(",")[1] ?? "", "base64"));
    await page.setViewportSize({ width: 390, height: 844 });
    for (const id of [
      "building",
      "next-building",
      "previous-building",
      "approve-building",
      "reject-building",
    ]) {
      const b = await page.locator(`#${id}`).boundingBox();
      expect(b?.y).toBeGreaterThanOrEqual(0);
      expect((b?.y ?? 0) + (b?.height ?? 0)).toBeLessThanOrEqual(844);
    }
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  await expect(page.locator("#district-play")).toHaveAttribute("href", /regional-v6/);
  await page.locator("#building-note").fill("First commercial change");
  await page.locator("#reject-building").click();
  await page.locator("#building-note").fill("Second commercial change");
  await page.locator("#reject-building").click();
  await expect(page.locator("#review-pause")).toBeVisible();
  await page.goto("/tilefun/building-lab.html?run=districts");
  await expect(page.locator(ready)).toBeVisible();
  await expect(page.locator("#review-pause")).toBeHidden();
  await expect(page.locator("#review-progress")).toContainText("1/3");
  await page.goto(url);
  await expect(page.locator("#review-pause")).toBeVisible();
});
test("commercial feedback carries the exact place recipe and resolves to its Workshop candidate", async ({
  page,
  request,
}) => {
  await page.goto(`${url}&case=district-v2-parking`);
  await expect(page.locator(ready)).toBeVisible();
  const note = `Commercial bay review ${crypto.randomUUID()}`;
  await page.locator("#building-note").fill(note);
  await page.locator("#save-building-note").click();
  await expect(page.locator("#feedback-sync")).toHaveText("Server inbox up to date.");
  const rows = (await (await request.get("/tilefun/api/art-notes")).json()) as ArtNote[];
  expect(rows.find((r) => r.note === note)?.buildingReview).toMatchObject({
    scene: "district",
    districtRecipe: "commercial-district-v1",
    caseId: "district-v2-parking",
    url: "/tilefun/building-lab.html?run=commercial&case=district-v2-parking",
  });
  await page.goto("/tilefun/workshop.html#/review/district%3Adistrict-v2-parking");
  await expect(page.locator('[data-review-ready="true"]')).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Parked cars & curb bays", exact: true }),
  ).toBeVisible();
});
test("commercial archive offers a fresh current world without promising the archived layout", async ({
  page,
}) => {
  await page.goto(url);
  await expect(page.locator(ready)).toBeVisible();
  await page.locator("#district-play").click();
  await expect(page.locator("#app")).toHaveAttribute("data-tile-complete", "true");
  const link = page.getByRole("link", { name: "Create current world with this seed" });
  const href = await link.getAttribute("href");
  if (!href) throw Error("Missing handoff");
  const target = new URL(href);
  expect(target.searchParams.has("arrival")).toBe(false);
  expect(JSON.parse(target.searchParams.get("generation") ?? "{}")).toEqual(
    createDescriptor("regional", 2026),
  );
});
