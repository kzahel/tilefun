import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { ArtNote } from "../src/art/ArtNotes.js";
import { candidateSummary } from "../src/workshop/WorkshopProjection.js";
import type { WorkshopEvent, WorkshopManifest } from "../src/workshop/WorkshopTypes.js";
import { WORKSHOP_TEST_PASSWORD, WORKSHOP_TEST_STATE } from "./workshop-setup.js";

const manifest = JSON.parse(
  readFileSync("public/data/workshop-manifest.json", "utf8"),
) as WorkshopManifest;
const URL = "/tilefun/workshop.html";

test("owner login protects both legacy APIs and reveals all batches on desktop and phone", async ({
  browser,
  page,
}) => {
  const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  try {
    const visitor = await anonymous.newPage();
    for (const api of ["art-notes", "interior-review", "workshop/inbox"]) {
      expect((await visitor.request.get(`/tilefun/api/${api}`)).status()).toBe(401);
      expect((await visitor.request.post(`/tilefun/api/${api}`, { data: {} })).status()).toBe(401);
    }
    await visitor.goto(URL);
    await expect(visitor.getByRole("heading", { name: "Sign in to your Workshop." })).toBeVisible();
    await visitor.getByRole("link", { name: "Sign in", exact: true }).last().click();
    await visitor.getByLabel("Password", { exact: true }).fill(WORKSHOP_TEST_PASSWORD);
    await visitor.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(visitor.getByRole("heading", { name: "What’s ready to look at?" })).toBeVisible();
  } finally {
    await anonymous.close();
  }
  await page.goto(URL);
  await expect(page.locator('[data-batch="districts"]')).toBeVisible();
  await page.getByLabel("Show", { exact: true }).selectOption("all");
  await expect(page.locator('[data-batch="roads"]')).toBeVisible();
  await page.screenshot({ path: "/tmp/tilefun-workshop-inbox-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/tilefun-workshop-inbox-phone.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Toggle tool navigation" }).click();
  await page.getByRole("link", { name: "All tools", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Find your tool." })).toBeVisible();
  await expect(page.locator(".tool-card")).toHaveCount(manifest.tools.length);
});

test("native road review preserves exact pixels, drafts, independent pause and reopened appearances", async ({
  page,
}) => {
  const notes: ArtNote[] = [];
  await page.route("**/api/workshop/inbox", (route) =>
    route.fulfill({
      json: {
        manifestCurrent: true,
        requests: [],
        candidates: manifest.candidates.map((c) => candidateSummary(c, notes, [])),
      },
    }),
  );
  await page.route("**/api/workshop/events", async (route) => {
    const event = route.request().postDataJSON() as WorkshopEvent;
    if (event.type === "review") {
      const c = manifest.candidates.find((c) => c.id === event.candidateId);
      if (!c?.art) throw new Error("Unknown review");
      const createdAt = new Date().toISOString();
      notes.push({
        ...c.art,
        id: event.id,
        threadId: event.id,
        createdAt,
        note: event.note,
        reply: "",
        status: event.verdict === "changes" ? "pending" : "resolved",
        buildingVerdict: { value: event.verdict, createdAt },
      });
    }
    await route.fulfill({ json: { saved: true } });
  });
  await page.goto(URL + "#/review/surface%3Asurface-v1-narrow");
  await expect(page.locator('[data-review-ready="true"]')).toBeVisible();
  const narrow = manifest.candidates.find((c) => c.id === "surface:surface-v1-narrow");
  const fingerprint = await page
    .getByLabel("Candidate preview", { exact: true })
    .evaluate(async (el) => {
      const c = el as HTMLCanvasElement,
        ctx = c.getContext("2d");
      if (!ctx) throw new Error("No canvas");
      const sha = async (b: BufferSource) =>
        [...new Uint8Array(await crypto.subtle.digest("SHA-256", b))]
          .map((v) => v.toString(16).padStart(2, "0"))
          .join("");
      return sha(
        new TextEncoder().encode(
          `${c.width}:${c.height}:${await sha(ctx.getImageData(0, 0, c.width, c.height).data)}`,
        ),
      );
    });
  expect(fingerprint).toBe(narrow?.fingerprint);
  await page.getByLabel("Note", { exact: true }).fill("Narrow draft");
  await page.getByRole("button", { name: "Next →", exact: true }).click();
  await expect(page.getByLabel("Note", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "← Previous", exact: true }).click();
  await expect(page.getByLabel("Note", { exact: true })).toHaveValue("Narrow draft");
  await page.getByRole("button", { name: "Looks right ✓", exact: true }).click();
  await expect.poll(() => notes.length).toBe(1);
  await expect(
    page.getByRole("heading", { name: "Two-lane street & crossing", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Note", { exact: true }).fill("Change horizontal curb");
  await page.getByRole("button", { name: "Needs changes ✕", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Two-lane street · north–south", exact: true }),
  ).toBeVisible();
  await expect(page.locator('[data-review-ready="true"]')).toBeVisible();
  await page.getByLabel("Note", { exact: true }).fill("Change vertical curb");
  await page.getByRole("button", { name: "Needs changes ✕", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ready for the next fix." })).toBeVisible();
  await expect.poll(() => notes.length).toBe(3);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Ready for the next fix." })).toBeVisible();
  await page.goto(URL + "#/review/district%3Adistrict-v1-neighborhood");
  await expect(page.locator('[data-review-ready="true"]')).toBeVisible();
  await expect(page.locator(".review-pause")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/tilefun-workshop-district-phone.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const label of ["Looks right ✓", "Needs changes ✕"]) {
    const bounds = await page.getByRole("button", { name: label, exact: true }).boundingBox();
    expect(bounds).not.toBeNull();
    expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeLessThanOrEqual(844);
  }
  // A prior appearance is not an approval/report of the new one.
  const reported = notes[1];
  if (!reported?.buildingReview) throw new Error("Missing report");
  reported.buildingReview = { ...reported.buildingReview, renderFingerprint: "0".repeat(64) };
  await page.goto(URL + "#/review/surface%3Asurface-v1-two-lane");
  await expect(page.locator('[data-review-ready="true"]')).toBeVisible();
  await expect(page.locator(".review-pause")).toHaveCount(0);
  await expect(page.getByText("Changed · review again", { exact: true })).toBeVisible();
});

test("source selection saves a shared request and full history supports replies without approvals", async ({
  page,
}) => {
  const note = `Workshop source request ${crypto.randomUUID()}`;
  await page.goto(URL + "#/tool/art?sheet=me-complete&rect=512,16,32,32");
  await expect(page.getByLabel("Selected source art")).toBeVisible();
  await page.getByLabel("Note", { exact: true }).fill(note);
  await page.getByLabel("Use / intent").selectOption("terrain");
  await page.reload();
  await expect(page.getByLabel("Note", { exact: true })).toHaveValue(note);
  await expect(page.getByLabel("Use / intent")).toHaveValue("terrain");
  await expect(page.getByRole("button", { name: "Save shared note" })).toBeEnabled();
  await page.getByRole("button", { name: "Save shared note" }).click();
  await expect
    .poll(async () => {
      const rows = (await (await page.request.get("/tilefun/api/art-notes")).json()) as ArtNote[];
      return rows.some((r) => r.note === note);
    })
    .toBe(true);
  await page
    .getByRole("link", { name: /Requests & fixes/ })
    .first()
    .click();
  const card = page.locator(".thread-card").filter({ hasText: note });
  await expect(card).toBeVisible();
  await card.getByRole("link", { name: "Open thread & reply →" }).click();
  await page.getByLabel("Reply", { exact: true }).fill("Ready for a road pattern audit");
  await page.getByLabel("Status", { exact: true }).selectOption("in-progress");
  await page.getByRole("button", { name: "Save update" }).click();
  await expect(page.locator(".thread-history")).toContainText("Ready for a road pattern audit");
  const rows = (await (await page.request.get("/tilefun/api/art-notes")).json()) as ArtNote[];
  const row = rows.find((r) => r.note === note);
  expect(row?.rect).toEqual([512, 16, 32, 32]);
  expect(row?.buildingVerdict).toBeUndefined();
  expect(row?.status).toBe("in-progress");
  await page.getByRole("link", { name: "Inspect original context ↗" }).click();
  await expect(page).toHaveURL(/#\/tool\/art\?sheet=me-complete&rect=512,16,32,32/);
});

test("unsent legacy notes survive a login boundary and sync once into the shared inbox", async ({
  browser,
}) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } }),
    label = `Migrated draft ${crypto.randomUUID()}`;
  try {
    const page = await context.newPage();
    await page.goto(URL + "#/login");
    const source = manifest.candidates.find((c) => c.art)?.art;
    if (!source) throw new Error("No source");
    const row = {
      ...source,
      id: crypto.randomUUID(),
      threadId: crypto.randomUUID(),
      note: label,
      reply: "",
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    await page.evaluate(
      (row) =>
        localStorage.setItem(
          "tilefun.art-workbench.v1",
          JSON.stringify({ outbox: [row], records: [] }),
        ),
      row,
    );
    await page.reload();
    await expect(page.getByRole("status").first()).toContainText("1 pending save");
    await page.getByLabel("Password", { exact: true }).fill(WORKSHOP_TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(
          () => JSON.parse(localStorage.getItem("tilefun.art-workbench.v1") ?? "{}").outbox.length,
        ),
      )
      .toBe(0);
    const records = (await (await page.request.get("/tilefun/api/art-notes")).json()) as ArtNote[];
    expect(records.filter((r) => r.note === label)).toHaveLength(1);
  } finally {
    await context.close();
  }
});

test("existing room editor and movement tools stay inside the shared navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(URL + "#/tool/indoor");
  const editor = page.frameLocator('iframe[title="Room editor"]');
  await expect(editor.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(editor.getByLabel("Fixture", { exact: true })).toBeVisible();
  await expect(editor.getByRole("button", { name: "Export", exact: true })).toBeVisible();
  await expect(editor.getByRole("button", { name: "New room", exact: true })).toBeVisible();
  await page
    .getByRole("link", { name: /Furniture movement/ })
    .first()
    .click();
  const movement = page.frameLocator('iframe[title="Furniture movement"]');
  await expect(movement.locator("#room")).toBeVisible();
  await expect(movement.getByRole("button", { name: "Looks good", exact: false })).toBeEnabled();
  await page
    .getByRole("link", { name: /World explorer/ })
    .first()
    .click();
  const explorer = page.frameLocator('iframe[title="World explorer"]');
  await expect(explorer.getByLabel("World type", { exact: true })).toBeVisible();
  await expect(explorer.locator("#play-here")).toBeVisible();
  await expect(explorer.locator("#share")).toBeVisible();
  await page.getByRole("link", { name: "Review inbox", exact: false }).first().click();
  await expect(page.getByRole("heading", { name: "What’s ready to look at?" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("session expiry retains native feedback and signing back in completes the save", async ({
  browser,
}) => {
  const context = await browser.newContext({ storageState: WORKSHOP_TEST_STATE }),
    label = `Expired session report ${crypto.randomUUID()}`;
  try {
    const page = await context.newPage();
    await page.goto(URL + "#/review/surface%3Asurface-v1-warm?show=all");
    await expect(page.locator('[data-review-ready="true"]')).toBeVisible();
    await page.getByLabel("Note", { exact: true }).fill(label);
    await context.clearCookies();
    await page.getByRole("button", { name: "Needs changes ✕", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Sign in to your Workshop." })).toBeVisible();
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("tilefun.workshop.v1") ?? "{}").state.outbox.length,
      ),
    ).toBe(1);
    await page.getByRole("link", { name: "Sign in", exact: true }).last().click();
    await page.getByLabel("Password", { exact: true }).fill(WORKSHOP_TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(
          () => JSON.parse(localStorage.getItem("tilefun.workshop.v1") ?? "{}").state.outbox.length,
        ),
      )
      .toBe(0);
    const records = (await (await page.request.get("/tilefun/api/art-notes")).json()) as ArtNote[];
    expect(records.filter((r) => r.note === label)).toHaveLength(1);
  } finally {
    await context.close();
  }
});

test("native room pins and drafts survive reload and use the existing feedback contract", async ({
  page,
}) => {
  const room = manifest.candidates.find((c) => c.kind === "interior" && !c.excluded);
  if (!room) throw new Error("No room fixture");
  const previous = {
    current: room.id,
    stage: "all",
    uncheckedOnly: true,
    records: [],
    outbox: [],
    batch: [],
    paused: false,
    draft: "Imported room draft",
    annotation: {
      caseId: room.id,
      fingerprint: room.fingerprint,
      pins: [{ x: 16, y: 16, size: 16 }],
    },
  };
  await page.addInitScript(
    ({ previous }) => {
      if (!localStorage.getItem("tilefun.indoor-review.v1"))
        localStorage.setItem("tilefun.indoor-review.v1", JSON.stringify(previous));
    },
    { previous },
  );
  await page.goto(`${URL}#/review/${encodeURIComponent(room.id)}?show=all`);
  await expect(page.locator('[data-review-ready="true"]')).toBeVisible();
  await expect(page.getByLabel("Note", { exact: true })).toHaveValue("Imported room draft");
  await expect(page.locator(".pin-overlay rect")).toHaveCount(1);
  await page.getByLabel("Candidate preview", { exact: true }).click({ position: { x: 2, y: 2 } });
  await expect(page.locator(".pin-overlay rect")).toHaveCount(2);
  await page.getByLabel("Note", { exact: true }).fill("Workshop room join report");
  await page.reload();
  await expect(page.locator('[data-review-ready="true"]')).toBeVisible();
  await expect(page.locator(".pin-overlay rect")).toHaveCount(2);
  await expect(page.getByLabel("Note", { exact: true })).toHaveValue("Workshop room join report");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/tilefun-workshop-room-phone.png", fullPage: true });
  await page.getByRole("button", { name: "Needs changes ✕", exact: true }).click();
  await expect
    .poll(async () => {
      const rows = await (await page.request.get("/tilefun/api/interior-review")).json();
      return rows.find(
        (r: { caseId: string; note: string }) =>
          r.caseId === room.id && r.note === "Workshop room join report",
      );
    })
    .toMatchObject({
      fingerprint: room.fingerprint,
      verdict: "wrong",
      pins: expect.arrayContaining([
        { x: 16, y: 16, size: 16 },
        { x: 0, y: 0, size: 16 },
      ]),
    });
});
