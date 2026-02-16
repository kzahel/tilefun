import { describe, expect, it } from "vitest";
import type { Entity } from "../entities/Entity.js";
import { Direction } from "../entities/Entity.js";
import type { SpriteState, WanderAIState } from "../entities/EntityDefs.js";
import { applyEntityDelta, diffEntitySnapshots, type EntityDelta } from "./entityDelta.js";
import type { EntitySnapshot } from "./protocol.js";

// ---- Helpers ----

/** Assert non-null and return typed value (avoids biome noNonNullAssertion warnings). */
function assertDefined<T>(value: T | null | undefined, msg = "expected non-null"): T {
  expect(value, msg).not.toBeNull();
  expect(value, msg).not.toBeUndefined();
  return value as T;
}

function makeSnapshot(overrides?: Partial<EntitySnapshot>): EntitySnapshot {
  return {
    id: 1,
    type: "chicken",
    position: { wx: 100, wy: 200 },
    velocity: { vx: 0, vy: 0 },
    spriteState: {
      direction: Direction.Down,
      moving: false,
      frameRow: 0,
    },
    wanderAIState: {
      state: "idle",
      dirX: 0,
      dirY: 0,
    },
    ...overrides,
  };
}

function makeEntity(overrides?: Partial<Entity>): Entity {
  return {
    id: 1,
    type: "chicken",
    position: { wx: 100, wy: 200 },
    velocity: { vx: 0, vy: 0 },
    sprite: {
      sheetKey: "chicken",
      spriteWidth: 16,
      spriteHeight: 16,
      frameCount: 4,
      frameDuration: 200,
      frameCol: 2,
      frameRow: 0,
      animTimer: 50,
      direction: Direction.Down,
      moving: false,
    },
    collider: {
      offsetX: 0,
      offsetY: -5,
      width: 10,
      height: 6,
      physicalHeight: 8,
    },
    wanderAI: {
      state: "idle",
      timer: 2.0,
      dirX: 0,
      dirY: 0,
      idleMin: 1.0,
      idleMax: 4.0,
      walkMin: 1.0,
      walkMax: 3.0,
      speed: 20,
      directional: false,
      befriendable: true,
      followDistance: 20,
    },
    ...overrides,
  };
}

// ---- diffEntitySnapshots ----

