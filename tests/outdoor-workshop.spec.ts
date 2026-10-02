import { expect, test } from "@playwright/test";
import type { ArtNote } from "../src/art/ArtNotes.js";

const workshop = "/tilefun/workshop.html";
test("outdoor catalog bounds DOM, saves exact corrections and runs production movement geometry", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(workshop + "#/tool/outdoor");
  await expect(
    page.getByRole("heading", { name: "Outdoor asset catalog", exact: true }),
  ).toBeVisible();
  await expect.poll(() => page.locator(".outdoor-grid article").count()).toBeGreaterThan(0);
  expect(await page.locator(".outdoor-grid article").count()).toBeLessThanOrEqual(48);
  await page
    .getByRole("button", { name: /Picnic table with attached benches/ })
    .first()
    .click();
  await expect(page.getByLabel("Asset name", { exact: true })).toHaveValue(
    "Picnic table with attached benches",
  );
  await page.getByText("Placement & collision geometry", { exact: true }).click();
  const canvas = page.getByLabel("Asset movement test", { exact: true });
  await expect(canvas).toHaveAttribute("data-player-y", "40");
  await canvas.focus();
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(950);
  await page.keyboard.up("ArrowUp");
  const stopped = Number(await canvas.getAttribute("data-player-y"));
  expect(stopped).toBeGreaterThanOrEqual(3);
  expect(stopped).toBeLessThan(14);
  await canvas.focus();
  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(950);
  await page.keyboard.up("ArrowLeft");
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(700);
  await page.keyboard.up("ArrowUp");
  expect(Number(await canvas.getAttribute("data-player-y"))).toBeLessThan(-10);
  const note = `Outdoor metadata correction ${crypto.randomUUID()}`;
  await page.getByLabel("Asset name", { exact: true }).fill("Park picnic table with benches");
  await page.getByLabel("Asset tags", { exact: true }).fill("seating, picnic, park tables");
  await page.getByLabel("Metadata feedback", { exact: true }).fill(note);
  await page.reload();
  await expect(page.getByLabel("Asset name", { exact: true })).toHaveValue(
    "Park picnic table with benches",
  );
  await expect(page.getByLabel("Metadata feedback", { exact: true })).toHaveValue(note);
  await page.getByRole("button", { name: "Save correction", exact: true }).click();
  await expect
    .poll(async () => {
      const r = await page.request.get("/tilefun/api/art-notes");
      return ((await r.json()) as ArtNote[]).some(
        (n) =>
          n.note === note && n.assetAnnotation?.metadata.name === "Park picnic table with benches",
      );
    })
    .toBe(true);
  await page.screenshot({ path: "/tmp/tilefun-outdoor-catalog-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/tilefun-outdoor-catalog-phone.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("atlas gaps can become named asset proposals without original source packs", async ({
  page,
}) => {
  const name = `Unmapped atlas candidate ${crypto.randomUUID()}`;
  await page.goto(workshop + "#/tool/art?sheet=me-complete&view=sheet&coverage=gaps");
  await expect(page.getByText(/Pink marks occupied cells/)).toBeVisible();
  await page.getByRole("button", { name: "Next unmapped region →", exact: true }).click();
  await page.getByRole("link", { name: "Name / review this asset →", exact: true }).click();
  await page.getByLabel("Asset name", { exact: true }).fill(name);
  await page.getByLabel("Asset kind", { exact: true }).selectOption("modular");
  await page.getByRole("button", { name: "Save correction", exact: true }).click();
  await expect
    .poll(async () => {
      const r = await page.request.get("/tilefun/api/art-notes");
      return ((await r.json()) as ArtNote[]).some((n) => n.assetAnnotation?.metadata.name === name);
    })
    .toBe(true);
  await page.reload();
  await expect(page.getByLabel("Asset name", { exact: true })).toHaveValue(name);
});

