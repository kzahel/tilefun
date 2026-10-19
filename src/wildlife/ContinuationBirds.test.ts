import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { EntityManager } from "../entities/EntityManager.js";
import { durableId } from "../persistence/ActorRecords.js";
import { CONTINUATION_BIRD_PROFILES } from "./ContinuationBirds.js";
import { createFauna } from "./Fauna.js";
import { canEat } from "./FoodWeb.js";
import { createPredator } from "./Predator.js";
import { resolvePredatorCatches } from "./predatorAI.js";
import { tickWildlifeRespawns } from "./WildlifeRespawns.js";

const land = { isWater: () => false, canOccupy: () => true, surfaceZ: () => 0 };
describe.each(CONTINUATION_BIRD_PROFILES)("$species food-web origin", (p) => {
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
      required(prey.fauna).groupId = "original-bird-group";
      if (natural) prey.naturalSpawnId = "natural-bird";
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
        expect(replacement.naturalSpawnId).toBe("natural-bird");
        expect(replacement.fauna?.home).toEqual(replacement.position);
        expect(replacement.fauna?.groupId).toBe("original-bird-group");
        expect(replacement.persistentId).not.toBe(prey.persistentId);
      }
    });
});

describe.each(CONTINUATION_BIRD_PROFILES)("$species exact articulated flight bank", (p) => {
  it("uses the audited connected wing source and matching physical flight clock", () => {
    const base = `public/${p.image.slice(0, -"sheet.png".length)}`;
    const metadata = JSON.parse(readFileSync(`${base}sprite.json`, "utf8"));
    const audit = JSON.parse(readFileSync(`${base}source-audit.json`, "utf8"));
    expect(
      createHash("sha256")
        .update(readFileSync(`public/${p.image}`))
        .digest("hex"),
    ).toBe(p.sha256);
    expect(metadata.identity).toBe(p.identity);
    expect(audit.twoLegs).toBe(true);
    expect(audit.fixedLengthLegChecks).toBeGreaterThan(1900);
    expect(audit.wingAttachmentChecks).toBeGreaterThan(2500);
    expect(audit.maxAttachmentGapWorldUnits).toBeLessThan(0.00001);
    expect(audit.maxContinuousEndpointGapWorldUnits).toBeLessThan(0.012);
    expect(audit.maxQuarterPoseWingRotationStepDegrees).toBeLessThan(30);
    expect(Object.values(audit.projectedWingTipRangePixels).every((v) => Number(v) > 2)).toBe(true);
    expect(audit.physicalHop).toEqual(p.hop);
    expect(required(p.hop).duration).toBe(
      (required(p.clips[1]).count * required(p.clips[1]).frameDuration) / 1000,
    );
  });
});
