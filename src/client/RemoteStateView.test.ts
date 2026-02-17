import { describe, expect, it, vi } from "vitest";
import {
  PLAYER_ACCELERATE,
  PLAYER_AIR_ACCELERATE,
  PLAYER_AIR_WISHCAP,
  PLAYER_FRICTION,
  PLAYER_STOP_SPEED,
} from "../config/constants.js";
import { Direction } from "../entities/Entity.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import {
  getAccelerate,
  getAirAccelerate,
  getAirWishCap,
  getFriction,
  getGravityScale,
  getNoBunnyHop,
  getPlatformerAir,
  getSmallJumps,
  getStopSpeed,
  getTimeScale,
  setAccelerate,
  setAirAccelerate,
  setAirWishCap,
  setFriction,
  setGravityScale,
  setNoBunnyHop,
  setPlatformerAir,
  setSmallJumps,
  setStopSpeed,
  setTimeScale,
} from "../physics/PlayerMovement.js";
import type { FrameMessage } from "../shared/protocol.js";
import { serializeChunk, serializeEntity, serializeProp } from "../shared/serialization.js";
import { Chunk } from "../world/Chunk.js";
import { World } from "../world/World.js";
import { RemoteStateView } from "./ClientStateView.js";

function makeTestEntity(id: number, wx: number, wy: number) {
  return serializeEntity({
    id,
    type: "chicken",
    position: { wx, wy },
    velocity: { vx: 0, vy: 0 },
    sprite: null,
    collider: null,
    wanderAI: null,
  });
}

/** Entity with a sprite so tickAnimations has something to animate. */
function makeAnimatedEntity(id: number, wx: number, wy: number, moving: boolean) {
  return serializeEntity({
    id,
    type: "chicken",
    position: { wx, wy },
    velocity: { vx: 0, vy: 0 },
    sprite: {
      sheetKey: "chicken",
      spriteWidth: 16,
      spriteHeight: 16,
      frameCount: 4,
      frameDuration: 200,
      frameCol: 0,
      frameRow: 0,
      animTimer: 0,
      direction: Direction.Down,
      moving,
    },
    collider: null,
    wanderAI: null,
  });
}

function makeTestPlayer(id: number, wx: number, wy: number, vx: number, vy: number) {
  return serializeEntity({
    id,
    type: "player",
    position: { wx, wy },
    velocity: { vx, vy },
    sprite: {
      sheetKey: "player",
      spriteWidth: 16,
      spriteHeight: 16,
      frameCount: 4,
      frameDuration: 120,
      frameCol: 0,
      frameRow: 0,
      animTimer: 0,
      direction: Direction.Down,
      moving: true,
    },
    collider: null,
    wanderAI: null,
  });
}

function makeTestProp(id: number, wx: number, wy: number) {
  return serializeProp({
    id,
    type: "tree",
    position: { wx, wy },
    sprite: {
      sheetKey: "trees",
      frameCol: 0,
      frameRow: 0,
      spriteWidth: 16,
      spriteHeight: 32,
    },
    collider: null,
    walls: null,
    isProp: true,
  });
}

function makeFrame(overrides: Partial<FrameMessage> = {}): FrameMessage {
  return {
    type: "frame",
    serverTick: 0,
    lastProcessedInputSeq: 0,
    playerEntityId: 1,
    ...overrides,
  };
}

