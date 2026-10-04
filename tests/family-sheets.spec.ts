import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { required } from "../src/art/ArtCatalog.js";
import { familyCanonicalJSON } from "../src/workshop/FamilySheetArt.js";
import type { FamilySheetCatalog } from "../src/workshop/FamilySheetTypes.js";
import type { WorkshopEvent } from "../src/workshop/WorkshopTypes.js";

const catalog = JSON.parse(
  readFileSync("public/data/family-sheets.json", "utf8"),
) as FamilySheetCatalog;
const URL = "/tilefun/workshop.html#/tool/families";

// The normal test server is isolated, but these discussions must not generate
// even test inbox history. Exercise the existing sync contract with a mock.
async function mockDiscussions(page: Page) {
  const events: WorkshopEvent[] = [];
  await page.route("**/api/art-notes", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/workshop/events", async (route) => {
    events.push(route.request().postDataJSON() as WorkshopEvent);
    await route.fulfill({ json: { saved: true } });
  });
  return events;
}

async function ready(page: Page, count: number) {
  await expect(page.locator(".family-piece")).toHaveCount(count);
  await expect(page.locator('.family-piece canvas[data-art-ready="true"]')).toHaveCount(count);
}

async function pixels(canvas: Locator) {
  return canvas.evaluate(async (element) => {
    const canvas = element as HTMLCanvasElement;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No artwork context");
    const bytes = context.getImageData(0, 0, canvas.width, canvas.height).data;
    if (!bytes.some((value, index) => index % 4 === 3 && value > 0))
      throw new Error("The artwork is blank");
    return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
  });
}