describe("diffEntitySnapshots", () => {
  it("returns null for identical snapshots", () => {
    const a = makeSnapshot();
    const b = makeSnapshot();
    expect(diffEntitySnapshots(a, b)).toBeNull();
  });

  it("detects position change", () => {
    const a = makeSnapshot();
    const b = makeSnapshot({ position: { wx: 110, wy: 200 } });
    const delta = diffEntitySnapshots(a, b);
    expect(delta).toEqual({ id: 1, position: { wx: 110, wy: 200 } });
  });

  it("detects position change in wy only", () => {
    const a = makeSnapshot();
    const b = makeSnapshot({ position: { wx: 100, wy: 205 } });
    const delta = diffEntitySnapshots(a, b);
    expect(delta).toEqual({ id: 1, position: { wx: 100, wy: 205 } });
  });

  it("detects velocity change", () => {
    const a = makeSnapshot({ velocity: { vx: 0, vy: 0 } });
    const b = makeSnapshot({ velocity: { vx: 5, vy: -3 } });
    const delta = diffEntitySnapshots(a, b);
    expect(delta).toEqual({ id: 1, velocity: { vx: 5, vy: -3 } });
  });

  it("detects velocity null to object", () => {
    const a = makeSnapshot({ velocity: null });
    const b = makeSnapshot({ velocity: { vx: 1, vy: 2 } });
    const delta = diffEntitySnapshots(a, b);
    expect(delta).toEqual({ id: 1, velocity: { vx: 1, vy: 2 } });
  });

  it("detects velocity object to null", () => {
    const a = makeSnapshot({ velocity: { vx: 1, vy: 2 } });
    const b = makeSnapshot({ velocity: null });
    const delta = diffEntitySnapshots(a, b);
    expect(delta).toEqual({ id: 1, velocity: null });
  });

  it("no delta when both velocities null", () => {
    const a = makeSnapshot({ velocity: null });
    const b = makeSnapshot({ velocity: null });
    expect(diffEntitySnapshots(a, b)).toBeNull();
  });

  it("detects sprite direction change", () => {
    const a = makeSnapshot({
      spriteState: { direction: Direction.Down, moving: false, frameRow: 0 },
    });
    const b = makeSnapshot({
      spriteState: { direction: Direction.Right, moving: false, frameRow: 3 },
    });
    const delta = diffEntitySnapshots(a, b);
    expect(delta?.spriteState).toEqual({
      direction: Direction.Right,
      moving: false,
      frameRow: 3,
    });
  });

  it("detects sprite moving change", () => {
    const a = makeSnapshot({
      spriteState: { direction: Direction.Down, moving: false, frameRow: 0 },
    });
    const b = makeSnapshot({
      spriteState: { direction: Direction.Down, moving: true, frameRow: 0 },
    });
    const delta = diffEntitySnapshots(a, b);
    expect(delta?.spriteState?.moving).toBe(true);
  });

  it("detects sprite flipX change", () => {
    const a = makeSnapshot({
      spriteState: { direction: Direction.Left, moving: true, frameRow: 2 },
    });
    const b = makeSnapshot({
      spriteState: { direction: Direction.Left, moving: true, frameRow: 2, flipX: true },
    });
    const delta = diffEntitySnapshots(a, b);
    expect(delta?.spriteState?.flipX).toBe(true);
  });

  it("detects sprite frameDuration change", () => {
    const a = makeSnapshot({
      spriteState: { direction: Direction.Down, moving: true, frameRow: 0, frameDuration: 200 },
    });
    const b = makeSnapshot({
      spriteState: { direction: Direction.Down, moving: true, frameRow: 0, frameDuration: 100 },
    });
    const delta = diffEntitySnapshots(a, b);
    expect(delta?.spriteState?.frameDuration).toBe(100);
  });

  it("no delta for identical sprite states", () => {
    const ss: SpriteState = { direction: Direction.Up, moving: true, frameRow: 1, flipX: true };
    const a = makeSnapshot({ spriteState: ss });
    const b = makeSnapshot({ spriteState: { ...ss } });
    expect(diffEntitySnapshots(a, b)).toBeNull();
  });

  it("detects sprite null to object", () => {
    const a = makeSnapshot({ spriteState: null });
    const b = makeSnapshot({
      spriteState: { direction: Direction.Down, moving: false, frameRow: 0 },
    });
    const delta = diffEntitySnapshots(a, b);
    expect(delta?.spriteState).toBeTruthy();
  });

  it("detects sprite object to null", () => {
    const a = makeSnapshot({
      spriteState: { direction: Direction.Down, moving: false, frameRow: 0 },
    });
    const b = makeSnapshot({ spriteState: null });
    const delta = diffEntitySnapshots(a, b);
    expect(delta?.spriteState).toBeNull();
  });

  it("no delta when both sprite states null", () => {
    const a = makeSnapshot({ spriteState: null });
    const b = makeSnapshot({ spriteState: null });
    expect(diffEntitySnapshots(a, b)).toBeNull();
  });

  it("detects wanderAI state change", () => {
    const a = makeSnapshot({ wanderAIState: { state: "idle", dirX: 0, dirY: 0 } });
    const b = makeSnapshot({ wanderAIState: { state: "walking", dirX: 1, dirY: 0 } });
    const delta = diffEntitySnapshots(a, b);
    expect(delta?.wanderAIState).toEqual({ state: "walking", dirX: 1, dirY: 0 });
  });

  it("detects wanderAI following change", () => {
    const a = makeSnapshot({ wanderAIState: { state: "idle", dirX: 0, dirY: 0 } });
    const b = makeSnapshot({
      wanderAIState: { state: "following", dirX: 1, dirY: -1, following: true },
    });
    const delta = diffEntitySnapshots(a, b);
    expect(delta?.wanderAIState?.following).toBe(true);
  });

  it("no delta for identical wanderAI states", () => {
    const ai: WanderAIState = { state: "walking", dirX: 1, dirY: -1, following: true };
    const a = makeSnapshot({ wanderAIState: ai });
    const b = makeSnapshot({ wanderAIState: { ...ai } });
    expect(diffEntitySnapshots(a, b)).toBeNull();
  });

  it("detects wanderAI null to object", () => {
    const a = makeSnapshot({ wanderAIState: null });
    const b = makeSnapshot({ wanderAIState: { state: "idle", dirX: 0, dirY: 0 } });
    const delta = diffEntitySnapshots(a, b);
    expect(delta?.wanderAIState).toBeTruthy();
  });

  it("detects wanderAI object to null", () => {
    const a = makeSnapshot({ wanderAIState: { state: "idle", dirX: 0, dirY: 0 } });
    const b = makeSnapshot({ wanderAIState: null });
    const delta = diffEntitySnapshots(a, b);
    expect(delta?.wanderAIState).toBeNull();
  });

  it("no delta when both wanderAI states null", () => {
    const a = makeSnapshot({ wanderAIState: null });
    const b = makeSnapshot({ wanderAIState: null });
    expect(diffEntitySnapshots(a, b)).toBeNull();
  });

  // Optional entity-level fields

  it("detects optional bool field added", () => {
    const a = makeSnapshot();
    const b = makeSnapshot({ flashHidden: true });
    const delta = diffEntitySnapshots(a, b);
    expect(delta?.flashHidden).toBe(true);
  });

  it("detects optional bool field removed (null sentinel)", () => {
    const a = makeSnapshot({ flashHidden: true });
    const b = makeSnapshot();
    const delta = diffEntitySnapshots(a, b);
    expect(delta?.flashHidden).toBeNull();
  });

  it("detects optional num field added", () => {
    const a = makeSnapshot();
    const b = makeSnapshot({ jumpZ: 10 });
    const delta = diffEntitySnapshots(a, b);
    expect(delta?.jumpZ).toBe(10);
  });

  it("detects optional num field changed", () => {
    const a = makeSnapshot({ jumpZ: 5 });
    const b = makeSnapshot({ jumpZ: 10 });
    const delta = diffEntitySnapshots(a, b);
    expect(delta?.jumpZ).toBe(10);
  });

  it("detects optional num field removed (null sentinel)", () => {
    const a = makeSnapshot({ deathTimer: 2.5 });
    const b = makeSnapshot();
    const delta = diffEntitySnapshots(a, b);
    expect(delta?.deathTimer).toBeNull();
  });

  it("no delta when optional fields both absent", () => {
    const a = makeSnapshot();
    const b = makeSnapshot();
    expect(diffEntitySnapshots(a, b)).toBeNull();
  });

  it("detects multiple changes in one delta", () => {
    const a = makeSnapshot();
    const b = makeSnapshot({
      position: { wx: 150, wy: 250 },
      velocity: { vx: 3, vy: -1 },
      spriteState: { direction: Direction.Right, moving: true, frameRow: 3 },
      flashHidden: true,
      jumpZ: 5,
    });
    const delta = assertDefined(diffEntitySnapshots(a, b));
    expect(delta).not.toBeNull();
    expect(delta.position).toEqual({ wx: 150, wy: 250 });
    expect(delta.velocity).toEqual({ vx: 3, vy: -1 });
    expect(delta.spriteState?.direction).toBe(Direction.Right);
    expect(delta.flashHidden).toBe(true);
    expect(delta.jumpZ).toBe(5);
    // Unchanged fields should be absent
    expect(delta.wanderAIState).toBeUndefined();
    expect(delta.noShadow).toBeUndefined();
    expect(delta.deathTimer).toBeUndefined();
  });

  it("handles all optional num fields", () => {
    const a = makeSnapshot();
    const b = makeSnapshot({
      jumpZ: 1,
      jumpVZ: 2,
      wz: 3,
      parentId: 99,
      localOffsetX: 4,
      localOffsetY: 5,
    });
    const delta = assertDefined(diffEntitySnapshots(a, b));
    expect(delta.jumpZ).toBe(1);
    expect(delta.jumpVZ).toBe(2);
    expect(delta.wz).toBe(3);
    expect(delta.parentId).toBe(99);
    expect(delta.localOffsetX).toBe(4);
    expect(delta.localOffsetY).toBe(5);
  });

  it("handles noShadow field", () => {
    const a = makeSnapshot();
    const b = makeSnapshot({ noShadow: true });
    const delta = assertDefined(diffEntitySnapshots(a, b));
    expect(delta.noShadow).toBe(true);
  });

  it("uses curr entity id in delta", () => {
    const a = makeSnapshot();
    const b = makeSnapshot({ position: { wx: 999, wy: 999 } });
    const delta = assertDefined(diffEntitySnapshots(a, b));
    expect(delta.id).toBe(1);
  });
});

