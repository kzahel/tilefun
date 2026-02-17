import { describe, expect, it } from "vitest";
import { Direction } from "../entities/Entity.js";
import { ENTITY_DEFS } from "../entities/EntityDefs.js";
import {
  decodeClientMessage,
  decodeServerMessage,
  encodeClientMessage,
  encodeServerMessage,
} from "./binaryCodec.js";
import type { EntityDelta } from "./entityDelta.js";
import { ENTITY_TYPE_LIST, ENTITY_TYPE_TO_INDEX } from "./entityTypeIndex.js";
import type {
  ChunkSnapshot,
  ClientMessage,
  EntitySnapshot,
  FrameMessage,
  ServerMessage,
  SyncChunksMessage,
} from "./protocol.js";

// ---- Helpers ----

function roundtripServer(msg: ServerMessage): ServerMessage {
  return decodeServerMessage(encodeServerMessage(msg));
}

function roundtripClient(msg: ClientMessage): ClientMessage {
  return decodeClientMessage(encodeClientMessage(msg));
}

// ---- Entity type index ----

describe("entityTypeIndex", () => {
  it("has an entry for every ENTITY_DEFS key", () => {
    const defKeys = Object.keys(ENTITY_DEFS).sort();
    expect(ENTITY_TYPE_LIST).toEqual(defKeys);
    for (const key of defKeys) {
      expect(ENTITY_TYPE_TO_INDEX.has(key)).toBe(true);
    }
  });

  it("indices are sequential starting from 0", () => {
    for (let i = 0; i < ENTITY_TYPE_LIST.length; i++) {
      expect(ENTITY_TYPE_TO_INDEX.get(ENTITY_TYPE_LIST[i]!)).toBe(i);
    }
  });

  it("list is sorted alphabetically", () => {
    const sorted = [...ENTITY_TYPE_LIST].sort();
    expect(ENTITY_TYPE_LIST).toEqual(sorted);
  });
});

// ---- FrameMessage ----

describe("FrameMessage binary codec", () => {
  it("encodes empty frame (no entities)", () => {
    const msg: FrameMessage = {
      type: "frame",
      serverTick: 12345,
      lastProcessedInputSeq: 678,
      playerEntityId: 1,
    };
    const buf = encodeServerMessage(msg);
    expect(buf.byteLength).toBe(19); // header only
    const decoded = decodeServerMessage(buf) as FrameMessage;
    expect(decoded).toEqual(msg);
  });

  it("encodes frame with exits only", () => {
    const msg: FrameMessage = {
      type: "frame",
      serverTick: 100,
      lastProcessedInputSeq: 50,
      playerEntityId: 1,
      entityExits: [42, 99, 1000],
    };
    const decoded = roundtripServer(msg) as FrameMessage;
    expect(decoded).toEqual(msg);
    expect(encodeServerMessage(msg).byteLength).toBe(19 + 3 * 4); // header + 3 u32s
  });

  it("roundtrips frame with baselines, deltas, and exits", () => {
    const baseline: EntitySnapshot = {
      id: 1,
      type: "chicken",
      position: { wx: 100.5, wy: 200.25 },
      velocity: { vx: 1.5, vy: -2.5 },
      spriteState: {
        direction: Direction.Left,
        moving: true,
        frameRow: 2,
      },
      wanderAIState: {
        state: "walking",
        dirX: 1,
        dirY: 0,
      },
    };

    const delta: EntityDelta = {
      id: 1,
      position: { wx: 101, wy: 200.25 },
    };

    const msg: FrameMessage = {
      type: "frame",
      serverTick: 999,
      lastProcessedInputSeq: 500,
      playerEntityId: 1,
      entityBaselines: [baseline],
      entityDeltas: [delta],
      entityExits: [5],
    };

    const decoded = roundtripServer(msg) as FrameMessage;
    expect(decoded.type).toBe("frame");
    expect(decoded.serverTick).toBe(999);
    expect(decoded.lastProcessedInputSeq).toBe(500);
    expect(decoded.playerEntityId).toBe(1);
    expect(decoded.entityBaselines).toHaveLength(1);
    expect(decoded.entityDeltas).toHaveLength(1);
    expect(decoded.entityExits).toEqual([5]);
  });
});

// ---- EntitySnapshot baselines ----

