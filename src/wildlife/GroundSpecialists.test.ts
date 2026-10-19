import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { EntityManager } from "../entities/EntityManager.js";
import { durableId } from "../persistence/ActorRecords.js";
import { createFauna } from "./Fauna.js";
import { canEat } from "./FoodWeb.js";
import { GROUND_SPECIALIST_PROFILES } from "./GroundSpecialists.js";
import { createPredator } from "./Predator.js";
import { resolvePredatorCatches } from "./predatorAI.js";
import { tickWildlifeRespawns } from "./WildlifeRespawns.js";

const land = { isWater: () => false, canOccupy: () => true, surfaceZ: () => 0 };
describe.each(GROUND_SPECIALIST_PROFILES)("$species food-web origin", (p) => {
  for (const natural of [false, true])
    it(`${natural ? "natural" : "placed"} prey follows the replacement lineage policy`, () => {
      const manager = new EntityManager();
      const hunter = manager.spawn(createPredator("t-rex", 0, 0));
      const probe = createFauna(p.species, 0, 0);
      const prey = manager.spawn(
        createFauna(
          p.species,
          (required(hunter.collider).width + required(probe.collider).width) / 2 + 1,
          0,
        ),
      );
      expect(canEat(hunter, prey)).toBe(true);
      required(prey.fauna).home = { wx: 120, wy: 64 };
      required(prey.fauna).groupId = "original-specialist-group";
      if (natural) prey.naturalSpawnId = "natural-specialist";
      Object.assign(required(hunter.predator), {
        state: "pounce",
        elapsed: 0.5,
        targetId: durableId(prey),
      });
      prey.jumpZ = 3;
      resolvePredatorCatches(manager, [...manager.entities], land, []);
      expect(manager.byId.has(prey.id)).toBe(true);
      expect(hunter.predator?.meals).toBe(0);
      prey.jumpZ = 0;
      resolvePredatorCatches(manager, [...manager.entities], land, []);
      expect(manager.byId.has(prey.id)).toBe(false);
      expect(hunter.predator?.meals).toBe(1);
      expect(manager.wildlifeRespawns.size).toBe(natural ? 1 : 0);
      tickWildlifeRespawns(manager, 120, land, []);
      const replacements = manager.entities.filter((e) => e.type === prey.type);
      expect(replacements).toHaveLength(natural ? 1 : 0);
      if (natural) {
        const replacement = required(replacements[0]);
        expect(replacement.naturalSpawnId).toBe("natural-specialist");
        expect(replacement.fauna?.home).toEqual(replacement.position);
        expect(replacement.fauna?.groupId).toBe("original-specialist-group");
        expect(replacement.persistentId).not.toBe(prey.persistentId);
      }
    });
});

describe.each(GROUND_SPECIALIST_PROFILES)("$species connected ground gait", (p) => {
  it("matches source travel and keeps fixed-volume limbs joined between poses", () => {
    const base = `public/${p.image.slice(0, -"sheet.png".length)}`;
    const metadata = JSON.parse(readFileSync(`${base}sprite.json`, "utf8"));
    const audit = JSON.parse(readFileSync(`${base}source-audit.json`, "utf8"));
    expect(
      createHash("sha256")
        .update(readFileSync(`public/${p.image}`))
        .digest("hex"),
    ).toBe(p.sha256);
    expect(metadata.identity).toBe(p.identity);
    const walk = required(p.clips[1]);
    const projection = JSON.parse(
      readFileSync(`art-source/wildlife-v2/${p.species}/roster-v3/projection.json`, "utf8"),
    );
    expect(
      (projection.strideWorldUnits * 10) / ((walk.count * walk.frameDuration) / 1000),
    ).toBeCloseTo(p.speed, 6);
    expect(audit.fixedLengthLinkChecks).toBeGreaterThan(5000);
    expect(audit.tailFixedLengthChecks).toBeGreaterThan(900);
    expect(audit.buriedHipRootChecks).toBeGreaterThan(1200);
    expect(audit.maxContinuousEndpointGapWorldUnits).toBeLessThan(0.001);
    expect(audit.maxQuarterPoseRotationStepDegrees).toBeLessThan(5);
    if (p.species === "armadillo") expect(audit.closedArmorVolumes).toBe(8);
    if (p.species === "pangolin") expect(audit.closedArmorVolumes).toBe(58);
    expect(audit.maxContactSlideWorldUnits).toBeLessThan(0.00001);
    expect(Object.values(audit.bodyRangePixels.walk).every((v) => Number(v) >= 1)).toBe(true);
  });
});
