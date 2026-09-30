import { expect, test } from "@playwright/test";
import { required } from "../src/art/ArtCatalog.js";
import type { ArtNote } from "../src/art/ArtNotes.js";
import { CITY_BUILDING_PREFABS } from "../src/generation/regional/CityBuildingPrefabs.js";

const candidateCount = CITY_BUILDING_PREFABS.length + 3;
const URL = "/tilefun/building-lab.html";
test("one-tap review hides approvals, persists, pauses after two reports, and can undo", async ({
  page,
}) => {
  const saved: ArtNote[] = [];
  let online = true;
  await page.route("**/tilefun/api/art-notes", async (route) => {
    if (!online) return route.abort();
    if (route.request().method() === "POST") {
      const row = route.request().postDataJSON() as ArtNote;
      if (!saved.some((r) => r.id === row.id)) saved.push(row);
      return route.fulfill({ json: { saved: true } });
    }
    return route.fulfill({ json: saved });
  });
  await page.goto(URL);
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  const first = await page.locator("#prefab").inputValue();
  await page.locator("#next-building").click();
  const second = await page.locator("#prefab").inputValue();
  expect(second).not.toBe(first);
  await page.locator("#previous-building").click();
  await expect(page.locator("#prefab")).toHaveValue(first);
  await page.locator("#approve-building").click();
  await expect(page.locator("#prefab")).toHaveValue(second);
  await expect(page.locator("#queue-sync")).toHaveText("Server inbox up to date.");
  expect(saved[0]?.buildingVerdict?.value).toBe("approved");
  await page.reload();
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.locator("#review-filter")).toHaveValue("unchecked");
  await expect(page.locator("#review-progress")).toContainText("1 approved");
  await page.locator("#previous-building").click();
  expect(await page.locator("#prefab").inputValue()).not.toBe(first);
  await page.locator("#next-building").click();
  await page.locator("#reject-building").click();
  expect(saved).toHaveLength(1);
  await expect(page.locator("#building-note")).toBeFocused();
  await page.locator("#building-note").fill("Roof gap on the left");
  await page.locator("#reject-building").click();
  await expect(page.locator("#building-note")).toHaveValue("");
  await expect(page.locator("#review-progress")).toContainText("1 need changes");
  online = false;
  await page.locator("#building-note").fill("The storefront sign overlaps wrong");
  await page.locator("#reject-building").click();
  await expect(page.locator("#review-pause")).toBeVisible();
  await expect(page.locator("#review-batch")).toContainText("Roof gap on the left");
  await expect(page.locator("#review-batch")).toContainText("storefront sign");
  await expect(page.locator("#queue-sync")).toContainText("pending server save");
  await page.reload();
  await expect(page.locator('#app[data-ready="true"]')).toBeAttached();
  await expect(page.locator("#review-pause")).toBeVisible();
  online = true;
  await page.locator("#refresh-building-notes").click();
  await expect(page.locator("#queue-sync")).toHaveText("Server inbox up to date.");
  expect(saved).toHaveLength(3);
  await page.locator("#undo-building").click();
  await expect(page.locator("#review-pause")).toBeHidden();
  await expect(page.locator("#review-verdict")).toContainText("Unchecked");
  await expect(page.locator("#review-progress")).toContainText("1 need changes");
  await expect(page.locator("#queue-sync")).toHaveText("Server inbox up to date.");
  expect(saved.at(-1)?.buildingVerdict?.value).toBe("clear");
});

test("approvals survive debug view changes; a changed appearance returns to unchecked", async ({
  page,
}) => {
  let saved: ArtNote[] = [];
  await page.route("**/tilefun/api/art-notes", async (route) => {
    if (route.request().method() === "POST") {
      saved.push(route.request().postDataJSON());
      return route.fulfill({ json: { saved: true } });
    }
    return route.fulfill({ json: saved });
  });
  await page.goto(URL);
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  const first = await page.locator("#prefab").inputValue();
  await page.locator("#approve-building").click();
  await expect(page.locator("#review-progress")).toContainText("1 approved");
  await page.locator("#review-filter").selectOption("approved");
  await expect(page.locator("#prefab")).toHaveValue(first);
  await page.locator("#geometry").check();
  await page.locator("#scale").selectOption("large");
  await expect(page.locator("#review-verdict")).toContainText("Approved");
  await page.locator("#review-filter").selectOption("unchecked");
  await page.locator("#building-note").fill("x Space ArrowRight are plain text here");
  await page.locator("#building-note").press("ArrowRight");
  expect(saved).toHaveLength(1);
  saved = saved.map((note) => ({
    ...note,
    buildingReview: { ...required(note.buildingReview), renderFingerprint: "c".repeat(64) },
  }));
  await page.locator("#refresh-building-notes").click();
  await expect(page.locator("#review-progress")).toContainText("0 approved");
  await page.locator("#prefab").selectOption(first);
  await expect(page.locator("#review-filter")).toHaveValue("unchecked");
  await expect(page.locator("#review-verdict")).toContainText("Unchecked");
});

