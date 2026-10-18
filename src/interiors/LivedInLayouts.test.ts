import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import { ENTITY_FACTORIES } from "../entities/EntityFactories.js";
import { createPlayer } from "../entities/Player.js";
import { createProp } from "../entities/PropFactories.js";
import { decodeActor, encodeActor } from "../persistence/ActorRecords.js";
import { buildingDoors, withLivedInLayout } from "./BuildingDoors.js";
import { type InteriorIdentity, interiorGenerator, interiorPlan } from "./GameplayInterior.js";
import { compileGameplayRoom, initialRoom, validateRoomOccupancy } from "./GameplayRoom.js";
import { residentPath, updateResident } from "./ResidentBehavior.js";

function required<T>(value: T | undefined | null): T {
  if (value === undefined || value === null) throw new Error("Missing fixture value");
  return value;
}

const base: InteriorIdentity = {
  version: "interior-v1",
  parentWorldId: "world-1",
  featureId: "settlement:0:0:block:0:0:lot:0",
  buildingType: "",
  floor: 0,
  returnX: 0,
  returnY: 0,
};
function livedInFixture(kind: "home" | "restaurant" | "market") {
  const type = kind === "home" ? "condo-bay-3" : kind === "restaurant" ? "bakery-3" : "butcher-2";
  const identity = withLivedInLayout(
    { ...base, buildingType: `prop-city-dense-v1-${type}` },
    { wx: 0, wy: 0 },
  );
  const room = compileGameplayRoom(identity, initialRoom(identity));
  const generator = interiorGenerator(identity, 2026);
  const props = [0, 1]
    .flatMap((cx) => [0, 1].flatMap((cy) => generator.placements(cx, cy, new Set()).placements))
    .map((p) => createProp(p.propType, p.wx, p.wy));
  // The generator can emit a prop into overlapping chunks; runtime reconciliation deduplicates it.
  const unique = [
    ...new Map(props.map((p) => [`${p.type}:${p.position.wx}:${p.position.wy}`, p])).values(),
  ].map((p, i) => ({ ...p, id: i + 1 }));
  const actors = [0, 1]
    .flatMap((cx) => [0, 1].flatMap((cy) => generator.actors?.(cx, cy) ?? []))
    .map((p) => {
      const entity = required(ENTITY_FACTORIES[p.type])(p.wx, p.wy);
      entity.resident = structuredClone(required(p.resident));
      entity.persistentId = p.featureId;
      return entity;
    });
  return { identity, room, props: unique, actors };
}

describe("lived-in first-visit interiors", () => {
  const index = JSON.parse(readFileSync("public/data/modern-interiors-atlas.json", "utf8"));
  const keys = new Set(index.entries.map((e: { key: string }) => e.key));
  for (const kind of ["home", "restaurant", "market"] as const)
    it(`${kind}: complete furnishing, clear doors and reachable activity spots`, () => {
      const { identity, room, props, actors } = livedInFixture(kind);
      expect(interiorPlan(identity).furniture.length).toBeGreaterThan(10);
      expect(() => validateRoomOccupancy(room, props, actors)).not.toThrow();
      const clear = (e: (typeof actors)[number], p: { wx: number; wy: number }) => {
        const b = getEntityAABB(p, required(e.collider));
        return (
          room.onFloor({
            x: b.left,
            y: b.top,
            width: b.right - b.left,
            height: b.bottom - b.top,
          }) &&
          !props.some(
            (prop) => prop.collider && aabbsOverlap(b, getEntityAABB(prop.position, prop.collider)),
          )
        );
      };
      for (const actor of actors) {
        const stops = required(actor.resident).inside;
        for (let i = 0; i < stops.length; i++) {
          const from = i ? required(stops[i - 1]) : required(buildingDoors(identity)[0]).arrival;
          expect(
            residentPath(from, required(stops[i]), (p) => clear(actor, p)),
            `${kind} ${actor.type} ${required(stops[i]).id}`,
          ).not.toBeNull();
        }
      }
      for (const door of buildingDoors(identity)) {
        expect(() =>
          validateRoomOccupancy(room, props, [createPlayer(door.arrival.wx, door.arrival.wy)]),
        ).not.toThrow();
        expect(
          room.onFloor({ x: door.inside.wx - 5, y: door.inside.wy - 6, width: 10, height: 6 }),
        ).toBe(true);
        expect(room.map.cells[17]?.[Math.floor(door.inside.wx / 16)]?.floor).toHaveLength(0);
      }
      for (const row of room.map.cells)
        for (const cell of row)
          for (const tile of [...cell.floor, ...cell.wall, ...cell.foreground])
            expect(keys.has(tile.key), tile.key).toBe(true);
    });

  it("keeps activity clocks through reload and never persists an in-flight transfer latch", () => {
    const { actors } = livedInFixture("home");
    const entity = required(actors[0]);
    updateResident(entity, 2, () => true, actors);
    required(entity.resident).transferring = true;
    const restored = decodeActor(encodeActor(entity));
    expect("isProp" in restored).toBe(false);
    if ("isProp" in restored) throw new Error("Unexpected prop");
    expect(restored.resident?.elapsed).toBe(2);
    expect(restored.resident?.transferring).toBeUndefined();
    expect(restored.sprite?.clip).toBe(1);
  });

  it("waits when an activity is blocked, then resumes without teleporting", () => {
    const { actors } = livedInFixture("home");
    const e = required(actors[0]);
    required(e.resident).phase = "walk";
    required(e.resident).index = 1;
    const before = { ...e.position };
    updateResident(e, 0.1, () => false, actors);
    expect(e.velocity).toEqual({ vx: 0, vy: 0 });
    expect(e.position).toEqual(before);
    updateResident(e, 2.1, () => true, actors);
    expect(Math.hypot(required(e.velocity).vx, required(e.velocity).vy)).toBeGreaterThan(0);
  });
});
