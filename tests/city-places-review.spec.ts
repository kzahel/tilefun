import { writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { required } from "../src/art/ArtCatalog.js";
import { CITY_REVIEW_RUNS } from "../src/art/CityReviewRuns.js";
import { CITY_PLACES_REVIEW_CASES } from "../src/art/DenseDistrictShowcase.js";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";

for (const [run, meta] of Object.entries(CITY_REVIEW_RUNS)) {
  test(`${run} is indexed with exact feedback, phone controls and independent review state`, async ({
    page,
  }) => {
    const notes: unknown[] = [];
    await page.route("**/api/art-notes", (r) => {
      if (r.request().method() === "POST") notes.push(r.request().postDataJSON());
      return r.fulfill({ json: r.request().method() === "POST" ? { saved: true } : notes });
    });
    await page.goto("/tilefun/workshop.html");
    await expect(page.locator(`[data-batch="${run}"]`)).toContainText("1 unchecked");
    await page.setViewportSize({ width: 390, height: 844 });
    for (const c of CITY_PLACES_REVIEW_CASES.filter((c) => c.run === run)) {
      await page.goto(`/tilefun/building-lab.html?run=${run}&case=${c.id}`);
      await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
      await expect(page.locator("#recipe-id")).toHaveText(c.id);
      expect(
        Number(await page.locator("#building").getAttribute("data-chunks")),
      ).toBeLessThanOrEqual(81);
      for (const id of [
        "approve-building",
        "reject-building",
        "next-building",
        "previous-building",
      ]) {
        const b = required(await page.locator(`#${id}`).boundingBox());
        expect(b).toBeTruthy();
        expect(b.y + b.height).toBeLessThanOrEqual(844);
      }
      const png = await page
        .locator("#building")
        .evaluate((c) => (c as HTMLCanvasElement).toDataURL());
      writeFileSync(`/tmp/tilefun-${c.id}.png`, Buffer.from(required(png.split(",")[1]), "base64"));
      await expect(page.locator("#district-play")).toHaveAttribute(
        "href",
        new RegExp(meta.version),
      );
    }
    await page.locator("#building-note").fill("Please review this place");
    await page.locator("#save-building-note").click();
    await expect.poll(() => notes.length).toBeGreaterThan(0);
    expect(notes.at(-1)).toMatchObject({
      buildingReview: { districtRecipe: meta.recipe, url: expect.stringContaining(`run=${run}`) },
    });
    await page.goto(
      `/tilefun/workshop.html#/review/district%3A${required(CITY_PLACES_REVIEW_CASES.find((c) => c.run === run)).id}`,
    );
    await expect(page.locator('[data-review-ready="true"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Looks right ✓", exact: true })).toBeEnabled();
  });
  test(`${run} archived explorer is a finite snapshot, not a playable historical world`, async ({
    page,
  }) => {
    const generation = {
      type: "regional",
      version: meta.version,
      seed: 2026,
      preset: "temperate-v1",
    };
    await page.goto(
      `/tilefun/world-explorer.html?generation=${encodeURIComponent(JSON.stringify(generation))}&x=300&y=519&zoom=16&mode=tiles`,
    );
    await expect(page.locator("#app")).toHaveAttribute("data-tile-complete", "true");
    const link = page.getByRole("link", { name: "Create current world with this seed" });
    const href = await link.getAttribute("href");
    if (!href) throw Error("Missing handoff");
    expect(new URL(href).searchParams.has("arrival")).toBe(false);
    expect(JSON.parse(new URL(href).searchParams.get("generation") ?? "{}")).toEqual(
      createDescriptor("regional", 2026),
    );
  });
}
