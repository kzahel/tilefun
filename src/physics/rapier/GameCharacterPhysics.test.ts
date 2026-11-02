import { beforeAll, expect, it } from "vitest";
import type { Entity } from "../../entities/Entity.js";
import { createPlayer } from "../../entities/Player.js";
import type { Prop } from "../../entities/Prop.js";
import type { Movement } from "../../input/ActionManager.js";
import { createFauna } from "../../wildlife/Fauna.js";
import { CollisionFlag } from "../../world/TileRegistry.js";
import { prepareCharacterPhysics } from "../CharacterPhysics.js";
import {
  getMovementPhysicsParams,
  type MovementPhysicsParams,
  stepPlayerFromInput,
} from "../PlayerMovement.js";
import { createMovementContext, createSurfaceSampler } from "../SimulationEnvironment.js";
import { characterShape } from "./CharacterShape.js";

const idle: Movement = { dx: 0, dy: 0, jump: false, sprinting: false };
beforeAll(() => prepareCharacterPhysics(1));
function fixture(
  mode: 0 | 1 | 2 = 1,
  props: Prop[] = [],
  x = 0,
  collision: (x: number, y: number) => number = () => 0,
) {
  const player = createPlayer(x, 32);
  player.id = 1;
  const entities: Entity[] = [player];
  const physics: MovementPhysicsParams = { ...getMovementPhysicsParams(), characterPhysics: mode };
  const queryEntities = () => entities,
    queryProps = () => props;
  const context = createMovementContext({
    getCollision: collision,
    getHeight: () => 0,
    queryEntities,
    queryProps,
    movingEntity: player,
    excludeIds: new Set([player.id]),
    noclip: false,
    pushBody: (before, after) => {
      Object.assign(before, after);
    },
  });
  const sample = createSurfaceSampler({ queryEntities, queryProps });
  let state = { jumpConsumed: false, lastJumpHeld: false };
  return {
    player,
    physics,
    entities,
    context,
    step(input = idle, dt = 1 / 60) {
      const result = stepPlayerFromInput(
        player,
        input,
        dt,
        context,
        () => 0,
        sample,
        state,
        physics,
      );
      state = result.jumpState;
      return result;
    },
  };
}
function wall(x: number): Prop {
  return {
    id: 1,
    type: "test",
    isProp: true,
    position: { wx: x, wy: 64 },
    sprite: { sheetKey: "", frameCol: 0, frameRow: 0, spriteWidth: 16, spriteHeight: 64 },
    walls: null,
    collider: { offsetX: 0, offsetY: 0, width: 16, height: 64 },
  };
}
it("retains normal acceleration/friction and 64px/s travel on flat ground", () => {
  const legacy = fixture(0),
    rapier = fixture(1);
  for (let tick = 0; tick < 120; tick++) {
    const input = tick < 60 ? { ...idle, dx: 1 } : idle;
    legacy.step(input);
    rapier.step(input);
    expect(rapier.player.position.wx).toBeCloseTo(legacy.player.position.wx, 1);
    expect(rapier.player.velocity?.vx).toBeCloseTo(legacy.player.velocity?.vx ?? 0, 2);
    expect(Math.abs(rapier.player.wz ?? 0)).toBeLessThan(0.1);
  }
});
it("keeps the anchored 10x6x12 box stable under facing changes and offers a capsule", () => {
  const game = fixture();
  const a = characterShape(game.player, "box");
  if (game.player.sprite) game.player.sprite.direction = 3;
  const b = characterShape(game.player, "box");
  expect(a.half).toEqual({ x: 5 / 16, y: 6 / 16, z: 3 / 16 });
  expect(b.center).toEqual(a.center);
  expect(b.half).toEqual(a.half);
  expect(characterShape(game.player, "capsule").descriptor.shape.type).not.toBe(
    a.descriptor.shape.type,
  );
});
it("uses exact box offset at a wall, including far-world local coordinates", () => {
  for (const origin of [0, 10000000]) {
    const game = fixture(1, [wall(origin + 64)], origin);
    for (let tick = 0; tick < 120; tick++) game.step({ ...idle, dx: 1 });
    expect(game.player.position.wx - origin).toBeCloseTo(51, 0);
    expect(game.player.position.wx - origin).toBeLessThan(51.1);
  }
  const capsule = fixture(2, [wall(64)]);
  for (let tick = 0; tick < 120; tick++) capsule.step({ ...idle, dx: 1 });
  expect(capsule.player.position.wx).toBeGreaterThan(52);
});
it("uses game gravity, short-jump settings, and preserved configuration changes", () => {
  const normal = fixture(),
    moon = fixture(),
    short = fixture();
  moon.physics.gravityScale = 0.5;
  short.physics.smallJumps = true;
  let high = 0,
    moonHigh = 0,
    shortHigh = 0;
  for (let tick = 0; tick < 150; tick++) {
    const input = { ...idle, jump: tick < 2 };
    normal.step(input);
    moon.step(input);
    short.step(input);
    high = Math.max(high, normal.player.wz ?? 0);
    moonHigh = Math.max(moonHigh, moon.player.wz ?? 0);
    shortHigh = Math.max(shortHigh, short.player.wz ?? 0);
  }
  expect(high).toBeGreaterThan(18);
  expect(moonHigh).toBeGreaterThan(high * 1.7);
  expect(shortHigh).toBeLessThan(high * 0.6);
  expect(normal.player.jumpVZ).toBeUndefined();
});
it("pushes an idle player without storing received motion as its input velocity", () => {
  const game = fixture();
  const other = createPlayer(16, 32);
  other.id = 2;
  game.entities.push(other);
  for (let tick = 0; tick < 60; tick++) game.step({ ...idle, dx: 1 });
  expect(other.position.wx).toBeGreaterThan(32);
  expect(other.velocity?.vx).toBe(0);
  for (let tick = 0; tick < 60; tick++) game.step();
  const settled = other.position.wx;
  for (let tick = 0; tick < 60; tick++) game.step();
  expect(other.position.wx).toBeCloseTo(settled, 1);
});

