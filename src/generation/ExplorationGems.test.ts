import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { aabbOverlapsPropWalls } from "../entities/collision.js";
import { createProp } from "../entities/PropFactories.js";
import { withLivedInLayout } from "../interiors/BuildingDoors.js";
import { type InteriorIdentity, interiorGenerator } from "../interiors/GameplayInterior.js";
import { compileGameplayRoom, initialRoom } from "../interiors/GameplayRoom.js";
import { withInteriorGems } from "../interiors/InteriorGems.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import { World } from "../world/World.js";
import { outdoorGems } from "./ExplorationGems.js";
import { createDescriptor } from "./GenerationDescriptor.js";
import { createGenerator } from "./Generator.js";
import { NaturalStrategy } from "./regional/NaturalStrategy.js";

it("seeds sparse parking, pond and lake gems with stable identities on clear dry ground", () => {
  const generator = createGenerator(createDescriptor("regional", 2026));
  const terrain = generator.terrain;
  if (!(terrain instanceof NaturalStrategy)) throw Error("Expected default regional terrain");
  const world = new World(terrain);
  const center = required(terrain.districts.owner(0, 0)?.shoppingCenters?.[0]);
  const waters = [required(terrain.nature.pond(1, -2)), required(terrain.nature.lake(1, -2))];
  const keys = new Set([
    `${Math.floor((center.wx + 600) / 256)},${Math.floor((center.wy + 216) / 256)}`,
    `${Math.floor((center.wx + 600) / 256)},${Math.floor((center.wy + 552) / 256)}`,
    ...waters.map(
      (p) =>
        `${Math.floor((Math.floor(p.x - 2) * 16 + 8) / 256)},${Math.floor((Math.floor(p.y - p.ry - 2) * 16 + 12) / 256)}`,
    ),
  ]);
  const finds = [...keys].flatMap((key) => {
    const [cx = 0, cy = 0] = key.split(",").map(Number);
    const gems = outdoorGems(terrain, cx, cy);
    expect(required(generator.actorAdditions)(cx, cy).filter((p) => p.type === "gem")).toEqual(
      gems,
    );
    const props = terrain.placements(cx, cy).map((p) => createProp(p.propType, p.wx, p.wy));
    for (const p of gems) {
      expect(Math.floor(p.wx / 256)).toBe(cx);
      expect(Math.floor(p.wy / 256)).toBe(cy);
      const box = { left: p.wx - 8, right: p.wx + 8, top: p.wy - 12, bottom: p.wy + 2 };
      for (let y = Math.floor(box.top / 16); y <= Math.floor(box.bottom / 16); y++)
        for (let x = Math.floor(box.left / 16); x <= Math.floor(box.right / 16); x++)
          expect(world.getCollision(x, y) & (CollisionFlag.Solid | CollisionFlag.Water)).toBe(0);
      expect(props.some((prop) => aabbOverlapsPropWalls(box, prop.position, prop, 0, 12))).toBe(
        false,
      );
    }
    return gems;
  });
  expect(finds.filter((p) => p.featureId.includes(":parking:"))).toHaveLength(2);
  expect(finds.filter((p) => p.featureId.startsWith("gem:pond:"))).toHaveLength(2);
  expect(finds.filter((p) => p.featureId.startsWith("gem:lake:"))).toHaveLength(2);
  for (const key of [...keys].reverse()) {
    const [cx = 0, cy = 0] = key.split(",").map(Number);
    expect(outdoorGems(terrain, cx, cy)).toEqual(
      finds.filter((p) => Math.floor(p.wx / 256) === cx && Math.floor(p.wy / 256) === cy),
    );
  }
});

it("puts the larger caches on usable indoor floor across homes, shops and tiny sheds", () => {
  for (const buildingType of ["prop-country-house", "prop-shed", "prop-shopping-v1-1"]) {
    const base: InteriorIdentity = {
      version: "interior-v1",
      parentWorldId: "world-1",
      floor: 0,
      featureId: "settlement:0:0:block:0:0:lot:0",
      buildingType,
      returnX: 0,
      returnY: 0,
    };
    const identity = withLivedInLayout(base, { wx: 0, wy: 0 });
    const state = initialRoom(identity),
      room = compileGameplayRoom(identity, state);
    const generator = withInteriorGems(interiorGenerator(identity, 42), identity, state);
    const gems = Array.from({ length: 9 }, (_, i) =>
      required(generator.actorAdditions)(i % 3, Math.floor(i / 3)),
    ).flat();
    expect(gems.length, buildingType).toBeGreaterThanOrEqual(buildingType === "prop-shed" ? 1 : 3);
    expect(gems.length).toBeLessThanOrEqual(5);
    for (const p of gems) {
      expect(room.furnitureFloor({ x: p.wx - 7, y: p.wy - 10, width: 14, height: 12 })).toBe(true);
      expect(
        required(generator.actors)(Math.floor(p.wx / 256), Math.floor(p.wy / 256)),
      ).toContainEqual(p);
    }
    const again = withInteriorGems(interiorGenerator(identity, 42), identity, state);
    expect(
      Array.from({ length: 9 }, (_, i) =>
        required(again.actorAdditions)(i % 3, Math.floor(i / 3)),
      ).flat(),
    ).toEqual(gems);
  }
});
