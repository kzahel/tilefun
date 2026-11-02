import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { TerrainId } from "../autotile/TerrainId.js";
import { aabbOverlapsPropWalls, getEntityAABB } from "../entities/collision.js";
import { createPlayer } from "../entities/Player.js";
import { createProp } from "../entities/PropFactories.js";
import { setSpriteClipElapsed } from "../entities/spriteAnimation.js";
import { createDescriptor } from "../generation/GenerationDescriptor.js";
import { createGenerator } from "../generation/Generator.js";
import { NaturalLandscape } from "../generation/regional/NaturalLandscape.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { encodeActor } from "../persistence/ActorRecords.js";
import { naturalLandscapeRecipe } from "../scenarios/NaturalLandscapeRecipe.js";
import { FLAT_SCENARIO } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { decodeServerMessage, encodeServerMessage } from "../shared/binaryCodec.js";
import { applyEntityDelta, diffEntitySnapshots } from "../shared/entityDelta.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import { createFrog, FROG_CLIPS, FROG_IMAGE, FROG_TYPE } from "./Frog.js";
import { updateFrogAI } from "./frogAI.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
const open = { canOccupy: () => true, isWater: () => false, surfaceZ: () => 0 };

it("uses the unchanged frog sheet and its real hop/swim/blink frame ranges", () => {
  const sprite = JSON.parse(
    readFileSync(`public/${FROG_IMAGE.replace("sheet.png", "sprite.json")}`, "utf8"),
  );
  expect(
    createHash("sha256")
      .update(readFileSync(`public/${FROG_IMAGE}`))
      .digest("hex"),
  ).toBe(sprite.sheetSha256);
  expect(sprite.anchor).toEqual([24, 34]);
  for (const clip of FROG_CLIPS) {
    expect(sprite.clips[clip.name].start).toBe(clip.start);
    expect(sprite.clips[clip.name].count).toBe(clip.count);
    expect(sprite.clips[clip.name].durationMs).toBe(clip.count * clip.frameDuration);
  }
});

it("seeds a small independent frog population on open grassy banks, in either query order", () => {
  const coords = Array.from({ length: 64 }, (_, i) => ({
    cx: 8 + (i % 8),
    cy: -16 + Math.floor(i / 8),
  }));
  const placements = (seed: number, reverse = false) => {
    const n = new NaturalLandscape(regionalWorld(seed), "thicket");
    return (reverse ? [...coords].reverse() : coords)
      .flatMap((c) => n.wildlife(c.cx, c.cy))
      .filter((p) => p.type === FROG_TYPE)
      .sort((a, b) => a.featureId.localeCompare(b.featureId));
  };
  const frogs = placements(2026);
  expect(frogs.length).toBeGreaterThanOrEqual(2);
  expect(frogs.length).toBeLessThanOrEqual(4);
  expect(placements(2026, true)).toEqual(frogs);
  expect(placements(7)).not.toEqual(frogs);
  const generator = createGenerator(createDescriptor("regional", 2026));
  const n = new NaturalLandscape(regionalWorld(2026), "thicket");
  for (const p of frogs) {
    expect(n.pondBank(p.wx / 16, p.wy / 16)).toBe(true);
    expect(n.terrain(p.wx / 16, p.wy / 16)).toBe(TerrainId.Grass);
    const box = getEntityAABB(p, required(createFrog(p.wx, p.wy).collider));
    const cx = Math.floor(p.wx / 256),
      cy = Math.floor(p.wy / 256);
    expect(generator.actors?.(cx, cy)).toContainEqual(p);
    const nearby = [-1, 0, 1].flatMap((dx) =>
      [-1, 0, 1].flatMap((dy) => generator.placements(cx + dx, cy + dy, new Set()).placements),
    );
    expect(
      nearby.some((a) => {
        const prop = createProp(a.propType, a.wx, a.wy);
        return aabbOverlapsPropWalls(box, prop.position, prop);
      }),
    ).toBe(false);
  }
});

