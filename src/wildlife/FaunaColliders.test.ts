import { expect, it } from "vitest";
import { ENTITY_DEFS } from "../entities/EntityDefs.js";
import { decodeActor, encodeActor } from "../persistence/ActorRecords.js";
import { required } from "../shared/required.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { createFauna, faunaProfile } from "./Fauna.js";

it("restores an old sheep at the fitted support height and replicates it with its original weight", () => {
  const animal = createFauna("sheep", 64, 64);
  const [width, height, physicalHeight] = required(faunaProfile(animal.type)).body;
  const collider = {
    offsetX: 0,
    offsetY: 5,
    width: 10,
    height: 10,
    physicalHeight: 10,
    solid: true,
  };
  expect(ENTITY_DEFS[animal.type]?.collider).toEqual(collider);
  expect(animal.collider).toEqual(collider);
  expect(animal.weight).toBe(width * 2);

  // Existing actors sent and saved their semantic state without a static collider.
  animal.collider = { offsetX: 0, offsetY: 0, width, height, physicalHeight, solid: true };
  expect(decodeActor(encodeActor(animal))).toMatchObject({ collider, weight: width * 2 });
  expect(deserializeEntity(serializeEntity(animal))).toMatchObject({
    collider,
    weight: width * 2,
  });
});

it("keeps the classic cow, cat coat variants and upright giraffe on their own colliders", () => {
  expect(ENTITY_DEFS.cow?.collider).toEqual({
    offsetX: 0,
    offsetY: 0,
    width: 22,
    height: 10,
    physicalHeight: 10,
  });
  for (const species of ["cat-black", "cat-ginger", "giraffe-upright"] as const) {
    const animal = createFauna(species, 64, 64);
    const [width, height, physicalHeight] = required(faunaProfile(animal.type)).body;
    expect(animal.collider).toEqual({
      offsetX: 0,
      offsetY: 0,
      width,
      height,
      physicalHeight,
      solid: true,
    });
  }
});