describe("EntitySnapshot binary codec", () => {
  it("roundtrips minimal baseline (no optional fields)", () => {
    const snap: EntitySnapshot = {
      id: 42,
      type: "gem",
      position: { wx: 0, wy: 0 },
      velocity: null,
      spriteState: null,
      wanderAIState: null,
    };
    const msg: FrameMessage = {
      type: "frame",
      serverTick: 1,
      lastProcessedInputSeq: 0,
      playerEntityId: 42,
      entityBaselines: [snap],
    };
    const decoded = roundtripServer(msg) as FrameMessage;
    expect(decoded.entityBaselines![0]!).toEqual(snap);
  });

  it("roundtrips baseline with all optional fields", () => {
    const snap: EntitySnapshot = {
      id: 100,
      type: "player",
      position: { wx: -50.5, wy: 300.75 },
      velocity: { vx: 10, vy: -5 },
      spriteState: {
        direction: Direction.Right,
        moving: true,
        frameRow: 3,
        flipX: true,
        frameDuration: 100,
      },
      wanderAIState: {
        state: "following",
        dirX: -1,
        dirY: 1,
        following: true,
      },
      flashHidden: true,
      noShadow: true,
      deathTimer: 2.5,
      jumpZ: 10,
      jumpVZ: -5,
      wz: 16,
      parentId: 7,
      localOffsetX: 3.5,
      localOffsetY: -1.5,
    };
    const msg: FrameMessage = {
      type: "frame",
      serverTick: 1,
      lastProcessedInputSeq: 0,
      playerEntityId: 100,
      entityBaselines: [snap],
    };
    const decoded = roundtripServer(msg) as FrameMessage;
    const result = decoded.entityBaselines![0]!;

    expect(result.id).toBe(100);
    expect(result.type).toBe("player");
    // f32 precision: compare within tolerance
    expect(result.position.wx).toBeCloseTo(-50.5, 2);
    expect(result.position.wy).toBeCloseTo(300.75, 2);
    expect(result.velocity!.vx).toBeCloseTo(10, 2);
    expect(result.velocity!.vy).toBeCloseTo(-5, 2);
    expect(result.spriteState).toEqual(snap.spriteState);
    expect(result.wanderAIState).toEqual(snap.wanderAIState);
    expect(result.flashHidden).toBe(true);
    expect(result.noShadow).toBe(true);
    expect(result.deathTimer).toBeCloseTo(2.5, 2);
    expect(result.jumpZ).toBeCloseTo(10, 2);
    expect(result.jumpVZ).toBeCloseTo(-5, 2);
    expect(result.wz).toBeCloseTo(16, 2);
    expect(result.parentId).toBe(7);
    expect(result.localOffsetX).toBeCloseTo(3.5, 2);
    expect(result.localOffsetY).toBeCloseTo(-1.5, 2);
  });

  it("roundtrips every entity type", () => {
    for (const entityType of ENTITY_TYPE_LIST) {
      const snap: EntitySnapshot = {
        id: 1,
        type: entityType,
        position: { wx: 0, wy: 0 },
        velocity: null,
        spriteState: null,
        wanderAIState: null,
      };
      const msg: FrameMessage = {
        type: "frame",
        serverTick: 1,
        lastProcessedInputSeq: 0,
        playerEntityId: 1,
        entityBaselines: [snap],
      };
      const decoded = roundtripServer(msg) as FrameMessage;
      expect(decoded.entityBaselines![0]!.type).toBe(entityType);
    }
  });

  it("roundtrips SpriteState without optional fields", () => {
    const snap: EntitySnapshot = {
      id: 1,
      type: "chicken",
      position: { wx: 0, wy: 0 },
      velocity: null,
      spriteState: {
        direction: Direction.Down,
        moving: false,
        frameRow: 0,
      },
      wanderAIState: null,
    };
    const msg: FrameMessage = {
      type: "frame",
      serverTick: 1,
      lastProcessedInputSeq: 0,
      playerEntityId: 1,
      entityBaselines: [snap],
    };
    const decoded = roundtripServer(msg) as FrameMessage;
    const ss = decoded.entityBaselines![0]!.spriteState!;
    expect(ss.direction).toBe(Direction.Down);
    expect(ss.moving).toBe(false);
    expect(ss.frameRow).toBe(0);
    expect(ss.flipX).toBeUndefined();
    expect(ss.frameDuration).toBeUndefined();
  });

  it("preserves all four Direction values", () => {
    for (const dir of [Direction.Down, Direction.Up, Direction.Left, Direction.Right]) {
      const snap: EntitySnapshot = {
        id: 1,
        type: "chicken",
        position: { wx: 0, wy: 0 },
        velocity: null,
        spriteState: { direction: dir, moving: false, frameRow: 0 },
        wanderAIState: null,
      };
      const msg: FrameMessage = {
        type: "frame",
        serverTick: 1,
        lastProcessedInputSeq: 0,
        playerEntityId: 1,
        entityBaselines: [snap],
      };
      const decoded = roundtripServer(msg) as FrameMessage;
      expect(decoded.entityBaselines![0]!.spriteState!.direction).toBe(dir);
    }
  });

  it("preserves all WanderAI state values", () => {
    for (const state of ["idle", "walking", "chasing", "following", "ridden"]) {
      const snap: EntitySnapshot = {
        id: 1,
        type: "chicken",
        position: { wx: 0, wy: 0 },
        velocity: null,
        spriteState: null,
        wanderAIState: { state, dirX: 0, dirY: 0 },
      };
      const msg: FrameMessage = {
        type: "frame",
        serverTick: 1,
        lastProcessedInputSeq: 0,
        playerEntityId: 1,
        entityBaselines: [snap],
      };
      const decoded = roundtripServer(msg) as FrameMessage;
      expect(decoded.entityBaselines![0]!.wanderAIState!.state).toBe(state);
    }
  });

  it("encodes multiple baselines", () => {
    const baselines: EntitySnapshot[] = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      type: "chicken",
      position: { wx: i * 16, wy: i * 16 },
      velocity: { vx: 0, vy: 0 },
      spriteState: { direction: Direction.Down as Direction, moving: false, frameRow: 0 },
      wanderAIState: { state: "idle", dirX: 0, dirY: 0 },
    }));
    const msg: FrameMessage = {
      type: "frame",
      serverTick: 1,
      lastProcessedInputSeq: 0,
      playerEntityId: 1,
      entityBaselines: baselines,
    };
    const decoded = roundtripServer(msg) as FrameMessage;
    expect(decoded.entityBaselines).toHaveLength(10);
    for (let i = 0; i < 10; i++) {
      expect(decoded.entityBaselines![i]!.id).toBe(i + 1);
    }
  });
});

