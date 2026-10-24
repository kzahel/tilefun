import { describe, expect, it } from "vitest";
import { aabbOverlapsPropWalls, getEntityAABB } from "../entities/collision.js";
import { createPlayer } from "../entities/Player.js";
import { createProp } from "../entities/PropFactories.js";
import { buildingDoor, withLivedInLayout } from "./BuildingDoors.js";
import {
  INTERIOR_ENTRY,
  INTERIOR_WALL_TYPE,
  interiorGenerator,
  interiorPlan,
  interiorRealmId,
  parseInteriorId,
} from "./GameplayInterior.js";
import { compileGameplayRoom, initialRoom, validateRoomOccupancy } from "./GameplayRoom.js";

describe("gameplay interior adapters", () => {
  it("round-trips farm building identities and rejects other farm objects", () => {
    for (const featureId of ["farmstead:0:0:south:house", "farmstead:-2:3:east:shed"]) {
      expect(parseInteriorId(interiorRealmId("world-1", featureId))).toEqual({
        parentWorldId: "world-1",
        featureId,
      });
    }
    for (const featureId of [
      "farmstead:0:0:south:crop:0:0",
      "farmstead:0:0:north:house",
      "farmstead:0:0:east:shed:extra",
    ])
      expect(() => interiorRealmId("world-1", featureId)).toThrow("Invalid building identity");
  });

  it("keeps a tiny outbuilding's entrance and seat accessible", () => {
    const identity = withLivedInLayout(
      {
        version: "interior-v1",
        parentWorldId: "world-1",
        featureId: "farmstead:0:0:south:shed",
        buildingType: "prop-shed",
        floor: 0,
        returnX: 10,
        returnY: 20,
      },
      { wx: 160, wy: 312 },
    );
    const room = compileGameplayRoom(identity, initialRoom(identity));
    expect(interiorPlan(identity).plan.width).toBe(3);
    expect(interiorPlan(identity).plan.height).toBe(4);
    const props = interiorGenerator(identity, 2026)
      .placements(0, 0, new Set())
      .placements.map((p) => createProp(p.propType, p.wx, p.wy));
    const door = buildingDoor(identity);
    expect(() =>
      validateRoomOccupancy(room, props, [createPlayer(door.arrival.wx, door.arrival.wy)]),
    ).not.toThrow();
    expect(
      room.onFloor({ x: door.inside.wx - 5, y: door.inside.wy - 6, width: 10, height: 6 }),
    ).toBe(true);
  });

  for (const buildingType of [
    "prop-regional-apartment-2",
    "prop-regional-bakery",
    "prop-country-house",
  ])
    it(`uses walkable shared wall/furniture recipes for ${buildingType}`, () => {
      const identity = {
        version: "interior-v1",
        parentWorldId: "world-1",
        featureId: "settlement:0:0:block:1:1:lot:0",
        buildingType,
        floor: 0,
        returnX: 1,
        returnY: 2,
      } as const;
      const { objects } = interiorPlan(identity);
      expect(objects.length).toBeGreaterThanOrEqual(3);
      const generator = interiorGenerator(identity, 2026);
      const props = generator
        .placements(0, 0, new Set())
        .placements.map((p) => createProp(p.propType, p.wx, p.wy));
      props.push(createProp(INTERIOR_WALL_TYPE, 0, 0));
      const player = createPlayer(INTERIOR_ENTRY.wx, INTERIOR_ENTRY.wy),
        collider = player.collider;
      if (!collider) throw new Error("No collider");
      expect(
        props.some((prop) =>
          aabbOverlapsPropWalls(
            getEntityAABB(player.position, collider),
            prop.position,
            prop,
            0,
            12,
          ),
        ),
      ).toBe(false);
      expect(
        props.some((prop) =>
          aabbOverlapsPropWalls(
            getEntityAABB({ wx: 4, wy: 90 }, collider),
            prop.position,
            prop,
            0,
            12,
          ),
        ),
      ).toBe(true);
      // South doorway floor is two native tiles deep; its end blocks departure into the void.
      const boundary = props.find((p) => p.type === INTERIOR_WALL_TYPE);
      if (!boundary) throw new Error("No room boundary");
      expect(
        aabbOverlapsPropWalls(
          getEntityAABB({ wx: 80, wy: 164 }, collider),
          boundary.position,
          boundary,
          0,
          12,
        ),
      ).toBe(true);
      const id = interiorRealmId(identity.parentWorldId, identity.featureId);
      expect(parseInteriorId(id)).toEqual({
        parentWorldId: identity.parentWorldId,
        featureId: identity.featureId,
      });
      expect(() => interiorRealmId("../world", identity.featureId)).toThrow();
    });
});
