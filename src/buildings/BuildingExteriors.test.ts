import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, expect, it } from "vitest";
import { aabbOverlapsPropWalls } from "../entities/collision.js";
import { createProp } from "../entities/PropFactories.js";
import { PHYSICS_PIXELS_PER_METRE as SCALE } from "../physics/PhysicsDefaults.js";
import { compileCollisionGeometry } from "../physics/rapier/CollisionGeometry.js";
import { deserializeProp, serializeProp } from "../shared/serialization.js";
import { buildingExterior } from "./BuildingExteriors.js";

beforeAll(async () => {
  await RAPIER.init();
});
it("fits the farmhouse at the ridge, under the eaves and beside the recessed west wing across a physics chunk seam", () => {
  const prop = createProp("prop-country-house", 255, 32);
  const descriptors = [0, 256].flatMap((left) =>
    compileCollisionGeometry(
      { getHeight: () => 1, getCollision: () => 0, queryProps: () => [prop] },
      { left, right: left + 256, top: -256, bottom: 256 },
      { x: 0, y: 0, z: 0 },
      -4096,
      4096,
    ),
  );
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  try {
    for (const d of descriptors) world.createCollider(d);
    world.step();
    const roof = (x: number, y: number) => {
      const ray = new RAPIER.Ray(
        { x: (255 + x) / SCALE, y: 300 / SCALE, z: (32 + y) / SCALE },
        { x: 0, y: -1, z: 0 },
      );
      const hit = world.castRay(ray, 400 / SCALE, true);
      return hit && 300 - hit.timeOfImpact * SCALE;
    };
    const ground = roof(-130, -20) ?? -1;
    expect(ground).toBeGreaterThan(0);
    expect(roof(26, -70)).toBeCloseTo(ground + 141, 1);
    expect(roof(-58, -70)).toBeCloseTo(ground + 74 + 67 / 85, 1);
    expect(roof(-110, -70)).toBeGreaterThan(ground + 55);
    expect(roof(0.02, -70)).toBeCloseTo(roof(-0.02, -70) ?? -1, 0);
    const clear = { left: 254, right: 256, top: 21, bottom: 23 };
    expect(aabbOverlapsPropWalls(clear, prop.position, prop, 10, 22)).toBe(false);
    expect(aabbOverlapsPropWalls(clear, prop.position, prop, 41, 5)).toBe(true);
  } finally {
    world.free();
  }
});

it("keeps both roof halves, beveled bay fronts and a complete shop strip after replication", () => {
  for (const type of [
    "prop-shed",
    "prop-country-house",
    "prop-japanese-house",
    ...Array.from({ length: 6 }, (_, i) => `prop-terraced-house-${i + 1}`),
  ]) {
    const prop = createProp(type, 20, 40);
    expect(buildingExterior(type)?.sections.some((s) => s.top !== s.topRight)).toBe(true);
    expect(deserializeProp(serializeProp(prop)).walls).toEqual(prop.walls);
  }
  const bay = createProp("prop-city-dense-v1-condo-bay-3", 0, 0);
  const blocked = (x: number, y: number) =>
    aabbOverlapsPropWalls(
      { left: x, right: x + 1, top: y, bottom: y + 1 },
      bay.position,
      bay,
      0,
      12,
    );
  expect(blocked(-91, -4)).toBe(false);
  expect(blocked(-91, -19)).toBe(true);
  expect(blocked(-48, -4)).toBe(true);
  for (let i = 0; i < 14; i += 2) {
    const cap = createProp(`prop-shopping-v1-${i}`, 0, -48);
    const front = createProp(`prop-shopping-v1-${i + 1}`, 0, 0);
    expect(cap.walls?.[0]).toMatchObject({ offsetY: 48, height: 96, zBase: 44, zHeight: 4 });
    expect(front.walls?.[0]).toMatchObject({ offsetY: 0, height: 96, zBase: 0, zHeight: 44 });
  }
});
