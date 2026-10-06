import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { createPlayer } from "../entities/Player.js";
import type { Movement } from "../input/ActionManager.js";
import { createTrainCarriages } from "../railway/Train.js";
import { roofSupport } from "../traffic/RoofSupport.js";
import type { MovementContext } from "./MovementContext.js";
import { getMovementPhysicsParams, stepPlayerFromInput } from "./PlayerMovement.js";
import type { PropSurface } from "./surfaceHeight.js";

const idle: Movement = { dx: 0, dy: 0, jump: false, sprinting: false };
function fixture(hz = 60, vx = 192, platformerAir = true, startX = 0) {
  const roofs = createTrainCarriages(0, 80, [0, 0, 0]);
  roofs.forEach((e, i) => {
    e.id = i + 2;
    e.velocity = { vx, vy: 0 };
  });
  const player = createPlayer(startX, 80);
  player.id = 1;
  player.wz = player.groundZ = 44;
  let state = { jumpConsumed: false, lastJumpHeld: false };
  const physics = { ...getMovementPhysicsParams(), platformerAir };
  const ctx: MovementContext = {
    getCollision: () => 0,
    getHeight: () => 0,
    isEntityBlocked: () => false,
    isPropBlocked: () => false,
    noclip: false,
    deferRoofCarry: true,
  };
  const props: PropSurface[] = [];
  const step = (input: Movement) => {
    const support = roofSupport(player, roofs);
    for (const e of roofs) e.position.wx += required(e.velocity).vx / hz;
    if (support) player.position.wx += required(support.velocity).vx / hz;
    const result = stepPlayerFromInput(
      player,
      input,
      1 / hz,
      ctx,
      () => 0,
      () => ({ props, entities: roofs }),
      state,
      physics,
    );
    state = result.jumpState;
    return result;
  };
  return { player, roofs, ctx, props, step };
}

for (const hz of [30, 60]) {
  for (const vx of [-192, 192]) {
    it(`keeps passive momentum throughout an idle flight (${hz}Hz, ${vx}px/s)`, () => {
      const f = fixture(hz, vx);
      f.step({ ...idle, jump: true });
      let airborne = 0;
      while (f.player.jumpVZ !== undefined && airborne++ < hz * 2) {
        expect(f.player.velocity?.vx).toBeCloseTo(vx, 8);
        f.step({ ...idle, jump: true });
      }
      expect(airborne).toBeGreaterThan(hz / 3);
      expect(roofSupport(f.player, f.roofs)?.id).toBe(3);
      expect(f.player.velocity?.vx).toBeCloseTo(0, 8);
      // A second jump must not stack the previous train contribution.
      f.step(idle);
      f.step({ ...idle, jump: true });
      expect(f.player.velocity?.vx).toBeCloseTo(vx, 8);
    });
  }
  it(`reverses and releases steering around the departure velocity (${hz}Hz)`, () => {
    const f = fixture(hz);
    f.step({ ...idle, dx: 1, jump: true });
    f.step({ ...idle, dx: 1, jump: true });
    expect(f.player.velocity?.vx).toBeCloseTo(256, 8);
    // The departed platform can brake/turn without changing the airborne baseline.
    for (const roof of f.roofs) roof.velocity = { vx: -20, vy: 10 };
    f.step({ ...idle, dx: -1, jump: true });
    expect(f.player.velocity?.vx).toBeCloseTo(128, 8);
    f.step({ ...idle, jump: true });
    expect(f.player.velocity?.vx).toBeCloseTo(192, 8);
  });
  for (const dx of [-1, 1]) {
    it(`lands across the native carriage gap (${hz}Hz, direction ${dx})`, () => {
      const f = fixture(hz, 192, true, dx === 1 ? 60 : 98);
      f.step({ ...idle, dx, jump: true });
      for (let i = 0; i < hz * 2 && f.player.jumpVZ !== undefined; i++) {
        f.step({ ...idle, dx, jump: true });
        if (f.player.jumpVZ !== undefined)
          expect(f.player.velocity?.vx).toBeCloseTo(192 + dx * 64, 8);
      }
      expect(f.player.jumpVZ).toBeUndefined();
      expect(roofSupport(f.player, f.roofs)?.id).toBe(dx === 1 ? 4 : 3);
      expect(f.player.velocity?.vx).toBeCloseTo(dx * 64, 8);
    });
  }
}

