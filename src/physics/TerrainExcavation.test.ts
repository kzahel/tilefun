import { expect, it } from "vitest";
import { createPlayer } from "../entities/Player.js";
import { undergroundGarageRecipe } from "../scenarios/UndergroundGarageRecipe.js";
import { surfaceProp } from "../scenarios/WorldGeometryRecipe.js";
import { locateSurfaceSpace, terrainBaseZ, validateExcavations } from "./TerrainExcavation.js";

it("lowers only the declared footprint and preserves narrow uncut terrain at boundaries", () => {
  const props = undergroundGarageRecipe().props;
  const flat = () => 0;
  expect(terrainBaseZ({ left: 64, right: 80, top: 0, bottom: 16 }, flat, props)).toBe(-48);
  expect(terrainBaseZ({ left: -160, right: -150, top: 0, bottom: 8 }, flat, props)).toBe(-8);
  expect(terrainBaseZ({ left: -5, right: 5, top: 0, bottom: 8 }, flat, props)).toBe(-46.75);
  expect(terrainBaseZ({ left: -0.0001, right: 10, top: 50, bottom: 56 }, flat, props)).toBe(0);
  expect(terrainBaseZ({ left: 150, right: 160.0001, top: 0, bottom: 16 }, flat, props)).toBe(0);
  expect(terrainBaseZ({ left: 64, right: 80, top: 0, bottom: 16 }, flat)).toBe(0);
  expect(terrainBaseZ({ left: 155, right: 168, top: 0, bottom: 16 }, () => 2, props)).toBe(16);
});

it("locates separate spaces at the same XY, retaining underground identity while jumping", () => {
  const props = undergroundGarageRecipe().props;
  const player = createPlayer(80, 8);
  for (const z of [-48, -32, -20]) {
    player.wz = z;
    expect(locateSurfaceSpace(props, player)).toBe("garage");
  }
  player.wz = 0;
  expect(locateSurfaceSpace(props, player)).toBe("outside");
});

it("rejects overlapping cuts, misaligned footprints and invalid ceilings", () => {
  const recipe = undergroundGarageRecipe();
  expect(() => validateExcavations(recipe.props)).not.toThrow();
  const extra = structuredClone(recipe.props[0]);
  if (!extra) throw new Error("Missing ramp");
  expect(() => validateExcavations([...recipe.props, extra])).toThrow("must not overlap");
  extra.position.wx += 1;
  expect(() => validateExcavations([extra])).toThrow("tile aligned");
  const floor = recipe.props[1]?.collider?.surface;
  if (!floor) throw new Error("Missing floor");
  floor.excavation = { ceilingId: "missing" };
  expect(() => validateExcavations(recipe.props)).toThrow("ceiling must match");
  floor.excavation = { ceilingId: "garage-roof" };
  floor.z = -4;
  expect(() => validateExcavations(recipe.props)).toThrow("ceiling must clear");
});

it("samples both slope directions without turning an opening into an entire lowered tile", () => {
  const patch = surfaceProp(
    { left: 0, right: 32, top: 0, bottom: 32 },
    {
      id: "test",
      spaceId: "room",
      z: -32,
      riseX: 16,
      riseY: -16,
      thickness: 8,
      excavation: {},
      connectsTo: [],
    },
  );
  expect(terrainBaseZ({ left: 8, right: 16, top: 8, bottom: 16 }, () => 0, [patch])).toBe(-28);
});
