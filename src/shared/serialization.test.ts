import { describe, expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import type { Entity } from "../entities/Entity.js";
import { Direction } from "../entities/Entity.js";
import { ENTITY_DEFS } from "../entities/EntityDefs.js";
import type { Prop } from "../entities/Prop.js";
import { Chunk } from "../world/Chunk.js";
import {
  applyChunkSnapshot,
  deserializeEntity,
  deserializeProp,
  reuseEntitySnapshot,
  serializeChunk,
  serializeEntity,
  serializeProp,
} from "./serialization.js";

function makeFullEntity(): Entity {
  return {
    id: 42,
    type: "chicken",
    tags: new Set(["befriendable"]),
    position: { wx: 100.5, wy: 200.25 },
    sortOffsetY: -4,
    velocity: { vx: 1.5, vy: -2.5 },
    sprite: {
      sheetKey: "chicken",
      frameCol: 2,
      frameRow: 1,
      animTimer: 123.4,
      frameDuration: 150,
      frameCount: 4,
      direction: Direction.Right,
      moving: true,
      spriteWidth: 16,
      spriteHeight: 16,
    },
    collider: {
      offsetX: -4,
      offsetY: -2,
      width: 8,
      height: 6,
      solid: false,
    },
    wanderAI: {
      state: "walking",
      timer: 1.5,
      dirX: 1,
      dirY: 0,
      idleMin: 1,
      idleMax: 3,
      walkMin: 2,
      walkMax: 4,
      speed: 30,
      directional: true,
      chaseRange: 64,
      chaseSpeed: 50,
      hostile: true,
      following: false,
      followDistance: 24,
      followLeash: 128,
      befriendable: true,
    },
    flashHidden: true,
    noShadow: true,
    deathTimer: 2.5,
  };
}

function makeMinimalEntity(): Entity {
  return {
    id: 1,
    type: "bird",
    position: { wx: 0, wy: 0 },
    velocity: null,
    sprite: null,
    collider: null,
    wanderAI: null,
  };
}

function makeFullProp(): Prop {
  return {
    id: 10,
    type: "prop-climb-arch",
    position: { wx: 50, wy: 75 },
    sprite: {
      sheetKey: "prop-climb-arch",
      frameCol: 0,
      frameRow: 0,
      spriteWidth: 48,
      spriteHeight: 64,
    },
    collider: {
      offsetX: 0,
      offsetY: 0,
      width: 40,
      height: 24,
    },
    walls: null, // walls come from definition, not serialized
    isProp: true,
  };
}

describe("Entity serialization", () => {
  it("round-trips a full entity with all fields", () => {
    const entity = makeFullEntity();
    const snapshot = serializeEntity(entity);
    const result = deserializeEntity(snapshot);

    expect(result.id).toBe(entity.id);
    expect(result.type).toBe(entity.type);
    expect(result.position).toEqual(entity.position);
    expect(result.velocity).toEqual(entity.velocity);
    // Sprite: dynamic state from snapshot + static fields from def
    // animTimer and frameCol are NOT serialized — client computes locally
    expect(result.sprite?.frameCol).toBe(0);
    expect(result.sprite?.frameRow).toBe(entity.sprite?.frameRow);
    expect(result.sprite?.animTimer).toBe(0);
    expect(result.sprite?.direction).toBe(entity.sprite?.direction);
    expect(result.sprite?.moving).toBe(entity.sprite?.moving);
    // Static fields come from ENTITY_DEFS["chicken"]
    expect(result.sprite?.sheetKey).toBe("chicken");
    expect(result.sprite?.spriteWidth).toBe(16);
    expect(result.sprite?.spriteHeight).toBe(16);
    expect(result.sprite?.frameCount).toBe(4);
    // Collider comes entirely from def
    expect(result.collider).toEqual({
      offsetX: 0,
      offsetY: 0,
      width: 10,
      height: 6,
      physicalHeight: 8,
    });
    // WanderAI: dynamic state from snapshot + static from def
    // timer is NOT serialized — only needed server-side
    expect(result.wanderAI?.state).toBe("walking");
    expect(result.wanderAI?.timer).toBe(0);
    expect(result.wanderAI?.dirX).toBe(1);
    expect(result.wanderAI?.dirY).toBe(0);
    expect(result.wanderAI?.speed).toBe(20); // from def
    expect(result.wanderAI?.befriendable).toBe(true); // from def
    // Static entity-level fields from def
    expect(result.weight).toBe(2); // chicken weight from def
    expect(result.flashHidden).toBe(true);
    expect(result.noShadow).toBe(true);
    expect(result.deathTimer).toBe(2.5);
  });

  it("snapshot contains only dynamic fields (no static)", () => {
    const entity = makeFullEntity();
    const snapshot = serializeEntity(entity);

    // Snapshot should have spriteState, not sprite
    expect(snapshot.spriteState).toBeTruthy();
    const snap = snapshot as unknown as Record<string, unknown>;
    expect(snap.sprite).toBeUndefined();
    expect(snap.collider).toBeUndefined();
    expect(snap.sortOffsetY).toBeUndefined();
    expect(snap.weight).toBeUndefined();

    // spriteState should not contain static fields
    const ss = snapshot.spriteState as unknown as Record<string, unknown>;
    expect(ss.sheetKey).toBeUndefined();
    expect(ss.spriteWidth).toBeUndefined();

    // wanderAIState should not contain static fields
    expect(snapshot.wanderAIState).toBeTruthy();
    const ais = snapshot.wanderAIState as unknown as Record<string, unknown>;
    expect(ais.speed).toBeUndefined();
    expect(ais.idleMin).toBeUndefined();
  });

  it("round-trips a minimal entity with null fields", () => {
    const entity = makeMinimalEntity();
    const snapshot = serializeEntity(entity);
    const result = deserializeEntity(snapshot);

    expect(result.id).toBe(1);
    expect(result.type).toBe("bird");
    expect(result.velocity).toBeNull();
    expect(result.sprite).toBeNull();
    expect(result.collider).toBeNull();
    expect(result.wanderAI).toBeNull();
    expect(result.sortOffsetY).toBeUndefined();
    expect(result.flashHidden).toBeUndefined();
    expect(result.noShadow).toBeUndefined();
    expect(result.deathTimer).toBeUndefined();
  });

  it("survives JSON roundtrip", () => {
    const entity = makeFullEntity();
    const snapshot = serializeEntity(entity);
    const jsonRoundtrip = JSON.parse(JSON.stringify(snapshot));
    const result = deserializeEntity(jsonRoundtrip);

    expect(result.position).toEqual(entity.position);
    expect(result.wanderAI?.befriendable).toBe(true); // from def
    expect(result.collider?.offsetY).toBe(0); // from chicken def
  });

  it("produces no object identity sharing", () => {
    const entity = makeFullEntity();
    const snapshot = serializeEntity(entity);
    const result = deserializeEntity(snapshot);

    expect(result.position).not.toBe(entity.position);
    expect(result.velocity).not.toBe(entity.velocity);
    expect(result.sprite).not.toBe(entity.sprite);
  });

  it("omits frameDuration from spriteState when it matches def", () => {
    const entity = makeFullEntity();
    // Set frameDuration to match the chicken def (200)
    entity.sprite!.frameDuration = 200;
    const snapshot = serializeEntity(entity);
    expect(snapshot.spriteState?.frameDuration).toBeUndefined();
  });

  it("includes frameDuration in spriteState when it differs from def", () => {
    const entity = makeFullEntity();
    // Set frameDuration to differ from the chicken def (200)
    entity.sprite!.frameDuration = 100;
    const snapshot = serializeEntity(entity);
    expect(snapshot.spriteState?.frameDuration).toBe(100);
    const result = deserializeEntity(snapshot);
    expect(result.sprite?.frameDuration).toBe(100);
  });
});

describe("Prop serialization", () => {
  it("preserves explicit ground-layer ordering through a snapshot roundtrip", () => {
    const prop = makeFullProp();
    prop.sortOffsetY = -2048;
    const snapshot = serializeProp(prop);
    expect(snapshot.sortOffsetY).toBe(-2048);
    expect(deserializeProp(JSON.parse(JSON.stringify(snapshot))).sortOffsetY).toBe(-2048);
  });
  it("round-trips a prop and reconstructs walls from definition", () => {
    const prop = makeFullProp();
    const snapshot = serializeProp(prop);
    const result = deserializeProp(snapshot);

    expect(result.id).toBe(prop.id);
    expect(result.type).toBe(prop.type);
    expect(result.position).toEqual(prop.position);
    expect(result.sprite).toEqual(prop.sprite);
    expect(result.collider).toEqual(prop.collider);
    expect(result.isProp).toBe(true);
    // walls are reconstructed from the prop definition, not serialized
    expect(result.walls).toHaveLength(7); // climb-arch has 7 stair-step walls
    expect(result.walls?.[0]).toHaveProperty("walkableTop", true);
    expect(result.walls?.[0]).toHaveProperty("passable", true);
  });

  it("round-trips a prop without collider or walls", () => {
    const prop: Prop = {
      id: 2,
      type: "flower",
      position: { wx: 10, wy: 20 },
      sprite: {
        sheetKey: "flowers",
        frameCol: 3,
        frameRow: 0,
        spriteWidth: 16,
        spriteHeight: 16,
      },
      collider: null,
      walls: null,
      isProp: true,
    };
    const snapshot = serializeProp(prop);
    const result = deserializeProp(snapshot);

    expect(result.collider).toBeNull();
    expect(result.walls).toBeNull();
    expect(result.isProp).toBe(true);
  });

  it("survives JSON roundtrip and reconstructs walls", () => {
    const prop = makeFullProp();
    const snapshot = serializeProp(prop);
    const jsonRoundtrip = JSON.parse(JSON.stringify(snapshot));
    const result = deserializeProp(jsonRoundtrip);

    // walls are not in the snapshot — they come from the definition
    expect(result.walls).toHaveLength(7);
  });
});

describe("Chunk serialization", () => {
  it("round-trips chunk data through number arrays", () => {
    const chunk = new Chunk();
    chunk.subgrid[0] = 5;
    chunk.subgrid[100] = 12;
    chunk.roadGrid[10] = 3;
    chunk.heightGrid[5] = 2;
    chunk.terrain[0] = 100;
    chunk.detail[7] = 42;
    chunk.blendBase[3] = 7;
    chunk.blendLayers[0] = 0x00010203;
    chunk.collision[15] = 1;
    chunk.revision = 7;

    const snapshot = serializeChunk(2, -3, chunk);

    expect(snapshot.cx).toBe(2);
    expect(snapshot.cy).toBe(-3);
    expect(snapshot.revision).toBe(7);
    expect(Array.isArray(snapshot.subgrid)).toBe(true);
    expect(snapshot.subgrid[0]).toBe(5);
    expect(snapshot.subgrid[100]).toBe(12);

    const target = new Chunk();
    applyChunkSnapshot(target, snapshot);

    expect(target.subgrid[0]).toBe(5);
    expect(target.subgrid[100]).toBe(12);
    expect(target.roadGrid[10]).toBe(3);
    expect(target.heightGrid[5]).toBe(2);
    expect(target.terrain[0]).toBe(100);
    expect(target.detail[7]).toBe(42);
    expect(target.blendBase[3]).toBe(7);
    expect(target.blendLayers[0]).toBe(0x00010203);
    expect(target.collision[15]).toBe(1);
    expect(target.revision).toBe(7);
    expect(target.visualRevision).toBeGreaterThan(0);
    expect(target.autotileComputed).toBe(true);
  });

  it("snapshot survives JSON roundtrip", () => {
    const chunk = new Chunk();
    chunk.subgrid[50] = 8;
    chunk.roadGrid[0] = 1;

    const snapshot = serializeChunk(0, 0, chunk);
    const jsonRoundtrip = JSON.parse(JSON.stringify(snapshot));

    const target = new Chunk();
    applyChunkSnapshot(target, jsonRoundtrip);

    expect(target.subgrid[50]).toBe(8);
    expect(target.roadGrid[0]).toBe(1);
  });
});

describe("immutable snapshot reuse", () => {
  it("reuses identical wire state despite server-only clocks and component replacement", () => {
    const e = makeFullEntity();
    const previous = serializeEntity(e);
    e.position = { ...e.position };
    e.velocity = { ...required(e.velocity) };
    required(e.sprite).frameCol++;
    required(e.sprite).animTimer++;
    required(e.wanderAI).timer++;
    expect(reuseEntitySnapshot(e, previous)).toBe(previous);
    expect(reuseEntitySnapshot(e, previous)).toEqual(serializeEntity(e));
  });

  const changes: [string, (e: Entity) => void][] = [
    [
      "id",
      (e) => {
        e.id++;
      },
    ],
    [
      "type",
      (e) => {
        e.type = "player";
      },
    ],
    [
      "x",
      (e) => {
        e.position.wx++;
      },
    ],
    [
      "y",
      (e) => {
        e.position.wy++;
      },
    ],
    [
      "vx",
      (e) => {
        required(e.velocity).vx++;
      },
    ],
    [
      "vy",
      (e) => {
        required(e.velocity).vy++;
      },
    ],
    [
      "velocity removal",
      (e) => {
        e.velocity = null;
      },
    ],
    [
      "sprite removal",
      (e) => {
        e.sprite = null;
      },
    ],
    [
      "direction",
      (e) => {
        required(e.sprite).direction = Direction.Left;
      },
    ],
    [
      "moving",
      (e) => {
        required(e.sprite).moving = false;
      },
    ],
    [
      "row",
      (e) => {
        required(e.sprite).frameRow++;
      },
    ],
    [
      "clip",
      (e) => {
        required(e.sprite).clip = 3;
      },
    ],
    [
      "clip clock",
      (e) => {
        required(e.sprite).clipElapsedMs = 123;
      },
    ],
    [
      "flip",
      (e) => {
        required(e.sprite).flipX = false;
      },
    ],
    [
      "duration",
      (e) => {
        required(e.sprite).frameDuration = 23;
      },
    ],
    [
      "AI removal",
      (e) => {
        e.wanderAI = null;
      },
    ],
    [
      "AI state",
      (e) => {
        required(e.wanderAI).state = "idle";
      },
    ],
    [
      "AI x",
      (e) => {
        required(e.wanderAI).dirX++;
      },
    ],
    [
      "AI y",
      (e) => {
        required(e.wanderAI).dirY++;
      },
    ],
    [
      "following",
      (e) => {
        required(e.wanderAI).following = true;
      },
    ],
    [
      "tag",
      (e) => {
        required(e.tags).delete("befriendable");
      },
    ],
    ...(
      [
        "flashHidden",
        "noShadow",
        "deathTimer",
        "jumpZ",
        "jumpVZ",
        "wz",
        "airMomentumX",
        "airMomentumY",
        "jumpInputState",
        "parentId",
        "localOffsetX",
        "localOffsetY",
      ] as const
    ).map(
      (key) =>
        [
          key,
          (e: Entity) => {
            Reflect.set(e, key, key === "flashHidden" || key === "noShadow" ? false : 13);
          },
        ] as [string, (e: Entity) => void],
    ),
  ];
  it.each(changes)("refreshes %s and removal without mutating previous state", (_name, change) => {
    const e = makeFullEntity();
    const previous = serializeEntity(e),
      saved = structuredClone(previous);
    change(e);
    const next = reuseEntitySnapshot(e, previous);
    expect(next).not.toBe(previous);
    expect(next).toEqual(serializeEntity(e));
    expect(previous).toEqual(saved);
    // Returning to the old values is also checked against the serializer.
    const restored = makeFullEntity();
    expect(reuseEntitySnapshot(restored, next)).toEqual(serializeEntity(restored));
  });
  it("refreshes optional sprite values, player model and definition-relative duration", () => {
    const e = makeFullEntity();
    e.type = "player";
    e.playerModel = "other";
    required(e.sprite).clip = 1;
    required(e.sprite).clipElapsedMs = 0;
    required(e.sprite).flipX = false;
    let previous = serializeEntity(e);
    for (const key of ["clip", "clipElapsedMs", "flipX"] as const) {
      delete required(e.sprite)[key];
      const next = reuseEntitySnapshot(e, previous);
      expect(next).not.toBe(previous);
      expect(next).toEqual(serializeEntity(e));
      previous = next;
    }
    delete e.playerModel;
    expect(reuseEntitySnapshot(e, previous)).toEqual(serializeEntity(e));
    e.type = "chicken";
    const def = required(required(ENTITY_DEFS.chicken).sprite),
      duration = def.frameDuration;
    previous = serializeEntity(e);
    try {
      def.frameDuration = required(e.sprite).frameDuration;
      const next = reuseEntitySnapshot(e, previous);
      expect(next).not.toBe(previous);
      expect(next).toEqual(serializeEntity(e));
      expect(next.spriteState?.frameDuration).toBeUndefined();
    } finally {
      def.frameDuration = duration;
    }
  });
});
