import { describe, expect, it } from "vitest";
import { CollisionIndex } from "./CollisionIndex.js";
import { type AABB, aabbsOverlap, getEntityAABB } from "./collision.js";
import type { Entity } from "./Entity.js";
import { createPlayer } from "./Player.js";

function collider(e: Entity) {
  if (!e.collider) throw new Error("Expected test collider");
  return e.collider;
}

function body(id: number, x: number, y: number, width = 12, height = 12): Entity {
  const e = createPlayer(x, y);
  e.id = id;
  e.collider = { offsetX: 0, offsetY: 0, width, height, physicalHeight: 8 };
  e.wz = 0;
  return e;
}

describe.each([32, 64])("collision cells (%ipx)", (cellSize) => {
  it("contains every brute-force overlap through edits, negative seams and large coordinates", () => {
    const index = new CollisionIndex(cellSize);
    let seed = 2026;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    const bodies = Array.from({ length: 120 }, (_, i) =>
      body(
        i + 1,
        (random() - 0.5) * 600,
        (random() - 0.5) * 600,
        4 + random() * 200,
        4 + random() * 160,
      ),
    );
    bodies.push(body(121, 3_000_000, -3_000_000, 160, 48));
    const first = bodies[0],
      second = bodies[1];
    if (!first || !second) throw new Error("Expected test bodies");
    collider(first).solid = false;
    second.collider = null;
    const assertComplete = (box: AABB) => {
      const candidates = index.query(box);
      expect(new Set(candidates).size).toBe(candidates.length);
      const exact = bodies.filter(
        (e) =>
          e.collider &&
          e.collider.solid !== false &&
          aabbsOverlap(box, getEntityAABB(e.position, e.collider)),
      );
      for (const e of exact) expect(candidates).toContain(e);
    };
    for (let pass = 0; pass < 3; pass++) {
      index.rebuild(bodies);
      for (let i = 0; i < 160; i++) {
        const x = (random() - 0.5) * 700,
          y = (random() - 0.5) * 700;
        assertComplete({ left: x, top: y, right: x + 16, bottom: y + 20 });
      }
      assertComplete({ left: 2_999_980, right: 3_000_040, top: -3_000_010, bottom: -2_999_990 });
      for (const e of bodies.slice(2, 20)) {
        e.position.wx -= 130;
        collider(e).offsetX = 80;
        collider(e).width = 400;
        index.update(e);
        assertComplete(getEntityAABB(e.position, collider(e)));
      }
      bodies.pop();
    }
  });

  it("deduplicates long roofs and falls back safely for oversized bodies and queries", () => {
    const roof = body(1, -16, -32, 300, 60);
    const huge = body(2, 0, 0, 100_000, 100_000);
    const index = new CollisionIndex(cellSize);
    index.rebuild([roof, huge]);
    expect(index.query({ left: -30, right: 20, top: -50, bottom: -20 })).toEqual([roof, huge]);
    expect(index.query({ left: 40_000, right: 40_020, top: -40_000, bottom: -39_980 })).toContain(
      huge,
    );
    expect(index.query({ left: -100_000, right: 100_000, top: -100_000, bottom: 100_000 })).toEqual(
      [roof, huge],
    );
  });

  it("refreshes collider edits and sleepers at rebuild and drops removed bodies", () => {
    const e = body(1, 8, 8);
    const index = new CollisionIndex(cellSize);
    const box = { left: -10, right: 20, top: -10, bottom: 20 };
    index.rebuild([e]);
    expect(index.query(box)).toContain(e);
    e.position.wx = 300;
    index.update(e);
    expect(index.query(box)).not.toContain(e);
    e.position.wx = 8;
    collider(e).solid = false;
    index.update(e);
    expect(index.query(box)).not.toContain(e);
    collider(e).solid = true;
    index.rebuild([e]);
    expect(index.query(box)).toContain(e);
    index.remove(e);
    expect(index.query(box)).not.toContain(e);
    index.update(e);
    expect(index.query(box)).toContain(e);
    e.collider = null;
    index.update(e);
    expect(index.query(box)).not.toContain(e);
    e.collider = body(2, 0, 0).collider;
    index.rebuild([]);
    expect(index.query(box)).toEqual([]);
  });
});
