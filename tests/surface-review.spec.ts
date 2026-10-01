import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { required } from "../src/art/ArtCatalog.js";
import type { ArtNote } from "../src/art/ArtNotes.js";
import {
  CITY_SURFACE_CASES,
  citySurfaceComposition,
  composeCitySurface,
} from "../src/road/CitySurfaceRecipes.js";
import approvedSurfaces from "./fixtures/road-foundation-v1.json" with { type: "json" };

const URL = "/tilefun/building-lab.html?run=surfaces";
const ready = '#app[data-ready="true"]';

test("all surface recipes render exact source pixels and keep phone review controls visible", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/art-notes", (r) => r.fulfill({ json: [] }));
  await page.goto(URL);
  await expect(page.locator(ready)).toBeVisible();
  await expect(page.locator("#review-progress")).toContainText("1/9");
  await page.locator("#building-note").fill("Narrow street draft");
  await page.locator("#next-building").click();
  await expect(page.locator("#building-note")).toHaveValue("");
  await page.locator("#previous-building").click();
  await expect(page.locator("#building-note")).toHaveValue("Narrow street draft");
  await expect(page.locator("#prefab-options")).toBeHidden();
  for (const c of CITY_SURFACE_CASES) {
    await page.locator("#surface-case").selectOption(c.id);
    await expect(page.locator("#recipe-id")).toHaveText(c.id);
    await expect(page.locator("#name")).toHaveText(c.name);
    const pieces = composeCitySurface(c);
    const approved = approvedSurfaces[c.id as keyof typeof approvedSurfaces];
    if (approved) {
      expect(
        createHash("sha256")
          .update(JSON.stringify(citySurfaceComposition(c)))
          .digest("hex"),
      ).toBe(approved.revision);
      const fingerprint = await page.locator("#building").evaluate(async (el) => {
        const canvas = el as HTMLCanvasElement;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Missing canvas");
        const sha = async (value: BufferSource) =>
          [...new Uint8Array(await crypto.subtle.digest("SHA-256", value))]
            .map((v) => v.toString(16).padStart(2, "0"))
            .join("");
        const pixels = await sha(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
        return sha(new TextEncoder().encode(`${canvas.width}:${canvas.height}:${pixels}`));
      });
      expect(fingerprint).toBe(approved.renderFingerprint);
    }
    // Composite the canonical placements independently at native resolution and
    // compare every unannotated pixel with the visible scaled preview.
    expect(
      await page.evaluate(async (pieces) => {
        const im = new Image();
        im.src = "/tilefun/assets/tilesets/me-complete.png";
        await im.decode();
        const expected = document.createElement("canvas");
        expected.width = 1024;
        expected.height = 768;
        const ctx = expected.getContext("2d");
        if (!ctx) throw new Error("Missing reference canvas");
        ctx.imageSmoothingEnabled = false;
        for (const p of pieces) {
          const [x, y, w, h] = p.rect;
          ctx.drawImage(im, x, y, w, h, p.x * 2, p.y * 2, w * 2, h * 2);
        }
        const actualCtx = document.querySelector<HTMLCanvasElement>("#building")?.getContext("2d");
        if (!actualCtx) throw new Error("Missing review canvas");
        const actual = actualCtx.getImageData(0, 0, 1024, 768).data;
        const reference = ctx.getImageData(0, 0, 1024, 768).data;
        return actual.every((v, i) => v === reference[i]);
      }, pieces),
    ).toBe(true);
    // Save native canvas pixels, independent of fit-preview styling.
    await page.locator("#building").evaluate((el) => {
      (window as unknown as { surfaceCapture: string }).surfaceCapture = (
        el as HTMLCanvasElement
      ).toDataURL();
    });
    const data = await page.evaluate(
      () => (window as unknown as { surfaceCapture: string }).surfaceCapture,
    );
    const { writeFileSync } = await import("node:fs");
    writeFileSync(`/tmp/tilefun-${c.id}.png`, Buffer.from(required(data.split(",")[1]), "base64"));
    await page.setViewportSize({ width: 390, height: 844 });
    for (const id of [
      "building",
      "previous-building",
      "next-building",
      "approve-building",
      "reject-building",
    ]) {
      const b = required(await page.locator(`#${id}`).boundingBox());
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height).toBeLessThanOrEqual(844);
    }
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/tilefun-surface-review-phone.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("surface verdicts use independent recipe identities, pause after two reports and reopen changed pixels", async ({
  page,
}) => {
  const notes: ArtNote[] = [];
  let online = true;
  await page.route("**/api/art-notes", (r) => {
    if (!online) return r.abort();
    if (r.request().method() === "POST") {
      notes.push(r.request().postDataJSON());
      return r.fulfill({ json: { saved: true } });
    }
    return r.fulfill({ json: notes });
  });
  await page.goto(URL);
  await expect(page.locator(ready)).toBeVisible();
  await page.locator("#approve-building").click();
  await expect(page.locator("#review-progress")).toContainText("1 approved");
  expect(notes[0]?.buildingReview).toMatchObject({
    scene: "surface",
    caseId: "surface-v1-narrow",
    prefabIds: [],
    surfaceRecipe: "city-surfaces-v1",
    renderFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
  });
  await page.locator("#geometry").check();
  await page.locator("#scale").selectOption("native");
  await page.locator("#building-note").fill("Change this curb");
  await page.locator("#reject-building").click();
  online = false;
  await page.locator("#building-note").fill("Change this crossing");
  await page.locator("#reject-building").click();
  await expect(page.locator("#review-pause")).toBeVisible();
  await page.reload();
  await expect(page.locator("#review-pause")).toBeVisible();
  await expect(page.locator("#queue-sync")).toContainText("pending server save");
  online = true;
  await page.locator("#refresh-building-notes").click();
  await expect(page.locator("#queue-sync")).toHaveText("Server inbox up to date.");
  await page.goto("/tilefun/building-lab.html?run=streets");
  await expect(page.locator(ready)).toBeVisible();
  await expect(page.locator("#review-progress")).toContainText("1/6 · 0 approved");
  await page.goto("/tilefun/building-lab.html");
  await expect(page.locator(ready)).toBeVisible();
  await expect(page.locator("#review-progress")).toContainText("0 approved");
  required(required(notes[0]).buildingReview).renderFingerprint = "0".repeat(64);
  await page.goto(URL);
  await page.locator("#undo-building").click();
  await expect(page.locator("#review-pause")).toBeHidden();
  await page.locator("#review-filter").selectOption("unchecked");
  await expect(page.locator("#review-progress")).toContainText("0 approved");
});

test("real isolated inbox accepts surface feedback and links to the exact case", async ({
  page,
  request,
}) => {
  await page.goto(`${URL}&case=surface-v1-boulevard`);
  await expect(page.locator(ready)).toBeVisible();
  const marker = `Surface API ${Date.now()}`;
  await page.locator("#building-note").fill(marker);
  await page.locator("#save-building-note").click();
  await expect(page.locator("#feedback-sync")).toHaveText("Server inbox up to date.");
  const notes = (await (await request.get("/tilefun/api/art-notes")).json()) as ArtNote[];
  expect(notes.find((n) => n.note === marker)?.buildingReview).toMatchObject({
    scene: "surface",
    caseId: "surface-v1-boulevard",
    surfaceRecipe: "city-surfaces-v1",
    prefabIds: [],
  });
  await page.goto("/tilefun/art-workbench.html?sheet=me-complete");
  await expect(
    page.locator(`a[href*="run=surfaces"][href*="surface-v1-boulevard"]`).first(),
  ).toBeVisible();
});
