import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { type ArtCatalog, required } from "../src/art/ArtCatalog.js";

const catalog = JSON.parse(readFileSync("public/data/art-catalog.json", "utf8")) as ArtCatalog;
const API = "**/tilefun/api/art-notes",
  URL = "/tilefun/art-workbench.html";
test("traces source uses, bookmarks exact regions, and browses both major atlases", async ({
  page,
}) => {
  await page.route(API, (route) => route.fulfill({ json: [] }));
  await page.goto(URL);
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await page.locator("#terraces").click();
  await expect(page.locator("#coordinates")).toContainText("me-complete");
  await expect(page.locator("#selection-info")).toContainText("prop-terraced-house-1");
  await expect(page.locator("#selection-info")).toContainText("PropFactories.ts");
  const bookmark = page.url();
  await page.reload();
  await expect(page.locator("#coordinates")).toContainText("me-complete");
  expect(page.url()).toBe(bookmark);
  await page.screenshot({ path: "/tmp/tilefun-art-terraces.png", fullPage: true });
  await page.locator("#apartments").click();
  await expect(page.locator("#results")).toContainText("Condo_1");
  await page.screenshot({ path: "/tmp/tilefun-art-city-apartments.png", fullPage: true });
  await page.locator("#facades").click();
  await expect(page.locator("#selection-info")).toContainText("Regional district facades");
  await page.locator("#sheet").selectOption("modern-interiors");
  await expect(page.locator("#counts")).toContainText("19,493 indexed slices");
  await page.locator("#search").fill("single/normal/bedroom/bedroom-singles-140");
  await page.locator("#results button").first().click();
  await expect(page.locator("#selection-info")).toContainText("Single bed");
  // Packed coordinates must remain exact, including non-grid-aligned y.
  const use = required(catalog.usages.find((u) => u.id === "furniture:single-bed"));
  await expect(page.locator("#coordinates")).toContainText(
    `x ${use.rect[0]}, y ${use.rect[1]}, ${use.rect[2]}×${use.rect[3]}`,
  );
  await page.screenshot({ path: "/tmp/tilefun-art-interiors.png", fullPage: true });
});
test("saves notes on the machine for a second browser and resolves the same thread", async ({
  page,
  browser,
}) => {
  const label = `SF apartments ${crypto.randomUUID()}`;
  await page.goto(URL);
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await page.locator("#terraces").click();
  await page.locator("#note").fill(label);
  await page.locator("#save-note").click();
  const note = page.locator("#notes article").filter({ hasText: label });
  await expect(note).toBeVisible();
  await expect(page.locator("#sync")).toHaveText("Server inbox up to date.");
  await page.reload();
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.locator("#note")).toHaveValue("");
  const second = await browser.newContext({ storageState: "test-results/workshop-session.json" });
  try {
    const other = await second.newPage();
    await other.goto(URL);
    const shared = other.locator("#notes article").filter({ hasText: label });
    await expect(shared).toBeVisible();
    await shared.getByRole("button", { name: "Resolve", exact: true }).click();
    await expect(shared).toHaveCount(0);
    await expect(other.locator("#sync")).toHaveText("Server inbox up to date.");
    await page.locator("#refresh").click();
    await expect(note).toHaveCount(0);
    await page.locator("#note-filter").selectOption("resolved");
    await expect(note).toBeVisible();
    const rows = await (await page.request.get("/tilefun/api/art-notes")).json();
    const row = rows.find((r: { note: string }) => r.note === label);
    expect(row).toMatchObject({ sheetId: "me-complete", status: "resolved" });
    expect(row.fingerprint).toHaveLength(64);
    expect(row.rect).toHaveLength(4);
  } finally {
    await second.close();
  }
});
test("retains offline notes and replays each event once after reconnect", async ({ page }) => {
  let available = false;
  const saved: Record<string, unknown>[] = [];
  await page.route(API, async (route) => {
    if (!available) return route.abort();
    if (route.request().method() === "POST") {
      saved.push(route.request().postDataJSON());
      return route.fulfill({ json: { saved: true } });
    }
    return route.fulfill({ json: saved });
  });
  await page.goto(URL);
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await page.locator("#facades").click();
  await page.locator("#note").fill("NYC shops with apartments above");
  await page.locator("#save-note").click();
  await expect(page.locator("#sync")).toContainText("pending server save");
  await page.reload();
  await expect(page.locator("#notes")).toContainText("NYC shops");
  available = true;
  await page.locator("#refresh").click();
  await expect(page.locator("#sync")).toHaveText("Server inbox up to date.");
  await page.locator("#refresh").click();
  expect(saved).toHaveLength(1);
});
test("supports phone tap and dragged source regions without horizontal overflow", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.route(API, (route) => route.fulfill({ json: [] }));
    await page.goto(URL);
    await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
    await page.locator("#terraces").tap();
    await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
    const canvas = page.locator("#atlas");
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Missing canvas");
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator("#coordinates")).toContainText("16×16 px");
    await page.locator("#select-region").click();
    await canvas.scrollIntoViewIfNeeded();
    const fresh = await canvas.boundingBox();
    if (!fresh) throw new Error("Missing canvas");
    await page.mouse.move(fresh.x + fresh.width / 2 - 30, fresh.y + fresh.height / 2 - 30);
    await page.mouse.down();
    await page.mouse.move(fresh.x + fresh.width / 2 + 30, fresh.y + fresh.height / 2 + 30);
    await page.mouse.up();
    await expect(page.locator("#coordinates")).not.toContainText("16×16 px");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.locator("#note").fill("Use this rowhouse facade");
    await page.screenshot({ path: "/tmp/tilefun-art-phone.png", fullPage: true });
  } finally {
    await context.close();
  }
});
test("flags changed source revisions without discarding the pending annotation", async ({
  page,
}) => {
  const sheet = required(catalog.sheets[0]);
  await page.route(API, (route) =>
    route.fulfill({
      json: [
        {
          id: "old-1",
          threadId: "old-thread",
          sheetId: sheet.id,
          fingerprint: "a".repeat(64),
          sheetSize: [sheet.width, sheet.height],
          rect: [0, 0, 16, 16],
          sliceKeys: [],
          intent: "building",
          status: "pending",
          note: "Old facade selection",
          reply: "",
          createdAt: "2026-09-30T00:00:00Z",
        },
      ],
    }),
  );
  await page.goto(URL);
  await expect(page.locator("#notes")).toContainText("Source sheet changed");
  await expect(page.locator("#notes")).toContainText("Old facade selection");
});

test("refuses to attach new notes to pixels from a stale inventory", async ({ page }) => {
  await page.route(API, (route) => route.fulfill({ json: [] }));
  await page.route("**/assets/tilesets/me-complete.png", (route) =>
    route.fulfill({ path: "public/assets/tilesets/objects.png", contentType: "image/png" }),
  );
  await page.goto(URL);
  await expect(page.locator("#canvas-message")).toContainText("Source image changed");
  await expect(page.locator("#save-note")).toBeDisabled();
});
