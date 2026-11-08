import { expect, it } from "vitest";
import { TILE_SIZE } from "../config/constants.js";
import { createDescriptor } from "../generation/GenerationDescriptor.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import type { Realm } from "./Realm.js";
import { safeArrival } from "./SafeArrival.js";

it("resumes a pose resting against a wall within contact tolerance and relocates real overlap", async () => {
  const generation = createDescriptor("flat", 7);
  // Solid tile row 9 ends at wy=160; the 6px-deep player rests against it at wy=166.
  const realm = {
    generation,
    interior: null,
    indoorFloor: undefined,
    ensureReady: async () => {},
    realizeProceduralProps: () => {},
    world: { getCollision: (_tx: number, ty: number) => (ty === 9 ? CollisionFlag.Solid : 0) },
    propManager: { getPropsNearPosition: () => [] },
  } as unknown as Realm;
  const at = (wy: number) =>
    safeArrival(realm, { x: 264 / TILE_SIZE, y: wy / TILE_SIZE, generation });
  // A shared-physics resting contact observed in the apartment reload case.
  expect(await at(165.99990844726562)).toEqual({ wx: 264, wy: 165.99990844726562 });
  expect(await at(165)).not.toEqual({ wx: 264, wy: 165 });
});

it("keeps clear of solid bodies only when asked, and never of visual-only ones", async () => {
  const generation = createDescriptor("flat", 7);
  const body = (wx: number, solid?: boolean) => ({
    position: { wx, wy: 0 },
    collider: {
      offsetX: 0,
      offsetY: 0,
      width: 20,
      height: 12,
      ...(solid === false ? { solid } : {}),
    },
  });
  const entities = [body(32)];
  const realm = {
    generation,
    interior: null,
    indoorFloor: undefined,
    ensureReady: async () => {},
    realizeProceduralProps: () => {},
    world: { getCollision: () => 0 },
    propManager: { getPropsNearPosition: () => [] },
    entityManager: { entities },
  } as unknown as Realm;
  const arrival = { x: 2, y: 0, generation };
  // A car-sized body sits on the arrival: ignored by default, avoided when asked.
  expect(await safeArrival(realm, arrival)).toEqual({ wx: 32, wy: 0 });
  const clear = await safeArrival(realm, arrival, { clearOfBodies: true });
  expect(clear).not.toEqual({ wx: 32, wy: 0 });
  expect(Math.abs(clear.wx - 32) + Math.abs(clear.wy)).toBeLessThanOrEqual(2 * TILE_SIZE);
  // A visual-only collider never blocks.
  entities[0] = body(32, false);
  expect(await safeArrival(realm, arrival, { clearOfBodies: true })).toEqual({ wx: 32, wy: 0 });
});
