import { expect, it } from "vitest";
import { createCow } from "../entities/Cow.js";
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

it("fits the classic cow and cat coats and keeps the upright giraffe's original collider", () => {
  const classicCow = {
    offsetX: 0,
    offsetY: 5,
    width: 10,
    height: 10,
    physicalHeight: 9,
  };
  expect(ENTITY_DEFS.cow?.collider).toEqual(classicCow);
  expect(createCow(64, 64)).toMatchObject({ collider: classicCow, weight: 500 });
  for (const species of ["cat-black", "cat-ginger"] as const) {
    expect(createFauna(species, 64, 64).collider).toEqual({
      offsetX: 0,
      offsetY: 2.25,
      width: 4.5,
      height: 4.5,
      physicalHeight: 7,
      solid: true,
    });
  }
  const giraffe = createFauna("giraffe-upright", 64, 64);
  const [width, height, physicalHeight] = required(faunaProfile(giraffe.type)).body;
  expect(giraffe.collider).toEqual({
    offsetX: 0,
    offsetY: 0,
    width,
    height,
    physicalHeight,
    solid: true,
  });
});
