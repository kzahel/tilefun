import { describe, expect, it } from "vitest";
import { aabbOverlapsPropWalls } from "../../entities/collision.js";
import { outdoorProp } from "../outdoor/OutdoorCatalog.js";
import { VEHICLE_VIEWS, validateVehicleGeometry } from "./VehicleCatalog.js";

describe("vehicle review proposals", () => {
  it("offers all audited directions with explicit review-only geometry and clean candidate crops", () => {
    expect(VEHICLE_VIEWS).toHaveLength(180);
    expect(new Set(VEHICLE_VIEWS.map((v) => v.id)).size).toBe(180);
    for (const v of VEHICLE_VIEWS) {
      expect(validateVehicleGeometry(v.asset.metadata, v.asset.rect)).toEqual(v.asset.metadata);
      expect(v.asset.runtimeTypes).toEqual([]);
    }
    const police = VEHICLE_VIEWS.find((v) => v.id === "vehicle:police-car:west");
    expect(police?.sourceRect).toEqual([1712, 1744, 80, 48]);
    expect(police?.asset.rect).toEqual([1712, 1745, 80, 47]);
  });
  it("uses the edited ground box and finite height in production collision", () => {
    const v = VEHICLE_VIEWS.find((v) => v.id === "vehicle:bus-1:east");
    if (!v) throw Error("Missing bus");
    const p = outdoorProp(v.asset, v.asset.metadata, 0, 0);
    const inside = { left: -2, right: 2, top: -10, bottom: -2 };
    expect(aabbOverlapsPropWalls(inside, p.position, p, 0, 24)).toBe(true);
    expect(aabbOverlapsPropWalls(inside, p.position, p, 41, 24)).toBe(false);
    expect(() =>
      validateVehicleGeometry(
        { ...v.asset.metadata, colliders: [{ offsetX: 0, offsetY: 0, width: 20, height: 10 }] },
        v.asset.rect,
      ),
    ).toThrow(/height/);
    expect(() =>
      validateVehicleGeometry({ ...v.asset.metadata, footprint: null }, v.asset.rect),
    ).toThrow(/ground/);
  });
});
