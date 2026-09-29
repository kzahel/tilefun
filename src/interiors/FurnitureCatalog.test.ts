import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFloorPlan } from "./ApartmentFloorPlan.js";
import { compileFurniture, furnitureDrawOrder, furnitureSignature } from "./FurnishedInterior.js";
import {
  FURNITURE_CATALOG,
  type FurniturePlacement,
  furnitureDefinition,
  parseFurniturePlacements,
} from "./FurnitureCatalog.js";
import { furnitureReviewCases } from "./review/FurnitureReviewCases.js";
import { parseReviewFeedback } from "./review/ReviewFeedback.js";

const plan = parseFloorPlan("#######\n#LLLLL#\n#LLLLL#\n#LLLLL#\n#LLLLL#\n#LLLLL#\n###+###");
const table: FurniturePlacement = { id: "table", asset: "worktable", x: 112, y: 88 };
const plant: FurniturePlacement = { id: "plant", asset: "table-plant", x: 10, y: 20, on: "table" };
describe("curated furniture", () => {
  it("uses complete normal sprites with exact dimensions and covers every catalog entry in review", () => {
    const source = JSON.parse(readFileSync("public/data/modern-interiors-atlas.json", "utf8")) as {
      entries: { key: string; rect: number[]; sourceKind: string; variant: string }[];
    };
    expect(FURNITURE_CATALOG).toHaveLength(16);
    expect(new Set(FURNITURE_CATALOG.map((d) => d.id)).size).toBe(FURNITURE_CATALOG.length);
    const used = new Set(
      furnitureReviewCases().flatMap((c) => c.furniture?.map((p) => p.asset) ?? []),
    );
    for (const d of FURNITURE_CATALOG) {
      const sprite = source.entries.find((e) => e.key === d.key);
      expect(sprite?.rect.slice(2), d.id).toEqual(d.size);
      expect(sprite?.sourceKind).toBe("single");
      expect(sprite?.variant).toBe("normal");
      expect(d.anchor[0]).toBeGreaterThanOrEqual(0);
      expect(d.anchor[0]).toBeLessThanOrEqual(d.size[0]);
      expect(d.anchor[1]).toBeGreaterThanOrEqual(0);
      expect(d.anchor[1]).toBeLessThanOrEqual(d.size[1]);
      expect(used.has(d.id), d.id).toBe(true);
    }
    for (const c of furnitureReviewCases())
      expect(
        () => compileFurniture(parseFloorPlan(c.sketch), c.furniture ?? []),
        c.id,
      ).not.toThrow();
  });
  it("keeps a tabletop object attached when its parent moves, regardless of input order", () => {
    const before = compileFurniture(plan, [plant, table]);
    const after = compileFurniture(plan, [{ ...table, x: 128, y: 104 }, plant]);
    const a = before.find((p) => p.placement.id === "plant"),
      b = after.find((p) => p.placement.id === "plant");
    expect([b?.x, b?.y]).toEqual([(a?.x ?? 0) + 16, (a?.y ?? 0) + 16]);
    const order = furnitureDrawOrder(before).map((o) => o.placement.id);
    expect(order).toEqual(["table", "plant"]);
    expect(furnitureDrawOrder(after).map((o) => o.placement.id)).toEqual(order);
  });
  it("renders rugs below solids and a support group before nearer furniture", () => {
    const objects = compileFurniture(plan, [
      { id: "stool", asset: "stool", x: 112, y: 120 },
      plant,
      { id: "rug", asset: "rug", x: 112, y: 128 },
      table,
    ]);
    expect(furnitureDrawOrder(objects).map((o) => o.placement.id)).toEqual([
      "rug",
      "table",
      "plant",
      "stool",
    ]);
  });
  it("rejects missing, cyclic, unsuitable and overflowing supports", () => {
    expect(() => compileFurniture(plan, [plant])).toThrow(/Missing support/);
    expect(() => compileFurniture(plan, [{ ...plant, on: "plant" }])).toThrow(/Cyclic/);
    expect(() =>
      compileFurniture(plan, [{ id: "lamp", asset: "table-lamp", x: 80, y: 80 }]),
    ).toThrow(/requires a support/);
    expect(() => compileFurniture(plan, [{ ...table, asset: "stool" }, plant])).toThrow(
      /Invalid support/,
    );
    expect(() => compileFurniture(plan, [table, { ...plant, x: 30 }])).toThrow(/leaves support/);
    expect(() => compileFurniture(plan, [table, plant, { ...plant, id: "second" }])).toThrow(
      /Surface objects overlap/,
    );
  });
  it("rejects blocking footprints, wall placement errors, and unusable access spaces", () => {
    expect(() => compileFurniture(plan, [table, { ...table, id: "other" }])).toThrow(/collision/);
    expect(() => compileFurniture(plan, [{ ...table, x: 112, y: 198 }])).toThrow(/doorway/);
    expect(() =>
      compileFurniture(plan, [{ id: "picture", asset: "wall-picture", x: 112, y: 90 }]),
    ).toThrow(/north wall/);
    expect(() =>
      compileFurniture(plan, [table, { id: "stool", asset: "stool", x: 112, y: 100 }]),
    ).toThrow(/access blocked/);
    expect(() => compileFurniture(plan, [{ ...table, y: 188 }])).toThrow(/access leaves/);
  });
  it("hashes placement and footprint metadata but ignores input ordering", () => {
    expect(furnitureSignature([table, plant])).toBe(furnitureSignature([plant, table]));
    expect(furnitureSignature([table])).not.toBe(furnitureSignature([{ ...table, x: 120 }]));
    expect(furnitureSignature([table])).toContain(
      JSON.stringify(furnitureDefinition("worktable").footprint),
    );
  });
  it("rejects rotations without matching authored sprites", () => {
    expect(() => parseFurniturePlacements([{ ...table, rotation: 90 }])).toThrow(/orientation/);
  });
  it("validates bounded serialized placements and keeps them in saved feedback", () => {
    for (const invalid of [
      null,
      [table, table],
      [{ ...table, x: NaN }],
      [{ ...table, y: -1 }],
      [{ ...table, on: 7 }],
      [{ ...table, asset: "<bad>" }],
      Array(101).fill(table),
    ])
      expect(() => parseFurniturePlacements(invalid)).toThrow();
    const record = {
      id: "test",
      caseId: "furniture-test",
      fingerprint: "a".repeat(64),
      verdict: "wrong",
      note: "",
      sketch: "####\n#LL#\n##+#",
      name: "Test",
      createdAt: "2026-09-29T00:00:00Z",
      furniture: [table, plant],
      furnitureCatalogVersion: 1,
    };
    expect(parseReviewFeedback(record).furniture).toEqual([table, plant]);
    expect(() => parseReviewFeedback({ ...record, furnitureCatalogVersion: 0 })).toThrow(/version/);
  });
});