test("all three contact sheets fit desktop and 390px phone with the complete piece inventory", async ({
  page,
}) => {
  await mockDiscussions(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${URL}?family=cabinets`);
  const counts = { cabinets: 9, trees: 14, scrapyard: 29 };
  for (const viewport of [
    { name: "desktop", width: 1440, height: 1000 },
    { name: "phone", width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await expect(
      page.getByRole("navigation", { name: "Art families" }).getByRole("link"),
    ).toHaveCount(3);
    for (const family of catalog.families) {
      const tab = page
        .getByRole("navigation", { name: "Art families" })
        .getByRole("link", { name: family.name, exact: true });
      await tab.click();
      await ready(page, counts[family.id]);
      await expect(tab).toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("heading", { name: family.name, exact: true })).toBeVisible();
      await expect(page.locator(".family-proposed")).toHaveText("Proposed");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(
        await page
          .locator(".family-page")
          .evaluate((element) => element.scrollWidth <= element.clientWidth),
      ).toBe(true);
      await page.screenshot({
        path: `/tmp/tilefun-family-${family.id}-${viewport.name}.png`,
        fullPage: true,
      });
    }
  }
  expect(errors).toEqual([]);
});

test("shadow and tree color controls change real artwork pixels", async ({ page }) => {
  await mockDiscussions(page);
  for (const familyId of ["cabinets", "trees"]) {
    const family = required(catalog.families.find((item) => item.id === familyId));
    await page.goto(`${URL}?family=${family.id}`);
    await ready(page, family.id === "cabinets" ? 9 : 14);
    const canvas = page.locator(".family-piece canvas").first();
    const hashes: string[] = [];
    for (const variant of family.variants) {
      await page.getByRole("combobox", { name: family.variantLabel }).selectOption(variant.id);
      if (hashes.length) await expect.poll(() => pixels(canvas)).not.toBe(hashes.at(-1));
      hashes.push(await pixels(canvas));
    }
    expect(new Set(hashes).size).toBe(family.variants.length);
  }
});

test("cabinet connector details and piece/variant deep links survive reload", async ({ page }) => {
  await mockDiscussions(page);
  await page.goto(`${URL}?family=cabinets`);
  await ready(page, 9);
  const joins = [
    [41, "Left end", "Add a middle or right end on the right."],
    [42, "Reflective middle", "Connect another piece on both sides."],
    [43, "Solid middle", "Connect another piece on both sides."],
    [44, "Right end", "Add a middle or left end on the left."],
  ] as const;
  for (const [number, label, join] of joins) {
    await page.getByRole("button", { name: `${number}. ${label}`, exact: true }).click();
    await expect(page.locator(".family-detail-copy")).toContainText(
      "Cannot stand alone in any shadow style.",
    );
    await expect(page.locator(".family-detail-copy")).toContainText(join);
  }
  const previous = await pixels(
    page.getByRole("button", { name: "44. Right end", exact: true }).locator("canvas"),
  );
  await page.getByRole("combobox", { name: "Shadow" }).selectOption("shadowless");
  await expect
    .poll(() =>
      pixels(page.getByRole("button", { name: "44. Right end", exact: true }).locator("canvas")),
    )
    .not.toBe(previous);
  const link = page.url();
  expect(link).toContain("member=P03-C44");
  expect(link).toContain("variant=shadowless");
  const hash = await pixels(
    page.getByRole("button", { name: "44. Right end", exact: true }).locator("canvas"),
  );
  await page.reload();
  await ready(page, 9);
  await expect(page).toHaveURL(link);
  await expect(page.getByRole("button", { name: "44. Right end", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("combobox", { name: "Shadow" })).toHaveValue("shadowless");
  expect(
    await pixels(
      page.getByRole("button", { name: "44. Right end", exact: true }).locator("canvas"),
    ),
  ).toBe(hash);
});

test("discussion drafts stay scoped to family, piece and variant and send exact source notes", async ({
  page,
}) => {
  const events = await mockDiscussions(page);
  await page.goto(`${URL}?family=cabinets&member=P03-C41&variant=normal`);
  await ready(page, 9);
  await page.getByText("Discuss this piece", { exact: true }).click();
  const note = page.getByRole("textbox");
  await note.fill("Left end, normal shadow");
  await page.getByRole("combobox", { name: "Shadow" }).selectOption("black-shadow");
  await expect(note).toHaveValue("");
  await note.fill("Left end, dark shadow");
  await page.reload();
  await ready(page, 9);
  await page.getByText("Discuss this piece", { exact: true }).click();
  await expect(note).toHaveValue("Left end, dark shadow");
  await page.getByRole("button", { name: "Clear selection", exact: true }).click();
  await page.getByText("Discuss this family", { exact: true }).click();
  await expect(note).toHaveValue("");
  await note.fill("Whole cabinet family");
  await page.getByRole("button", { name: "42. Reflective middle", exact: true }).click();
  await page.getByText("Discuss this piece", { exact: true }).click();
  await expect(note).toHaveValue("");
  await page.getByRole("button", { name: "41. Left end", exact: true }).click();
  await page.getByText("Discuss this piece", { exact: true }).click();
  await expect(note).toHaveValue("Left end, dark shadow");
  await page.getByRole("combobox", { name: "Shadow" }).selectOption("normal");
  await expect(note).toHaveValue("Left end, normal shadow");

  await page.goto(`${URL}?family=trees&member=tree-2&variant=orange-red`);
  await ready(page, 14);
  await page.getByText("Discuss this piece", { exact: true }).click();
  await expect(note).toHaveValue("");
  await note.fill("Please check this pale trunk.");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect.poll(() => events.length).toBe(1);
  const family = required(catalog.families.find((item) => item.id === "trees"));
  const source = required(catalog.sources.find((item) => item.id === "me-complete"));
  expect(events[0]).toMatchObject({
    type: "source",
    sheetId: source.id,
    fingerprint: source.fingerprint,
    rect: [2464, 448, 64, 64],
    intent: "other",
    sliceKeys: expect.arrayContaining([
      "family-sheet:trees",
      `family-proposal:${family.revision}`,
      `family-catalog:${catalog.revision}`,
      "family-member:tree-2",
      "family-variant:orange-red",
      `family-layer:me-complete:${source.fingerprint}:2464,512,64,16:0,48`,
    ]),
    note: "Trees and forest · 2. Tree · pale lower section · Orange / red\n\nPlease check this pale trunk.",
  });
  expect(events[0]).not.toHaveProperty("verdict");
  expect(events[0]).not.toHaveProperty("buildingVerdict");
  expect(events[0]).not.toHaveProperty("assetAnnotation");
  await expect(note).toHaveValue("");
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("tilefun.workshop.v1") ?? "{}").state.outbox.length,
      ),
    )
    .toBe(0);
});

test("changed source bytes block artwork and discussion submission", async ({ page }) => {
  const events = await mockDiscussions(page);
  await page.route("**/assets/tilesets/modern-interiors-atlas.png", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: readFileSync("public/favicon.png"),
    }),
  );
  await page.goto(`${URL}?family=cabinets&member=P03-C41&variant=normal`);
  await expect(
    page.getByText("The artwork could not be verified. Try reloading the sheet.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".family-piece canvas")).toHaveCount(0);
  await page.getByText("Discuss this piece", { exact: true }).click();
  await page.getByRole("textbox").fill("Must remain a draft while source verification fails.");
  await expect(page.getByRole("button", { name: "Save note", exact: true })).toBeDisabled();
  expect(events).toEqual([]);
});

test("a refreshed catalog cannot reuse a family proposal pinned to different artwork", async ({
  page,
}) => {
  await mockDiscussions(page);
  const changed = structuredClone(catalog);
  required(changed.sources.find((source) => source.id === "me-complete")).fingerprint = "0".repeat(
    64,
  );
  const { revision: _revision, ...contents } = changed;
  changed.revision = createHash("sha256").update(familyCanonicalJSON(contents)).digest("hex");
  await page.route("**/data/family-sheets.json", (route) => route.fulfill({ json: changed }));
  await page.goto(`${URL}?family=trees`);
  await expect(
    page.getByText("The artwork no longer matches this family proposal.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".family-piece canvas")).toHaveCount(0);
});

test("an earlier proposal link cannot attach new discussion to the current revision", async ({
  page,
}) => {
  const events = await mockDiscussions(page);
  await page.goto(
    `${URL}?family=trees&member=tree-2&variant=blue-green&revision=${"0".repeat(64)}`,
  );
  await ready(page, 14);
  await page.getByText("Discuss this piece", { exact: true }).click();
  await expect(
    page.getByText("This link refers to an earlier proposal. You are viewing the current sheet."),
  ).toBeVisible();
  await page.getByRole("textbox").fill("Draft belongs to the current proposal.");
  await expect(page.getByRole("button", { name: "Save note", exact: true })).toBeDisabled();
  await page.getByRole("link", { name: "Open current proposal to leave a note" }).click();
  await expect(page.getByRole("button", { name: "Save note", exact: true })).toBeEnabled();
  await expect(page.getByRole("combobox", { name: "Palette" })).toHaveValue("blue-green");
  await expect(
    page.getByRole("button", { name: "2. Tree · pale lower section", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(events).toEqual([]);
});
