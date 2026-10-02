import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type ArtCatalog, required } from "./ArtCatalog.js";
import { type ArtNote, type BuildingReview, parseArtNote, sameArtTarget } from "./ArtNotes.js";
import { buildingCaseKey, currentBuildingVerdict } from "./BuildingReviewQueue.js";

const catalog = JSON.parse(readFileSync("public/data/art-catalog.json", "utf8")) as ArtCatalog;
const sheet = required(catalog.sheets[0]);
const review: BuildingReview = {
  scene: "single",
  prefabIds: ["prop-city-v1-bakery-2"],
  revision: "a".repeat(64),
  renderFingerprint: "b".repeat(64),
  url: "/tilefun/building-lab.html?scene=single&prefab=prop-city-v1-bakery-2",
};
function decision(value: "approved" | "changes" | "clear", day = 1): ArtNote {
  const createdAt = `2026-09-${String(day).padStart(2, "0")}T12:00:00Z`;
  return {
    id: `n-${day}`,
    threadId: `t-${day}`,
    sheetId: sheet.id,
    fingerprint: sheet.fingerprint,
    sheetSize: [sheet.width, sheet.height],
    rect: [0, 0, 16, 16],
    sliceKeys: [],
    intent: "building",
    status: value === "changes" ? "pending" : "resolved",
    note: "Human review",
    reply: "",
    createdAt,
    buildingReview: review,
    buildingVerdict: { value, createdAt },
  };
}
describe("building approval identities", () => {
  it("round trips street context and keeps scene approvals independent of their shared building", () => {
    const street: BuildingReview = {
      ...review,
      scene: "street",
      caseId: "street-v1-meters",
      propTypes: ["prop-city-street-v1-meter"],
      url: "/tilefun/building-lab.html?run=streets&case=street-v1-meters",
    };
    const note = { ...decision("approved"), buildingReview: street };
    expect(parseArtNote(note, catalog)).toEqual(note);
    expect(buildingCaseKey(street)).toBe("street:street-v1-meters");
    expect(currentBuildingVerdict([note], sheet.fingerprint, street)).toBe("approved");
    expect(currentBuildingVerdict([note], sheet.fingerprint, review)).toBeUndefined();
    expect(
      currentBuildingVerdict([note], sheet.fingerprint, { ...street, caseId: "street-v1-bins" }),
    ).toBeUndefined();
    for (const change of [
      { caseId: undefined },
      { propTypes: undefined },
      { url: "/tilefun/building-lab.html?run=streets&case=street-v1-bins" },
      { url: "/tilefun/building-lab.html?run=streets-other&case=street-v1-meters" },
    ])
      expect(() =>
        parseArtNote({ ...note, buildingReview: { ...street, ...change } }, catalog),
      ).toThrow();
    expect(
      sameArtTarget(note, {
        ...note,
        buildingReview: { ...street, propTypes: ["prop-city-street-v1-bin-blue"] },
      }),
    ).toBe(false);
  });
  it("round trips terrain-only reviews and rejects ambiguous or mismatched targets", () => {
    const surface: BuildingReview = {
      ...review,
      scene: "surface",
      prefabIds: [],
      caseId: "surface-v1-narrow",
      surfaceRecipe: "city-surfaces-v1",
      url: "/tilefun/building-lab.html?run=surfaces&case=surface-v1-narrow",
    };
    const note = { ...decision("approved"), buildingReview: surface };
    expect(parseArtNote(note, catalog)).toEqual(note);
    const geometry = {
      ...note,
      buildingReview: {
        ...surface,
        caseId: "surface-v2-rounded",
        surfaceRecipe: "city-surfaces-v2",
        url: "/tilefun/building-lab.html?run=road-geometry&case=surface-v2-rounded",
      },
    };
    expect(parseArtNote(geometry, catalog)).toEqual(geometry);
    expect(buildingCaseKey(surface)).toBe("surface:surface-v1-narrow");
    expect(currentBuildingVerdict([note], sheet.fingerprint, review)).toBeUndefined();
    for (const change of [
      { prefabIds: ["prop-city-v1-bakery-2"] },
      { caseId: undefined },
      { surfaceRecipe: undefined },
      { surfaceRecipe: "unknown" },
      { propTypes: [] },
      { url: "/tilefun/building-lab.html?run=streets&case=surface-v1-narrow" },
      { url: "/tilefun/building-lab.html?run=surfaces&case=surface-v1-other" },
    ])
      expect(() =>
        parseArtNote({ ...note, buildingReview: { ...surface, ...change } }, catalog),
      ).toThrow();
    expect(
      sameArtTarget(note, { ...note, buildingReview: { ...surface, surfaceRecipe: "changed" } }),
    ).toBe(false);
  });
  it("round trips district reviews and scopes them to the exact pinned scene", () => {
    const district: BuildingReview = {
      ...review,
      scene: "district",
      caseId: "district-v1-neighborhood",
      districtRecipe: "dense-district-v1",
      prefabIds: ["prop-city-dense-v1-bakery-3"],
      propTypes: ["prop-street-lamp"],
      url: "/tilefun/building-lab.html?run=districts&case=district-v1-neighborhood",
    };
    const note = { ...decision("approved"), buildingReview: district };
    expect(parseArtNote(note, catalog)).toEqual(note);
    expect(buildingCaseKey(district)).toBe("district:district-v1-neighborhood");
    const revised = {
      ...note,
      buildingReview: { ...district, districtRecipe: "dense-district-v2" as const },
    };
    expect(parseArtNote(revised, catalog)).toEqual(revised);
    expect(currentBuildingVerdict([note], sheet.fingerprint, district)).toBe("approved");
    expect(currentBuildingVerdict([note], sheet.fingerprint, review)).toBeUndefined();
    for (const change of [
      { caseId: undefined },
      { districtRecipe: "unknown" },
      { surfaceRecipe: "city-surfaces-v1" },
      { prefabIds: [] },
      { propTypes: undefined },
      { url: "/tilefun/building-lab.html?run=surfaces&case=district-v1-neighborhood" },
      { url: "/tilefun/building-lab.html?run=districts&case=district-v1-green" },
    ])
      expect(() =>
        parseArtNote({ ...note, buildingReview: { ...district, ...change } }, catalog),
      ).toThrow();
  });
  it("does not infer human approval from an ordinary resolved note", () => {
    const { buildingVerdict: _, ...note } = decision("approved");
    expect(currentBuildingVerdict([note], sheet.fingerprint, review)).toBeUndefined();
  });
  it("invalidates a judgment when art, recipe, or rendered pixels change", () => {
    const note = decision("approved");
    expect(currentBuildingVerdict([note], sheet.fingerprint, review)).toBe("approved");
    expect(currentBuildingVerdict([note], "c".repeat(64), review)).toBeUndefined();
    expect(
      currentBuildingVerdict([note], sheet.fingerprint, { ...review, revision: "c".repeat(64) }),
    ).toBeUndefined();
    expect(
      currentBuildingVerdict([note], sheet.fingerprint, {
        ...review,
        renderFingerprint: "c".repeat(64),
      }),
    ).toBeUndefined();
  });
  it("keeps decisions ordered by human time despite later agent replies", () => {
    const approval = {
      ...decision("approved", 1),
      createdAt: "2026-09-30T12:00:00Z",
      reply: "Older approval updated later",
    };
    const changes = {
      ...decision("changes", 2),
      status: "resolved" as const,
      reply: "Fixed; waiting for human review",
    };
    expect(currentBuildingVerdict([changes, approval], sheet.fingerprint, review)).toBe("changes");
  });
  it("undo reopens a candidate and never resurrects an older matching approval", () => {
    expect(
      currentBuildingVerdict(
        [decision("approved"), decision("clear", 2)],
        sheet.fingerprint,
        review,
      ),
    ).toBeUndefined();
    const changed = {
      ...decision("changes", 2),
      buildingReview: { ...review, revision: "c".repeat(64) },
    };
    expect(
      currentBuildingVerdict([decision("approved"), changed], sheet.fingerprint, review),
    ).toBeUndefined();
  });
  it("round trips verdicts and prevents replies from changing them", () => {
    const note = decision("approved");
    expect(parseArtNote(note, catalog)).toEqual(note);
    expect(sameArtTarget(note, { ...note, status: "in-progress", reply: "Reply" })).toBe(true);
    expect(sameArtTarget(note, decision("changes"))).toBe(false);
    const { renderFingerprint: _, ...oldReview } = review;
    expect(() => parseArtNote({ ...note, buildingReview: oldReview }, catalog)).toThrow(
      "Invalid building verdict",
    );
    expect(() =>
      parseArtNote({ ...note, buildingVerdict: { value: "approved", createdAt: "bad" } }, catalog),
    ).toThrow("Invalid building verdict");
  });
});
