import { describe, expect, it } from "vitest";
import { aabbOverlapsPropWalls, getEntityAABB } from "../entities/collision.js";
import { createPlayer } from "../entities/Player.js";
import { createProp } from "../entities/PropFactories.js";
import {
  INTERIOR_ENTRY,
  INTERIOR_WALL_TYPE,
  interiorGenerator,
  interiorPlan,
  interiorRealmId,
  parseInteriorId,
} from "./GameplayInterior.js";

describe("gameplay interior adapters", () => {
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
      const id = interiorRealmId(identity.parentWorldId, identity.featureId);
      expect(parseInteriorId(id)).toEqual({
        parentWorldId: identity.parentWorldId,
        featureId: identity.featureId,
      });
      expect(() => interiorRealmId("../world", identity.featureId)).toThrow();
    });
});
