import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type ArtCatalog,
  inflateSlices,
  intersects,
  required,
  snapRegion,
  validateRect,
} from "./ArtCatalog.js";
import { latestArtNotes, parseArtNote, sameArtTarget } from "./ArtNotes.js";

const catalog = JSON.parse(readFileSync("public/data/art-catalog.json", "utf8")) as ArtCatalog;
const sheet = required(catalog.sheets.find((s) => s.id === "me-complete"));
const note = {
  id: "n-1",
  threadId: "t-1",
  sheetId: sheet.id,
  fingerprint: sheet.fingerprint,
  sheetSize: [sheet.width, sheet.height],
  rect: [0, 0, 16, 16],
  sliceKeys: [],
  intent: "building",
  status: "pending",
  note: "SF rowhouses",
  reply: "",
  createdAt: "2026-09-30T12:00:00Z",
};
describe("art source identity", () => {
  it("validates all generated uses against their real PNG dimensions", () => {
    expect(new Set(catalog.sheets.map((s) => s.id)).size).toBe(catalog.sheets.length);
    expect(new Set(catalog.usages.map((s) => s.id)).size).toBe(catalog.usages.length);
    for (const use of catalog.usages)
      expect(
        validateRect(use.rect, required(catalog.sheets.find((s) => s.id === use.sheetId))),
      ).toEqual(use.rect);
  });
  it("indexes both major sheets without rounding packed sprites to a tile grid", () => {
    for (const source of catalog.sheets.filter((s) => s.index)) {
      const slices = inflateSlices(
        source,
        JSON.parse(readFileSync(`public/${source.index}`, "utf8")),
      );
      expect(slices.length).toBeGreaterThan(4000);
      expect(slices.every((s) => validateRect(s.rect, source))).toBe(true);
      if (source.id === "modern-interiors")
        expect(slices.some((s) => s.rect[1] % 16 !== 0)).toBe(true);
    }
  });
  it("snaps backward drags and clips the final partial tile", () => {
    expect(snapRegion({ x: 47, y: 63 }, { x: 2, y: 17 }, sheet)).toEqual([0, 16, 48, 48]);
    expect(
      snapRegion({ x: 7, y: 4 }, { x: 18, y: 18 }, { ...sheet, width: 19, height: 19 }),
    ).toEqual([0, 0, 19, 19]);
    expect(intersects([0, 0, 16, 16], [16, 0, 16, 16])).toBe(false);
  });
  it("rejects malformed and off-sheet source selections", () => {
    for (const rect of [[0, 0, 0, 16], [-1, 0, 16, 16], [2800, 0, 32, 16], [0, 0, 1.5, 16], "rect"])
      expect(() => validateRect(rect, sheet)).toThrow();
  });
  it("retains old fingerprints and distinct exact-target note threads", () => {
    const old = parseArtNote({ ...note, fingerprint: "a".repeat(64) }, catalog);
    const row = parseArtNote(note, catalog);
    const update = { ...row, id: "n-2", status: "resolved" as const };
    expect(latestArtNotes([old, update])).toEqual([update]);
    expect(sameArtTarget(old, row)).toBe(false);
    expect(sameArtTarget(row, update)).toBe(true);
  });
  it("preserves old source bounds when an atlas is replaced by a smaller image", () => {
    const smaller = {
      ...catalog,
      sheets: catalog.sheets.map((s) =>
        s.id === sheet.id ? { ...s, width: 16, height: 16, fingerprint: "b".repeat(64) } : s,
      ),
    };
    const old = parseArtNote({ ...note, rect: [32, 32, 16, 16] }, smaller);
    expect(old.rect).toEqual([32, 32, 16, 16]);
    expect(old.sheetSize).toEqual([sheet.width, sheet.height]);
  });
  it("rejects invalid states, unexpected sheet IDs, and oversized notes", () => {
    for (const patch of [
      { status: "accepted" },
      { sheetId: "../file" },
      { note: "" },
      { note: "x".repeat(4001) },
      { sliceKeys: Array(41).fill("x") },
      { createdAt: "bad" },
    ])
      expect(() => parseArtNote({ ...note, ...patch }, catalog)).toThrow();
  });
});
