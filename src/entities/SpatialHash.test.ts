import { describe, expect, it } from "vitest";
import { CHUNK_SIZE_PX } from "../config/constants.js";
import type { Entity } from "./Entity.js";
import { SpatialHash } from "./SpatialHash.js";

function makeEntity(id: number, wx: number, wy: number): Entity {
  return {
    id,
    type: "test",
    position: { wx, wy },
    velocity: null,
    sprite: null,
    collider: null,
    wanderAI: null,
  };
}

describe("SpatialHash", () => {
  it("inserts and queries entities in the correct cell", () => {
    const hash = new SpatialHash();
    const e = makeEntity(1, 10, 10);
    hash.insert(e);
    expect(hash.getCell(0, 0)).toContain(e);
    expect(hash.getCell(1, 0)).not.toContain(e);
  });

  it("handles negative coordinates", () => {
    const hash = new SpatialHash();
    const e = makeEntity(1, -100, -200);
    hash.insert(e);
    const cx = Math.floor(-100 / CHUNK_SIZE_PX);
    const cy = Math.floor(-200 / CHUNK_SIZE_PX);
    expect(hash.getCell(cx, cy)).toContain(e);
  });

  it("removes entities", () => {
    const hash = new SpatialHash();
    const e = makeEntity(1, 10, 10);
    hash.insert(e);
    hash.remove(e);
    expect(hash.getCell(0, 0)).toHaveLength(0);
  });

  it("updates entity cell on chunk boundary crossing", () => {
    const hash = new SpatialHash();
    const e = makeEntity(1, 10, 10);
    hash.insert(e);
    expect(hash.getCell(0, 0)).toContain(e);

    // Move to next chunk
    e.position.wx = CHUNK_SIZE_PX + 10;
    hash.update(e);
    expect(hash.getCell(0, 0)).not.toContain(e);
    expect(hash.getCell(1, 0)).toContain(e);
  });

  it("does not move entity when staying in same chunk", () => {
    const hash = new SpatialHash();
    const e = makeEntity(1, 10, 10);
    hash.insert(e);

    e.position.wx = 50;
    hash.update(e);
    expect(hash.getCell(0, 0)).toContain(e);
  });

  it("queryRange returns entities in range", () => {
    const hash = new SpatialHash();
    const e1 = makeEntity(1, 10, 10); // chunk (0,0)
    const e2 = makeEntity(2, CHUNK_SIZE_PX + 10, 10); // chunk (1,0)
    const e3 = makeEntity(3, CHUNK_SIZE_PX * 5, 10); // chunk (5,0) — out of range
    hash.insert(e1);
    hash.insert(e2);
    hash.insert(e3);

    const result = hash.queryRange(0, 0, 1, 0);
    expect(result).toContain(e1);
    expect(result).toContain(e2);
    expect(result).not.toContain(e3);
  });

  it("queryRadius returns entities within radius", () => {
    const hash = new SpatialHash();
    const e1 = makeEntity(1, 100, 100);
    const e2 = makeEntity(2, 150, 100);
    const e3 = makeEntity(3, 1000, 1000);
    hash.insert(e1);
    hash.insert(e2);
    hash.insert(e3);

    const result = hash.queryRadius(100, 100, 60);
    expect(result).toContain(e1);
    expect(result).toContain(e2);
    expect(result).not.toContain(e3);
  });

  it("clear removes all data", () => {
    const hash = new SpatialHash();
    hash.insert(makeEntity(1, 10, 10));
    hash.insert(makeEntity(2, 500, 500));
    hash.clear();
    expect(hash.getCell(0, 0)).toHaveLength(0);
    expect(hash.queryRange(-100, -100, 100, 100)).toHaveLength(0);
  });

  it("handles multiple entities in the same cell", () => {
    const hash = new SpatialHash();
    const e1 = makeEntity(1, 10, 10);
    const e2 = makeEntity(2, 20, 20);
    const e3 = makeEntity(3, 30, 30);
    hash.insert(e1);
    hash.insert(e2);
    hash.insert(e3);
    expect(hash.getCell(0, 0)).toHaveLength(3);
  });

  it("swap-remove preserves other entities in bucket", () => {
    const hash = new SpatialHash();
    const e1 = makeEntity(1, 10, 10);
    const e2 = makeEntity(2, 20, 20);
    const e3 = makeEntity(3, 30, 30);
    hash.insert(e1);
    hash.insert(e2);
    hash.insert(e3);

    // Remove middle entity
    hash.remove(e2);
    const cell = hash.getCell(0, 0);
    expect(cell).toContain(e1);
    expect(cell).not.toContain(e2);
    expect(cell).toContain(e3);
    expect(cell).toHaveLength(2);
  });
});
