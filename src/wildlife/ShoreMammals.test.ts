import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { EntityManager } from "../entities/EntityManager.js";
import { durableId } from "../persistence/ActorRecords.js";
import { createFauna } from "./Fauna.js";
import { canEat } from "./FoodWeb.js";
import { createPredator } from "./Predator.js";
import { resolvePredatorCatches } from "./predatorAI.js";
import { SHORE_MAMMAL_PROFILES } from "./ShoreMammals.js";
import { tickWildlifeRespawns } from "./WildlifeRespawns.js";

describe.each(SHORE_MAMMAL_PROFILES)("$species connected motion and origin", (p) => {
  const deep = true;
  const env = {
    isWater: () => deep,
    isDeepWater: () => deep,
    canOccupy: () => true,
    surfaceZ: () => 0,
  };
  it("uses the exact checked source bank and its physical clock", () => {
    const base = `public/demos/wildlife-v2/${p.species}/roster-v3`;
    const meta = JSON.parse(readFileSync(`${base}/sprite.json`, "utf8"));
    const audit = JSON.parse(readFileSync(`${base}/source-audit.json`, "utf8"));
    expect(
      createHash("sha256")
        .update(readFileSync(`${base}/sheet.png`))
        .digest("hex"),
    ).toBe(p.sha256);
    expect(meta.identity).toBe(p.identity);
    expect(meta.frameWidth).toBe(p.size);
    expect(meta.anchor).toEqual(p.anchor);
    expect(audit.closedMeshVolumes).toBe(
      p.species === "platypus" ? 69 : p.species === "walrus" ? 95 : 79,
    );
    expect(audit.fixedLengthLinkChecks).toBeGreaterThan(9000);
    expect(audit.buriedHipRootChecks).toBeGreaterThan(2300);
    expect(audit.tailFixedLengthChecks).toBeGreaterThan(1700);
    expect(audit.plantedTravelPairs).toBeGreaterThan(680);
    expect(audit.maxContinuousEndpointGapWorldUnits).toBeLessThan(0.001);
    expect(audit.maxContactSlideWorldUnits).toBeLessThan(0.00001);
    expect(audit.swimPaddleTravelWorldUnits).toBeGreaterThan(0.35);
    for (const clip of ["walk", "swim"])
      expect(Object.values(audit.bodyRangePixels[clip]).every((v) => Number(v) >= 1)).toBe(true);
    const source = JSON.parse(
      readFileSync(`art-source/wildlife-v2/${p.species}/roster-v3/projection.json`, "utf8"),
    );
    const walk = required(p.clips[1]),
      swim = required(p.clips[2]);
    expect((source.strideWorldUnits * 10) / ((walk.count * walk.frameDuration) / 1000)).toBeCloseTo(
      p.speed,
      6,
    );
    expect(swim.frameDuration).toBe(source.swimMs);
    expect(p.swimSpeed).toBe(source.swimSpeed);
  });
  for (const natural of [false, true])
    it(`${natural ? "natural" : "placed"} prey retains source-specific replacement policy`, () => {
      const manager = new EntityManager();
      const hunter = manager.spawn(createPredator(deep ? "shark" : "t-rex", 0, 0));
      const prey = manager.spawn(createFauna(p.species, 0, 0));
      prey.position.wx = (required(hunter.collider).width + required(prey.collider).width) / 2 + 1;
      expect(canEat(hunter, prey)).toBe(true);
      required(prey.fauna).home = { wx: 120, wy: 64 };
      required(prey.fauna).groupId = "original-mammal-group";
      if (natural) prey.naturalSpawnId = `natural-${p.species}`;
      Object.assign(required(hunter.predator), {
        state: "pounce",
        elapsed: 0.5,
        targetId: durableId(prey),
      });
      if (!deep) {
        prey.jumpZ = 3;
        resolvePredatorCatches(manager, [...manager.entities], env, []);
        expect(manager.byId.has(prey.id)).toBe(true);
        prey.jumpZ = 0;
      }
      resolvePredatorCatches(manager, [...manager.entities], env, []);
      expect(manager.byId.has(prey.id)).toBe(false);
      expect(hunter.predator?.meals).toBe(1);
      expect(manager.wildlifeRespawns.size).toBe(natural ? 1 : 0);
      tickWildlifeRespawns(manager, 120, env, []);
      const replacements = manager.entities.filter((e) => e.type === prey.type);
      expect(replacements).toHaveLength(natural ? 1 : 0);
      if (natural) {
        const replacement = required(replacements[0]);
        expect(replacement.naturalSpawnId).toBe(`natural-${p.species}`);
        expect(replacement.fauna?.home).toEqual(replacement.position);
        expect(replacement.fauna?.groupId).toBe("original-mammal-group");
        expect(replacement.persistentId).not.toBe(prey.persistentId);
      }
    });
});
