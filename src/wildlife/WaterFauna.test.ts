import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { TerrainId } from "../autotile/TerrainId.js";
import { EntityManager } from "../entities/EntityManager.js";
import { PropManager } from "../entities/PropManager.js";
import { NaturalLandscape } from "../generation/regional/NaturalLandscape.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { decodeActor, encodeActor } from "../persistence/ActorRecords.js";
import { naturalLandscapeRecipe } from "../scenarios/NaturalLandscapeRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import { createFauna, FAUNA_PROFILES, faunaDefinition, faunaType } from "./Fauna.js";
import { faunaHabitatAllows, updateFaunaAI } from "./faunaAI.js";
import { restoreFaunaPose, startleFauna } from "./faunaInteractions.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
const env = {
  isWater: (p: { wx: number }) => p.wx >= 160,
  isDeepWater: (p: { wx: number }) => p.wx >= 192,
  canOccupy: () => true,
  surfaceZ: () => 0,
};
const collision = (tx: number) => (tx >= 10 ? CollisionFlag.Water : 0);
describe.each(FAUNA_PROFILES.filter((p) => ["pond", "shore", "deep"].includes(p.habitat)))(
  "$species water authority",
  (p) => {
    it("uses the frozen native cells, anchors, all activities and matched escape cadence", () => {
      const m = JSON.parse(
        readFileSync(`public/${p.image.replace("sheet.png", "sprite.json")}`, "utf8"),
      );
      expect(
        createHash("sha256")
          .update(readFileSync(`public/${p.image}`))
          .digest("hex"),
      ).toBe(p.sha256);
      expect(m.identity).toBe(p.identity);
      expect(m.anchor).toEqual(p.anchor);
      expect(m.frameWidth).toBe(p.size);
      for (const c of p.clips.filter((c) => !c.name.startsWith("flee"))) {
        expect(m.clips[c.name].start).toBe(c.start);
        expect(m.clips[c.name].count).toBe(c.count);
      }
      const def = faunaDefinition(p);
      expect(def.aquatic).toBe(p.habitat !== "shore");
      expect(def.amphibious).toBe(p.habitat === "shore");
      for (const c of p.clips.filter((c) => c.name.startsWith("flee"))) {
        const native = required(
          p.clips.find((n) => n.start === c.start && !n.name.startsWith("flee")),
        );
        expect(c.frameDuration * 2).toBe(native.frameDuration);
        expect(c.count).toBe(native.count);
      }
    });
    it("runs native activities with actual shore gait or full-footprint water confinement", () => {
      const manager = new EntityManager(),
        props = new PropManager(),
        animal = manager.spawn(createFauna(p.species, p.habitat === "shore" ? 170 : 256, 64));
      const ai = required(animal.fauna);
      ai.home = { wx: p.habitat === "shore" ? 160 : 256, wy: 64 };
      ai.timer = 0;
      const clips = new Set<number>();
      for (let i = 0; i < 2200; i++) {
        updateFaunaAI(animal, 0.1, env, [animal], []);
        manager.update(0.1, collision, [], props, undefined, () => 0);
        clips.add(required(animal.sprite).clip ?? 0);
        expect(animal.wz ?? 0).toBe(0);
        expect(animal.jumpVZ).toBeUndefined();
        if (p.habitat !== "shore")
          expect(faunaHabitatAllows(animal, animal.position, env)).toBe(true);
        else if (ai.motion) expect(animal.sprite?.clip).toBe(ai.water ? 2 : 1);
      }
      expect(clips.has(0)).toBe(true);
      expect(clips.has(p.clips.findIndex((c) => c.name === "action"))).toBe(true);
      expect(clips.has(1)).toBe(true);
      if (p.habitat === "shore") expect(clips.has(2)).toBe(true);
    });
    it("retains RNG, target, water pose and exact motion phase through save and binary presentation", () => {
      const manager = new EntityManager(),
        props = new PropManager(),
        animal = manager.spawn(createFauna(p.species, 256, 64));
      required(animal.fauna).timer = 0;
      updateFaunaAI(animal, 0.1, env, [animal], []);
      manager.update(0.4, collision, [], props, undefined, () => 0);
      expect(animal.fauna?.motion).toBeDefined();
      const restored = decodeActor(encodeActor(animal));
      if ("isProp" in restored) throw Error("Expected fauna");
      const other = new EntityManager();
      other.spawn(restored);
      expect(restored.fauna).toEqual(animal.fauna);
      expect(restored.sprite).toEqual(animal.sprite);
      expect(restored.noShadow).toBe(true);
      const replica = deserializeEntity(serializeEntity(animal));
      expect(replica.sprite?.frameCol).toBe(animal.sprite?.frameCol);
      expect(replica.noShadow).toBe(true);
      for (let i = 0; i < 150; i++) {
        manager.update(1 / 60, collision, [], props, undefined, () => 0);
        other.update(1 / 60, collision, [], props, undefined, () => 0);
        expect(restored.position).toEqual(animal.position);
        expect(restored.fauna).toEqual(animal.fauna);
        expect(restored.sprite?.clip).toBe(animal.sprite?.clip);
        expect(restored.sprite?.frameCol).toBe(animal.sprite?.frameCol);
      }
    });
    it("settles a closed refuge without teleporting, re-alarming or replacing an animal", () => {
      const animal = createFauna(p.species, 256, 64),
        before = { ...animal.position };
      startleFauna(animal, { wx: 210, wy: 64 });
      updateFaunaAI(animal, 0.5, { ...env, canOccupy: () => false }, [animal], []);
      expect(animal.fauna?.state).toBe("recover");
      expect(animal.position).toEqual(before);
      expect(animal.fauna?.alarmFrom).toBeUndefined();
    });
    it("seeds durable suitable populations deterministically across chunk order and bounded water caches", () => {
      const [x, y] = p.inspection;
      const coords = Array.from({ length: 64 }, (_, i) => ({
        cx: Math.floor(x / 16) - 4 + (i % 8),
        cy: Math.floor(y / 16) - 4 + Math.floor(i / 8),
      }));
      const n = new NaturalLandscape(regionalWorld(2026), "thicket"),
        other = new NaturalLandscape(regionalWorld(2026), "thicket");
      const collect = (n: NaturalLandscape, reverse: boolean) =>
        (reverse ? [...coords].reverse() : coords)
          .flatMap((c) => n.wildlife(c.cx, c.cy))
          .filter((a) => a.type === faunaType(p.species))
          .sort((a, b) => a.featureId.localeCompare(b.featureId));
      const a = collect(n, false);
      expect(a).toEqual(collect(other, true));
      expect(a.length).toBeGreaterThanOrEqual(p.group);
      expect(new Set(a.map((a) => a.featureId)).size).toBe(a.length);
      for (const actor of a) {
        const water = [TerrainId.ShallowWater, TerrainId.DeepWater].includes(
          n.terrain(actor.wx / 16, actor.wy / 16),
        );
        expect(actor.fauna?.water).toBe(water);
        if (p.habitat === "deep")
          expect(n.terrain(actor.wx / 16, actor.wy / 16)).toBe(TerrainId.DeepWater);
        if (p.habitat === "pond") expect(water).toBe(true);
        expect(n.reserved(actor.wx / 16, actor.wy / 16, 2)).toBe(false);
      }
      for (let i = 0; i < 150; i++) n.lagoon(1000 + i, 1000);
      expect(n.cacheSizes.lagoons).toBeLessThanOrEqual(128);
    });
    it("uses production regional Worker behavior and saves the same individual and activity phase", async () => {
      const s = await ScenarioSession.create(naturalLandscapeRecipe(p.species, "thicket"));
      try {
        const animals = () =>
          s.realm.entityManager.entities.filter((a) => a.type === faunaType(p.species));
        expect(animals().length).toBeGreaterThanOrEqual(p.group);
        const clips = new Set<number>();
        for (let i = 0; i < 1200; i++) {
          await s.step(idle, 0.1);
          for (const animal of animals()) {
            clips.add(animal.sprite?.clip ?? 0);
            expect(animal.wz).toBe(0);
          }
        }
        expect(clips.has(1)).toBe(true);
        if (p.habitat === "shore") expect(clips.has(2)).toBe(true);
        const before = animals().map((a) => ({
          id: a.proceduralId,
          position: { ...a.position },
          fauna: JSON.parse(JSON.stringify(a.fauna)),
          frame: a.sprite?.frameCol,
        }));
        await s.reload();
        for (const a of before) {
          const restored = required(animals().find((b) => b.proceduralId === a.id));
          expect(restored.position).toEqual(a.position);
          expect(restored.fauna).toEqual(a.fauna);
          expect(restored.sprite?.frameCol).toBe(a.frame);
        }
      } finally {
        await s.close();
      }
    }, 20000);
  },
);
it("an amphibious gait changes at the resolved shore, while the saved motion clock continues", () => {
  const m = new EntityManager(),
    props = new PropManager(),
    seal = m.spawn(createFauna("harbor-seal", 140, 64)),
    ai = required(seal.fauna);
  ai.target = { wx: 220, wy: 64 };
  ai.state = "travel";
  ai.motion = { elapsed: 0, duration: 10, escaping: false };
  restoreFaunaPose(seal);
  m.update(1, collision, [], props, undefined, () => 0);
  expect(seal.position.wx).toBe(150);
  expect(seal.sprite?.clip).toBe(1);
  m.update(1, collision, [], props, undefined, () => 0);
  expect(seal.position.wx).toBe(160);
  expect(seal.sprite?.clip).toBe(2);
  expect(seal.sprite?.clipElapsedMs).toBe(2000);
  expect(seal.noShadow).toBe(true);
  m.update(0.5, collision, [], props, undefined, () => 0);
  expect(seal.position.wx).toBe(173);
  expect(seal.sprite?.clipElapsedMs).toBe(2500);
});
it("large aquatic path clearance checks internal footprint tiles, not only center or corners", () => {
  const ray = createFauna("manta-ray", 256, 64);
  expect(
    faunaHabitatAllows(ray, ray.position, {
      ...env,
      isDeepWater: (p) => !(p.wx === 248 && p.wy === 56),
    }),
  ).toBe(false);
  expect(faunaHabitatAllows(ray, ray.position, env)).toBe(true);
});
it("non-moving native action phase is durable as well as travel phase", () => {
  const m = new EntityManager(),
    props = new PropManager(),
    animal = m.spawn(createFauna("penguin", 256, 64)),
    ai = required(animal.fauna);
  ai.timer = 0;
  ai.activity = 2;
  updateFaunaAI(animal, 0.1, env, [animal], []);
  expect(ai.state).toBe("action");
  m.update(0.7, collision, [], props, undefined, () => 0);
  const restored = decodeActor(encodeActor(animal));
  if ("isProp" in restored) throw Error("Expected fauna");
  expect(restored.sprite?.frameCol).toBe(animal.sprite?.frameCol);
  expect(restored.fauna?.actionElapsed).toBe(0.7);
});
it("a ray stops at actual depth after its committed route is edited to shallow water", () => {
  const m = new EntityManager(),
    props = new PropManager(),
    ray = m.spawn(createFauna("manta-ray", 256, 64)),
    ai = required(ray.fauna);
  ai.target = { wx: 350, wy: 64 };
  ai.state = "travel";
  ai.motion = { elapsed: 0, duration: 4, escaping: false };
  restoreFaunaPose(ray);
  for (let i = 0; i < 270; i++)
    m.update(
      1 / 60,
      () => CollisionFlag.Water,
      [],
      props,
      undefined,
      () => 0,
      undefined,
      (tx) => (tx < 20 ? TerrainId.DeepWater : TerrainId.ShallowWater),
    );
  expect(ray.position.wx).toBeLessThanOrEqual(284);
  expect(ai.state).toBe("rest");
  expect(ai.motion).toBeUndefined();
  expect(ray.wz).toBe(0);
});
