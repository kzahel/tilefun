import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { EntityManager } from "../entities/EntityManager.js";
import { durableId } from "../persistence/ActorRecords.js";
import { naturalLandscapeRecipe } from "../scenarios/NaturalLandscapeRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { createDeer } from "./Deer.js";
import { createFauna, faunaType } from "./Fauna.js";
import { canEat } from "./FoodWeb.js";
import { createPredator } from "./Predator.js";
import { resolvePredatorCatches } from "./predatorAI.js";
import { SECRETARY_BIRD_PROFILES } from "./TallBirds.js";
import { tickWildlifeRespawns } from "./WildlifeRespawns.js";

const land = { isWater: () => false, canOccupy: () => true, surfaceZ: () => 0 };
const cases = [{ hunter: "secretary-bird", prey: () => createFauna("king-cobra", 0, 0) }] as const;

describe.each(cases)("$hunter directed meals", ({ hunter: species, prey: factory }) => {
  it("remains prey for larger hunters without reversing that relationship", () => {
    const hunter = createPredator(species, 0, 0);
    const rex = createPredator("t-rex", 30, 0);
    expect(canEat(rex, hunter)).toBe(true);
    expect(canEat(hunter, rex)).toBe(false);
    expect(canEat(hunter, hunter)).toBe(false);
  });
  for (const natural of [false, true])
    it(`${natural ? "natural" : "placed"} meals retain their origin policy across prey kinds`, () => {
      const manager = new EntityManager();
      const hunter = manager.spawn(createPredator(species, 0, 0));
      const prey = manager.spawn(factory());
      prey.position.wx = (required(hunter.collider).width + required(prey.collider).width) / 2 + 1;
      expect(canEat(hunter, prey)).toBe(true);
      required(prey.predator ?? prey.fauna).home = { wx: 120, wy: 64 };
      if (prey.predator) {
        prey.predator.packId = "original-small-hunter-pack";
        prey.predator.state = "pounce";
        prey.predator.targetId = "stale-hunt";
      } else required(prey.fauna).groupId = "original-small-prey-group";
      if (natural) prey.naturalSpawnId = "natural-directed-prey";
      Object.assign(required(hunter.predator), {
        state: "pounce",
        elapsed: 0.5,
        targetId: durableId(prey),
      });
      if (prey.type === faunaType("cricket")) {
        prey.jumpZ = 3;
        resolvePredatorCatches(manager, [...manager.entities], land, []);
        expect(manager.byId.has(prey.id)).toBe(true);
        expect(hunter.predator?.meals).toBe(0);
        prey.jumpZ = 0;
      }
      resolvePredatorCatches(manager, [...manager.entities], land, []);
      expect(manager.byId.has(prey.id)).toBe(false);
      expect(hunter.predator?.meals).toBe(1);
      expect(manager.wildlifeRespawns.size).toBe(natural ? 1 : 0);
      tickWildlifeRespawns(manager, 120, land, []);
      const replacements = manager.entities.filter((e) => e.type === prey.type);
      expect(replacements).toHaveLength(natural ? 1 : 0);
      if (natural) {
        const replacement = required(replacements[0]);
        expect(replacement.naturalSpawnId).toBe("natural-directed-prey");
        expect((replacement.predator ?? replacement.fauna)?.home).toEqual(replacement.position);
        if (replacement.predator) {
          expect(replacement.predator.packId).toBe("original-small-hunter-pack");
          expect(replacement.predator.state).toBe("rest");
          expect(replacement.predator.targetId).toBeUndefined();
        } else expect(replacement.fauna?.groupId).toBe("original-small-prey-group");
      }
    });
});

it("keeps secretary bird source anatomy and both travel clocks connected", () => {
  const profile = required(SECRETARY_BIRD_PROFILES[0]);
  const base = "public/demos/wildlife-v2/secretary-bird/roster-v3/";
  const audit = JSON.parse(readFileSync(`${base}source-audit.json`, "utf8"));
  const projection = JSON.parse(
    readFileSync("art-source/wildlife-v2/secretary-bird/roster-v3/projection.json", "utf8"),
  );
  expect(
    createHash("sha256")
      .update(readFileSync(`${base}sheet.png`))
      .digest("hex"),
  ).toBe(profile.art.sha256);
  expect(audit.neckFixedLengthChecks).toBeGreaterThan(3800);
  expect(audit.fixedLengthLinkChecks).toBeGreaterThan(10000);
  expect(audit.maxNeckEndpointGapWorldUnits).toBeLessThan(0.012);
  expect(audit.maxContactSlideWorldUnits).toBeLessThan(0.00001);
  expect(audit.maxEighthPoseRotationStepDegrees).toBeLessThan(5);
  expect(Object.values(audit.bodyRangePixels.walk).every((v) => Number(v) >= 1)).toBe(true);
  const walk = required(profile.art.clips.find((c) => c.name === "walk"));
  const chase = required(profile.art.clips.find((c) => c.name === "chase"));
  expect(
    (projection.strideWorldUnits * 10) / ((walk.count * walk.frameDuration) / 1000),
  ).toBeCloseTo(profile.speed);
  expect(chase.frameDuration).toBe(20);
  expect(canEat(createPredator("secretary-bird", 0, 0), createDeer(10, 0))).toBe(false);
});

it("hunts a natural cobra through the real shared lab and preserves its meal on reload", async () => {
  const session = await ScenarioSession.create(
    naturalLandscapeRecipe("secretary-bird", "balanced"),
  );
  try {
    const manager = session.realm.entityManager;
    const bird = () =>
      required(
        session.realm.entityManager.entities.find(
          (e) => e.type === createPredator("secretary-bird", 0, 0).type,
        ),
      );
    for (let i = 0; i < 1200 && !bird().predator?.meals; i++)
      await session.step({ dx: 0, dy: 0, jump: false, sprinting: false });
    expect(bird().predator?.meals).toBe(1);
    expect(manager.entities.some((e) => e.type === faunaType("king-cobra"))).toBe(false);
    expect(manager.wildlifeRespawns.size).toBe(1);
    await session.reload();
    expect(bird().predator?.meals).toBe(1);
    expect(session.realm.entityManager.wildlifeRespawns.size).toBe(1);
  } finally {
    await session.close();
  }
});
