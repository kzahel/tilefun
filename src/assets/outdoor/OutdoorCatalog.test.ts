import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { aabbOverlapsPropWalls } from "../../entities/collision.js";
import { createProp, isPropType } from "../../entities/PropFactories.js";
import {
  type OutdoorCatalog,
  outdoorId,
  outdoorProp,
  parseOutdoorMetadata,
} from "./OutdoorCatalog.js";

const catalog = JSON.parse(
  readFileSync("public/data/outdoor-catalog.json", "utf8"),
) as OutdoorCatalog;
describe("outdoor source coverage and shared geometry", () => {
  it("accounts for occupied cells without counting aliases as separate artwork", () => {
    const c = catalog.coverage;
    expect(c.indexedCells + c.gapCells).toBe(c.occupiedCells);
    expect(c.gaps.reduce((n, r) => n + (r[2] * r[3]) / 256, 0)).toBe(c.gapCells);
    expect(catalog.assets.reduce((n, a) => n + a.aliases.length, 0)).toBe(c.originalMatched);
    expect(new Set(catalog.assets.map((a) => a.id)).size).toBe(catalog.assets.length);
    for (const a of catalog.assets) {
      expect(a.id).toBe(outdoorId(a.rect));
      parseOutdoorMetadata(a.metadata, a.rect);
      expect(a.visualBounds[0] + a.visualBounds[2]).toBeLessThanOrEqual(a.rect[2]);
    }
  });
  it("keeps candidate geometry identical between catalog preview and production factory", () => {
    const asset = catalog.assets.find(
      (a) => a.metadata.name === "Picnic table with attached benches",
    );
    if (!asset) throw new Error("Missing table");
    const type = `outdoor:${asset.id}`;
    expect(isPropType(type)).toBe(true);
    expect(createProp(type, 120, 160)).toEqual(outdoorProp(asset, asset.metadata, 120, 160));
    const p = createProp(type, 0, 0);
    expect(aabbOverlapsPropWalls({ left: -3, right: 3, top: -10, bottom: -4 }, p.position, p)).toBe(
      true,
    );
    expect(
      aabbOverlapsPropWalls({ left: 30, right: 36, top: -10, bottom: -4 }, p.position, p),
    ).toBe(false);
  });
  it("does not replace unknown collision with the image rectangle and validates edits", () => {
    const asset = catalog.assets.find((a) => a.metadata.colliders === null);
    if (!asset) throw new Error("Missing unknown");
    expect(outdoorProp(asset, asset.metadata, 0, 0).walls).toBeNull();
    expect(() =>
      parseOutdoorMetadata({ ...asset.metadata, anchor: [-1, 0] }, asset.rect),
    ).toThrow();
    expect(() =>
      parseOutdoorMetadata(
        { ...asset.metadata, colliders: [{ offsetX: 0, offsetY: 0, width: 0, height: 4 }] },
        asset.rect,
      ),
    ).toThrow();
    expect(() =>
      parseOutdoorMetadata({ ...asset.metadata, depthOffset: Infinity }, asset.rect),
    ).toThrow();
  });
});