it("clips blocked inherited momentum while preserving tangential motion", () => {
  const f = fixture(60, 192, false);
  f.step({ ...idle, jump: true });
  f.ctx.isEntityBlocked = (box) => box.right > f.player.position.wx + 6;
  f.step({ ...idle, dy: 1, jump: true });
  expect(f.player.velocity?.vx).toBe(0);
  expect(f.player.velocity?.vy).toBeGreaterThan(0);
  f.ctx.isEntityBlocked = () => false;
  f.step({ ...idle, dy: 1, jump: true });
  expect(f.player.velocity?.vx).toBe(0);
});

it("retains the Quake air-movement option's whole-velocity behavior", () => {
  const f = fixture(60, 192, false);
  f.step({ ...idle, jump: true });
  for (let i = 0; i < 10; i++) f.step({ ...idle, jump: true });
  expect(f.player.velocity?.vx).toBeCloseTo(192, 8);
});

it("retains ordinary platformer direction reversal on a stationary surface", () => {
  const f = fixture(60, 0);
  f.step({ ...idle, dx: 1, jump: true });
  f.step({ ...idle, dx: -1, jump: true });
  expect(f.player.velocity?.vx).toBe(-64);
});

it("inherits walk-off momentum once and keeps it during the fall", () => {
  const f = fixture(60, 192, true, 241);
  for (let i = 0; i < 20 && f.player.jumpVZ === undefined; i++) f.step({ ...idle, dx: 1 });
  expect(f.player.jumpVZ).toBeDefined();
  for (let i = 0; i < 5; i++) {
    f.step({ ...idle, dx: -1 });
    expect(f.player.velocity?.vx).toBe(128);
  }
});

it("inherits the new roof once for a jump buffered during landing", () => {
  const f = fixture();
  f.step({ ...idle, jump: true });
  f.step(idle); // Release while airborne, then hold a new jump through landing.
  for (let i = 0; i < 45; i++) {
    const result = f.step({ ...idle, jump: true });
    if (!result.outcome.landed) continue;
    expect(f.player.jumpVZ).toBeGreaterThan(0);
    expect(f.player.velocity?.vx).toBe(192);
    return;
  }
  throw new Error("Did not observe buffered landing jump");
});

it("keeps horizontal momentum when a ceiling stops ascent", () => {
  const f = fixture();
  f.props.push({
    position: { wx: 100, wy: 160 },
    walls: null,
    collider: {
      offsetX: 0,
      offsetY: 0,
      width: 600,
      height: 200,
      surface: {
        id: "ceiling",
        spaceId: "roof",
        z: 68,
        riseX: 0,
        riseY: 0,
        thickness: 4,
        connectsTo: [],
      },
    },
  });
  f.step({ ...idle, jump: true });
  for (let i = 0; i < 8 && (f.player.jumpVZ ?? 0) > 0; i++) f.step({ ...idle, jump: true });
  expect(f.player.jumpVZ).toBe(0);
  expect(f.player.velocity?.vx).toBe(192);
  expect(f.player.airMomentumX).toBe(192);
});

it("clears passive flight state when entering noclip", () => {
  const f = fixture();
  f.step({ ...idle, jump: true });
  expect(f.player.airMomentumX).toBe(192);
  f.ctx.noclip = true;
  f.step(idle);
  expect(f.player.airMomentumX).toBeUndefined();
  expect(f.player.airMomentumY).toBeUndefined();
});