// ---- EntityDelta ----

describe("EntityDelta binary codec", () => {
  it("roundtrips position-only delta", () => {
    const delta: EntityDelta = {
      id: 42,
      position: { wx: 100.5, wy: 200.25 },
    };
    const msg: FrameMessage = {
      type: "frame",
      serverTick: 1,
      lastProcessedInputSeq: 0,
      playerEntityId: 1,
      entityDeltas: [delta],
    };
    const decoded = roundtripServer(msg) as FrameMessage;
    const result = decoded.entityDeltas![0]!;
    expect(result.id).toBe(42);
    expect(result.position!.wx).toBeCloseTo(100.5, 2);
    expect(result.position!.wy).toBeCloseTo(200.25, 2);
    // All other fields should be absent
    expect(result.velocity).toBeUndefined();
    expect(result.spriteState).toBeUndefined();
    expect(result.wanderAIState).toBeUndefined();
  });

  it("position-only delta is 16 bytes", () => {
    const delta: EntityDelta = {
      id: 42,
      position: { wx: 100, wy: 200 },
    };
    const msg: FrameMessage = {
      type: "frame",
      serverTick: 1,
      lastProcessedInputSeq: 0,
      playerEntityId: 1,
      entityDeltas: [delta],
    };
    const buf = encodeServerMessage(msg);
    // 19 header + (4 id + 2 changeMask + 2 nullMask + 8 position) = 19 + 16 = 35
    expect(buf.byteLength).toBe(35);
  });

  it("roundtrips velocity set to null", () => {
    const delta: EntityDelta = {
      id: 1,
      velocity: null,
    };
    const msg: FrameMessage = {
      type: "frame",
      serverTick: 1,
      lastProcessedInputSeq: 0,
      playerEntityId: 1,
      entityDeltas: [delta],
    };
    const decoded = roundtripServer(msg) as FrameMessage;
    expect(decoded.entityDeltas![0]!.velocity).toBeNull();
  });

  it("roundtrips velocity with value", () => {
    const delta: EntityDelta = {
      id: 1,
      velocity: { vx: 3.5, vy: -1.5 },
    };
    const msg: FrameMessage = {
      type: "frame",
      serverTick: 1,
      lastProcessedInputSeq: 0,
      playerEntityId: 1,
      entityDeltas: [delta],
    };
    const decoded = roundtripServer(msg) as FrameMessage;
    expect(decoded.entityDeltas![0]!.velocity!.vx).toBeCloseTo(3.5, 2);
    expect(decoded.entityDeltas![0]!.velocity!.vy).toBeCloseTo(-1.5, 2);
  });

  it("roundtrips spriteState set to null", () => {
    const delta: EntityDelta = {
      id: 1,
      spriteState: null,
    };
    const msg: FrameMessage = {
      type: "frame",
      serverTick: 1,
      lastProcessedInputSeq: 0,
      playerEntityId: 1,
      entityDeltas: [delta],
    };
    const decoded = roundtripServer(msg) as FrameMessage;
    expect(decoded.entityDeltas![0]!.spriteState).toBeNull();
  });

  it("roundtrips wanderAIState set to null", () => {
    const delta: EntityDelta = {
      id: 1,
      wanderAIState: null,
    };
    const msg: FrameMessage = {
      type: "frame",
      serverTick: 1,
      lastProcessedInputSeq: 0,
      playerEntityId: 1,
      entityDeltas: [delta],
    };
    const decoded = roundtripServer(msg) as FrameMessage;
    expect(decoded.entityDeltas![0]!.wanderAIState).toBeNull();
  });

  it("roundtrips optional field removal (null sentinels)", () => {
    const delta: EntityDelta = {
      id: 1,
      flashHidden: null,
      noShadow: null,
      deathTimer: null,
      jumpZ: null,
      jumpVZ: null,
      wz: null,
      parentId: null,
      localOffsetX: null,
      localOffsetY: null,
    };
    const msg: FrameMessage = {
      type: "frame",
      serverTick: 1,
      lastProcessedInputSeq: 0,
      playerEntityId: 1,
      entityDeltas: [delta],
    };
    const decoded = roundtripServer(msg) as FrameMessage;
    const result = decoded.entityDeltas![0]!;
    expect(result.flashHidden).toBeNull();
    expect(result.noShadow).toBeNull();
    expect(result.deathTimer).toBeNull();
    expect(result.jumpZ).toBeNull();
    expect(result.jumpVZ).toBeNull();
    expect(result.wz).toBeNull();
    expect(result.parentId).toBeNull();
    expect(result.localOffsetX).toBeNull();
    expect(result.localOffsetY).toBeNull();
  });

  it("roundtrips optional fields with values", () => {
    const delta: EntityDelta = {
      id: 1,
      flashHidden: true,
      noShadow: false,
      deathTimer: 1.5,
      jumpZ: 10,
      jumpVZ: -5,
      wz: 16,
      parentId: 7,
      localOffsetX: 3.5,
      localOffsetY: -1.5,
    };
    const msg: FrameMessage = {
      type: "frame",
      serverTick: 1,
      lastProcessedInputSeq: 0,
      playerEntityId: 1,
      entityDeltas: [delta],
    };
    const decoded = roundtripServer(msg) as FrameMessage;
    const result = decoded.entityDeltas![0]!;
    expect(result.flashHidden).toBe(true);
    expect(result.noShadow).toBe(false);
    expect(result.deathTimer).toBeCloseTo(1.5, 2);
    expect(result.jumpZ).toBeCloseTo(10, 2);
    expect(result.jumpVZ).toBeCloseTo(-5, 2);
    expect(result.wz).toBeCloseTo(16, 2);
    expect(result.parentId).toBe(7);
    expect(result.localOffsetX).toBeCloseTo(3.5, 2);
    expect(result.localOffsetY).toBeCloseTo(-1.5, 2);
  });

  it("roundtrips delta with all field groups changed", () => {
    const delta: EntityDelta = {
      id: 42,
      position: { wx: 100, wy: 200 },
      velocity: { vx: 1, vy: -1 },
      spriteState: {
        direction: Direction.Up,
        moving: true,
        frameRow: 1,
        flipX: true,
        frameDuration: 200,
      },
      wanderAIState: {
        state: "chasing",
        dirX: 1,
        dirY: -1,
        following: true,
      },
      flashHidden: true,
      deathTimer: 3.0,
      jumpZ: 5,
    };
    const msg: FrameMessage = {
      type: "frame",
      serverTick: 1,
      lastProcessedInputSeq: 0,
      playerEntityId: 1,
      entityDeltas: [delta],
    };
    const decoded = roundtripServer(msg) as FrameMessage;
    const result = decoded.entityDeltas![0]!;
    expect(result.position!.wx).toBeCloseTo(100, 2);
    expect(result.velocity!.vx).toBeCloseTo(1, 2);
    expect(result.spriteState!.direction).toBe(Direction.Up);
    expect(result.spriteState!.moving).toBe(true);
    expect(result.spriteState!.flipX).toBe(true);
    expect(result.spriteState!.frameDuration).toBe(200);
    expect(result.wanderAIState!.state).toBe("chasing");
    expect(result.wanderAIState!.dirX).toBe(1);
    expect(result.wanderAIState!.dirY).toBe(-1);
    expect(result.wanderAIState!.following).toBe(true);
    expect(result.flashHidden).toBe(true);
    expect(result.deathTimer).toBeCloseTo(3.0, 2);
    expect(result.jumpZ).toBeCloseTo(5, 2);
  });
});

