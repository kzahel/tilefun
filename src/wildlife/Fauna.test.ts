import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TerrainId } from "../autotile/TerrainId.js";
import { aabbOverlapsPropWalls, getEntityAABB } from "../entities/collision.js";
import { createProp } from "../entities/PropFactories.js";
import { setSpriteClipElapsed } from "../entities/spriteAnimation.js";
import { createDescriptor } from "../generation/GenerationDescriptor.js";
import { createGenerator } from "../generation/Generator.js";
import { NaturalLandscape } from "../generation/regional/NaturalLandscape.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { decodeServerMessage, encodeServerMessage } from "../shared/binaryCodec.js";
import { applyEntityDelta, diffEntitySnapshots } from "../shared/entityDelta.js";
import { required } from "../shared/required.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { createFauna, FAUNA_PROFILES, faunaProfile, faunaType } from "./Fauna.js";
import { updateFaunaAI } from "./faunaAI.js";
import { startleFauna } from "./faunaInteractions.js";

describe("fauna profile lookup", () => {
  it("preserves each distinct species and coat's live profile identity", () => {
    expect(new Set(FAUNA_PROFILES.map((p) => faunaType(p.species))).size).toBe(
      FAUNA_PROFILES.length,
    );
    for (const profile of FAUNA_PROFILES) {
      expect(faunaProfile(faunaType(profile.species))).toBe(profile);
      expect(faunaProfile(createFauna(profile.species, 0, 0).type)).toBe(profile);
    }
  });

  it("leaves missing, unrelated and prototype-like names unrecognized", () => {
    for (const type of [
      undefined,
      "",
      "dog",
      "player",
      "constructor",
      "__proto__",
      "wildlife-dog-provisional-v2",
    ]) {
      expect(faunaProfile(type)).toBeUndefined();
    }
  });
});

