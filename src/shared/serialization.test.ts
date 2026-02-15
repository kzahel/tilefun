import { describe, expect, it } from "vitest";
import type { Entity } from "../entities/Entity.js";
import { Direction } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import { Chunk } from "../world/Chunk.js";
import {
  applyChunkSnapshot,
  deserializeEntity,
  deserializeProp,
  serializeChunk,
  serializeEntity,
  serializeProp,
} from "./serialization.js";

function makeFullEntity(): Entity {
  return {
    id: 42,
    type: "chicken",
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
    expect(result.sortOffsetY).toBe(entity.sortOffsetY);
    expect(result.velocity).toEqual(entity.velocity);
    expect(result.sprite).toEqual(entity.sprite);
    expect(result.collider).toEqual(entity.collider);
    expect(result.wanderAI).toEqual(entity.wanderAI);
    expect(result.flashHidden).toBe(true);
    expect(result.noShadow).toBe(true);
    expect(result.deathTimer).toBe(2.5);
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
    expect(result.wanderAI?.chaseRange).toBe(64);
    expect(result.collider?.solid).toBe(false);
  });

  it("produces no object identity sharing", () => {
    const entity = makeFullEntity();
    const snapshot = serializeEntity(entity);
    const result = deserializeEntity(snapshot);

    expect(result.position).not.toBe(entity.position);
    expect(result.velocity).not.toBe(entity.velocity);
    expect(result.sprite).not.toBe(entity.sprite);
  });
});

describe("Prop serialization", () => {
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
    expect(result.walls![0]).toHaveProperty("walkableTop", true);
    expect(result.walls![0]).toHaveProperty("passable", true);
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
    expect(target.dirty).toBe(true);
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
