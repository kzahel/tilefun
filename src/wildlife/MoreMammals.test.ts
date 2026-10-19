import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { EntityManager } from "../entities/EntityManager.js";
import { durableId } from "../persistence/ActorRecords.js";
import { createFauna } from "./Fauna.js";
import { canEat } from "./FoodWeb.js";
import { MORE_MAMMAL_PROFILES } from "./MoreMammals.js";
import { createPredator } from "./Predator.js";
import { resolvePredatorCatches } from "./predatorAI.js";
import { tickWildlifeRespawns } from "./WildlifeRespawns.js";

describe.each(MORE_MAMMAL_PROFILES)("$species connected motion and origin", (p) => {
  const deep = p.habitat === "deep";
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
    expect(audit.maxContinuousEndpointGapWorldUnits).toBeLessThan(0.001);
    const motion = required(p.clips[1]);
    if (deep) {
      expect(audit.closedMeshVolumes).toBeGreaterThanOrEqual(19);
      expect(audit.fixedLengthTailChecks).toBeGreaterThan(900);
      expect(audit.finAttachmentChecks).toBeGreaterThan(1200);
      expect(audit.maxTailRootGapWorldUnits).toBeLessThan(0.0001);
      expect(audit.maxLoopMatrixDelta).toBeLessThan(0.00001);
      expect(Object.values(audit.bodyMotionRangePixels).every((v) => Number(v) >= 1)).toBe(true);
      expect(motion.frameDuration).toBe(50);
    } else {
      expect(p.hop).toEqual(audit.physicalHop);
      expect((motion.count * motion.frameDuration) / 1000).toBeCloseTo(required(p.hop).duration, 8);
      expect(audit.fixedLengthLegChecks).toBeGreaterThan(3800);
      expect(audit.hipRootChecks).toBeGreaterThan(1200);
      expect(audit.restingFootContacts).toBe(8);
      expect(audit.maxAttachmentGapWorldUnits).toBeLessThan(0.0001);
      if (p.species === "bat") {
        expect(audit.fingerBones).toBe(8);
        expect(audit.closedMembraneVolumes).toBe(14);
        expect(audit.wingAttachmentChecks).toBeGreaterThan(5000);
        expect(audit.maxEighthPoseWingRotationStepDegrees).toBeLessThan(6);
      } else {
        expect(audit.forearmBones).toBe(4);
        expect(audit.forearmAttachmentChecks).toBeGreaterThan(5000);
        expect(audit.tailFixedLengthChecks).toBeGreaterThan(1900);
        expect(audit.tailOverlapVolumes).toBe(3);
        expect(audit.maxEighthPoseLimbRotationStepDegrees).toBeLessThan(6);
      }
    }
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