test("phone navigation and voting are visible without scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/tilefun/api/art-notes", (route) => route.fulfill({ json: [] }));
  await page.goto(URL);
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  for (const id of [
    "next-building",
    "previous-building",
    "building",
    "building-note",
    "approve-building",
    "reject-building",
  ]) {
    const bounds = await page.locator(`#${id}`).boundingBox();
    expect(bounds?.y).toBeGreaterThanOrEqual(0);
    expect((bounds?.y ?? 1000) + (bounds?.height ?? 0)).toBeLessThanOrEqual(844);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/tilefun-building-review-phone.png", fullPage: true });
  for (let i = 0; i < candidateCount; i++) {
    await page.locator("#next-building").click();
    expect(await page.evaluate(() => scrollY)).toBe(0);
    const buttons = await page.locator("#reject-building").boundingBox();
    expect((buttons?.y ?? 1000) + (buttons?.height ?? 0)).toBeLessThanOrEqual(844);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: "/tmp/tilefun-building-review-desktop.png", fullPage: true });
});

test("an exhausted queue stays empty after reload and decisions are readable from another browser", async ({
  page,
  browser,
}) => {
  const saved: ArtNote[] = [];
  const context = await browser.newContext();
  const routeInbox = async (target: import("@playwright/test").BrowserContext) =>
    target.route("**/tilefun/api/art-notes", async (route) => {
      if (route.request().method() === "POST") {
        saved.push(route.request().postDataJSON());
        return route.fulfill({ json: { saved: true } });
      }
      return route.fulfill({ json: saved });
    });
  await routeInbox(page.context());
  await routeInbox(context);
  try {
    await page.goto(URL);
    await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
    for (let i = 0; i < candidateCount; i++) await page.locator("#approve-building").click();
    await expect(page.locator("#review-empty")).toBeVisible();
    await expect(page.locator("#queue-sync")).toHaveText("Server inbox up to date.");
    expect(saved).toHaveLength(candidateCount);
    await page.reload();
    await expect(page.locator("#review-empty")).toBeVisible();
    const other = await context.newPage();
    await other.goto(URL);
    await expect(other.locator("#review-empty")).toBeVisible();
    await expect(other.locator("#review-progress")).toContainText(`${candidateCount} approved`);
    await other.locator("#show-all-buildings").click();
    await expect(other.locator("#review-verdict")).toContainText("Approved");
    await other.locator("#undo-building").click();
    await expect(other.locator("#review-verdict")).toContainText("Unchecked");
    await expect(other.locator("#queue-sync")).toHaveText("Server inbox up to date.");
    await page.locator("#refresh-building-notes").click();
    await expect(page.locator("#review-empty")).toBeHidden();
    await expect(page.locator("#review-verdict")).toContainText("Unchecked");
    await expect(page.locator("#review-progress")).toContainText("1/1");
  } finally {
    await context.close();
  }
});

test("a fixed batch reopens only changed candidates and releases the pause", async ({ page }) => {
  let saved: ArtNote[] = [];
  await page.route("**/tilefun/api/art-notes", async (route) => {
    if (route.request().method() === "POST") {
      saved.push(route.request().postDataJSON());
      return route.fulfill({ json: { saved: true } });
    }
    return route.fulfill({ json: saved });
  });
  await page.goto(URL);
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await page.locator("#building-note").fill("Roof needs attention");
  await page.locator("#reject-building").click();
  await page.locator("#building-note").fill("Door needs attention");
  await page.locator("#reject-building").click();
  await expect(page.locator("#review-pause")).toBeVisible();
  await expect(page.locator("#queue-sync")).toHaveText("Server inbox up to date.");
  // Emulate a historical judgment whose pixels differ from the newly loaded candidate.
  saved = saved.map((note, i) =>
    i
      ? note
      : {
          ...note,
          buildingReview: { ...required(note.buildingReview), renderFingerprint: "d".repeat(64) },
        },
  );
  await page.locator("#check-building-updates").click();
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.locator("#review-pause")).toBeHidden();
  await expect(page.locator("#review-progress")).toContainText("1 need changes");
  await page.locator("#prefab").selectOption(required(saved[0]?.buildingReview?.prefabIds[0]));
  await expect(page.locator("#review-verdict")).toContainText("Unchecked");
  await page.locator("#building-note").fill("The revised roof still needs attention");
  await page.locator("#reject-building").click();
  await expect(page.locator("#review-pause")).toBeVisible();
  await expect(page.locator("#review-batch")).toContainText("Door needs attention");
  await expect(page.locator("#review-batch")).toContainText("revised roof");
});
