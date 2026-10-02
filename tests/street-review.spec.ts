import { expect, test } from "@playwright/test";
import { required } from "../src/art/ArtCatalog.js";
import type { ArtNote } from "../src/art/ArtNotes.js";
import { STREET_REVIEW_SCENES } from "../src/generation/regional/StreetRecipes.js";
import { denseCitySurfacePieces } from "../src/road/DenseCitySurface.js";
import { RoadType } from "../src/road/RoadType.js";

const URL = "/tilefun/building-lab.html?run=streets";
const ready = '#app[data-ready="true"]';

test("street starter renders the dense neighborhood's source pavement, curb and asphalt pixels", async ({
  page,
}) => {
  await page.route("**/api/art-notes", (r) => r.fulfill({ json: [] }));
  await page.goto(URL);
  await expect(page.locator(ready)).toBeVisible();
  const query = (_x: number, y: number) => (y >= 6 ? RoadType.CityAsphalt : RoadType.CityPavement);
  // The gap between parking bays is free of guide paint and furniture.
  const samples = [3, 6, 10].map((y) =>
    required(denseCitySurfacePieces(query(-1, y), -1, y, query)[0]),
  );
  const scene = required(STREET_REVIEW_SCENES[0]);
  const matches = await page.locator("#building").evaluate(
    async (el, { samples, bounds }) => {
      const actual = (el as HTMLCanvasElement).getContext("2d");
      if (!actual) throw new Error("Missing preview canvas");
      const image = new Image();
      image.src = "/tilefun/assets/tilesets/me-complete.png";
      await image.decode();
      const tile = document.createElement("canvas");
      tile.width = tile.height = 32;
      const expected = tile.getContext("2d");
      if (!expected) throw new Error("Missing source canvas");
      expected.imageSmoothingEnabled = false;
      return samples.map((p) => {
        const [sx, sy, width, height] = p.rect;
        expected.clearRect(0, 0, 32, 32);
        expected.drawImage(image, sx, sy, width, height, 0, 0, 32, 32);
        const a = actual.getImageData(
          (p.x - bounds.minX) * 2,
          (p.y - bounds.minY) * 2,
          32,
          32,
        ).data;
        const b = expected.getImageData(0, 0, 32, 32).data;
        return a.every((v, i) => v === b[i]);
      });
    },
    { samples, bounds: scene.bounds },
  );
  expect(matches).toEqual([true, true, true]);
});

