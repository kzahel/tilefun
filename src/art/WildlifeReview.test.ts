import { expect, it } from "vitest";
import { type ArtCatalog, required } from "./ArtCatalog.js";
import { parseArtNote } from "./ArtNotes.js";

const catalog: ArtCatalog = {
  version: 1,
  usages: [],
  sheets: [
    {
      id: "wildlife-v2-elephant-pilot-v1",
      name: "Elephant",
      image: "demos/wildlife-v2/elephant/pilot-v1/sheet.png",
      width: 128,
      height: 128,
      tileSize: 16,
      fingerprint: "a".repeat(64),
      source: "art-source/wildlife-v2/elephant/pilot-v1",
    },
  ],
};
function note() {
  return {
    id: "isolated-wildlife-feedback",
    threadId: "isolated-wildlife-feedback",
    createdAt: "2026-10-04T02:00:00Z",
    sheetId: required(catalog.sheets[0]).id,
    fingerprint: "a".repeat(64),
    sheetSize: [128, 128],
    rect: [0, 0, 128, 128],
    sliceKeys: [],
    intent: "pattern",
    note: "Far feet need depth correction.",
    reply: "",
    status: "pending",
    buildingReview: {
      scene: "pattern",
      caseId: "wildlife-v2-elephant-pilot-v1",
      prefabIds: [],
      revision: "b".repeat(64),
      renderFingerprint: "c".repeat(64),
      url: "/tilefun/workshop.html#/review/pattern%3Awildlife-v2-elephant-pilot-v1",
    },
  };
}
it("keeps wildlife feedback attached to its registered exact revision", () => {
  expect(parseArtNote(note(), catalog).buildingReview?.caseId).toBe(
    "wildlife-v2-elephant-pilot-v1",
  );
  const retargeted = note();
  retargeted.buildingReview.url =
    "/tilefun/workshop.html#/review/pattern%3Awildlife-v2-elephant-pilot-v2";
  expect(() => parseArtNote(retargeted, catalog)).toThrow("Invalid pattern review context");
});
it("rejects unsafe wildlife review identities", () => {
  const unsafe = note();
  unsafe.buildingReview.caseId = "wildlife-v2-../elephant";
  expect(() => parseArtNote(unsafe, catalog)).toThrow();
});