// ---- player-input ----

describe("player-input binary codec", () => {
  it("encodes to exactly 10 bytes", () => {
    const msg: ClientMessage = {
      type: "player-input",
      seq: 12345,
      dx: 1,
      dy: -1,
      sprinting: true,
      jump: false,
    };
    const buf = encodeClientMessage(msg);
    expect(buf.byteLength).toBe(10);
  });

  it("roundtrips cardinal values exactly", () => {
    const msg: ClientMessage = {
      type: "player-input",
      seq: 99999,
      dx: -1,
      dy: 0,
      sprinting: false,
      jump: true,
    };
    const decoded = roundtripClient(msg) as Extract<ClientMessage, { type: "player-input" }>;
    expect(decoded.seq).toBe(99999);
    expect(decoded.dx).toBeCloseTo(-1, 2);
    expect(decoded.dy).toBe(0);
    expect(decoded.sprinting).toBe(false);
    expect(decoded.jump).toBe(true);
  });

  it("roundtrips diagonal fractional input within 1%", () => {
    const SQRT2_INV = 1 / Math.sqrt(2);
    const msg: ClientMessage = {
      type: "player-input",
      seq: 42,
      dx: SQRT2_INV,
      dy: -SQRT2_INV,
      sprinting: false,
      jump: false,
    };
    const decoded = roundtripClient(msg) as Extract<ClientMessage, { type: "player-input" }>;
    expect(decoded.dx).toBeCloseTo(SQRT2_INV, 2);
    expect(decoded.dy).toBeCloseTo(-SQRT2_INV, 2);
  });

  it("roundtrips analog gamepad values within 1%", () => {
    const msg: ClientMessage = {
      type: "player-input",
      seq: 1,
      dx: 0.5,
      dy: -0.25,
      sprinting: false,
      jump: false,
    };
    const decoded = roundtripClient(msg) as Extract<ClientMessage, { type: "player-input" }>;
    expect(decoded.dx).toBeCloseTo(0.5, 2);
    expect(decoded.dy).toBeCloseTo(-0.25, 2);
  });

  it("roundtrips zero movement", () => {
    const msg: ClientMessage = {
      type: "player-input",
      seq: 0,
      dx: 0,
      dy: 0,
      sprinting: false,
      jump: false,
    };
    const decoded = roundtripClient(msg);
    expect(decoded).toEqual(msg);
  });

  it("roundtrips max seq value", () => {
    const msg: ClientMessage = {
      type: "player-input",
      seq: 0xffffffff,
      dx: 1,
      dy: 1,
      sprinting: true,
      jump: true,
    };
    const decoded = roundtripClient(msg);
    expect(decoded).toEqual(msg);
  });

  it("roundtrips jumpPressed flag", () => {
    const msg: ClientMessage = {
      type: "player-input",
      seq: 123,
      dx: 0,
      dy: 0,
      sprinting: false,
      jump: false,
      jumpPressed: true,
    };
    const decoded = roundtripClient(msg) as Extract<ClientMessage, { type: "player-input" }>;
    expect(decoded.jump).toBe(false);
    expect(decoded.jumpPressed).toBe(true);
  });

  it("roundtrips command dtMs", () => {
    const msg: ClientMessage = {
      type: "player-input",
      seq: 77,
      dx: 0.25,
      dy: -0.25,
      sprinting: false,
      jump: false,
      dtMs: 17,
    };
    const decoded = roundtripClient(msg) as Extract<ClientMessage, { type: "player-input" }>;
    expect(decoded.dtMs).toBe(17);
    expect(decoded.dx).toBeCloseTo(0.25, 2);
    expect(decoded.dy).toBeCloseTo(-0.25, 2);
  });
});

