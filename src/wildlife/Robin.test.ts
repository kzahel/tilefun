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
import { createRobin, ROBIN_CLIPS, ROBIN_IMAGE, ROBIN_TYPE } from "./Robin.js";
import { updateRobinAI } from "./robinAI.js";
import { robinTreePerches } from "./robinPerches.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
const open = { canOccupy: () => true, isWater: () => false, surfaceZ: () => 0 };

it("waits without crown queries while retaining immediate close-player alarm rules", () => {
  for (const state of ["rest", "recover"] as const) {
    const bird = createRobin(64, 64),
      ai = required(bird.robin);
    ai.state = state;
    const rng = ai.randomState;
    updateRobinAI(
      bird,
      0.1,
      {
        ...open,
        perches: () => {
          throw Error("Distant timer waits must not query crowns");
        },
      },
      [bird],
      state === "recover" ? [bird.position] : [{ wx: 90, wy: 64 }],
    );
    expect(ai.timer).toBe(1.4);
    expect(ai.state).toBe(state);
    expect(ai.randomState).toBe(rng);
    expect(ai.alarmFrom).toBeUndefined();
  }

  const ground = createRobin(64, 64),
    perched = createRobin(64, 64);
  perched.wz = 32;
  required(perched.robin).state = "perch";
  let queries = 0;
  const env = {
    ...open,
    perches: () => {
      queries++;
      return [{ wx: 64, wy: 64, z: 32 }];
    },
  };
  const player = { wx: 84, wy: 64 };
  updateRobinAI(ground, 0.01, env, [ground], [player]);
  updateRobinAI(perched, 0.01, env, [perched], [player]);
  expect(queries).toBe(2);
  expect(ground.robin?.state).toBe("startle");
  expect(perched.robin?.state).toBe("perch");
  // Removing the crown changes the smaller alarm radius on the next decision.
  updateRobinAI(perched, 0.01, { ...env, perches: () => [] }, [perched], [player]);
  expect(perched.robin?.state).toBe("startle");
});

it("queries current crowns when the timer expires, including the exact boundary", () => {
  for (const timer of [0.1, 0.09]) {
    const bird = createRobin(64, 64);
    required(bird.robin).timer = timer;
    required(bird.robin).activity = 1;
    let queried = false;
    updateRobinAI(
      bird,
      0.1,
      {
        ...open,
        perches: () => {
          queried = true;
          return [{ wx: 100, wy: 64, z: 32 }];
        },
      },
      [bird],
      [],
    );
    expect(queried).toBe(true);
    expect(bird.robin?.target).toEqual({ wx: 100, wy: 64, z: 32 });
    expect(bird.robin?.state).toBe("flight");
  }
});

it("tests proposed path heights without copying actor state or mutating the bird", () => {
  const bird = createRobin(64, 64);
  required(bird.robin).timer = 0;
  required(bird.robin).activity = 1;
  Object.defineProperty(bird, "tags", {
    enumerable: true,
    get: () => {
      throw Error("Occupancy must not read unrelated actor fields");
    },
  });
  const heights: number[] = [];
  updateRobinAI(
    bird,
    0.1,
    {
      ...open,
      perches: () => [{ wx: 100, wy: 64, z: 32 }],
      canOccupy: (body) => {
        expect(body.collider).toBe(bird.collider);
        expect(bird.wz).toBeUndefined();
        heights.push(body.wz ?? 0);
        return true;
      },
    },
    [bird],
    [],
  );
  expect(Math.max(...heights)).toBeGreaterThan(44);
  expect(heights).toContain(32);
  expect(bird.robin?.state).toBe("flight");
});

it("uses unchanged native robin cells and hop/flap/song ranges", () => {
  const metadata = JSON.parse(
    readFileSync(`public/${ROBIN_IMAGE.replace("sheet.png", "sprite.json")}`, "utf8"),
  );
  expect(
    createHash("sha256")
      .update(readFileSync(`public/${ROBIN_IMAGE}`))
      .digest("hex"),
  ).toBe(metadata.sheetSha256);
  expect(metadata.anchor).toEqual([16, 25]);
  for (const clip of ROBIN_CLIPS) {
    expect(metadata.clips[clip.name].start).toBe(clip.start);
    expect(metadata.clips[clip.name].count).toBe(clip.count);
    expect(clip.frameDuration).toBe(metadata.clips[clip.name].frameDuration);
  }
});

it("seeds dry tree-edge robins with stable owner IDs independent of query order", () => {
  const coords = [
    { cx: -11, cy: -33 },
    { cx: -10, cy: -33 },
    { cx: -11, cy: -34 },
    { cx: -10, cy: -34 },
  ];
  const placements = (seed: number, reverse = false) => {
    const n = new NaturalLandscape(regionalWorld(seed), "thicket");
    return (reverse ? [...coords].reverse() : coords)
      .flatMap((c) => n.wildlife(c.cx, c.cy))
      .filter((a) => a.robin)
      .sort((a, b) => a.featureId.localeCompare(b.featureId));
  };
  const birds = placements(2026);
  expect(birds.length).toBeGreaterThan(1);
  expect(placements(2026, true)).toEqual(birds);
  expect(placements(7)).not.toEqual(birds);
  const n = new NaturalLandscape(regionalWorld(2026), "thicket");
  const generator = createGenerator(createDescriptor("regional", 2026));
  for (const p of birds) {
    expect(n.terrain(p.wx / 16, p.wy / 16)).toBe(TerrainId.Grass);
    expect(n.inThicket(p.wx / 16, p.wy / 16)).toBe(false);
    const cx = Math.floor(p.wx / 256),
      cy = Math.floor(p.wy / 256);
    expect(generator.actors?.(cx, cy)).toContainEqual(p);
    const props = [-1, 0, 1]
      .flatMap((dx) => [-1, 0, 1].flatMap((dy) => n.placements(cx + dx, cy + dy)))
      .map((a) => createProp(a.propType, a.wx, a.wy));
    const box = getEntityAABB({ wx: p.wx, wy: p.wy }, required(createRobin(p.wx, p.wy).collider));
    expect(props.some((prop) => aabbOverlapsPropWalls(box, prop.position, prop, 0, 5))).toBe(false);
    expect(
      robinTreePerches(props).some((perch) => Math.hypot(perch.wx - p.wx, perch.wy - p.wy) < 40),
    ).toBe(true);
  }
});