describe.each(FAUNA_PROFILES.filter((p) => !["pond", "shore", "deep"].includes(p.habitat)))(
  "$species shared authority",
  (p) => {
    const createAnimal = (wx: number, wy: number) => createFauna(p.species, wx, wy);
    const CLIPS = p.clips,
      IMAGE = p.image,
      TYPE = faunaType(p.species);
    const WALK_SPEED = p.speed,
      FLEE_SPEED = p.speed * 2;
    const open = { canOccupy: () => true, isWater: () => false, surfaceZ: () => 0 };

    if (p.interest > 0)
      it("shows cautious player interest without entering the alarm radius", () => {
        let improvement = 0;
        const player = { wx: 244, wy: 64 };
        for (let seed = 1; seed <= 24; seed++) {
          const alone = createAnimal(64, 64),
            curious = createAnimal(64, 64);
          for (const a of [alone, curious]) {
            required(a.fauna).randomState = seed;
            required(a.fauna).timer = 0;
          }
          updateFaunaAI(alone, 0.1, open, [alone], []);
          updateFaunaAI(curious, 0.1, open, [curious], [player]);
          const d = (a: typeof alone) =>
            Math.hypot(
              required(a.fauna).target.wx - player.wx,
              required(a.fauna).target.wy - player.wy,
            );
          expect(d(curious)).toBeLessThanOrEqual(d(alone) + 1e-8);
          expect(d(curious)).toBeGreaterThan(p.alarmDistance);
          improvement += d(alone) - d(curious);
        }
        expect(improvement).toBeGreaterThan(20);
      });

    it("uses exact native cells and authored walk/alert ranges and cadence", () => {
      const metadata = JSON.parse(
        readFileSync(`public/${IMAGE.replace("sheet.png", "sprite.json")}`, "utf8"),
      );
      expect(
        createHash("sha256")
          .update(readFileSync(`public/${IMAGE}`))
          .digest("hex"),
      ).toBe(p.sha256);
      expect(metadata.identity).toBe(p.identity);
      expect(metadata.anchor).toEqual(p.anchor);
      expect(metadata.frameWidth).toBe(p.size);
      if (typeof metadata.rootTravelPixelsPerCycle === "number") {
        expect(
          (p.speed * required(CLIPS[1]).count * required(CLIPS[1]).frameDuration) / 1000,
        ).toBeCloseTo(metadata.rootTravelPixelsPerCycle);
      }
      for (const clip of CLIPS.slice(0, 3)) {
        expect(metadata.clips[clip.name].start).toBe(clip.start);
        expect(metadata.clips[clip.name].count).toBe(clip.count);
        if (metadata.clips[clip.name].frameDuration)
          expect(clip.frameDuration).toBe(metadata.clips[clip.name].frameDuration);
        if (metadata.fps) expect(clip.frameDuration).toBeCloseTo(1000 / metadata.fps);
      }
      expect(required(CLIPS[3]).start).toBe(required(CLIPS[1]).start);
      expect(required(CLIPS[3]).count).toBe(required(CLIPS[1]).count);
      expect(FLEE_SPEED * required(CLIPS[3]).frameDuration).toBe(
        WALK_SPEED * required(CLIPS[1]).frameDuration,
      );
    });

    it("seeds stable groups in the intended habitat with whole-body clearance", () => {
      if (p.variantOf) {
        const coords = Array.from({ length: 16 }, (_, i) => ({
          cx: Math.floor(p.inspection[0] / 16) - 2 + (i % 4),
          cy: Math.floor(p.inspection[1] / 16) - 2 + Math.floor(i / 4),
        }));
        const placements = (reverse: boolean) => {
          const g = createGenerator(createDescriptor("regional", 2026));
          return (reverse ? [...coords].reverse() : coords)
            .flatMap((c) => g.actors?.(c.cx, c.cy) ?? [])
            .filter((a) => a.type === TYPE)
            .sort((a, b) => a.featureId.localeCompare(b.featureId));
        };
        const animals = placements(false);
        expect(placements(true)).toEqual(animals);
        expect(
          animals.some((a) => a.wx === p.inspection[0] * 16 && a.wy === p.inspection[1] * 16),
        ).toBe(true);
        for (const a of animals) {
          expect(a.featureId).toMatch(new RegExp(`^settlement-pet:.*:${p.variantOf}$`));
          const b = required(a.fauna?.habitatBounds);
          expect(a.wx - p.body[0] / 2).toBeGreaterThanOrEqual(b.minX);
          expect(a.wx + p.body[0] / 2).toBeLessThanOrEqual(b.maxX);
        }
        return;
      }
      const coords = Array.from({ length: 16 }, (_, i) => ({
        cx: Math.floor(p.inspection[0] / 16) - 2 + (i % 4),
        cy: Math.floor(p.inspection[1] / 16) - 2 + Math.floor(i / 4),
      }));
      const placements = (seed: number, reverse = false) => {
        const n = new NaturalLandscape(regionalWorld(seed), "thicket");
        return (reverse ? [...coords].reverse() : coords)
          .flatMap((c) => n.wildlife(c.cx, c.cy))
          .filter((a) => a.type === TYPE)
          .sort((a, b) => a.featureId.localeCompare(b.featureId));
      };
      const animal = placements(2026);
      expect(animal.length).toBeGreaterThanOrEqual(p.group);
      expect(animal.length).toBeLessThanOrEqual(p.group);
      expect(placements(2026, true)).toEqual(animal);
      expect(placements(7)).not.toEqual(animal);
      const n = new NaturalLandscape(regionalWorld(2026), "thicket"),
        generator = createGenerator(createDescriptor("regional", 2026));
      for (const placement of animal) {
        const cx = Math.floor(placement.wx / 256),
          cy = Math.floor(placement.wy / 256),
          ai = required(placement.fauna);
        expect(generator.actors?.(cx, cy)).toContainEqual(placement);
        if (p.group > 1) expect(ai.groupId).toMatch(/fauna-(?:expansion-)?home:/);
        else expect(ai.groupId).toBeUndefined();
        const props = [-1, 0, 1]
          .flatMap((dx) => [-1, 0, 1].flatMap((dy) => n.placements(cx + dx, cy + dy)))
          .map((a) => createProp(a.propType, a.wx, a.wy));
        for (let i = 0; i < 24; i++) {
          const angle = (i * Math.PI) / 12,
            point = {
              wx: ai.home.wx + Math.cos(angle) * ai.radius,
              wy: ai.home.wy + Math.sin(angle) * ai.radius,
            };
          expect(n.terrain(point.wx / 16, point.wy / 16)).toBe(TerrainId.Grass);
          expect(n.inThicket(point.wx / 16, point.wy / 16)).toBe(false);
          const box = getEntityAABB(point, required(createAnimal(point.wx, point.wy).collider));
          expect(props.some((prop) => aabbOverlapsPropWalls(box, prop.position, prop, 0, 24))).toBe(
            false,
          );
        }
      }
      expect(new Set(animal.map((p) => p.fauna?.groupId)).size).toBe(1);
      for (let i = 0; i < 600; i++) n.faunaHome(i, i);
      expect(n.cacheSizes.faunaHomes).toBeLessThanOrEqual(128);
    });

    it("replicates timed walk phase in binary baselines/deltas and clears it at rest", () => {
      const animal = createAnimal(64, 64);
      required(animal.fauna).timer = 0;
      const before = serializeEntity(animal);
      updateFaunaAI(animal, 0.1, open, [animal], []);
      setSpriteClipElapsed(animal, 437);
      const after = serializeEntity(animal);
      const wire = decodeServerMessage(
        encodeServerMessage({
          type: "frame",
          serverTick: 1,
          lastProcessedInputSeq: 0,
          playerEntityId: 0,
          entityBaselines: [after],
          entityDeltas: [required(diffEntitySnapshots(before, after))],
        }),
      );
      if (wire.type !== "frame") throw new Error("Expected frame");
      expect(deserializeEntity(required(wire.entityBaselines?.[0])).sprite?.frameCol).toBe(
        required(CLIPS[1]).start + Math.floor(437 / required(CLIPS[1]).frameDuration),
      );
      const replica = deserializeEntity(before);
      applyEntityDelta(replica, required(wire.entityDeltas?.[0]));
      expect(replica.sprite?.clipElapsedMs).toBe(437);
      expect(replica.sprite?.frameCol).toBe(
        required(CLIPS[1]).start + Math.floor(437 / required(CLIPS[1]).frameDuration),
      );
      delete required(animal.sprite).clipElapsedMs;
      applyEntityDelta(replica, required(diffEntitySnapshots(after, serializeEntity(animal))));
      expect(replica.sprite?.clipElapsedMs).toBeUndefined();
    });

    it("loosely keeps herd company and rejects water/closed routes without an alarm retry loop", () => {
      const animal = createAnimal(64, 64),
        peer = createAnimal(64 + Math.max(64, p.body[0] * 2), 64);
      required(animal.fauna).groupId = required(peer.fauna).groupId = "companions";
      required(animal.fauna).timer = 0;
      updateFaunaAI(animal, 0.1, open, [animal, peer], []);
      expect(animal.fauna?.state).toBe("travel");
      if (p.cohesion > 0)
        expect(
          Math.hypot(
            required(animal.fauna).target.wx - peer.position.wx,
            required(animal.fauna).target.wy - peer.position.wy,
          ),
        ).toBeLessThan(Math.max(64, p.body[0] * 2));
      const enclosed = createAnimal(64, 64);
      startleFauna(enclosed, { wx: 40, wy: 64 });
      updateFaunaAI(enclosed, 0.5, { ...open, isWater: () => true }, [enclosed], []);
      expect(enclosed.fauna?.state).toBe("recover");
      expect(enclosed.fauna?.alarmFrom).toBeUndefined();
      updateFaunaAI(enclosed, 4, { ...open, canOccupy: () => false }, [enclosed], []);
      expect(enclosed.fauna?.state).toBe("rest");
    });
  },
);
