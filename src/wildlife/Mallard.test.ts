import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { RemoteStateView } from "../client/ClientStateView.js";
import { createChicken } from "../entities/Chicken.js";
import { aabbOverlapsPropWalls, getEntityAABB } from "../entities/collision.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createPlayer } from "../entities/Player.js";
import { createProp } from "../entities/PropFactories.js";
import { PropManager } from "../entities/PropManager.js";
import { setSpriteClip, tickSpriteAnimation } from "../entities/spriteAnimation.js";
import { createDescriptor } from "../generation/GenerationDescriptor.js";
import { createGenerator } from "../generation/Generator.js";
import { NaturalLandscape } from "../generation/regional/NaturalLandscape.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { decodeActor, encodeActor } from "../persistence/ActorRecords.js";
import { naturalLandscapeRecipe } from "../scenarios/NaturalLandscapeRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { decodeServerMessage, encodeServerMessage } from "../shared/binaryCodec.js";
import { applyEntityDelta, diffEntitySnapshots } from "../shared/entityDelta.js";
import type { FrameMessage } from "../shared/protocol.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import { World } from "../world/World.js";
import { createMallard, MALLARD_CLIPS, MALLARD_IMAGE, MALLARD_TYPE } from "./Mallard.js";
import { updateMallardAI } from "./mallardAI.js";

it("pins the unchanged provisional sheet and its actual directional clip bounds", () => {
  const sprite = JSON.parse(
    readFileSync(`public/${MALLARD_IMAGE.replace("sheet.png", "sprite.json")}`, "utf8"),
  );
  expect(
    createHash("sha256")
      .update(readFileSync(`public/${MALLARD_IMAGE}`))
      .digest("hex"),
  ).toBe(sprite.sheetSha256);
  expect(sprite.anchor).toEqual([24, 34]);
  for (const clip of MALLARD_CLIPS) {
    const authored = sprite.clips[clip.name === "flight" ? "flap" : clip.name];
    expect(authored.start).toBe(clip.start);
    expect(authored.count).toBe(clip.count);
    if (clip.name !== "flight") expect(authored.durationMs).toBe(clip.count * clip.frameDuration);
  }
});

it("seeds small pond flocks independently of chunk query order, with open banks", () => {
  const n = new NaturalLandscape(regionalWorld(2026), "thicket");
  const coords = Array.from({ length: 64 }, (_, i) => ({
    cx: 8 + (i % 8),
    cy: -16 + Math.floor(i / 8),
  }));
  const placements = (nature: NaturalLandscape, reversed = false) =>
    (reversed ? [...coords].reverse() : coords)
      .flatMap((c) => nature.wildlife(c.cx, c.cy))
      .sort((a, b) => a.featureId.localeCompare(b.featureId));
  const ducks = placements(n);
  expect(ducks.length).toBeGreaterThanOrEqual(2);
  expect(ducks.length).toBeLessThanOrEqual(4);
  expect(placements(new NaturalLandscape(regionalWorld(2026), "thicket"), true)).toEqual(ducks);
  const generator = createGenerator(createDescriptor("regional", 2026));
  for (const p of ducks) {
    expect(generator.actors?.(Math.floor(p.wx / 256), Math.floor(p.wy / 256))).toContainEqual(p);
    const collider = required(createMallard(p.wx, p.wy).collider);
    const box = getEntityAABB(p, collider);
    const nearby = generator.placements(
      Math.floor(p.wx / 256),
      Math.floor(p.wy / 256),
      new Set(),
    ).placements;
    expect(
      nearby.some((a) => {
        const prop = createProp(a.propType, a.wx, a.wy);
        return aabbOverlapsPropWalls(box, prop.position, prop);
      }),
    ).toBe(false);
    expect(n.pondBank(p.wx / 16, p.wy / 16)).toBe(true);
    expect(p.mallard?.home).not.toEqual({ wx: p.wx, wy: p.wy });
  }
  expect(placements(new NaturalLandscape(regionalWorld(7), "thicket"))).not.toEqual(ducks);
});

it("replicates every clip through binary baselines and deltas; stationary one-shots stop at their last pose", () => {
  const duck = createMallard(16, 16);
  const client = deserializeEntity(serializeEntity(duck));
  for (let clip = 0; clip < MALLARD_CLIPS.length; clip++) {
    const before = serializeEntity(duck);
    setSpriteClip(duck, clip);
    const after = serializeEntity(duck);
    const message: FrameMessage = {
      type: "frame",
      serverTick: 1,
      lastProcessedInputSeq: 0,
      playerEntityId: 0,
      entityBaselines: [after],
    };
    // Baselines use the same optional byte as incremental sprite state.
    const decoded = decodeServerMessage(encodeServerMessage(message));
    if (decoded.type !== "frame") throw new Error("Expected frame");
    expect(decoded.entityBaselines?.[0]?.spriteState?.clip).toBe(clip);
    const delta = diffEntitySnapshots(before, after);
    if (delta) {
      const wire = decodeServerMessage(
        encodeServerMessage({
          type: "frame",
          serverTick: 2,
          lastProcessedInputSeq: 0,
          playerEntityId: 0,
          entityDeltas: [delta],
        }),
      );
      if (wire.type !== "frame") throw new Error("Expected delta frame");
      applyEntityDelta(client, required(wire.entityDeltas?.[0]));
    }
    tickSpriteAnimation(client, 0.32);
    const def = required(MALLARD_CLIPS[clip]);
    expect(client.sprite?.frameCol).toBe(
      def.start + Math.min(Math.floor(320 / def.frameDuration), def.count - 1),
    );
    tickSpriteAnimation(client, 10);
    if (!def.loop) expect(client.sprite?.frameCol).toBe(def.start + def.count - 1);
  }
  const view = new RemoteStateView(new World());
  setSpriteClip(duck, 4);
  view.applyMessage({
    type: "frame",
    serverTick: 1,
    lastProcessedInputSeq: 0,
    playerEntityId: 0,
    entityBaselines: [serializeEntity(duck)],
  });
  view.tickAnimations(0.32);
  expect(view.entities.find((e) => e.type === MALLARD_TYPE)?.sprite?.frameCol).toBe(27);
  const chicken = createChicken(0, 0);
  required(chicken.sprite).moving = true;
  tickSpriteAnimation(chicken, 0.2);
  expect(chicken.sprite?.frameCol).toBe(1);
});