it("runs hops, flights, crown rests and songs in production Realm and saves durable individuals", async () => {
  const s = await ScenarioSession.create(naturalLandscapeRecipe("robins", "thicket"));
  try {
    const birds = () => s.realm.entityManager.entities.filter((e) => e.robin);
    expect(birds().length).toBeGreaterThan(1);
    const clips = new Set<number>();
    let perched = false;
    for (let i = 0; i < 700; i++) {
      await s.step(idle);
      for (const bird of birds()) {
        clips.add(bird.sprite?.clip ?? 0);
        perched ||= bird.robin?.state === "perch";
        expect(
          Math.hypot(
            bird.position.wx - required(bird.robin).home.wx,
            bird.position.wy - required(bird.robin).home.wy,
          ),
        ).toBeLessThanOrEqual(required(bird.robin).radius + 1);
        expect(
          s.realm.world.getCollisionIfLoaded(
            Math.floor(bird.position.wx / 16),
            Math.floor(bird.position.wy / 16),
          ) & CollisionFlag.Water,
        ).toBe(0);
      }
    }
    expect([...clips]).toEqual(expect.arrayContaining([0, 1, 2, 3]));
    expect(perched).toBe(true);
    const removed = required(birds()[0]),
      retained = required(birds()[1]);
    s.realm.entityManager.remove(removed.id);
    const manual = s.realm.entityManager.spawn(
      createRobin(s.player.player.position.wx + 40, s.player.player.position.wy),
    );
    const saved = encodeActor(retained),
      manualId = manual.persistentId;
    const individuals = birds().map((bird) => encodeActor(bird));
    await s.reload();
    expect(birds().some((b) => b.persistentId === removed.persistentId)).toBe(false);
    expect(required(birds().find((b) => b.persistentId === saved.persistentId)).robin).toEqual(
      saved.state.robin,
    );
    expect(birds().some((b) => b.persistentId === manualId)).toBe(true);
    for (const individual of individuals) {
      const restored = required(birds().find((b) => b.persistentId === individual.persistentId));
      expect(restored.robin).toEqual(individual.state.robin);
      expect(restored.position).toEqual({ wx: individual.wx, wy: individual.wy });
    }
    const owners = birds()
      .map((b) => b.naturalSpawnId ?? b.proceduralId)
      .filter((id): id is string => !!id);
    expect(owners.length).toBeGreaterThan(0);
    expect(new Set(owners).size).toBe(owners.length);
  } finally {
    await s.close();
  }
}, 60000);

it("replicates mid-hop phase through binary baselines/deltas and removes it on landing", () => {
  const robin = createRobin(64, 64);
  required(robin.robin).timer = 0;
  const before = serializeEntity(robin);
  updateRobinAI(robin, 0.1, open, [robin], []);
  setSpriteClipElapsed(robin, 437);
  const after = serializeEntity(robin);
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
  expect(baseline.sprite?.frameCol).toBe(4);
  const replica = deserializeEntity(before);
  applyEntityDelta(replica, required(wire.entityDeltas?.[0]));
  expect(replica.sprite?.clipElapsedMs).toBe(437);
  expect(replica.sprite?.frameCol).toBe(4);
  delete required(robin.sprite).clipElapsedMs;
  applyEntityDelta(replica, required(diffEntitySnapshots(after, serializeEntity(robin))));
  expect(replica.sprite?.clipElapsedMs).toBeUndefined();
});

it.each([true, false])(
  "Realm landing startles a robin with or without player input (input=%s)",
  async (input) => {
    const robin = createRobin(64, 64);
    robin.persistentId = "durable-robin";
    const player = createPlayer(64, 64);
    player.wz = 8;
    player.jumpZ = 8;
    player.jumpVZ = -40;
    const s = await ScenarioSession.create({
      version: 1,
      id: "robin-contact",
      generation: FLAT_SCENARIO,
      player,
      props: [],
      actors: [robin],
    });
    try {
      for (let i = 0; i < 6; i++) {
        if (input) await s.step(idle);
        else s.tick();
      }
      const animal = required(s.realm.entityManager.entities.find((e) => e.type === ROBIN_TYPE));
      expect(s.player.player.jumpVZ).toBeUndefined();
      expect(animal.wanderAI?.state).toBe("scared");
      for (let i = 0; i < 22; i++) await s.step(idle);
      expect(animal.robin?.state).toBe("flight");
      const saved = encodeActor(animal);
      await s.reload();
      const restored = required(s.realm.entityManager.entities.find((e) => e.type === ROBIN_TYPE));
      expect(restored.persistentId).toBe("durable-robin");
      expect(restored.robin).toEqual(saved.state.robin);
    } finally {
      await s.close();
    }
  },
);
