import { test as base, expect, type Page } from "@playwright/test";
import { furnitureSignature } from "../../src/interiors/FurnishedInterior.js";
import { reviewCases } from "../../src/interiors/review/ReviewCases.js";
import type { ReviewFeedback } from "../../src/interiors/review/ReviewFeedback.js";

/** Capture unmarked native-resolution renders through the public review UI. */
export async function captureReviewRenders(page: Page, ids: string[], images = false) {
  await page.goto("/tilefun/interior-review.html?stage=all&unchecked=0");
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  return page.evaluate(
    async ({ ids, furniture, images }) => {
      const wanted = new Set(ids);
      const visited = new Set<string>();
      const results: { id: string; fingerprint: string; png: string }[] = [];
      while (results.length < wanted.size) {
        const canvas = document.querySelector<HTMLCanvasElement>("#render");
        const id = document.querySelector("#case-id")?.textContent;
        const sketch = document.querySelector("#sketch")?.textContent;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx || !id || !sketch) throw new Error("Missing review canvas");
        if (visited.has(id)) throw new Error("A requested case disappeared from the review pool");
        visited.add(id);
        if (wanted.has(id)) {
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          const header = new TextEncoder().encode(
            `${sketch}\n${canvas.width},${canvas.height}\n${furniture[id] ?? ""}`,
          );
          const bytes = new Uint8Array(header.length + pixels.length);
          bytes.set(header);
          bytes.set(pixels, header.length);
          const fingerprint = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
          results.push({ id, fingerprint, png: images ? canvas.toDataURL("image/png") : "" });
        }
        document.querySelector<HTMLButtonElement>("#skip")?.click();
      }
      return results;
    },
    {
      ids,
      images,
      furniture: Object.fromEntries(
        reviewCases().map((c) => [c.id, c.furniture ? furnitureSignature(c.furniture) : ""]),
      ),
    },
  );
}

export const test = base.extend<{ reviewRecords: ReviewFeedback[] }>({
  reviewRecords: async ({ browser, baseURL }, use) => {
    // Functional scenarios need current approvals in this browser, not hashes
    // from a visual reference captured on another OS. Keep setup storage isolated.
    if (!baseURL) throw new Error("Review scenarios require a configured baseURL");
    const context = await browser.newContext({ baseURL });
    try {
      const page = await context.newPage();
      await page.route("**/api/interior-review", (route) => route.fulfill({ json: [] }));
      const cases = reviewCases();
      const renders = await captureReviewRenders(
        page,
        cases.map((c) => c.id),
      );
      const fingerprints = new Map(renders.map((r) => [r.id, r.fingerprint]));
      await use(
        cases.map((c) => {
          const fingerprint = fingerprints.get(c.id);
          if (!fingerprint) throw new Error(`Missing current fingerprint for ${c.id}`);
          return {
            id: `current-${c.id}`,
            caseId: c.id,
            name: c.name,
            sketch: c.sketch,
            fingerprint,
            verdict: "good",
            note: "",
            createdAt: "2026-09-29T00:00:00Z",
          };
        }),
      );
    } finally {
      await context.close();
    }
  },
});

export { expect };