// ---- applyEntityDelta ----

describe("applyEntityDelta", () => {
  it("updates position in-place", () => {
    const entity = makeEntity();
    applyEntityDelta(entity, { id: 1, position: { wx: 300, wy: 400 } });
    expect(entity.position.wx).toBe(300);
    expect(entity.position.wy).toBe(400);
  });

  it("does not modify position when absent from delta", () => {
    const entity = makeEntity();
    applyEntityDelta(entity, { id: 1 });
    expect(entity.position.wx).toBe(100);
    expect(entity.position.wy).toBe(200);
  });

  it("updates velocity in-place when entity has velocity", () => {
    const entity = makeEntity();
    applyEntityDelta(entity, { id: 1, velocity: { vx: 5, vy: -3 } });
    expect(entity.velocity).toEqual({ vx: 5, vy: -3 });
  });

  it("creates velocity when entity has null velocity", () => {
    const entity = makeEntity({ velocity: null });
    applyEntityDelta(entity, { id: 1, velocity: { vx: 1, vy: 2 } });
    expect(entity.velocity).toEqual({ vx: 1, vy: 2 });
  });

  it("sets velocity to null", () => {
    const entity = makeEntity({ velocity: { vx: 1, vy: 2 } });
    applyEntityDelta(entity, { id: 1, velocity: null });
    expect(entity.velocity).toBeNull();
  });

  it("does not modify velocity when absent from delta", () => {
    const entity = makeEntity({ velocity: { vx: 7, vy: 8 } });
    applyEntityDelta(entity, { id: 1 });
    expect(entity.velocity).toEqual({ vx: 7, vy: 8 });
  });

  it("updates sprite state in-place, preserving animTimer/frameCol", () => {
    const entity = makeEntity();
    const sprite = assertDefined(entity.sprite);
    sprite.animTimer = 123;
    sprite.frameCol = 2;

    applyEntityDelta(entity, {
      id: 1,
      spriteState: { direction: Direction.Right, moving: true, frameRow: 3 },
    });

    expect(entity.sprite?.direction).toBe(Direction.Right);
    expect(entity.sprite?.moving).toBe(true);
    expect(entity.sprite?.frameRow).toBe(3);
    // Client-side animation state preserved
    expect(entity.sprite?.animTimer).toBe(123);
    expect(entity.sprite?.frameCol).toBe(2);
    // Static fields preserved
    expect(entity.sprite?.sheetKey).toBe("chicken");
    expect(entity.sprite?.spriteWidth).toBe(16);
  });

  it("applies flipX to existing sprite", () => {
    const entity = makeEntity();
    applyEntityDelta(entity, {
      id: 1,
      spriteState: { direction: Direction.Left, moving: true, frameRow: 2, flipX: true },
    });
    expect(entity.sprite?.flipX).toBe(true);
  });

  it("removes flipX when absent from spriteState delta", () => {
    const entity = makeEntity();
    assertDefined(entity.sprite).flipX = true;
    applyEntityDelta(entity, {
      id: 1,
      spriteState: { direction: Direction.Down, moving: false, frameRow: 0 },
    });
    expect(entity.sprite?.flipX).toBeUndefined();
  });

  it("applies frameDuration override to existing sprite", () => {
    const entity = makeEntity();
    applyEntityDelta(entity, {
      id: 1,
      spriteState: { direction: Direction.Down, moving: true, frameRow: 0, frameDuration: 100 },
    });
    expect(entity.sprite?.frameDuration).toBe(100);
  });

  it("resets frameDuration to def when absent from spriteState delta", () => {
    const entity = makeEntity();
    assertDefined(entity.sprite).frameDuration = 100; // was overridden
    applyEntityDelta(entity, {
      id: 1,
      spriteState: { direction: Direction.Down, moving: false, frameRow: 0 },
    });
    // Should reset to chicken def frameDuration (200)
    expect(entity.sprite?.frameDuration).toBe(200);
  });

  it("reconstructs sprite from def when entity has null sprite", () => {
    const entity = makeEntity({ sprite: null });
    applyEntityDelta(entity, {
      id: 1,
      spriteState: { direction: Direction.Right, moving: true, frameRow: 3 },
    });
    expect(entity.sprite).not.toBeNull();
    expect(entity.sprite?.sheetKey).toBe("chicken");
    expect(entity.sprite?.direction).toBe(Direction.Right);
    expect(entity.sprite?.moving).toBe(true);
    expect(entity.sprite?.frameRow).toBe(3);
    expect(entity.sprite?.frameCol).toBe(0);
    expect(entity.sprite?.animTimer).toBe(0);
    expect(entity.sprite?.frameCount).toBe(4);
    expect(entity.sprite?.spriteWidth).toBe(16);
    expect(entity.sprite?.spriteHeight).toBe(16);
    expect(entity.sprite?.frameDuration).toBe(200);
  });

  it("sets sprite to null", () => {
    const entity = makeEntity();
    applyEntityDelta(entity, { id: 1, spriteState: null });
    expect(entity.sprite).toBeNull();
  });

  it("does not modify sprite when absent from delta", () => {
    const entity = makeEntity();
    const origDirection = entity.sprite?.direction;
    applyEntityDelta(entity, { id: 1 });
    expect(entity.sprite?.direction).toBe(origDirection);
  });

  it("updates wanderAI state in-place", () => {
    const entity = makeEntity();
    applyEntityDelta(entity, {
      id: 1,
      wanderAIState: { state: "walking", dirX: 1, dirY: 0 },
    });
    expect(entity.wanderAI?.state).toBe("walking");
    expect(entity.wanderAI?.dirX).toBe(1);
    expect(entity.wanderAI?.dirY).toBe(0);
    // Static fields preserved
    expect(entity.wanderAI?.speed).toBe(20);
    expect(entity.wanderAI?.befriendable).toBe(true);
  });

  it("applies following to existing wanderAI", () => {
    const entity = makeEntity();
    applyEntityDelta(entity, {
      id: 1,
      wanderAIState: { state: "following", dirX: 1, dirY: -1, following: true },
    });
    expect(entity.wanderAI?.following).toBe(true);
    expect(entity.wanderAI?.state).toBe("following");
  });

  it("removes following when absent from wanderAI delta", () => {
    const entity = makeEntity();
    assertDefined(entity.wanderAI).following = true;
    applyEntityDelta(entity, {
      id: 1,
      wanderAIState: { state: "idle", dirX: 0, dirY: 0 },
    });
    expect(entity.wanderAI?.following).toBeUndefined();
  });

  it("reconstructs wanderAI from def when entity has null wanderAI", () => {
    const entity = makeEntity({ wanderAI: null });
    applyEntityDelta(entity, {
      id: 1,
      wanderAIState: { state: "walking", dirX: -1, dirY: 0 },
    });
    expect(entity.wanderAI).not.toBeNull();
    expect(entity.wanderAI?.state).toBe("walking");
    expect(entity.wanderAI?.dirX).toBe(-1);
    expect(entity.wanderAI?.timer).toBe(0);
    // Static fields from chicken def
    expect(entity.wanderAI?.speed).toBe(20);
    expect(entity.wanderAI?.idleMin).toBe(1.0);
    expect(entity.wanderAI?.befriendable).toBe(true);
    expect(entity.wanderAI?.followDistance).toBe(20);
  });

  it("sets wanderAI to null", () => {
    const entity = makeEntity();
    applyEntityDelta(entity, { id: 1, wanderAIState: null });
    expect(entity.wanderAI).toBeNull();
  });

  it("does not modify wanderAI when absent from delta", () => {
    const entity = makeEntity();
    applyEntityDelta(entity, { id: 1 });
    expect(entity.wanderAI?.state).toBe("idle");
  });

  // Optional entity-level fields

  it("sets optional bool field", () => {
    const entity = makeEntity();
    applyEntityDelta(entity, { id: 1, flashHidden: true });
    expect(entity.flashHidden).toBe(true);
  });

  it("removes optional bool field via null", () => {
    const entity = makeEntity({ flashHidden: true });
    applyEntityDelta(entity, { id: 1, flashHidden: null });
    expect(entity.flashHidden).toBeUndefined();
  });

  it("sets optional num field", () => {
    const entity = makeEntity();
    applyEntityDelta(entity, { id: 1, jumpZ: 15 });
    expect(entity.jumpZ).toBe(15);
  });

  it("changes optional num field", () => {
    const entity = makeEntity({ jumpZ: 5 });
    applyEntityDelta(entity, { id: 1, jumpZ: 15 });
    expect(entity.jumpZ).toBe(15);
  });

  it("removes optional num field via null", () => {
    const entity = makeEntity({ deathTimer: 2.5 });
    applyEntityDelta(entity, { id: 1, deathTimer: null });
    expect(entity.deathTimer).toBeUndefined();
  });

  it("does not modify optional fields when absent from delta", () => {
    const entity = makeEntity({ jumpZ: 5, flashHidden: true });
    applyEntityDelta(entity, { id: 1 });
    expect(entity.jumpZ).toBe(5);
    expect(entity.flashHidden).toBe(true);
  });

  it("applies all optional num fields", () => {
    const entity = makeEntity();
    applyEntityDelta(entity, {
      id: 1,
      jumpZ: 1,
      jumpVZ: 2,
      wz: 3,
      parentId: 99,
      localOffsetX: 4,
      localOffsetY: 5,
    });
    expect(entity.jumpZ).toBe(1);
    expect(entity.jumpVZ).toBe(2);
    expect(entity.wz).toBe(3);
    expect(entity.parentId).toBe(99);
    expect(entity.localOffsetX).toBe(4);
    expect(entity.localOffsetY).toBe(5);
  });

  it("removes all optional num fields via null", () => {
    const entity = makeEntity({
      jumpZ: 1,
      jumpVZ: 2,
      wz: 3,
      parentId: 99,
      localOffsetX: 4,
      localOffsetY: 5,
    });
    applyEntityDelta(entity, {
      id: 1,
      jumpZ: null,
      jumpVZ: null,
      wz: null,
      parentId: null,
      localOffsetX: null,
      localOffsetY: null,
    });
    expect(entity.jumpZ).toBeUndefined();
    expect(entity.jumpVZ).toBeUndefined();
    expect(entity.wz).toBeUndefined();
    expect(entity.parentId).toBeUndefined();
    expect(entity.localOffsetX).toBeUndefined();
    expect(entity.localOffsetY).toBeUndefined();
  });

  it("sets noShadow field", () => {
    const entity = makeEntity();
    applyEntityDelta(entity, { id: 1, noShadow: true });
    expect(entity.noShadow).toBe(true);
  });

  it("removes noShadow field via null", () => {
    const entity = makeEntity({ noShadow: true });
    applyEntityDelta(entity, { id: 1, noShadow: null });
    expect(entity.noShadow).toBeUndefined();
  });
});

