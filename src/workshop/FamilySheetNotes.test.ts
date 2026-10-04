import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { parseArtNote } from "../art/ArtNotes.js";
import { familyNoteEvent, familyNoteTarget, familyNoteUrl } from "./FamilySheetNotes.js";
import type { FamilySheetCatalog } from "./FamilySheetTypes.js";

const catalog = JSON.parse(
  readFileSync("public/data/family-sheets.json", "utf8"),
) as FamilySheetCatalog;
const trees = required(catalog.families.find((family) => family.id === "trees"));
const paleTree = required(
  trees.groups.flatMap((group) => group.members).find((m) => m.id === "tree-2"),
);
const source = required(catalog.sources.find((sheet) => sheet.id === "me-complete"));

describe("family discussions use exact source-note targets", () => {
  it("retains the canopy and replacement strip of a composed tree", () => {
    const event = familyNoteEvent(
      catalog,
      trees,
      paleTree,
      "orange-red",
      "Check the trunk",
      "tree-note",
    );
    expect(event).toMatchObject({
      type: "source",
      sheetId: "me-complete",
      fingerprint: source.fingerprint,
      rect: [2464, 448, 64, 64],
      intent: "other",
    });
    expect(event.sliceKeys.filter((key) => key.startsWith("family-layer:"))).toEqual([
      `family-layer:me-complete:${source.fingerprint}:2464,448,64,64:0,0`,
      `family-layer:me-complete:${source.fingerprint}:2464,512,64,16:0,48`,
    ]);
    expect(event.sliceKeys).toContain(`family-catalog:${catalog.revision}`);
    expect(event).not.toHaveProperty("verdict");
    expect(event).not.toHaveProperty("buildingReview");
  });

  it("deep links reopen the exact family revision, member and variant", () => {
    const event = familyNoteEvent(
      catalog,
      trees,
      paleTree,
      "blue-green",
      "A specific color",
      "link-note",
    );
    expect(familyNoteTarget(event.sliceKeys)).toEqual({
      family: "trees",
      revision: trees.revision,
      member: "tree-2",
      variant: "blue-green",
    });
    expect(familyNoteUrl(event)).toBe(
      `/tilefun/workshop.html#/tool/families?family=trees&revision=${trees.revision}&member=tree-2&variant=blue-green`,
    );
    const whole = familyNoteEvent(catalog, trees, null, "green", "Whole family", "family-note");
    expect(familyNoteUrl(whole)).toBe(
      `/tilefun/workshop.html#/tool/families?family=trees&revision=${trees.revision}&variant=green`,
    );
    expect(whole.sliceKeys.some((key) => key.startsWith("family-member:"))).toBe(false);
  });

  it("pins a different source basis for each color instead of reusing the prior variant", () => {
    const green = familyNoteEvent(catalog, trees, paleTree, "green", "Green trunk", "green-note");
    const autumn = familyNoteEvent(
      catalog,
      trees,
      paleTree,
      "orange-red",
      "Autumn trunk",
      "autumn-note",
    );
    expect(green.rect).toEqual([2464, 16, 64, 64]);
    expect(autumn.rect).toEqual([2464, 448, 64, 64]);
    expect(familyNoteTarget(green.sliceKeys)?.variant).toBe("green");
    expect(familyNoteTarget(autumn.sliceKeys)?.variant).toBe("orange-red");
    expect(green.note).toContain("Green\n\nGreen trunk");
    expect(autumn.note).toContain("Orange / red\n\nAutumn trunk");
  });

  it("round trips through the existing art-note parser without an approval payload", () => {
    const event = familyNoteEvent(
      catalog,
      trees,
      paleTree,
      "orange-red",
      "  Check the trunk  ",
      "stored-note",
    );
    const note = parseArtNote(
      {
        ...event,
        threadId: event.id,
        sheetSize: [source.width, source.height],
        status: "pending",
        reply: "",
        createdAt: "2026-10-04T12:00:00Z",
      },
      { version: 1, sheets: catalog.sources, usages: [] },
    );
    expect(note.sliceKeys).toEqual(event.sliceKeys);
    expect(note.note).toBe(
      `${trees.name} · 2. ${paleTree.label} · Orange / red\n\nCheck the trunk`,
    );
    expect(note.buildingReview).toBeUndefined();
    expect(note.buildingVerdict).toBeUndefined();
    expect(note.assetAnnotation).toBeUndefined();
  });

  it("does not interpret unrelated or malformed note identities as family links", () => {
    for (const sliceKeys of [
      ["tree-2"],
      ["family-sheet:unknown", `family-proposal:${trees.revision}`],
      ["family-sheet:trees", "family-proposal:old"],
      ["family-sheet:trees"],
    ]) {
      expect(familyNoteTarget(sliceKeys)).toBeNull();
      expect(familyNoteUrl({ sliceKeys })).toBeUndefined();
    }
    expect(() => familyNoteEvent(catalog, trees, paleTree, "green", "  ", "blank")).toThrow();
    expect(() =>
      familyNoteEvent(catalog, trees, paleTree, "green", "x".repeat(2001), "long"),
    ).toThrow();
  });
});