// ---- SyncChunksMessage ----

describe("SyncChunksMessage binary codec", () => {
  it("roundtrips with loadedChunkKeys only", () => {
    const msg: SyncChunksMessage = {
      type: "sync-chunks",
      loadedChunkKeys: ["0,0", "1,-1", "-5,3"],
    };
    const decoded = roundtripServer(msg) as SyncChunksMessage;
    expect(decoded.type).toBe("sync-chunks");
    expect(decoded.loadedChunkKeys).toEqual(["0,0", "1,-1", "-5,3"]);
    expect(decoded.chunkUpdates).toBeUndefined();
  });

  it("roundtrips chunk update data", () => {
    const chunk: ChunkSnapshot = {
      cx: 3,
      cy: -2,
      revision: 42,
      subgrid: new Array(1089).fill(0).map((_, i) => i % 256),
      roadGrid: new Array(256).fill(0),
      heightGrid: new Array(256).fill(1),
      terrain: new Array(256).fill(100),
      detail: new Array(256).fill(0),
      blendBase: new Array(256).fill(5),
      blendLayers: new Array(1536).fill(0),
      collision: new Array(256).fill(0),
    };
    const msg: SyncChunksMessage = {
      type: "sync-chunks",
      chunkUpdates: [chunk],
    };
    const decoded = roundtripServer(msg) as SyncChunksMessage;
    expect(decoded.chunkUpdates).toHaveLength(1);
    const result = decoded.chunkUpdates![0]!;
    expect(result.cx).toBe(3);
    expect(result.cy).toBe(-2);
    expect(result.revision).toBe(42);
    expect(result.subgrid).toEqual(chunk.subgrid);
    expect(result.roadGrid).toEqual(chunk.roadGrid);
    expect(result.heightGrid).toEqual(chunk.heightGrid);
    expect(result.terrain).toEqual(chunk.terrain);
    expect(result.detail).toEqual(chunk.detail);
    expect(result.blendBase).toEqual(chunk.blendBase);
    expect(result.blendLayers).toEqual(chunk.blendLayers);
    expect(result.collision).toEqual(chunk.collision);
  });

  it("chunk binary is smaller than JSON with realistic data", () => {
    // Use realistic values: terrain IDs are multi-digit, blend layers are packed u32s
    const chunk: ChunkSnapshot = {
      cx: 0,
      cy: 0,
      revision: 1,
      subgrid: new Array(1089).fill(0).map((_, i) => (i * 7) % 256),
      roadGrid: new Array(256).fill(0).map((_, i) => i % 5),
      heightGrid: new Array(256).fill(0).map((_, i) => i % 16),
      terrain: new Array(256).fill(0).map((_, i) => 1000 + i),
      detail: new Array(256).fill(0).map((_, i) => i * 10),
      blendBase: new Array(256).fill(0).map((_, i) => i % 26),
      blendLayers: new Array(1536).fill(0).map((_, i) => (i * 65537) % 0xffffffff),
      collision: new Array(256).fill(0).map((_, i) => i % 16),
    };
    const msg: SyncChunksMessage = {
      type: "sync-chunks",
      chunkUpdates: [chunk],
    };
    const binarySize = encodeServerMessage(msg).byteLength;
    const jsonSize = JSON.stringify(msg).length;
    // Binary is fixed ~9.3 KB; JSON with multi-digit values is ~20+ KB
    expect(binarySize).toBeLessThan(jsonSize * 0.7);
  });
});

// ---- JSON fallback ----

describe("JSON fallback", () => {
  it("roundtrips non-binary server messages via JSON fallback", () => {
    const msg: ServerMessage = {
      type: "player-assigned",
      entityId: 42,
    };
    const decoded = roundtripServer(msg);
    expect(decoded).toEqual(msg);
  });

  it("roundtrips non-binary client messages via JSON fallback", () => {
    const msg: ClientMessage = {
      type: "visible-range",
      minCx: -5,
      minCy: -3,
      maxCx: 5,
      maxCy: 3,
    };
    const decoded = roundtripClient(msg);
    expect(decoded).toEqual(msg);
  });

  it("roundtrips sync-session via JSON fallback", () => {
    const msg: ServerMessage = {
      type: "sync-session",
      gemsCollected: 15,
      editorEnabled: true,
      mountEntityId: null,
    };
    const decoded = roundtripServer(msg);
    expect(decoded).toEqual(msg);
  });

  it("roundtrips sync-invincibility via JSON fallback", () => {
    const msg: ServerMessage = {
      type: "sync-invincibility",
      startTick: 1200,
      durationTicks: 45,
    };
    const decoded = roundtripServer(msg);
    expect(decoded).toEqual(msg);
  });
});
