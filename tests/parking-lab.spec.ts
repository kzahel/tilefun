import { readFileSync } from "node:fs";
import { chromium, expect, test } from "@playwright/test";
import type { WorkshopManifest } from "../src/workshop/WorkshopTypes.js";
import { WORKSHOP_TEST_STATE } from "./workshop-setup.js";

test("parking layouts, empty patterns, grid and phone inspection", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tilefun/workshop.html#/tool/parking-lab");
  await expect(page.locator('[data-parking-ready="true"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "Parking lot lab" })).toBeVisible();
  await expect(page.getByLabel("Shopping center parking layout")).toBeVisible();
  await expect(page.getByText(/64 spaces · \d+ parked cars/)).toBeVisible();
  const populated = await page
    .getByLabel("Shopping center parking layout")
    .evaluate((node) => (node as HTMLCanvasElement).toDataURL());
  await page.getByLabel("Show parked cars").uncheck();
  await expect(page.getByText("64 spaces · 0 parked cars")).toBeVisible();
  expect(
    await page
      .getByLabel("Shopping center parking layout")
      .evaluate((node) => (node as HTMLCanvasElement).toDataURL()),
  ).not.toBe(populated);
  await page.getByLabel("Tile grid & drive aisles").check();
  await expect(page.locator('[data-parking-ready="true"]')).toBeVisible();
  await page.getByRole("button", { name: /^Town shops/ }).click();
  await expect(page.getByLabel("Town shops parking layout")).toBeVisible();
  await expect(page).toHaveURL(/case=town/);
  await page.reload();
  await expect(page.getByRole("button", { name: /^Town shops/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /^Long parking bays/ }).click();
  await expect(page.getByLabel("Long parking bays parking layout")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole("link", { name: "Review this layout" }).click();
  await expect(page.locator('[data-review-ready="true"]')).toBeVisible();
  expect(errors).toEqual([]);
});

test("all three parking reviews match registered pixels in full Chromium", async () => {
  const manifest = JSON.parse(
    readFileSync("public/data/workshop-manifest.json", "utf8"),
  ) as WorkshopManifest;
  const candidates = manifest.candidates.filter((c) => c.batchId === "parking-patterns");
  expect(candidates).toHaveLength(3);
  const browser = await chromium.launch({ channel: "chromium", headless: true });
  try {
    const page = await browser.newPage({
      baseURL: "http://localhost:4174",
      storageState: WORKSHOP_TEST_STATE,
      deviceScaleFactor: 2,
    });
    for (const candidate of candidates) {
      await page.goto(
        `/tilefun/workshop.html#/review/${encodeURIComponent(candidate.id)}?show=all`,
      );
      await expect(page.locator('[data-review-ready="true"]')).toBeVisible();
      await expect(page.getByRole("button", { name: "Looks right ✓", exact: true })).toBeEnabled();
      const hash = await page
        .getByLabel("Candidate preview", { exact: true })
        .evaluate(async (node) => {
          const canvas = node as HTMLCanvasElement,
            ctx = canvas.getContext("2d");
          if (!ctx) throw Error("Missing parking canvas");
          const sha = async (data: BufferSource) =>
            [...new Uint8Array(await crypto.subtle.digest("SHA-256", data))]
              .map((n) => n.toString(16).padStart(2, "0"))
              .join("");
          return sha(
            new TextEncoder().encode(
              `${canvas.width}:${canvas.height}:${await sha(ctx.getImageData(0, 0, canvas.width, canvas.height).data)}`,
            ),
          );
        });
      expect(hash).toBe(candidate.fingerprint);
    }
  } finally {
    await browser.close();
  }
});
