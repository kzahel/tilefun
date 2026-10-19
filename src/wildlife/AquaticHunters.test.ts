import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { TerrainId } from "../autotile/TerrainId.js";
import { ENTITY_DEFS } from "../entities/EntityDefs.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createPlayer } from "../entities/Player.js";
import { NaturalLandscape } from "../generation/regional/NaturalLandscape.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { decodeActor, durableId, encodeActor } from "../persistence/ActorRecords.js";
import { naturalLandscapeRecipe } from "../scenarios/NaturalLandscapeRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { AQUATIC_HUNTER_PROFILES } from "./AquaticHunters.js";
import { createFauna, faunaType } from "./Fauna.js";
import { canEat } from "./FoodWeb.js";
import { createPredator, predatorType } from "./Predator.js";
import { restorePredatorPose } from "./PredatorMotion.js";
import { predatorHabitatAllows, resolvePredatorCatches, updatePredatorAI } from "./predatorAI.js";

const wet = {
  isWater: () => true,
  isDeepWater: () => true,
  canOccupy: () => true,
  surfaceZ: () => 0,
};
const idle = { dx: 0, dy: 0, sprinting: false, jump: false };
describe.each(AQUATIC_HUNTER_PROFILES)("$species aquatic source and authority", (p) => {
  it("uses exact native source clips and keeps the swimmer pose through persistence", () => {
    const base = `public/demos/wildlife-v2/${p.species}/${p.revision}`;
    const metadata = JSON.parse(readFileSync(`${base}/sprite.json`, "utf8"));
    expect(metadata.identity).toBe(p.art.identity);
    expect(
      createHash("sha256")
        .update(readFileSync(`${base}/sheet.png`))
        .digest("hex"),
    ).toBe(p.art.sha256);
    expect(metadata.anchor).toEqual([48, 72]);
    for (const c of p.art.clips)
      expect(metadata.clips[c.name]).toEqual({
        start: c.start,
        count: c.count,
        frameDuration: c.frameDuration,
      });
    const e = createPredator(p.species, 64, 64);
    expect(ENTITY_DEFS[e.type]?.aquatic).toBe(true);
    expect(e.noShadow).toBe(true);
    Object.assign(required(e.predator), { state: "chase", elapsed: 0.275 });
    restorePredatorPose(e);
    expect(e.sprite?.clip).toBe(4);
    expect(e.sprite?.frameCol).toBe(62);
    expect(decodeActor(encodeActor(e))).toMatchObject({
      predator: e.predator,
      sprite: e.sprite,
      noShadow: true,
    });
  });
  it("rejects a shallow or dry footprint edge even while the center is deep", () => {
    const e = createPredator(p.species, 32, 32);
    expect(predatorHabitatAllows(e, e.position, wet)).toBe(true);
    expect(predatorHabitatAllows(e, e.position, { ...wet, isDeepWater: (q) => q.wx >= 32 })).toBe(
      false,
    );
    expect(predatorHabitatAllows(e, e.position, { ...wet, isDeepWater: () => false })).toBe(false);
    const fish = createFauna("fish", 80, 32);
    required(e.predator).timer = 0;
    updatePredatorAI(
      e,
      0.1,
      { ...wet, isWater: () => false, isDeepWater: () => false },
      [e, fish],
      [],
    );
    expect(e.predator?.targetId).toBeUndefined();
    expect(e.velocity).toEqual({ vx: 0, vy: 0 });
  });
  for (const natural of [false, true])
    it(`${natural ? "natural" : "placed"} fish has the correct finite/replacement catch policy`, () => {
      const manager = new EntityManager(),
        hunter = manager.spawn(createPredator(p.species, 0, 0));
      const probe = createFauna("fish", 0, 0);
      const fish = manager.spawn(
        createFauna(
          "fish",
          (required(hunter.collider).width + required(probe.collider).width) / 2 + 1,
          0,
        ),
      );
      const home = { wx: 120, wy: 80 };
      Object.assign(required(fish.fauna), { home, groupId: "original-fish-school" });
      if (natural) fish.naturalSpawnId = "lagoon-fish";
      Object.assign(required(hunter.predator), {
        state: "pounce",
        elapsed: 0.5,
        targetId: durableId(fish),
      });
      resolvePredatorCatches(manager, [...manager.entities], wet, []);
      expect(manager.byId.has(fish.id)).toBe(false);
      expect(hunter.predator?.meals).toBe(1);
      const replacements = manager.entities.filter((e) => e.type === fish.type);
      expect(replacements).toHaveLength(natural ? 1 : 0);
      if (natural) {
        const replacement = required(replacements[0]);
        expect(replacement.naturalSpawnId).toBe("lagoon-fish");
        expect(replacement.fauna?.home).toEqual(home);
        expect(replacement.fauna?.groupId).toBe("original-fish-school");
        expect(replacement.persistentId).not.toBe(fish.persistentId);
      }
    });
  it("waits rather than consuming natural prey when no legal replacement water exists", () => {
    const manager = new EntityManager(),
      hunter = manager.spawn(createPredator(p.species, 0, 0));
    const fish = manager.spawn(createFauna("fish", required(hunter.collider).width / 2 + 4, 0));
    fish.naturalSpawnId = "isolated-fish";
    Object.assign(required(hunter.predator), {
      state: "pounce",
      elapsed: 0.5,
      targetId: durableId(fish),
    });
    resolvePredatorCatches(
      manager,
      [...manager.entities],
      { ...wet, isWater: (q) => Math.hypot(q.wx, q.wy) < 48 },
      [],
    );
    expect(manager.byId.has(fish.id)).toBe(true);
    expect(hunter.predator?.meals).toBe(0);
  });
  it("seeds a stable lagoon owner and nearby legal fish regardless of chunk order", () => {
    const [x, y] = p.expansion.inspection,
      coords = Array.from(
        { length: 25 },
        (_, i) =>
          [Math.floor(x / 16) - 2 + (i % 5), Math.floor(y / 16) - 2 + Math.floor(i / 5)] as const,
      );
    const collect = (reverse: boolean) => {
      const n = new NaturalLandscape(regionalWorld(2026), "thicket");
      return (reverse ? [...coords].reverse() : coords)
        .flatMap(([cx, cy]) => n.wildlife(cx, cy))
        .filter(
          (a) =>
            a.type === predatorType(p.species) ||
            a.featureId.startsWith(`wildlife:water-prey:${p.species}:`),
        )
        .sort((a, b) => a.featureId.localeCompare(b.featureId));
    };
    const a = collect(false);
    expect(a).toEqual(collect(true));
    expect(a.filter((a) => a.predator)).toHaveLength(1);
    expect(a.filter((a) => a.fauna)).toHaveLength(3);
    expect(new Set(a.map((a) => a.featureId)).size).toBe(4);
    const n = new NaturalLandscape(regionalWorld(2026), "thicket");
    for (const actor of a)
      expect(n.terrain(actor.wx / 16, actor.wy / 16)).toBe(TerrainId.DeepWater);
  });
  it("hunts actual generated fish and reloads the same meal, pose and replacement lineage", async () => {
    const recipe = naturalLandscapeRecipe(p.species, "thicket");
    expect(recipe.generation.type).toBe("regional");
    const s = await ScenarioSession.create(recipe);
    try {
      const entities = () => s.realm.entityManager.entities,
        hunter = () => required(entities().find((e) => e.type === predatorType(p.species)));
      expect(hunter().proceduralId).toContain("lagoon:");
      for (let i = 0; i < 1600 && !hunter().predator?.meals; i++) await s.step(idle);
      expect(hunter().predator?.meals).toBeGreaterThan(0);
      const replacements = entities().filter((e) =>
        e.naturalSpawnId?.startsWith(`wildlife:water-prey:${p.species}:`),
      );
      expect(replacements.length).toBeGreaterThan(0);
      const saved = JSON.parse(JSON.stringify(hunter().predator)),
        frame = hunter().sprite?.frameCol,
        ids = replacements.map((e) => e.persistentId).sort();
      await s.reload();
      expect(hunter().predator).toEqual(saved);
      expect(hunter().sprite?.frameCol).toBe(frame);
      expect(
        entities()
          .filter((e) => ids.includes(e.persistentId))
          .map((e) => e.persistentId)
          .sort(),
      ).toEqual(ids);
      const n = new NaturalLandscape(regionalWorld(2026), "thicket");
      expect(n.terrain(hunter().position.wx / 16, hunter().position.wy / 16)).toBe(
        TerrainId.DeepWater,
      );
    } finally {
      await s.close();
    }
  }, 60000);
});
it("orcas can eat natural sharks without reciprocal hunts or player meals", () => {
  const manager = new EntityManager(),
    orca = manager.spawn(createPredator("orca", 0, 0)),
    shark = manager.spawn(createPredator("shark", 38, 0));
  expect(canEat(orca, shark)).toBe(true);
  expect(canEat(shark, orca)).toBe(false);
  expect(canEat(orca, createPlayer(0, 0))).toBe(false);
  shark.naturalSpawnId = "natural-shark";
  required(shark.predator).home = { wx: 100, wy: 100 };
  Object.assign(required(orca.predator), {
    state: "pounce",
    elapsed: 0.5,
    targetId: durableId(shark),
  });
  resolvePredatorCatches(manager, [...manager.entities], wet, []);
  const replacement = required(manager.entities.find((e) => e.type === shark.type));
  expect(replacement.naturalSpawnId).toBe("natural-shark");
  expect(replacement.predator?.home).toEqual({ wx: 100, wy: 100 });
  expect(replacement.predator?.targetId).toBeUndefined();
  expect(orca.predator?.meals).toBe(1);
  expect(manager.entities.filter((e) => e.type === faunaType("fish"))).toHaveLength(0);
});
