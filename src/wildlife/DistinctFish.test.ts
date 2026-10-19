import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { EntityManager } from "../entities/EntityManager.js";
import { durableId } from "../persistence/ActorRecords.js";
import { DISTINCT_FISH_FAUNA_PROFILES, DISTINCT_FISH_HUNTER_PROFILES } from "./DistinctFish.js";
import { createFauna } from "./Fauna.js";
import { canEat } from "./FoodWeb.js";
import { createPredator } from "./Predator.js";
import { resolvePredatorCatches } from "./predatorAI.js";
import { tickWildlifeRespawns } from "./WildlifeRespawns.js";

const fish = [
  ...DISTINCT_FISH_FAUNA_PROFILES.map((p) => ({
    species: p.species,
    size: p.size,
    anchor: p.anchor,
    identity: p.identity,
    sha256: p.sha256,
    create: (x: number, y: number) => createFauna(p.species, x, y),
  })),
  ...DISTINCT_FISH_HUNTER_PROFILES.map((p) => ({
    species: p.species,
    size: p.size,
    anchor: [p.size / 2, p.anchorY],
    identity: p.art.identity,
    sha256: p.art.sha256,
    create: (x: number, y: number) => createPredator(p.species, x, y),
  })),
];
const wet = {
  isWater: () => true,
  isDeepWater: () => true,
  canOccupy: () => true,
  surfaceZ: () => 0,
};
describe.each(fish)("$species exact fish bank and lineage", (p) => {
  it("retains closed anatomy, attached fins and fixed tail links throughout its swim", () => {
    const base = `public/demos/wildlife-v2/${p.species}/roster-v3`;
    const metadata = JSON.parse(readFileSync(`${base}/sprite.json`, "utf8"));
    const audit = JSON.parse(readFileSync(`${base}/source-audit.json`, "utf8"));
    expect(
      createHash("sha256")
        .update(readFileSync(`${base}/sheet.png`))
        .digest("hex"),
    ).toBe(p.sha256);
    expect(metadata.identity).toBe(p.identity);
    expect(metadata.frameWidth).toBe(p.size);
    expect(metadata.anchor).toEqual(p.anchor);
    expect(audit.closedMeshVolumes).toBeGreaterThanOrEqual(19);
    expect(audit.fixedLengthTailChecks).toBeGreaterThan(900);
    expect(audit.finAttachmentChecks).toBeGreaterThan(1900);
    expect(audit.maxContinuousEndpointGapWorldUnits).toBeLessThan(0.001);
    expect(audit.maxTailRootGapWorldUnits).toBeLessThan(0.0001);
    expect(audit.maxLoopMatrixDelta).toBeLessThan(0.00001);
    expect(Object.values(audit.bodyMotionRangePixels).every((v) => Number(v) >= 1)).toBe(true);
  });
  for (const natural of [false, true])
    it(`${natural ? "natural" : "placed"} fish eaten by a larger hunter follows its origin policy`, () => {
      const manager = new EntityManager(),
        hunter = manager.spawn(createPredator("shark", 0, 0));
      const probe = p.create(0, 0),
        prey = manager.spawn(
          p.create((required(hunter.collider).width + required(probe.collider).width) / 2 + 1, 0),
        );
      expect(canEat(hunter, prey)).toBe(true);
      const ai = prey.fauna ?? required(prey.predator);
      ai.home = { wx: 100, wy: 100 };
      if (natural) prey.naturalSpawnId = `natural-${p.species}`;
      Object.assign(required(hunter.predator), {
        state: "pounce",
        elapsed: 0.5,
        targetId: durableId(prey),
      });
      resolvePredatorCatches(manager, [...manager.entities], wet, []);
      expect(manager.byId.has(prey.id)).toBe(false);
      expect(hunter.predator?.meals).toBe(1);
      expect(manager.wildlifeRespawns.size).toBe(natural ? 1 : 0);
      tickWildlifeRespawns(manager, 120, wet, []);
      const replacements = manager.entities.filter((e) => e.type === prey.type);
      expect(replacements).toHaveLength(natural ? 1 : 0);
      if (natural) {
        const replacement = required(replacements[0]);
        expect(replacement.naturalSpawnId).toBe(`natural-${p.species}`);
        expect((replacement.fauna ?? required(replacement.predator)).home).toEqual(
          replacement.position,
        );
        expect(replacement.persistentId).not.toBe(prey.persistentId);
      }
    });
});
it("keeps the new hunter chain directed", () => {
  const sword = createPredator("swordfish", 0, 0),
    angler = createPredator("anglerfish", 0, 0),
    shark = createPredator("shark", 0, 0);
  expect(canEat(sword, angler)).toBe(true);
  expect(canEat(angler, sword)).toBe(false);
  expect(canEat(shark, sword)).toBe(true);
  expect(canEat(sword, shark)).toBe(false);
});
