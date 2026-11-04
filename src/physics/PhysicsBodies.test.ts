import { expect, it } from "vitest";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import {
  createFoodSource,
  createForageItem,
  FORAGE_KINDS,
  SOURCE_KINDS,
} from "../wildlife/ForageResources.js";
import { physicsBodyKind } from "./PhysicsBodies.js";

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