it("replicates mid-hop phase through binary baselines/deltas and removes it on landing", () => {
  const frog = createFrog(64, 64);
  required(frog.frog).timer = 0;
  const before = serializeEntity(frog);
  updateFrogAI(frog, 0.1, open, [frog], []);
  setSpriteClipElapsed(frog, 560);
  const after = serializeEntity(frog);
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
  const baseline = deserializeEntity(required(wire.entityBaselines?.[0]));
  expect(baseline.sprite?.frameCol).toBe(5);
  const replica = deserializeEntity(before);
  applyEntityDelta(replica, required(wire.entityDeltas?.[0]));
  expect(replica.sprite?.clipElapsedMs).toBe(560);
  expect(replica.sprite?.frameCol).toBe(5);
  delete required(frog.sprite).clipElapsedMs;
  applyEntityDelta(replica, required(diffEntitySnapshots(after, serializeEntity(frog))));
  expect(replica.sprite?.clipElapsedMs).toBeUndefined();
});

it("runs all four frog cycles, land and water in the production pond Realm, and retains saved animals/deletions", async () => {
  const s = await ScenarioSession.create(naturalLandscapeRecipe("pond", "thicket"));
  try {
    const frogs = () => s.realm.entityManager.entities.filter((e) => e.type === FROG_TYPE);
    expect(frogs().length).toBeGreaterThanOrEqual(2);
    const clips = new Set<number>(),
      media = new Set<boolean>();
    for (let i = 0; i < 1600; i++) {
      await s.step(idle, 0.1);
      for (const frog of frogs()) {
        clips.add(frog.sprite?.clip ?? 0);
        media.add(
          (s.realm.world.getCollisionIfLoaded(
            Math.floor(frog.position.wx / 16),
            Math.floor(frog.position.wy / 16),
          ) &
            CollisionFlag.Water) !==
            0,
        );
        expect(
          Math.hypot(
            frog.position.wx - required(frog.frog).home.wx,
            frog.position.wy - required(frog.frog).home.wy,
          ),
        ).toBeLessThanOrEqual(required(frog.frog).radius + 1);
      }
    }
    expect([...clips].sort()).toEqual([0, 1, 2, 3]);
    expect(media.size).toBe(2);
    const removed = required(frogs()[0]),
      retained = required(frogs()[1]);
    s.realm.entityManager.remove(removed.id);
    const manual = s.realm.entityManager.spawn(
      createFrog(s.player.player.position.wx + 24, s.player.player.position.wy),
    );
    const saved = encodeActor(retained),
      manualId = manual.persistentId;
    await s.reload();
    expect(frogs().some((f) => f.persistentId === removed.persistentId)).toBe(false);
    const restored = required(frogs().find((f) => f.persistentId === saved.persistentId));
    expect(restored.frog).toEqual(saved.state.frog);
    expect(restored.position).toEqual({ wx: saved.wx, wy: saved.wy });
    expect(frogs().some((f) => f.persistentId === manualId)).toBe(true);
  } finally {
    await s.close();
  }
}, 60000);

it.each([true, false])(
  "Realm landing startles a frog with or without player input (input=%s)",
  async (input) => {
    const frog = createFrog(64, 64);
    frog.persistentId = "durable-frog";
    const player = createPlayer(64, 64);
    player.wz = 7;
    player.jumpZ = 7;
    player.jumpVZ = -40;
    const s = await ScenarioSession.create({
      version: 1,
      id: "frog-contact",
      generation: FLAT_SCENARIO,
      player,
      props: [],
      actors: [frog],
    });
    try {
      for (let i = 0; i < 6; i++) {
        if (input) await s.step(idle, 1 / 60);
        else s.tick(1 / 60);
      }
      const animal = required(s.realm.entityManager.entities.find((e) => e.type === FROG_TYPE));
      expect(s.player.player.jumpVZ).toBeUndefined();
      expect(animal.wanderAI?.state).toBe("scared");
      for (let i = 0; i < 42; i++) await s.step(idle, 1 / 60);
      expect(animal.frog?.state).toBe("hop");
      const saved = encodeActor(animal);
      await s.reload();
      const restored = required(s.realm.entityManager.entities.find((e) => e.type === FROG_TYPE));
      expect(restored.persistentId).toBe("durable-frog");
      expect(restored.frog).toEqual(saved.state.frog);
    } finally {
      await s.close();
    }
  },
);
