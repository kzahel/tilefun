import { describe, expect, it } from "vitest";
import { createPlayer } from "../entities/Player.js";
import { createProp } from "../entities/PropFactories.js";
import { CITY_ARCHITECTURE_BUILDINGS } from "../generation/regional/CityArchitectureAssets.js";
import { DENSE_CITY_BUILDINGS } from "../generation/regional/DenseCityAssets.js";
import { buildingDoors, exteriorDoors, withBuildingLayout } from "./BuildingDoors.js";
import { type InteriorIdentity, interiorGenerator } from "./GameplayInterior.js";
import { compileGameplayRoom, initialRoom, validateRoomOccupancy } from "./GameplayRoom.js";

const identity: InteriorIdentity = {
  version: "interior-v1",
  parentWorldId: "world-1",
  featureId: "settlement:0:0:block:1:1:lot:0",
  buildingType: "prop-city-dense-v1-butcher-2",
  floor: 0,
  returnX: 100,
  returnY: 100,
};
describe("versioned city interiors", () => {
  for (const recipe of [...DENSE_CITY_BUILDINGS, ...CITY_ARCHITECTURE_BUILDINGS])
    it(`keeps all ${recipe.type} doors reachable through furnished rooms`, () => {
      const id = withBuildingLayout(
        { ...identity, buildingType: recipe.type },
        { wx: 1000, wy: 2000 },
      );
      const room = compileGameplayRoom(id, initialRoom(id));
      const props = interiorGenerator(id, 2026)
        .placements(0, 0, new Set())
        .placements.map((p, i) => ({ ...createProp(p.propType, p.wx, p.wy), id: i + 1 }));
      expect(room.legacy).toBe(false);
      for (const door of buildingDoors(id)) {
        expect(() =>
          validateRoomOccupancy(room, props, [createPlayer(door.arrival.wx, door.arrival.wy)]),
        ).not.toThrow();
        expect(room.plan.entrances).toContainEqual({ x: Math.floor(door.inside.wx / 32), y: 8 });
      }
      expect(() => validateRoomOccupancy(room, props, [])).not.toThrow();
      // Reach the upper rooms through the actual compiled partition passages.
      const upperRooms =
        id.layout === "apartment-v2"
          ? [
              [112, 112],
              [272, 112],
            ]
          : [[176, 76]];
      for (const [x, y] of upperRooms)
        expect(() =>
          validateRoomOccupancy(room, props, [createPlayer(x ?? 0, y ?? 0)]),
        ).not.toThrow();
    });
  it("uses stable secondary names, one shared realm, and exterior left-to-right order", () => {
    for (const [type, secondary] of [
      [identity.buildingType, "butcher-right"],
      ["prop-city-dense-v1-condo-bay-3", "bay"],
    ]) {
      const id = withBuildingLayout(
        { ...identity, buildingType: type as string },
        { wx: 1000, wy: 2000 },
      );
      const doors = buildingDoors(id);
      expect(doors.map((d) => d.id).sort()).toEqual([secondary, "street"].sort());
      expect(new Set(doors.map((d) => d.insideRealmId)).size).toBe(1);
      expect(doors[0]?.outside.wx).toBeLessThan(doors[1]?.outside.wx ?? 0);
      expect(doors[0]?.inside.wx).toBeLessThan(doors[1]?.inside.wx ?? 0);
      expect(
        exteriorDoors({ type: type as string, position: { wx: 1000, wy: 2000 } }),
      ).toHaveLength(2);
    }
  });
  it("rejects edits that seal a connected entrance or separate empty entrance landings", () => {
    const id = withBuildingLayout(identity, { wx: 1000, wy: 2000 });
    const initial = initialRoom(id);
    const blocked = structuredClone(initial);
    const secondary = blocked.document.cells.find((c) => c.x === 8 && c.y === 8);
    if (!secondary) throw new Error("Missing second door");
    secondary.value = "#";
    expect(() => compileGameplayRoom(id, blocked)).toThrow(/doorway/);
    const divided = structuredClone(initial);
    for (const c of divided.document.cells) if (c.x === 5) c.value = "#";
    expect(() => validateRoomOccupancy(compileGameplayRoom(id, divided), [], [])).toThrow(/route/);
  });
});