test("full neighborhood area notes attach asset revisions, survive drafts and locate shared feedback", async ({
  page,
}) => {
  test.setTimeout(60000);
  const note = `Shade and seating in selected square ${crypto.randomUUID()}`;
  await page.goto(
    workshop + "#/scene/district-v10-destinations?focus=district-v10-square-visitors",
  );
  await expect(page.locator('[data-scene-ready="true"]')).toBeVisible();
  await page.getByLabel("Scene tool", { exact: true }).selectOption("select");
  const canvas = page.getByLabel("Neighborhood preview", { exact: true }),
    box = await canvas.boundingBox();
  if (!box) throw new Error("Missing neighborhood");
  // Choose a visible region through the transformed whole-scene canvas.
  const viewport = await page.getByLabel("Preview viewport", { exact: true }).boundingBox();
  if (!viewport) throw new Error("Missing viewport");
  await page.mouse.move(viewport.x + viewport.width * 0.45, viewport.y + viewport.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(viewport.x + viewport.width * 0.6, viewport.y + viewport.height * 0.7);
  await page.mouse.up();
  await page.getByLabel("Location note", { exact: true }).fill(note);
  await page.getByRole("button", { name: "Browse props to suggest", exact: true }).click();
  await page
    .getByRole("button", {
      name: /Picnic table with attached benches|Park picnic table with benches/,
    })
    .first()
    .click();
  await expect(page.locator(".asset-suggestions article")).toHaveCount(1);
  await page.getByRole("button", { name: "Done choosing props", exact: true }).click();
  await page.reload();
  await expect(page.locator('[data-scene-ready="true"]')).toBeVisible();
  await expect(page.getByLabel("Location note", { exact: true })).toHaveValue(note);
  await expect(page.locator(".asset-suggestions article")).toHaveCount(1);
  await page.getByRole("button", { name: "Save location note", exact: true }).click();
  let thread: ArtNote | undefined;
  await expect
    .poll(async () => {
      const r = await page.request.get("/tilefun/api/art-notes");
      thread = ((await r.json()) as ArtNote[]).find((n) => n.note === note);
      return !!thread?.sceneAnnotation;
    })
    .toBe(true);
  expect(thread?.sceneAnnotation?.generation).toMatchObject({
    version: "regional-v10",
    seed: 2026,
  });
  expect(thread?.sceneAnnotation?.suggestions).toHaveLength(1);
  expect(thread?.sceneAnnotation?.suggestions[0]?.metadataFingerprint).toMatch(/^[a-f0-9]{64}$/);
  await expect(page.locator(".scene-notes").getByText(note, { exact: true })).toBeVisible();
  await page
    .locator(".scene-notes article")
    .filter({ hasText: note })
    .getByRole("button", { name: "Locate comment", exact: true })
    .click();
  await page.screenshot({
    path: "/tmp/tilefun-neighborhood-annotation-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/tilefun-neighborhood-annotation-phone.png", fullPage: true });
});

test("new catalog and scene writes retain public login and CSRF protections", async ({
  browser,
  page,
}) => {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  try {
    const visitor = await ctx.newPage();
    await visitor.goto(workshop + "#/tool/outdoor");
    await expect(
      visitor.getByRole("heading", { name: "Outdoor asset catalog", exact: true }),
    ).toBeVisible();
    expect(
      (
        await visitor.request.post("/tilefun/api/workshop/events", {
          data: { id: crypto.randomUUID(), type: "asset" },
        })
      ).status(),
    ).toBe(401);
    await visitor.goto(workshop + "#/scene/district-v10-destinations");
    await expect(
      visitor.getByRole("heading", { name: "Sign in to your Workshop.", exact: true }),
    ).toBeVisible();
  } finally {
    await ctx.close();
  }
  expect(
    (
      await page.request.post("/tilefun/api/workshop/events", {
        data: { id: crypto.randomUUID(), type: "scene" },
      })
    ).status(),
  ).toBe(403);
});

test("metadata outbox survives a failed save and reload then syncs once", async ({ page }) => {
  const note = `Offline metadata ${crypto.randomUUID()}`;
  await page.goto(`${workshop}#/tool/outdoor?asset=me%3A80%3A208%3A48%3A32`);
  await expect(page.getByLabel("Asset name", { exact: true })).toBeVisible();
  await page.route("**/api/workshop/events", (route) => route.abort());
  await page.getByLabel("Metadata feedback", { exact: true }).fill(note);
  await page.getByRole("button", { name: "Save correction", exact: true }).click();
  await expect(page.locator(".save-status")).toContainText("pending save");
  await page.reload();
  await expect(page.locator(".save-status")).toContainText("pending save");
  await page.unroute("**/api/workshop/events");
  await page.reload();
  await expect
    .poll(async () => {
      const r = await page.request.get("/tilefun/api/art-notes");
      return ((await r.json()) as ArtNote[]).filter((n) => n.note === note).length;
    })
    .toBe(1);
  await expect(page.locator(".save-status")).not.toContainText("pending save");
});