test("street starter renders every shared scene, source links and mobile review in view", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/art-notes", (r) => r.fulfill({ json: [] }));
  await page.goto(URL);
  await expect(page.locator(ready)).toBeVisible();
  await expect(page.locator("#review-progress")).toContainText("1/6");
  await expect(page.locator("#scene-options")).toBeHidden();
  await expect(page.locator("#prefab-options")).toBeHidden();
  for (const s of STREET_REVIEW_SCENES) {
    await page.locator("#street-case").selectOption(s.id);
    await expect(page.locator("#recipe-id")).toHaveText(s.id);
    await expect(page.locator("#name")).toHaveText(s.name);
    await expect(page).toHaveURL(new RegExp(`case=${s.id}$`));
    await expect(page.locator("#facts")).toContainText(`${s.props.length} street props`);
    expect(await page.locator("#pieces a").count()).toBe(s.props.length);
    await page.locator("#building").screenshot({ path: `/tmp/tilefun-${s.id}.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    for (const id of [
      "building",
      "previous-building",
      "next-building",
      "approve-building",
      "reject-building",
    ]) {
      const b = await page.locator(`#${id}`).boundingBox();
      expect(b?.y).toBeGreaterThanOrEqual(0);
      expect((b?.y ?? 1000) + (b?.height ?? 0)).toBeLessThanOrEqual(844);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  await page.locator("#geometry").check();
  await page.screenshot({ path: "/tmp/tilefun-street-review-geometry.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/tilefun-street-review-phone.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("street review saves exact scenes, pauses at two reports, persists offline and does not alter building queues", async ({
  page,
}) => {
  const saved: ArtNote[] = [];
  let online = true;
  await page.route("**/api/art-notes", async (r) => {
    if (!online) return r.abort();
    if (r.request().method() === "POST") {
      saved.push(r.request().postDataJSON());
      return r.fulfill({ json: { saved: true } });
    }
    return r.fulfill({ json: saved });
  });
  await page.goto(URL);
  await expect(page.locator(ready)).toBeVisible();
  await page.locator("#approve-building").click();
  await expect(page.locator("#queue-sync")).toHaveText("Server inbox up to date.");
  expect(saved[0]?.buildingReview).toMatchObject({
    scene: "street",
    caseId: "street-v1-meters",
    propTypes: ["prop-city-street-v1-meter"],
    prefabIds: ["prop-city-v1-bakery-2"],
    revision: expect.stringMatching(/^[a-f0-9]{64}$/),
    renderFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    url: "/tilefun/building-lab.html?run=streets&case=street-v1-meters",
  });
  await page.locator("#reject-building").click();
  expect(saved).toHaveLength(1);
  await expect(page.locator("#building-note")).toBeFocused();
  await page.locator("#building-note").fill("Lamp is too low");
  await page.locator("#reject-building").click();
  await expect(page.locator("#review-progress")).toContainText("1 need changes");
  online = false;
  await page.locator("#building-note").fill("Bin perspective needs work");
  await page.locator("#reject-building").click();
  await expect(page.locator("#review-pause")).toBeVisible();
  await expect(page.locator("#queue-sync")).toContainText("pending server save");
  await page.reload();
  await expect(page.locator("#review-pause")).toBeVisible();
  online = true;
  await page.locator("#refresh-building-notes").click();
  await expect(page.locator("#queue-sync")).toHaveText("Server inbox up to date.");
  expect(saved).toHaveLength(3);
  await page.goto("/tilefun/building-lab.html");
  await expect(page.locator(ready)).toBeVisible();
  await expect(page.locator("#review-pause")).toBeHidden();
  await expect(page.locator("#review-progress")).toContainText("0 approved");
  await expect(page.locator("#undo-building")).toBeDisabled();
  await page.goto(URL);
  await expect(page.locator("#review-pause")).toBeVisible();
  await page.locator("#undo-building").click();
  await expect(page.locator("#review-pause")).toBeHidden();
  await expect(page.locator("#review-verdict")).toContainText("Unchecked");
});

test("street judgments are accepted by the real shared note API and link back from the atlas", async ({
  page,
}) => {
  const note = `Street source context ${crypto.randomUUID()}`;
  await page.goto(`${URL}&case=street-v1-parking`);
  await expect(page.locator(ready)).toBeVisible();
  await page.locator("#building-note").fill(note);
  await page.locator("#save-building-note").click();
  await expect(page.locator("#feedback-sync")).toHaveText("Server inbox up to date.");
  const rows = await (await page.request.get("/tilefun/api/art-notes")).json();
  const row = rows.find((r: ArtNote) => r.note === note) as ArtNote;
  expect(row.buildingReview?.caseId).toBe("street-v1-parking");
  expect(row.buildingReview?.propTypes).toContain("prop-city-street-v1-car-west");
  await page.goto("/tilefun/art-workbench.html");
  await expect(page.getByRole("link", { name: /Review street-v1-parking/ }).last()).toBeAttached();
  // Exercise a real verdict POST without synthesizing any live human approval.
  await page.goto(`${URL}&case=street-v1-meters`);
  await expect(page.locator(ready)).toBeVisible();
  await page.locator("#approve-building").click();
  await expect(page.locator("#queue-sync")).toHaveText("Server inbox up to date.");
  const decisions = await (await page.request.get("/tilefun/api/art-notes")).json();
  expect(
    decisions.some(
      (r: ArtNote) =>
        r.buildingReview?.caseId === "street-v1-meters" && r.buildingVerdict?.value === "approved",
    ),
  ).toBe(true);
});

test("street drafts and exact appearance approvals survive debug views; changed renders reopen", async ({
  page,
}) => {
  let saved: ArtNote[] = [];
  await page.route("**/api/art-notes", async (r) => {
    if (r.request().method() === "POST") {
      saved.push(r.request().postDataJSON());
      return r.fulfill({ json: { saved: true } });
    }
    return r.fulfill({ json: saved });
  });
  await page.goto(URL);
  await expect(page.locator(ready)).toBeVisible();
  await page.locator("#building-note").fill("Meter draft");
  await page.locator("#next-building").click();
  await expect(page.locator("#building-note")).toHaveValue("");
  await page.locator("#previous-building").click();
  await expect(page.locator("#building-note")).toHaveValue("Meter draft");
  await page.locator("#approve-building").click();
  await page.locator("#review-filter").selectOption("approved");
  await page.locator("#geometry").check();
  await page.locator("#scale").selectOption("large");
  await expect(page.locator("#review-verdict")).toContainText("Approved");
  saved = saved.map((n) => ({
    ...n,
    buildingReview: { ...required(n.buildingReview), renderFingerprint: "f".repeat(64) },
  }));
  await page.locator("#refresh-building-notes").click();
  await expect(page.locator("#review-progress")).toContainText("0 approved");
  await page.locator("#review-filter").selectOption("unchecked");
  await page.locator("#street-case").selectOption("street-v1-meters");
  await expect(page.locator("#review-verdict")).toContainText("Unchecked");
});
