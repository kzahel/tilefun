import { readFileSync } from "node:fs";
import { chromium, expect, test } from "@playwright/test";
import type { WorkshopManifest } from "../src/workshop/WorkshopTypes.js";
import { WORKSHOP_TEST_STATE } from "./workshop-setup.js";

const manifest = JSON.parse(
  readFileSync("public/data/workshop-manifest.json", "utf8"),
) as WorkshopManifest;
test("GPU Chromium at retina scale renders every district with the registered pixel hash", async () => {
  // Playwright's default headless-shell uses a different raster path than normal
  // Chromium. Exercise the actual full browser binary rather than repeating it.
  const browser = await chromium.launch({ channel: "chromium", headless: true });
  try {
    const context = await browser.newContext({
      baseURL: "http://localhost:4174",
      deviceScaleFactor: 2,
      viewport: { width: 1280, height: 900 },
      storageState: WORKSHOP_TEST_STATE,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const candidate of manifest.candidates.filter((c) =>
      ["districts", "commercial"].includes(c.batchId),
    )) {
      await page.goto(
        `/tilefun/workshop.html#/review/${encodeURIComponent(candidate.id)}?show=all`,
      );
      await expect(page.locator('[data-review-ready="true"]')).toBeVisible();
      await expect(page.getByRole("button", { name: "Looks right ✓", exact: true })).toBeEnabled();
      const actual = await page
        .getByLabel("Candidate preview", { exact: true })
        .evaluate(async (node) => {
          const canvas = node as HTMLCanvasElement;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw Error("Missing preview context");
          const hash = async (bytes: BufferSource) =>
            [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
              .map((n) => n.toString(16).padStart(2, "0"))
              .join("");
          return hash(
            new TextEncoder().encode(
              `${canvas.width}:${canvas.height}:${await hash(ctx.getImageData(0, 0, canvas.width, canvas.height).data)}`,
            ),
          );
        });
      expect(actual).toBe(candidate.fingerprint);
      if (candidate.id === "district:district-v1-neighborhood")
        await page.screenshot({
          path: "/tmp/tilefun-workshop-gpu-district-desktop.png",
          fullPage: true,
        });
    }
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
  }
});
