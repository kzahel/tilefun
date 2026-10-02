import { readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { ArtNote } from "../src/art/ArtNotes.js";
import { CITY_GEOMETRY_CASES, composeCitySurface } from "../src/road/CitySurfaceRecipes.js";
import { candidateSummary } from "../src/workshop/WorkshopProjection.js";
import type { WorkshopManifest } from "../src/workshop/WorkshopTypes.js";

const URL = "/tilefun/building-lab.html?run=road-geometry";
const ready = '#app[data-ready="true"]';
const manifest = JSON.parse(
  readFileSync("public/data/workshop-manifest.json", "utf8"),
) as WorkshopManifest;

test("four geometry cases are indexed under Roads, render exact source pixels and fit phone review", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/art-notes", (r) => r.fulfill({ json: [] }));
  await page.route("**/api/workshop/inbox", (r) =>
    r.fulfill({
      json: {
        manifestCurrent: true,
        requests: [],
        candidates: manifest.candidates.map((c) => candidateSummary(c, [], [])),
      },
    }),
  );
  await page.goto("/tilefun/workshop.html");
  await expect(page.locator('[data-batch="roads-geometry"]')).toContainText("4 unchecked");
  await page.goto("/tilefun/workshop.html#/tool/roads");
  await expect(page.getByRole("heading", { name: "Road geometry", exact: true })).toBeVisible();
  await expect(page.locator('a[href*="surface-v2-"]')).toHaveCount(4);
  for (const c of CITY_GEOMETRY_CASES) {
    await page.goto(`/tilefun/workshop.html#/review/${encodeURIComponent(`surface:${c.id}`)}`);
    await expect(page.locator('[data-review-ready="true"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: c.name, exact: true })).toBeVisible();
    const png = await page
      .getByLabel("Candidate preview", { exact: true })
      .evaluate((el) => (el as HTMLCanvasElement).toDataURL());
    writeFileSync(`/tmp/tilefun-${c.id}.png`, Buffer.from(png.split(",")[1] ?? "", "base64"));
    expect(
      await page.getByLabel("Candidate preview", { exact: true }).evaluate(async (el, pieces) => {
        const im = new Image();
        im.src = "/tilefun/assets/tilesets/me-complete.png";
        await im.decode();
        const expected = document.createElement("canvas");
        expected.width = 1024;
        expected.height = 768;
        const ctx = expected.getContext("2d"),
          actual = (el as HTMLCanvasElement).getContext("2d");
        if (!ctx || !actual) throw new Error("Missing canvas");
        ctx.imageSmoothingEnabled = false;
        for (const p of pieces) {
          const [x, y, w, h] = p.rect;
          ctx.drawImage(im, x, y, w, h, p.x * 2, p.y * 2, w * 2, h * 2);
        }
        const a = actual.getImageData(0, 0, 1024, 768).data,
          b = ctx.getImageData(0, 0, 1024, 768).data;
        return a.every((v, i) => v === b[i]);
      }, composeCitySurface(c)),
    ).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    const frame = await page.getByLabel("Preview viewport").boundingBox();
    expect(frame?.width).toBeLessThanOrEqual(390);
    await expect(page.getByRole("button", { name: "Looks right ✓", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  await page.goto(URL);
  await expect(page.locator(ready)).toBeVisible();
  await expect(page.locator("#review-progress")).toContainText("1/4");
  await expect(page.locator("#surface-case option")).toHaveCount(4);
  expect(errors).toEqual([]);
});

test("geometry feedback round trips through the isolated server and atlas with its own recipe and URL", async ({
  page,
  request,
}) => {
  await page.goto(`${URL}&case=surface-v2-refuge`);
  await expect(page.locator(ready)).toBeVisible();
  const marker = `Refuge review ${crypto.randomUUID()}`;
  await page.locator("#building-note").fill(marker);
  await page.locator("#reject-building").click();
  await expect(page.locator("#queue-sync")).toHaveText("Server inbox up to date.");
  const rows = (await (await request.get("/tilefun/api/art-notes")).json()) as ArtNote[];
  expect(rows.find((n) => n.note === marker)?.buildingReview).toMatchObject({
    scene: "surface",
    caseId: "surface-v2-refuge",
    surfaceRecipe: "city-surfaces-v2",
    prefabIds: [],
    url: "/tilefun/building-lab.html?run=road-geometry&case=surface-v2-refuge",
  });
  await page.goto("/tilefun/art-workbench.html?sheet=me-complete");
  await expect(
    page.locator('a[href*="run=road-geometry"][href*="surface-v2-refuge"]').first(),
  ).toBeVisible();
});

test("geometry batch pauses at two reports without pausing the approved foundation batch", async ({
  page,
}) => {
  const rows: ArtNote[] = [];
  await page.route("**/api/art-notes", (r) => {
    if (r.request().method() === "POST") rows.push(r.request().postDataJSON());
    return r.fulfill({ json: r.request().method() === "POST" ? { saved: true } : rows });
  });
  await page.goto(URL);
  await expect(page.locator(ready)).toBeVisible();
  for (const reason of ["Corner join review", "Refuge edge review"]) {
    await page.locator("#building-note").fill(reason);
    await page.locator("#reject-building").click();
    await expect.poll(() => rows.length).toBe(reason.startsWith("Corner") ? 1 : 2);
  }
  await expect(page.locator("#review-pause")).toBeVisible();
  await page.goto("/tilefun/building-lab.html?run=surfaces");
  await expect(page.locator(ready)).toBeVisible();
  await expect(page.locator("#review-pause")).toBeHidden();
  await expect(page.locator("#review-progress")).toContainText("1/9");
  await page.goto(URL);
  await expect(page.locator("#review-pause")).toBeVisible();
});
