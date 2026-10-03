import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { WorkshopManifest } from "../src/workshop/WorkshopTypes.js";

// GPU-enabled bundled Chromium: the user's browser must match manifest pixels.
test.use({ channel: "chromium" });
const manifest = JSON.parse(
  readFileSync("public/data/workshop-manifest.json", "utf8"),
) as WorkshopManifest;
const rails = manifest.candidates.filter((c) => c.kind === "railway");
const url = (id: string) =>
  `/tilefun/workshop.html#/review/${encodeURIComponent(`pattern:rail-v1-${id}`)}?show=all`;

test("all railway proposals verify in normal Chromium and are discoverable before feedback", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (e) => {
    // Workshop has no root favicon; keep React/render failures visible.
    if (e.type() === "error" && !e.location().url.endsWith("/favicon.ico")) errors.push(e.text());
  });
  await page.goto("/tilefun/workshop.html#/tool/railways");
  await expect(page.getByRole("heading", { name: "Railway previews", exact: true })).toBeVisible();
  expect(rails).toHaveLength(32);
  await expect(page.locator(".case-list a")).toHaveCount(32);
  for (const c of rails) {
    await page.goto(`${c.url}?show=all`);
    await expect(page.locator('[data-review-ready="true"]')).toBeVisible();
    await expect(page.locator(".railway-controls")).toHaveCount(1);
    await expect(page.getByLabel("Candidate preview", { exact: true })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Looks right ✓", exact: true })).toBeEnabled();
  }
  expect(errors).toEqual([]);
});

test("motion pauses, scrubs, slows and survives geometry controls on phone", async ({ page }) => {
  await page.goto(url("white-south"));
  await expect(page.locator('[data-review-ready="true"]')).toBeVisible();
  const canvas = page.getByLabel("Candidate preview", { exact: true });
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-rail-time")))
    .toBeGreaterThan(0.2);
  await page.getByRole("button", { name: "Pause motion", exact: true }).click();
  const t = Number(await canvas.getAttribute("data-rail-time"));
  await page.waitForTimeout(250);
  expect(Number(await canvas.getAttribute("data-rail-time"))).toBeCloseTo(t, 1);
  await page.getByLabel("Preview time", { exact: true }).fill("6");
  await expect(canvas).toHaveAttribute("data-rail-time", "6.000");
  await page.getByLabel("Geometry / routes", { exact: true }).check();
  await expect(page.locator('[data-review-ready="true"]')).toBeVisible();
  await expect(canvas).toHaveAttribute("data-rail-time", "6.000");
  await page.getByLabel("Playback speed", { exact: true }).selectOption("0.25");
  await page.getByRole("button", { name: "Play motion", exact: true }).click();
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-rail-time")))
    .toBeGreaterThan(6.05);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/tilefun-railway-phone.png", fullPage: true });
});

test("railway decisions persist against exact identity and reject stale fingerprints", async ({
  page,
}) => {
  const c = rails.find((c) => c.id === "pattern:rail-v1-rails-grey");
  if (!c) throw Error("Missing rail case");
  const session = await (await page.request.get("/tilefun/api/auth/session")).json();
  const headers = {
    "X-Workshop-CSRF": session.csrfToken,
    Origin: new URL(String(test.info().project.use.baseURL)).origin,
  };
  const stale = await page.request.post("/tilefun/api/workshop/events", {
    headers,
    data: {
      id: crypto.randomUUID(),
      type: "review",
      candidateId: c.id,
      fingerprint: "0".repeat(64),
      verdict: "approved",
      note: "isolated stale test",
    },
  });
  expect(stale.status()).toBe(409);
  await page.goto(url("rails-grey"));
  await expect(page.locator('[data-review-ready="true"]')).toBeVisible();
  await page.getByLabel("Note", { exact: true }).fill("Isolated browser test only");
  await page.getByRole("button", { name: "Looks right ✓", exact: true }).click();
  await expect
    .poll(async () => {
      const inbox = await (await page.request.get("/tilefun/api/workshop/inbox")).json();
      return inbox.candidates.find((r: { id: string }) => r.id === c.id)?.state;
    })
    .toBe("approved");
  await page.goto(url("rails-grey"));
  await expect(page.locator(".page-heading .state")).toContainText("Approved");
});

test("changed preview blocks review, reasons are required and two reports pause only that batch", async ({
  page,
}) => {
  let changed = false;
  await page.route("**/api/workshop/inbox", async (route) => {
    const response = await route.fetch();
    const inbox = await response.json();
    if (changed)
      inbox.candidates = inbox.candidates.map((c: { id: string; fingerprint: string }) =>
        c.id === "pattern:rail-v1-blue-east" ? { ...c, fingerprint: "1".repeat(64) } : c,
      );
    await route.fulfill({ json: inbox });
  });
  await page.goto(url("blue-east"));
  await expect(page.locator('[data-review-ready="true"]')).toBeVisible();
  await page.getByRole("button", { name: "Needs changes ✕", exact: true }).click();
  await expect(page.getByText("Add a reason for Needs changes.")).toBeVisible();
  await page.getByLabel("Note", { exact: true }).fill("First isolated report");
  await page.getByRole("button", { name: "Needs changes ✕", exact: true }).click();
  await expect(
    page.locator('[data-candidate="pattern:rail-v1-blue-west"][data-review-ready="true"]'),
  ).toBeVisible();
  await page.getByLabel("Note", { exact: true }).fill("Second isolated report");
  await page.getByRole("button", { name: "Needs changes ✕", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ready for the next fix." })).toBeVisible();
  await page.goto(url("network"));
  await expect(page.locator('[data-review-ready="true"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Looks right ✓", exact: true })).toBeEnabled();
  changed = true;
  await page.goto(url("blue-east"));
  await expect(
    page.getByText("Railway preview changed. Regenerate the manifest before reviewing."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Looks right ✓", exact: true })).toBeDisabled();
});