it("persists home, timer, destination and random state without a replacement animal", () => {
  const duck = createMallard(12, 34),
    ai = required(duck.mallard);
  duck.persistentId = "manual-duck";
  ai.state = "travel";
  ai.timer = 8;
  ai.target = { wx: 60, wy: 40 };
  ai.randomState = 123;
  const restored = decodeActor(encodeActor(duck));
  expect(restored.persistentId).toBe("manual-duck");
  expect((restored as typeof duck).mallard).toEqual(ai);
});

it("avoids obstructed targets and stays near its home", () => {
  const duck = createMallard(-30, 0),
    ai = required(duck.mallard);
  ai.timer = 0;
  const env = {
    canOccupy: (_e: unknown, p: { wx: number; wy: number }) => p.wx < 0,
    isWater: () => false,
  };
  for (let i = 0; i < 300; i++) {
    updateMallardAI(duck, 0.1, env, [duck], []);
    const v = required(duck.velocity);
    duck.position.wx += v.vx * 0.1;
    duck.position.wy += v.vy * 0.1;
    expect(duck.position.wx).toBeLessThan(0);
    expect(
      Math.hypot(duck.position.wx - ai.home.wx, duck.position.wy - ai.home.wy),
    ).toBeLessThanOrEqual(ai.radius + 1);
  }
});

it("runs all five cycles in the real pond Realm and restores moved, deleted and manually created ducks", async () => {
  const s = await ScenarioSession.create(naturalLandscapeRecipe("pond", "thicket"));
  try {
    const flock = () => s.realm.entityManager.entities.filter((e) => e.type === MALLARD_TYPE);
    expect(flock().length).toBeGreaterThanOrEqual(2);
    const clips = new Set<number>(),
      media = new Set<boolean>();
    for (let i = 0; i < 1000; i++) {
      await s.step({ dx: 0, dy: 0, jump: false, sprinting: false }, 0.1);
      for (const duck of flock()) {
        clips.add(required(duck.sprite).clip ?? 0);
        media.add(
          (s.realm.world.getCollisionIfLoaded(
            Math.floor(duck.position.wx / 16),
            Math.floor(duck.position.wy / 16),
          ) &
            CollisionFlag.Water) !==
            0,
        );
        const ai = required(duck.mallard);
        expect(
          Math.hypot(duck.position.wx - ai.home.wx, duck.position.wy - ai.home.wy),
        ).toBeLessThanOrEqual(ai.radius + 1);
      }
    }
    expect([...clips].sort()).toEqual([0, 1, 2, 3, 4]);
    expect(media.size).toBe(2);
    const removed = required(flock()[0]),
      retained = required(flock()[1]);
    s.realm.entityManager.remove(removed.id);
    const manual = s.realm.entityManager.spawn(
      createMallard(s.player.player.position.wx + 20, s.player.player.position.wy),
    );
    const saved = encodeActor(retained),
      savedManual = encodeActor(manual);
    await s.reload();
    expect(flock().some((e) => e.proceduralId === removed.proceduralId)).toBe(false);
    const restored = required(flock().find((e) => e.persistentId === saved.persistentId));
    expect(restored.position).toEqual({ wx: saved.wx, wy: saved.wy });
    expect(restored.mallard).toEqual(saved.state.mallard);
    expect(flock().some((e) => e.persistentId === savedManual.persistentId)).toBe(true);
  } finally {
    await s.close();
  }
}, 30000);

it("duck bodies are solid, and amphibious motion respects solid terrain", () => {
  const manager = new EntityManager(),
    player = manager.spawn(createPlayer(0, 10));
  const duck = manager.spawn(createMallard(10, 10));
  expect(duck.collider?.solid).toBe(true);
  required(player.velocity).vx = 20;
  manager.update(0.1, () => CollisionFlag.None, [player], new PropManager());
  expect(player.position.wx).toBeLessThan(2);
  manager.remove(player.id);
  duck.position = { wx: 10, wy: 10 };
  required(duck.velocity).vx = 20;
  manager.update(0.1, () => CollisionFlag.Water, [], new PropManager());
  expect(duck.position.wx).toBe(12);
  manager.update(0.1, () => CollisionFlag.Solid, [], new PropManager());
  expect(duck.position.wx).toBe(12);
});
