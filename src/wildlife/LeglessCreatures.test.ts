import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { EntityManager } from "../entities/EntityManager.js";
import { durableId } from "../persistence/ActorRecords.js";
import { createFauna, faunaType } from "./Fauna.js";
import { canEat } from "./FoodWeb.js";
import {
  LEGLESS_FAUNA_PROFILES,
  LEGLESS_LAND_HUNTER_PROFILES,
  LEGLESS_WATER_HUNTER_PROFILES,
} from "./LeglessCreatures.js";
import { createPredator } from "./Predator.js";
import { resolvePredatorCatches } from "./predatorAI.js";
import { tickWildlifeRespawns } from "./WildlifeRespawns.js";

const banks = [
  ...LEGLESS_FAUNA_PROFILES.map((p) => ({
    species: p.species,
    size: p.size,
    anchor: p.anchor,
    identity: p.identity,
    sha256: p.sha256,
    create: (x: number, y: number) => createFauna(p.species, x, y),
  })),
  ...[...LEGLESS_LAND_HUNTER_PROFILES, ...LEGLESS_WATER_HUNTER_PROFILES].map((p) => ({
    species: p.species,
    size: p.size,
    anchor: [p.size / 2, p.anchorY],
    identity: p.art.identity,
    sha256: p.art.sha256,
    create: (x: number, y: number) => createPredator(p.species, x, y),
  })),
];
const counts: Record<string, number> = {
  "gaboon-viper": 18,
  snail: 8,
  worm: 14,
  "moray-eel": 22,
  "electric-eel": 24,
};
describe.each(banks)("$species closed linked motion and origin", (p) => {
  const deep = p.species === "moray-eel" || p.species === "electric-eel";
  const env = {
    isWater: () => deep,
    isDeepWater: () => deep,
    canOccupy: () => true,
    surfaceZ: () => 0,
  };
  it("keeps its exact bank, closed volumes, attached chain and source loop", () => {
    const base = `public/demos/wildlife-v2/${p.species}/roster-v3`;
    const m = JSON.parse(readFileSync(`${base}/sprite.json`, "utf8"));
    const a = JSON.parse(readFileSync(`${base}/source-audit.json`, "utf8"));
    const pixels = JSON.parse(readFileSync(`${base}/pixel-audit.json`, "utf8"));
    expect(
      createHash("sha256")
        .update(readFileSync(`${base}/sheet.png`))
        .digest("hex"),
    ).toBe(p.sha256);
    expect(m.identity).toBe(p.identity);
    expect(m.frameWidth).toBe(p.size);
    expect(m.anchor).toEqual(p.anchor);
    expect(a.chainSegments).toBe(counts[p.species]);
    expect(a.closedMeshVolumes).toBeGreaterThanOrEqual(43);
    expect(a.fixedLengthChainChecks).toBeGreaterThan(2500);
    expect(a.chainRootAttachmentChecks).toBeGreaterThan(600);
    expect(a.maxContinuousEndpointGapWorldUnits).toBeLessThan(0.001);
    expect(a.maxLoopMatrixDelta).toBeLessThan(0.00001);
    expect(a.maxQuarterPoseRotationStepDegrees).toBeLessThan(2);
    expect(Object.values(a.bodyMotionRangePixels).every((v) => Number(v) >= 1)).toBe(true);
    expect(Object.values(pixels.bodyPaintCentroidRangePixels).every((v) => Number(v) >= 1)).toBe(
      true,
    );
    if (!deep) {
      expect(a.groundClearanceWorldUnits[0]).toBeGreaterThanOrEqual(0);
      expect(a.groundClearanceWorldUnits[1]).toBeLessThan(0.03);
    }
  });
  for (const natural of [false, true])
    it(`${natural ? "natural" : "placed"} prey follows its directed source-origin policy`, () => {
      const manager = new EntityManager();
      const hunter = manager.spawn(
        createPredator(deep ? "shark" : p.species === "gaboon-viper" ? "t-rex" : "mongoose", 0, 0),
      );
      const prey = manager.spawn(p.create(0, 0));
      prey.position.wx = (required(hunter.collider).width + required(prey.collider).width) / 2 + 1;
      expect(canEat(hunter, prey)).toBe(true);
      expect(canEat(prey, hunter)).toBe(false);
      const ai = required(prey.fauna ?? prey.predator);
      ai.home = { wx: 100, wy: 100 };
      if (prey.fauna) prey.fauna.groupId = "legless-source-group";
      else required(prey.predator).packId = "legless-source-pack";
      if (natural) prey.naturalSpawnId = `natural-${p.species}`;
      Object.assign(required(hunter.predator), {
        state: "pounce",
        elapsed: 0.5,
        targetId: durableId(prey),
      });
      resolvePredatorCatches(manager, [...manager.entities], env, []);
      expect(manager.byId.has(prey.id)).toBe(false);
      expect(hunter.predator?.meals).toBe(1);
      expect(manager.wildlifeRespawns.size).toBe(natural ? 1 : 0);
      tickWildlifeRespawns(manager, 120, env, []);
      const born = manager.entities.filter((e) => e.type === prey.type);
      expect(born).toHaveLength(natural ? 1 : 0);
      if (natural) {
        const e = required(born[0]);
        expect(e.naturalSpawnId).toBe(`natural-${p.species}`);
        expect(required(e.fauna ?? e.predator).home).toEqual(e.position);
        expect(e.persistentId).not.toBe(prey.persistentId);
        if (e.fauna) expect(e.fauna.groupId).toBe("legless-source-group");
        else expect(e.predator?.packId).toBe("legless-source-pack");
      }
    });
});
it("uses mouse prey in the viper lab and preserves rabbit defaults elsewhere", async () => {
  const { naturalLandscapeRecipe } = await import("../scenarios/NaturalLandscapeRecipe.js");
  const recipe = naturalLandscapeRecipe("gaboon-viper", "thicket");
  expect(recipe.actors?.filter((e) => e.type === faunaType("mouse"))).toHaveLength(1);
  expect(recipe.actors?.some((e) => e.rabbit)).toBe(false);
  expect(naturalLandscapeRecipe("tiger", "thicket").actors?.some((e) => e.rabbit)).toBe(true);
});