describe("RemoteStateView", () => {
  it("starts with empty state", () => {
    const world = new World(new FlatStrategy());
    const view = new RemoteStateView(world);

    expect(view.entities).toEqual([]);
    expect(view.props).toEqual([]);
    expect(view.gemsCollected).toBe(0);
    expect(view.editorEnabled).toBe(true);
  });

  it("playerEntity returns placeholder before any state", () => {
    const world = new World(new FlatStrategy());
    const view = new RemoteStateView(world);

    const player = view.playerEntity;
    expect(player.id).toBe(-1);
    expect(player.type).toBe("player");
  });

  it("applies entity baselines from frame message", () => {
    const world = new World(new FlatStrategy());
    const view = new RemoteStateView(world);

    view.applyFrame(
      makeFrame({
        entityBaselines: [makeTestEntity(1, 50, 75), makeTestEntity(2, 100, 200)],
        playerEntityId: 1,
      }),
    );

    expect(view.entities).toHaveLength(2);
    expect(view.entities.at(0)?.id).toBe(1);
    expect(view.entities.at(1)?.position).toEqual({ wx: 100, wy: 200 });
    expect(view.playerEntity.id).toBe(1);
  });

  it("applies entity deltas to existing entities", () => {
    const world = new World(new FlatStrategy());
    const view = new RemoteStateView(world);

    // First tick: baselines
    view.applyFrame(
      makeFrame({
        entityBaselines: [makeTestEntity(1, 50, 75)],
        playerEntityId: 1,
      }),
    );
    expect(view.entities.at(0)?.position).toEqual({ wx: 50, wy: 75 });

    // Second tick: delta moves entity
    view.applyFrame(
      makeFrame({
        entityDeltas: [{ id: 1, position: { wx: 100, wy: 200 } }],
        playerEntityId: 1,
      }),
    );
    expect(view.entities).toHaveLength(1);
    expect(view.entities.at(0)?.position).toEqual({ wx: 100, wy: 200 });
  });

  it("applies entity exits", () => {
    const world = new World(new FlatStrategy());
    const view = new RemoteStateView(world);

    // First tick: two entities
    view.applyFrame(
      makeFrame({
        entityBaselines: [makeTestEntity(1, 0, 0), makeTestEntity(2, 50, 50)],
        playerEntityId: 1,
      }),
    );
    expect(view.entities).toHaveLength(2);

    // Second tick: entity 2 exits
    view.applyFrame(
      makeFrame({
        entityExits: [2],
        playerEntityId: 1,
      }),
    );
    expect(view.entities).toHaveLength(1);
    expect(view.entities.at(0)?.id).toBe(1);
  });

  it("applies prop state from sync-props message", () => {
    const world = new World(new FlatStrategy());
    const view = new RemoteStateView(world);

    view.applyMessage({
      type: "sync-props",
      props: [makeTestProp(10, 25, 50)],
    });

    expect(view.props).toHaveLength(1);
    expect(view.props.at(0)?.type).toBe("tree");
  });

  it("applies gameplay state from sync-session", () => {
    const world = new World(new FlatStrategy());
    const view = new RemoteStateView(world);

    view.applyFrame(
      makeFrame({
        entityBaselines: [makeTestEntity(1, 0, 0)],
        playerEntityId: 1,
      }),
    );
    view.applyMessage({
      type: "sync-session",
      gemsCollected: 15,
      editorEnabled: false,
      mountEntityId: null,
    });

    expect(view.gemsCollected).toBe(15);
    expect(view.editorEnabled).toBe(false);
  });

  it("applies sync-invincibility and reconstructs countdown from serverTick", () => {
    const world = new World(new FlatStrategy());
    const view = new RemoteStateView(world);

    view.applyFrame(
      makeFrame({
        serverTick: 100,
        playerEntityId: 1,
      }),
    );
    view.applyMessage({
      type: "sync-invincibility",
      startTick: 100,
      durationTicks: 60,
    });
    expect(view.invincibilityTimer).toBeCloseTo(1, 3);

    view.applyFrame(
      makeFrame({
        serverTick: 130,
        playerEntityId: 1,
      }),
    );
    expect(view.invincibilityTimer).toBeCloseTo(0.5, 3);

    view.applyFrame(
      makeFrame({
        serverTick: 160,
        playerEntityId: 1,
      }),
    );
    expect(view.invincibilityTimer).toBe(0);
  });

  it("applies chunk updates from sync-chunks", () => {
    const world = new World(new FlatStrategy());
    const view = new RemoteStateView(world);

    const chunk = new Chunk();
    chunk.subgrid[0] = 5;
    chunk.roadGrid[10] = 3;
    chunk.revision = 1;
    const snapshot = serializeChunk(0, 0, chunk);

    view.applyMessage({
      type: "sync-chunks",
      loadedChunkKeys: ["0,0"],
      chunkUpdates: [snapshot],
    });

    const loaded = view.world.chunks.get(0, 0);
    expect(loaded).toBeTruthy();
    expect(loaded?.subgrid[0]).toBe(5);
    expect(loaded?.roadGrid[10]).toBe(3);
  });

  it("unloads chunks not in loadedChunkKeys", () => {
    const world = new World(new FlatStrategy());
    const view = new RemoteStateView(world);

    // First load a chunk
    const chunk = new Chunk();
    chunk.revision = 1;
    view.applyMessage({
      type: "sync-chunks",
      loadedChunkKeys: ["0,0"],
      chunkUpdates: [serializeChunk(0, 0, chunk)],
    });
    expect(view.world.chunks.get(0, 0)).toBeTruthy();

    // Now send state without that chunk
    view.applyMessage({
      type: "sync-chunks",
      loadedChunkKeys: [],
    });
    expect(view.world.chunks.get(0, 0)).toBeUndefined();
  });

  it("clear() resets all state", () => {
    const world = new World(new FlatStrategy());
    const view = new RemoteStateView(world);

    // Apply some state
    view.applyFrame(
      makeFrame({
        entityBaselines: [makeTestEntity(1, 0, 0)],
        playerEntityId: 1,
      }),
    );
    view.applyMessage({
      type: "sync-props",
      props: [makeTestProp(10, 0, 0)],
    });
    view.applyMessage({
      type: "sync-session",
      gemsCollected: 42,
      editorEnabled: true,
      mountEntityId: null,
    });
    view.applyMessage({
      type: "sync-chunks",
      loadedChunkKeys: ["0,0"],
      chunkUpdates: [serializeChunk(0, 0, new Chunk())],
    });

    view.clear();

    expect(view.entities).toEqual([]);
    expect(view.props).toEqual([]);
    expect(view.gemsCollected).toBe(0);
    expect(view.playerEntity.id).toBe(-1);
  });

  it("exits remove entities and baselines add new ones", () => {
    const world = new World(new FlatStrategy());
    const view = new RemoteStateView(world);

    // First tick: two entities
    view.applyFrame(
      makeFrame({
        entityBaselines: [makeTestEntity(1, 0, 0), makeTestEntity(2, 0, 0)],
        playerEntityId: 1,
      }),
    );
    expect(view.entities).toHaveLength(2);

    // Second tick: entity 1 and 2 exit, entity 3 enters
    view.applyFrame(
      makeFrame({
        entityExits: [1, 2],
        entityBaselines: [makeTestEntity(3, 50, 50)],
        playerEntityId: 3,
      }),
    );
    expect(view.entities).toHaveLength(1);
    expect(view.entities.at(0)?.id).toBe(3);
  });

  it("entities persist across ticks without explicit updates", () => {
    const world = new World(new FlatStrategy());
    const view = new RemoteStateView(world);

    // First tick: baseline
    view.applyFrame(
      makeFrame({
        entityBaselines: [makeTestEntity(1, 50, 75)],
        playerEntityId: 1,
      }),
    );

    // Second tick: no entity updates at all (idle entity)
    view.applyFrame(
      makeFrame({
        playerEntityId: 1,
      }),
    );

    // Entity should still be there with original position
    expect(view.entities).toHaveLength(1);
    expect(view.entities.at(0)?.position).toEqual({ wx: 50, wy: 75 });
  });

  it("saves prevPosition before applying updates", () => {
    const world = new World(new FlatStrategy());
    const view = new RemoteStateView(world);

    // First tick: baseline at (50, 75)
    view.applyFrame(
      makeFrame({
        entityBaselines: [makeTestEntity(1, 50, 75)],
        playerEntityId: 1,
      }),
    );
    // No prevPosition on first tick (new baseline)
    expect(view.entities.at(0)?.prevPosition).toBeUndefined();

    // Second tick: delta moves entity to (100, 200)
    view.applyFrame(
      makeFrame({
        entityDeltas: [{ id: 1, position: { wx: 100, wy: 200 } }],
        playerEntityId: 1,
      }),
    );
    // prevPosition should be the old position
    expect(view.entities.at(0)?.prevPosition).toEqual({ wx: 50, wy: 75 });
    expect(view.entities.at(0)?.position).toEqual({ wx: 100, wy: 200 });
  });

  it("prevPosition is saved for idle entities too", () => {
    const world = new World(new FlatStrategy());
    const view = new RemoteStateView(world);

    view.applyFrame(
      makeFrame({
        entityBaselines: [makeTestEntity(1, 50, 75)],
        playerEntityId: 1,
      }),
    );

    // No-change tick — prevPosition should still be saved
    view.applyFrame(
      makeFrame({
        playerEntityId: 1,
      }),
    );
    expect(view.entities.at(0)?.prevPosition).toEqual({ wx: 50, wy: 75 });
    // Position unchanged
    expect(view.entities.at(0)?.position).toEqual({ wx: 50, wy: 75 });
  });

  it("bufferMessage queues messages, applyPending applies them in order", () => {
    const world = new World(new FlatStrategy());
    const view = new RemoteStateView(world);

    // Buffer baseline
    view.bufferMessage(
      makeFrame({
        serverTick: 1,
        entityBaselines: [makeTestEntity(1, 50, 75)],
        playerEntityId: 1,
      }),
    );

    // Buffer delta
    view.bufferMessage(
      makeFrame({
        serverTick: 2,
        entityDeltas: [{ id: 1, position: { wx: 100, wy: 200 } }],
        playerEntityId: 1,
      }),
    );

    // Nothing applied yet
    expect(view.entities).toHaveLength(0);

    // Apply both
    view.applyPending();

    // Both applied in order: baseline first, then delta
    expect(view.entities).toHaveLength(1);
    expect(view.entities.at(0)?.position).toEqual({ wx: 100, wy: 200 });
    expect(view.stateAppliedThisTick).toBe(true);
  });

  it("applyPending clears queue after applying", () => {
    const world = new World(new FlatStrategy());
    const view = new RemoteStateView(world);

    view.bufferMessage(
      makeFrame({
        entityBaselines: [makeTestEntity(1, 50, 75)],
        playerEntityId: 1,
      }),
    );
    view.applyPending();
    expect(view.stateAppliedThisTick).toBe(true);

    // Second call with no new messages
    view.applyPending();
    expect(view.stateAppliedThisTick).toBe(false);
  });

  it("sequential buffer ordering matters — baseline then delta", () => {
    const world = new World(new FlatStrategy());
    const view = new RemoteStateView(world);

    // Buffer in correct order: baseline → delta → exit
    view.bufferMessage(
      makeFrame({
        serverTick: 1,
        entityBaselines: [makeTestEntity(1, 0, 0), makeTestEntity(2, 50, 50)],
        playerEntityId: 1,
      }),
    );
    view.bufferMessage(
      makeFrame({
        serverTick: 2,
        entityDeltas: [{ id: 1, position: { wx: 100, wy: 100 } }],
        entityExits: [2],
        playerEntityId: 1,
      }),
    );
    view.applyPending();

    // Entity 1 moved, entity 2 exited
    expect(view.entities).toHaveLength(1);
    expect(view.entities.at(0)?.id).toBe(1);
    expect(view.entities.at(0)?.position).toEqual({ wx: 100, wy: 100 });
  });

  it("session state unchanged when no sync-session received", () => {
    const world = new World(new FlatStrategy());
    const view = new RemoteStateView(world);

    // First: set session state
    view.applyFrame(
      makeFrame({
        entityBaselines: [makeTestEntity(1, 0, 0)],
        playerEntityId: 1,
      }),
    );
    view.applyMessage({
      type: "sync-session",
      gemsCollected: 15,
      editorEnabled: false,
      mountEntityId: null,
    });

    expect(view.gemsCollected).toBe(15);
    expect(view.editorEnabled).toBe(false);

    // Second tick: only frame, no sync-session — values should be retained
    view.applyFrame(
      makeFrame({
        serverTick: 1,
        playerEntityId: 1,
      }),
    );

    expect(view.gemsCollected).toBe(15);
    expect(view.editorEnabled).toBe(false);
  });

  it("mountEntityId null clears mount in sync-session", () => {
    const world = new World(new FlatStrategy());
    const view = new RemoteStateView(world);

    // First: mount entity set
    view.applyFrame(
      makeFrame({
        entityBaselines: [makeTestEntity(1, 0, 0)],
        playerEntityId: 1,
      }),
    );
    view.applyMessage({
      type: "sync-session",
      gemsCollected: 0,
      editorEnabled: true,
      mountEntityId: 42,
    });
    expect(view.mountEntityId).toBe(42);

    // Second tick: only frame — mount should be retained
    view.applyFrame(makeFrame({ playerEntityId: 1 }));
    expect(view.mountEntityId).toBe(42);

    // Third tick: sync-session with mount=null — should clear (dismount)
    view.applyMessage({
      type: "sync-session",
      gemsCollected: 0,
      editorEnabled: true,
      mountEntityId: null,
    });
    expect(view.mountEntityId).toBeUndefined();
  });

  it("syncs physics CVars from sync-cvars to PlayerMovement module", () => {
    const world = new World(new FlatStrategy());
    const view = new RemoteStateView(world);

    // Reset to defaults
    setGravityScale(1);
    setFriction(PLAYER_FRICTION);
    setAccelerate(PLAYER_ACCELERATE);
    setAirAccelerate(PLAYER_AIR_ACCELERATE);
    setAirWishCap(PLAYER_AIR_WISHCAP);
    setStopSpeed(PLAYER_STOP_SPEED);
    setNoBunnyHop(false);
    setSmallJumps(false);
    setPlatformerAir(true);
    setTimeScale(1);

    view.applyMessage({
      type: "sync-cvars",
      cvars: {
        gravity: 0.5,
        friction: 4,
        accelerate: 10,
        airAccelerate: 0.7,
        airWishCap: 30,
        stopSpeed: 100,
        noBunnyHop: true,
        smallJumps: true,
        platformerAir: false,
        timeScale: 0.5,
        tickMs: 1000 / 30,
        physicsMult: 2,
        tickRate: 30,
      },
    });

    expect(getGravityScale()).toBe(0.5);
    expect(getFriction()).toBe(4);
    expect(getAccelerate()).toBe(10);
    expect(getAirAccelerate()).toBe(0.7);
    expect(getAirWishCap()).toBe(30);
    expect(getStopSpeed()).toBe(100);
    expect(getNoBunnyHop()).toBe(true);
    expect(getSmallJumps()).toBe(true);
    expect(getPlatformerAir()).toBe(false);
    expect(getTimeScale()).toBe(0.5);

    // Restore defaults so other tests aren't affected
    setGravityScale(1);
    setFriction(PLAYER_FRICTION);
    setAccelerate(PLAYER_ACCELERATE);
    setAirAccelerate(PLAYER_AIR_ACCELERATE);
    setAirWishCap(PLAYER_AIR_WISHCAP);
    setStopSpeed(PLAYER_STOP_SPEED);
    setNoBunnyHop(false);
    setSmallJumps(false);
    setPlatformerAir(true);
    setTimeScale(1);
  });

  it("applies sync-player-names", () => {
    const world = new World(new FlatStrategy());
    const view = new RemoteStateView(world);

    view.applyMessage({
      type: "sync-player-names",
      playerNames: { 1: "Alice", 2: "Bob" },
    });

    expect(view.playerNames).toEqual({ 1: "Alice", 2: "Bob" });
  });

  it("applies sync-editor-cursors", () => {
    const world = new World(new FlatStrategy());
    const view = new RemoteStateView(world);

    view.applyMessage({
      type: "sync-editor-cursors",
      editorCursors: [
        {
          displayName: "Alice",
          color: "#ff0000",
          tileX: 5,
          tileY: 10,
          editorTab: "terrain",
          brushMode: "tile",
        },
      ],
    });

    expect(view.remoteCursors).toHaveLength(1);
    expect(view.remoteCursors.at(0)?.displayName).toBe("Alice");
    expect(view.remoteCursors.at(0)?.tileX).toBe(5);
  });

  it("delta for unknown entity is silently ignored", () => {
    const world = new World(new FlatStrategy());
    const view = new RemoteStateView(world);

    // Baseline for entity 1 only
    view.applyFrame(
      makeFrame({
        entityBaselines: [makeTestEntity(1, 50, 75)],
        playerEntityId: 1,
      }),
    );

    // Delta for entity 99 (not in entity map) — should not throw
    view.applyFrame(
      makeFrame({
        entityDeltas: [{ id: 99, position: { wx: 999, wy: 999 } }],
        playerEntityId: 1,
      }),
    );

    // Entity 1 is unchanged, no entity 99 appeared
    expect(view.entities).toHaveLength(1);
    expect(view.entities.at(0)?.position).toEqual({ wx: 50, wy: 75 });
  });
});

