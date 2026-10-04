import { readFileSync } from "node:fs";
import { chromium, expect, test } from "@playwright/test";
import type { WildlifeReview } from "../src/workshop/WildlifeCandidates.js";
import type { WorkshopManifest } from "../src/workshop/WorkshopTypes.js";
import { WORKSHOP_TEST_STATE } from "./workshop-setup.js";

const manifest = JSON.parse(
  readFileSync("public/data/workshop-manifest.json", "utf8"),
) as WorkshopManifest;
const definitions = JSON.parse(
  readFileSync("src/wildlife/reviews.json", "utf8"),
) as WildlifeReview[];

test("supervised wildlife revisions appear without feedback and preserve native pixels in full Chromium", async () => {
  const browser = await chromium.launch({ channel: "chromium", headless: true });
  try {
    const context = await browser.newContext({
      baseURL: "http://localhost:4174",
      storageState: WORKSHOP_TEST_STATE,
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    const inbox = await (await context.request.get("/tilefun/api/workshop/inbox")).json();
    const pilots = definitions.filter((d) => d.batchId.startsWith("wildlife-v2-supervised-"));
    expect(pilots.length).toBeGreaterThan(0);
    for (const d of pilots) {
      const id = `pattern:wildlife-v2-${d.id}`;
      expect(manifest.candidates.find((c) => c.id === id)?.kind).toBe("wildlife");
      expect(inbox.candidates.some((c: { id: string }) => c.id === id)).toBe(true);
      expect(inbox.candidates.find((c: { id: string }) => c.id === id)?.state).toBe("unchecked");
      await page.goto(`/tilefun/workshop.html#/review/${encodeURIComponent(id)}`);
      await expect(page.locator('[data-review-ready="true"]')).toBeVisible();
      await expect(page.getByRole("button", { name: "Looks right ✓", exact: true })).toBeEnabled();
      expect(
        await page.getByLabel("Candidate preview", { exact: true }).evaluate(
          async (node, { scene, contact }) => {
            const images = await Promise.all(
              [scene, contact].map(async (path) => {
                const image = new Image();
                image.src = `/tilefun/${path}`;
                await image.decode();
                return image;
              }),
            );
            const [sceneImage, contactImage] = images;
            if (!sceneImage || !contactImage) throw new Error("Missing preview images");
            const expected = document.createElement("canvas");
            expected.width = Math.max(sceneImage.width, contactImage.width);
            expected.height = sceneImage.height + contactImage.height;
            const ctx = expected.getContext("2d");
            if (!ctx) throw new Error("Missing canvas context");
            ctx.drawImage(sceneImage, 0, 0);
            ctx.drawImage(contactImage, 0, sceneImage.height);
            return (node as HTMLCanvasElement).toDataURL() === expected.toDataURL();
          },
          { scene: d.scene.image, contact: d.contact.image },
        ),
      ).toBe(true);
    }
    await page.goto("/tilefun/demos/wildlife-v2/");
    await expect(page.locator("#drafts article")).toHaveCount(definitions.length);
    const first = definitions[0];
    if (!first) throw new Error("Missing registered pilot");
    await expect(
      page.getByRole("link", { name: "Play movement and actions" }).first(),
    ).toHaveAttribute("href", first.galleryUrl);
  } finally {
    await browser.close();
  }
});

test("changed playback bytes disable exact wildlife feedback", async ({ page }) => {
  const d = definitions[0];
  if (!d) throw new Error("Missing registered pilot");
  const file = d.files.find((f) => f.path.endsWith("playback.js"));
  if (!file) throw new Error("Pilot lacks registered playback source");
  await page.route(`**/tilefun/${file.path}`, async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\n// changed revision\n` });
  });
  await page.goto(
    `/tilefun/workshop.html#/review/${encodeURIComponent(`pattern:wildlife-v2-${d.id}`)}`,
  );
  await expect(
    page.getByText(`Wildlife artifact changed: ${file.path}`, { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Looks right ✓", exact: true })).toBeDisabled();
  await expect(page.locator('[data-review-ready="true"]')).toHaveCount(0);
});

test("missing archived motion evidence blocks human feedback", async ({ page }) => {
  const d = definitions[0];
  if (!d) throw new Error("Missing registered pilot");
  const file = d.files.find((f) => f.path.endsWith(".gif"));
  if (!file) throw new Error("Pilot lacks animation evidence");
  await page.route(`**/tilefun/${file.path}`, (route) => route.fulfill({ status: 404, body: "" }));
  await page.goto(
    `/tilefun/workshop.html#/review/${encodeURIComponent(`pattern:wildlife-v2-${d.id}`)}`,
  );
  await expect(
    page.getByText(`Wildlife artifact changed: ${file.path}`, { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Looks right ✓", exact: true })).toBeDisabled();
});