function slab(id: number, left: number, width: number, z: number, riseX = 0): Prop {
  return {
    ...wall(left + width / 2),
    id,
    position: { wx: left + width / 2, wy: 16 },
    collider: {
      offsetX: 0,
      offsetY: 0,
      width,
      height: 32,
      surface: {
        id: `s${id}`,
        spaceId: "bridge",
        z,
        riseX,
        riseY: 0,
        thickness: 4,
        connectsTo: [],
      },
    },
  };
}
it("climbs authored ramps and keeps bridge underside contacts distinct from its upper floor", () => {
  const props = [slab(1, 0, 64, 0, 32), slab(2, 64, 10000000, 32)];
  const upper = fixture(1, props, -12);
  upper.player.position.wy = 8;
  for (let tick = 0; tick < 140; tick++) upper.step({ ...idle, dx: 1 });
  expect(upper.player.position.wx).toBeGreaterThan(100);
  expect(upper.player.wz).toBeCloseTo(32, 0);
  const lower = fixture(1, props, 112);
  lower.player.position.wy = 8;
  let maximum = 0;
  for (let tick = 0; tick < 90; tick++) {
    lower.step({ ...idle, jump: tick < 2 });
    maximum = Math.max(maximum, lower.player.wz ?? 0);
  }
  expect(maximum).toBeGreaterThan(8);
  expect(maximum).toBeLessThan(16.2);
  expect(lower.player.wz).toBeCloseTo(0, 0);
});
it("fails closed at the query collider budget and leaves the next query usable", () => {
  const overloaded = fixture(
    1,
    Array.from({ length: 520 }, (_, i) => ({ ...wall(20), id: i + 1 })),
  );
  expect(() => overloaded.step({ ...idle, dx: 1 })).toThrow("collider budget");
  const next = fixture();
  next.step({ ...idle, dx: 1 });
  expect(next.player.position.wx).toBeGreaterThan(0);
});

it("uses the grounded recipient's shoreline rules when its pusher is airborne", () => {
  const game = fixture(1, [], 16.9, (x) => (x >= 2 ? CollisionFlag.Water : 0));
  game.player.wz = 0.2;
  game.player.jumpVZ = 0;
  const peer = createPlayer(27, 32);
  peer.id = 2;
  game.entities.push(peer);
  game.step({ ...idle, dx: 1 });
  expect(peer.position.wx).toBeLessThan(27.1);
});

