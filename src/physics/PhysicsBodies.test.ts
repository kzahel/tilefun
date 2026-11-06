import { expect, it } from "vitest";
import { createPlayer } from "../entities/Player.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { createFauna } from "../wildlife/Fauna.js";
import {
  createFoodSource,
  createForageItem,
  FORAGE_KINDS,
  SOURCE_KINDS,
} from "../wildlife/ForageResources.js";
import { carryingSupportId, physicsBodyKind } from "./PhysicsBodies.js";

it("anchors all ground supplies/sites and keeps only actual carryable resources loose, including replicas", () => {
  const loose = new Set(["twig", "fruit", "nut", "root", "shiny"]);
  for (const kind of FORAGE_KINDS) {
    const item = createForageItem(kind, 0, 0);
    const expected = loose.has(kind) ? "loose" : "fixed";
    expect(physicsBodyKind(item), kind).toBe(expected);
    expect(physicsBodyKind(deserializeEntity(serializeEntity(item))), `${kind} replica`).toBe(
      expected,
    );
  }
  for (const kind of SOURCE_KINDS) {
    const item = createFoodSource(kind, 0, 0);
    expect(physicsBodyKind(item), kind).toBe("fixed");
    expect(physicsBodyKind(deserializeEntity(serializeEntity(item))), `${kind} replica`).toBe(
      "fixed",
    );
  }
  const cached = createForageItem("shiny", 0, 0);
  if (!cached.workItem) throw Error("Missing work state");
  cached.workItem.cachedIn = "hoard";
  expect(physicsBodyKind(cached)).toBe("fixed");
});

it("does not carry players on fleeing wildlife, but keeps other supports and riders", () => {
  const fox = createFauna("fox", 0, 0);
  fox.id = 7;
  const predator = createFauna("cat", 0, 0);
  const friend = createPlayer(0, 0);
  friend.id = 8;
  const bodies = new Map([
    [7, { entity: fox }],
    [8, { entity: friend }],
  ]);
  expect(carryingSupportId(createPlayer(0, 0), 7, bodies)).toBe(-1);
  expect(carryingSupportId(createPlayer(0, 0), 8, bodies)).toBe(8);
  expect(carryingSupportId(predator, 7, bodies)).toBe(7); // non-player riders keep the support
  expect(carryingSupportId(createPlayer(0, 0), undefined, bodies)).toBe(-1);
});