describe("RemoteStateView tickAnimations", () => {
  it("advances frameCol for moving entities", () => {
    const world = new World(new FlatStrategy());
    const view = new RemoteStateView(world);

    view.applyFrame(
      makeFrame({
        entityBaselines: [makeAnimatedEntity(1, 0, 0, true)],
        playerEntityId: 1,
      }),
    );

    const entity = view.entities.at(0);
    expect(entity?.sprite?.frameCol).toBe(0);
    expect(entity?.sprite?.animTimer).toBe(0);

    // Tick 200ms — should advance one frame (frameDuration=200)
    view.tickAnimations(0.2);
    expect(entity?.sprite?.frameCol).toBe(1);
  });

  it("wraps frameCol around frameCount", () => {
    const world = new World(new FlatStrategy());
    const view = new RemoteStateView(world);

    view.applyFrame(
      makeFrame({
        entityBaselines: [makeAnimatedEntity(1, 0, 0, true)],
        playerEntityId: 1,
      }),
    );

    // Advance through all 4 frames (frameCount=4, frameDuration=200ms)
    // tickAnimations advances one frame per call when dt >= frameDuration
    for (let i = 0; i < 4; i++) {
      view.tickAnimations(0.2);
    }
    // After 4 advances: 0→1→2→3→0 (wraps around)
    expect(view.entities.at(0)?.sprite?.frameCol).toBe(0);
  });

  it("resets frameCol to 0 for idle entities", () => {
    const world = new World(new FlatStrategy());
    const view = new RemoteStateView(world);

    // Start moving
    view.applyFrame(
      makeFrame({
        entityBaselines: [makeAnimatedEntity(1, 0, 0, true)],
        playerEntityId: 1,
      }),
    );
    view.tickAnimations(0.2); // advance to frame 1
    expect(view.entities.at(0)?.sprite?.frameCol).toBe(1);

    // Stop moving via delta
    view.applyFrame(
      makeFrame({
        entityDeltas: [
          { id: 1, spriteState: { direction: Direction.Down, moving: false, frameRow: 0 } },
        ],
        playerEntityId: 1,
      }),
    );

    // Tick — should reset to frame 0
    view.tickAnimations(0.1);
    expect(view.entities.at(0)?.sprite?.frameCol).toBe(0);
    expect(view.entities.at(0)?.sprite?.animTimer).toBe(0);
  });

  it("does not animate entities without sprite", () => {
    const world = new World(new FlatStrategy());
    const view = new RemoteStateView(world);

    // Entity with null sprite
    view.applyFrame(
      makeFrame({
        entityBaselines: [makeTestEntity(1, 0, 0)],
        playerEntityId: 1,
      }),
    );

    // Should not throw
    view.tickAnimations(0.1);
    expect(view.entities.at(0)?.sprite).toBeNull();
  });
});

