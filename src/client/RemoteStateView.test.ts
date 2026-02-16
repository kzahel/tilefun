import { describe, expect, it } from "vitest";
import {
  PLAYER_ACCELERATE,
  PLAYER_AIR_ACCELERATE,
  PLAYER_AIR_WISHCAP,
  PLAYER_FRICTION,
  PLAYER_STOP_SPEED,
} from "../config/constants.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import {
  getAccelerate,
  getAirAccelerate,
  getAirWishCap,
  getFriction,
  getGravityScale,
  getNoBunnyHop,
  getSmallJumps,
  getStopSpeed,
  getTimeScale,
  setAccelerate,
  setAirAccelerate,
  setAirWishCap,
  setFriction,
  setGravityScale,
  setNoBunnyHop,
  setSmallJumps,
  setStopSpeed,
  setTimeScale,
} from "../physics/PlayerMovement.js";
import type { GameStateMessage, PhysicsCVars } from "../shared/protocol.js";
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

const DEFAULT_CVARS: PhysicsCVars = {
  gravity: 1,
  friction: PLAYER_FRICTION,
  accelerate: PLAYER_ACCELERATE,
  airAccelerate: PLAYER_AIR_ACCELERATE,
  airWishCap: PLAYER_AIR_WISHCAP,
  stopSpeed: PLAYER_STOP_SPEED,
  noBunnyHop: false,
  smallJumps: false,
  timeScale: 1,
};

function makeGameState(overrides: Partial<GameStateMessage> = {}): GameStateMessage {
  return {
    type: "game-state",
    serverTick: 0,
    lastProcessedInputSeq: 0,
    props: [],
    playerEntityId: 1,
    gemsCollected: 0,
    invincibilityTimer: 0,
    editorEnabled: true,
    loadedChunkKeys: [],
    chunkUpdates: [],
    editorCursors: [],
    playerNames: {},
    cvars: DEFAULT_CVARS,
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

  it("applies entity baselines from game-state message", () => {
    const world = new World(new FlatStrategy());
    const view = new RemoteStateView(world);

    view.applyGameState(
      makeGameState({
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
    view.applyGameState(
      makeGameState({
        entityBaselines: [makeTestEntity(1, 50, 75)],
        playerEntityId: 1,
      }),
    );
    expect(view.entities.at(0)?.position).toEqual({ wx: 50, wy: 75 });

    // Second tick: delta moves entity
    view.applyGameState(
      makeGameState({
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
    view.applyGameState(
      makeGameState({
        entityBaselines: [makeTestEntity(1, 0, 0), makeTestEntity(2, 50, 50)],
        playerEntityId: 1,
      }),
    );
    expect(view.entities).toHaveLength(2);

    // Second tick: entity 2 exits
    view.applyGameState(
      makeGameState({
        entityExits: [2],
        playerEntityId: 1,
      }),
    );
    expect(view.entities).toHaveLength(1);
    expect(view.entities.at(0)?.id).toBe(1);
  });

  it("applies prop state from game-state message", () => {
    const world = new World(new FlatStrategy());
    const view = new RemoteStateView(world);

    view.applyGameState(
      makeGameState({
        props: [makeTestProp(10, 25, 50)],
      }),
    );

    expect(view.props).toHaveLength(1);
    expect(view.props.at(0)?.type).toBe("tree");
  });

  it("applies gameplay state", () => {
    const world = new World(new FlatStrategy());
    const view = new RemoteStateView(world);

    view.applyGameState(
      makeGameState({
        entityBaselines: [makeTestEntity(1, 0, 0)],
        playerEntityId: 1,
        gemsCollected: 15,
        invincibilityTimer: 2.5,
        editorEnabled: false,
      }),
    );

    expect(view.gemsCollected).toBe(15);
    expect(view.invincibilityTimer).toBe(2.5);
    expect(view.editorEnabled).toBe(false);
  });

  it("applies chunk updates", () => {
    const world = new World(new FlatStrategy());
    const view = new RemoteStateView(world);

    const chunk = new Chunk();
    chunk.subgrid[0] = 5;
    chunk.roadGrid[10] = 3;
    chunk.revision = 1;
    const snapshot = serializeChunk(0, 0, chunk);

    view.applyGameState(
      makeGameState({
        loadedChunkKeys: ["0,0"],
        chunkUpdates: [snapshot],
      }),
    );

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
    view.applyGameState(
      makeGameState({
        loadedChunkKeys: ["0,0"],
        chunkUpdates: [serializeChunk(0, 0, chunk)],
      }),
    );
    expect(view.world.chunks.get(0, 0)).toBeTruthy();

    // Now send state without that chunk
    view.applyGameState(
      makeGameState({
        loadedChunkKeys: [],
        chunkUpdates: [],
      }),
    );
    expect(view.world.chunks.get(0, 0)).toBeUndefined();
  });

  it("clear() resets all state", () => {
    const world = new World(new FlatStrategy());
    const view = new RemoteStateView(world);

    // Apply some state
    view.applyGameState(
      makeGameState({
        entityBaselines: [makeTestEntity(1, 0, 0)],
        props: [makeTestProp(10, 0, 0)],
        playerEntityId: 1,
        gemsCollected: 42,
        loadedChunkKeys: ["0,0"],
        chunkUpdates: [serializeChunk(0, 0, new Chunk())],
      }),
    );

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
    view.applyGameState(
      makeGameState({
        entityBaselines: [makeTestEntity(1, 0, 0), makeTestEntity(2, 0, 0)],
        playerEntityId: 1,
      }),
    );
    expect(view.entities).toHaveLength(2);

    // Second tick: entity 1 and 2 exit, entity 3 enters
    view.applyGameState(
      makeGameState({
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
    view.applyGameState(
      makeGameState({
        entityBaselines: [makeTestEntity(1, 50, 75)],
        playerEntityId: 1,
      }),
    );

    // Second tick: no entity updates at all (idle entity)
    view.applyGameState(
      makeGameState({
        playerEntityId: 1,
      }),
    );

    // Entity should still be there with original position
    expect(view.entities).toHaveLength(1);
    expect(view.entities.at(0)?.position).toEqual({ wx: 50, wy: 75 });
  });

  it("syncs physics CVars from game-state to PlayerMovement module", () => {
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
    setTimeScale(1);

    view.applyGameState(
      makeGameState({
        cvars: {
          gravity: 0.5,
          friction: 4,
          accelerate: 10,
          airAccelerate: 0.7,
          airWishCap: 30,
          stopSpeed: 100,
          noBunnyHop: true,
          smallJumps: true,
          timeScale: 0.5,
        },
      }),
    );

    expect(getGravityScale()).toBe(0.5);
    expect(getFriction()).toBe(4);
    expect(getAccelerate()).toBe(10);
    expect(getAirAccelerate()).toBe(0.7);
    expect(getAirWishCap()).toBe(30);
    expect(getStopSpeed()).toBe(100);
    expect(getNoBunnyHop()).toBe(true);
    expect(getSmallJumps()).toBe(true);
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
    setTimeScale(1);
  });
});