// ---- Roundtrip: diff then apply ----

describe("diff → apply roundtrip", () => {
  it("applying a diff to a clone of prev yields curr state", () => {
    const prev = makeSnapshot();
    const curr = makeSnapshot({
      position: { wx: 200, wy: 300 },
      velocity: { vx: 5, vy: -2 },
      spriteState: { direction: Direction.Right, moving: true, frameRow: 3, flipX: true },
      wanderAIState: { state: "walking", dirX: 1, dirY: 0 },
      flashHidden: true,
      jumpZ: 10,
    });
    const delta = assertDefined(diffEntitySnapshots(prev, curr));
    expect(delta).not.toBeNull();

    // Create an entity from "prev" state
    const entity = makeEntity({
      position: { ...prev.position },
      velocity: prev.velocity ? { ...prev.velocity } : null,
    });

    applyEntityDelta(entity, delta);

    expect(entity.position.wx).toBe(200);
    expect(entity.position.wy).toBe(300);
    expect(entity.velocity).toEqual({ vx: 5, vy: -2 });
    expect(entity.sprite?.direction).toBe(Direction.Right);
    expect(entity.sprite?.moving).toBe(true);
    expect(entity.sprite?.frameRow).toBe(3);
    expect(entity.sprite?.flipX).toBe(true);
    expect(entity.wanderAI?.state).toBe("walking");
    expect(entity.wanderAI?.dirX).toBe(1);
    expect(entity.flashHidden).toBe(true);
    expect(entity.jumpZ).toBe(10);
  });

  it("empty delta (no changes) is a no-op", () => {
    const snap = makeSnapshot({ jumpZ: 5, flashHidden: true });
    const delta = diffEntitySnapshots(snap, snap);
    expect(delta).toBeNull();
    // Applying null delta would be a no-op (caller skips when null)
  });

  it("survives JSON roundtrip (simulating wire transfer)", () => {
    const prev = makeSnapshot();
    const curr = makeSnapshot({
      position: { wx: 150, wy: 250 },
      spriteState: { direction: Direction.Up, moving: true, frameRow: 1 },
      deathTimer: 3.0,
    });
    const delta = assertDefined(diffEntitySnapshots(prev, curr));

    // Simulate JSON serialization (as happens over the wire)
    const wireDelta: EntityDelta = JSON.parse(JSON.stringify(delta));

    const entity = makeEntity();
    applyEntityDelta(entity, wireDelta);

    expect(entity.position.wx).toBe(150);
    expect(entity.sprite?.direction).toBe(Direction.Up);
    expect(entity.deathTimer).toBe(3.0);
  });

  it("sequential deltas accumulate correctly", () => {
    const snap1 = makeSnapshot();
    const snap2 = makeSnapshot({ position: { wx: 110, wy: 200 } });
    const snap3 = makeSnapshot({
      position: { wx: 120, wy: 210 },
      spriteState: { direction: Direction.Right, moving: true, frameRow: 3 },
    });

    const delta1 = assertDefined(diffEntitySnapshots(snap1, snap2));
    const delta2 = assertDefined(diffEntitySnapshots(snap2, snap3));

    const entity = makeEntity();
    applyEntityDelta(entity, delta1);
    expect(entity.position.wx).toBe(110);

    applyEntityDelta(entity, delta2);
    expect(entity.position.wx).toBe(120);
    expect(entity.position.wy).toBe(210);
    expect(entity.sprite?.direction).toBe(Direction.Right);
    expect(entity.sprite?.moving).toBe(true);
  });
});
