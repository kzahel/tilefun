import { describe, expect, it, vi } from "vitest";
import { CollisionIndex } from "./CollisionIndex.js";
import { type AABB, aabbsOverlap, getEntityAABB } from "./collision.js";
import type { Entity } from "./Entity.js";
import { EntityManager } from "./EntityManager.js";
import { createPlayer } from "./Player.js";
import { PropManager } from "./PropManager.js";

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

function crowd(manager: EntityManager): Entity[] {
  return Array.from({ length: 32 }, (_, i) => {
    const e = manager.spawn(body(0, 60 + (i % 16) * 10, 140 + Math.floor(i / 16) * 20, 4, 4));
    e.velocity = null;
    return e;
  });
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

it("sees an earlier mover across fine-cell boundaries in the same movement pass", () => {
  const manager = new EntityManager();
  const first = manager.spawn(body(0, 20, 20, 8, 8));
  first.velocity = { vx: 100, vy: 0 };
  const second = manager.spawn(body(0, 110, 20, 8, 8));
  second.velocity = { vx: 100, vy: 0 };
  crowd(manager);
  manager.update(1, () => 0, [], new PropManager());
  expect(first.position.wx).toBe(120);
  expect(second.position.wx).toBe(210);
  // Reverse direction into the first mover's new footprint on the next pass.
  first.velocity.vx = 60;
  second.velocity.vx = -30;
  manager.update(1, () => 0, [], new PropManager());
  expect(first.position.wx).toBe(180);
  expect(second.position.wx).toBe(210);
});

it("keeps sleeping blockers live after a teleport/shape edit between passes", () => {
  const manager = new EntityManager();
  const mover = manager.spawn(body(0, 20, 20, 8, 8));
  mover.velocity = { vx: 10, vy: 0 };
  const sleeping = manager.spawn(body(0, 400, 20));
  sleeping.velocity = null;
  const active = new Map([[mover, 1], ...crowd(manager).map((e) => [e, 1] as const)]);
  manager.update(1, () => 0, [], new PropManager(), active);
  sleeping.position.wx = 40;
  collider(sleeping).width = 16;
  manager.update(1, () => 0, [], new PropManager(), active);
  expect(mover.position.wx).toBe(30);
});

it("matches chunk-query blocking for height, solidity, child exclusion and blocked reactions", () => {
  function run(chunk: boolean) {
    const manager = new EntityManager();
    const mover = manager.spawn(body(0, 20, 20, 8, 8));
    mover.velocity = { vx: 12, vy: 0 };
    mover.wanderAI = {
      state: "walking",
      timer: 2,
      dirX: 1,
      dirY: 0,
      speed: 12,
      idleMin: 1,
      idleMax: 2,
      walkMin: 1,
      walkMax: 2,
      directional: false,
    };
    const blocker = manager.spawn(body(0, 32, 20));
    blocker.velocity = null;
    crowd(manager);
    let spy: ReturnType<typeof vi.spyOn> | undefined;
    if (chunk)
      spy = vi
        .spyOn(manager.collisionIndex, "query")
        .mockImplementation((box) =>
          manager.spatialHash.queryRange(
            Math.floor(box.left / 256),
            Math.floor(box.top / 256),
            Math.floor(box.right / 256),
            Math.floor(box.bottom / 256),
          ),
        );
    const poses = [];
    for (let i = 0; i < 4; i++) {
      blocker.wz = i === 1 ? 30 : 0;
      collider(blocker).solid = i !== 2;
      if (i === 3) blocker.parentId = mover.id;
      else delete blocker.parentId;
      mover.position.wx = 20;
      mover.velocity.vx = 12;
      manager.update(1, () => 0, [], new PropManager());
      poses.push({
        position: { ...mover.position },
        velocity: { ...mover.velocity },
        ai: { ...mover.wanderAI },
      });
    }
    spy?.mockRestore();
    return poses;
  }
  expect(run(false)).toEqual(run(true));
});

it("keeps sparse passes on the cheap chunk path", () => {
  const manager = new EntityManager();
  for (let i = 0; i < 40; i++) manager.spawn(body(0, i * 256, 20));
  const fine = vi.spyOn(manager.collisionIndex, "rebuild");
  const chunk = vi.spyOn(manager.spatialHash, "queryRange");
  manager.update(1 / 60, () => 0, [], new PropManager());
  expect(fine).not.toHaveBeenCalled();
  expect(chunk).toHaveBeenCalled();
  vi.restoreAllMocks();
});