it("keeps a passively stepped recipient grounded on its one-way support", () => {
  const platform = wall(40);
  if (!platform.collider) throw Error("Missing platform");
  Object.assign(platform.collider, {
    width: 16,
    zBase: 0,
    zHeight: 2,
    walkableTop: true,
    passable: true,
  });
  const game = fixture(1, [platform], 16.9);
  game.player.wz = 3;
  game.player.jumpVZ = 20;
  const peer = createPlayer(27, 32);
  peer.id = 2;
  game.entities.push(peer);
  game.step({ ...idle, dx: 1 });
  expect(peer.wz).toBeGreaterThan(1.5);
  expect(peer.groundZ).toBeCloseTo(peer.wz ?? 0, 1);
  expect(peer.jumpZ).toBe(0);
});

it("preserves exact excavated ramp planes for descent and return ascent", () => {
  const ramp = slab(1, 0, 96, 0, -48),
    floor = slab(2, 96, 96, -48);
  for (const prop of [ramp, floor])
    if (prop.collider?.surface) prop.collider.surface.excavation = {};
  const game = fixture(1, [ramp, floor], -12);
  game.player.position.wy = 8;
  for (let tick = 0; tick < 220 && game.player.position.wx < 132; tick++)
    game.step({ ...idle, dx: 1 });
  expect(game.player.position.wx).toBeGreaterThan(130);
  expect(game.player.wz).toBeCloseTo(-48, 0);
  for (let tick = 0; tick < 240 && game.player.position.wx > -16; tick++)
    game.step({ ...idle, dx: -1 });
  expect(game.player.position.wx).toBeLessThan(0);
  expect(game.player.wz).toBeCloseTo(0, 0);
});

it.each([false, true])(
  "clears passive flight state after admitted-time restoration on landing (roof=%s)",
  (roof) => {
    const game = fixture();
    const support = createPlayer(0, 32);
    support.id = 2;
    support.type = "vehicle-v1:compact-1";
    if (support.collider)
      Object.assign(support.collider, { width: 64, height: 32, physicalHeight: 16 });
    if (support.velocity) support.velocity.vx = 20;
    if (roof) game.entities.push(support);
    game.player.wz = (roof ? 16 : 0) + 0.1;
    game.player.jumpVZ = -2;
    game.player.airMomentumX = 80;
    game.player.airMomentumY = 0;
    if (game.player.velocity) game.player.velocity.vx = 80;
    game.context.takeAirMomentumDt = () => 0;
    const result = game.step();
    expect(result.outcome.landed).toBe(true);
    expect(game.player.airMomentumX).toBeUndefined();
    expect(game.player.airMomentumY).toBeUndefined();
    expect(game.player.velocity?.vx).toBeCloseTo(roof ? 60 : 80, 1);
  },
);

it("returns the actual wildlife support contact for mounting and landing effects", () => {
  const game = fixture();
  const horse = createFauna("horse", 0, 32);
  horse.id = 2;
  horse.wanderAI = null;
  game.entities.push(horse);
  game.player.wz = (horse.collider?.physicalHeight ?? 0) + 0.1;
  game.player.jumpVZ = -2;
  expect(game.step().outcome.wildlifeContactId).toBe(horse.id);
});

it("uses the movement collision policy for airborne ground metadata above water and one-way decks", () => {
  const deck = slab(3, -32, 64, 16);
  deck.position.wy = 48;
  if (!deck.collider) throw Error("Missing deck");
  deck.collider.passable = true;
  for (const props of [[], [deck]]) {
    const game = fixture(1, props, 0, () => CollisionFlag.Water);
    game.player.wz = 8;
    game.player.jumpVZ = -1;
    game.step();
    expect(game.player.groundZ).toBeCloseTo(0, 1);
    expect(game.player.jumpVZ).toBeDefined();
    expect(game.player.jumpZ).toBeGreaterThan(7);
  }
});

it("lands on a one-way deck when gravity reverses velocity at the jump apex", () => {
  const deck = slab(3, -32, 64, 16);
  deck.position.wy = 48;
  if (!deck.collider) throw Error("Missing deck");
  deck.collider.passable = true;
  const game = fixture(1, [deck]);
  game.player.wz = 16.05;
  game.player.jumpVZ = 1;
  expect(game.step().outcome.landed).toBe(true);
  expect(game.player.wz).toBeCloseTo(16, 1);
  expect(game.player.jumpVZ).toBeUndefined();
});