describe("RemoteStateView extrapolation debug sampling", () => {
  it("samples ghost positions for remote players using capped lead time", () => {
    const world = new World(new FlatStrategy());
    const view = new RemoteStateView(world);
    const nowSpy = vi.spyOn(performance, "now");

    nowSpy.mockReturnValue(1000);
    view.applyFrame(
      makeFrame({
        entityBaselines: [makeTestPlayer(1, 0, 0, 0, 0), makeTestPlayer(2, 100, 50, 10, 0)],
        playerEntityId: 1,
      }),
    );

    nowSpy.mockReturnValue(1200);
    const ghosts = view.getExtrapolationGhosts(0.05);
    expect(ghosts).toHaveLength(1);
    expect(ghosts.at(0)?.entityId).toBe(2);
    expect(ghosts.at(0)?.wx).toBeCloseTo(100.5, 3);
    expect(ghosts.at(0)?.wy).toBeCloseTo(50, 3);

    nowSpy.mockRestore();
  });

  it("tracks extrapolation error when authoritative updates arrive", () => {
    const world = new World(new FlatStrategy());
    const view = new RemoteStateView(world);
    const nowSpy = vi.spyOn(performance, "now");

    nowSpy.mockReturnValue(1000);
    view.applyFrame(
      makeFrame({
        entityBaselines: [makeTestPlayer(1, 0, 0, 0, 0), makeTestPlayer(2, 100, 50, 10, 0)],
        playerEntityId: 1,
      }),
    );

    nowSpy.mockReturnValue(1050);
    view.getExtrapolationGhosts(0.1);

    nowSpy.mockReturnValue(1066);
    view.applyFrame(
      makeFrame({
        entityDeltas: [{ id: 2, position: { wx: 100.5, wy: 50 } }],
        playerEntityId: 1,
      }),
    );

    expect(view.extrapolationStats).toBeDefined();
    expect(view.extrapolationStats?.samples).toBe(1);
    expect(view.extrapolationStats?.avgPosErr).toBeCloseTo(0, 4);
    expect(view.extrapolationStats?.maxPosErr).toBeCloseTo(0, 4);
    expect(view.extrapolationStats?.avgLeadMs).toBeCloseTo(50, 4);

    nowSpy.mockRestore();
  });
});
