import { describe, expect, it } from "vitest";
import type { Entity } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { CONTROL_HOLD_TICKS, vehicleMotionIntent } from "../physics/PlayerControls.js";
import type { Movement } from "../shared/Movement.js";
import { createVehicle } from "../traffic/Vehicle.js";
import { CoSeats, SeatReplay, seatBodies } from "./SeatInputs.js";

const move = (dx: number, jump = false): Movement => ({ dx, dy: 0, sprinting: false, jump });

describe("SeatReplay", () => {
  it("coalesces due inputs to the latest axes but keeps a jump press edge once", () => {
    const replay = new SeatReplay(() => false);
    replay.consume(new Map([[7, move(1, true)]]));
    replay.consume(new Map([[7, move(-1, true)]]));
    expect(replay.take()?.get(7)).toMatchObject({ dx: -1, jump: true, jumpPressed: true });
    expect(replay.take()?.get(7)).toMatchObject({ dx: -1, jumpPressed: false });
  });

  it("seeds jump state from the snapshot so a held jump is not a new press", () => {
    const replay = new SeatReplay((id) => id === 7);
    replay.consume(new Map([[7, move(0, true)]]));
    expect(replay.take()?.get(7)?.jumpPressed).toBe(false);
  });

  it("stops holding a seat that leaves the device's input and drops its press", () => {
    const replay = new SeatReplay(() => false);
    replay.consume(new Map([[7, move(1)]]));
    replay.consume(new Map([[8, move(0, true)]]));
    replay.consume(new Map([[9, move(1)]]));
    expect([...(replay.take()?.keys() ?? [])]).toEqual([9]);
    replay.consume(undefined);
    expect(replay.take()).toBeUndefined();
    replay.consume(new Map([[8, move(0)]]));
    expect(replay.take()?.get(8)?.jumpPressed).toBe(false);
  });
});

const body = (id: number, extra: Partial<Entity> = {}): Entity => ({
  ...createPlayer(0, 0),
  id,
  ...extra,
});
const at = (x: number, y = 0, z = 0) => ({ x, y, z });

describe("seatBodies", () => {
  it("resolves each guest's controlled body by the parent rule, from the stream's seat list", () => {
    const entities = [body(4), body(5, { parentId: 9 }), body(9)];
    // Seat 0 is the primary; seat 3 is in no frame (another realm), so its old id
    // in this realm cannot be mistaken for its body.
    const seats = new Map([
      [0, 4],
      [1, 5],
      [2, 77],
    ]);
    expect(seatBodies(seats, entities)).toEqual(new Map([[1, 9]]));
    expect(seatBodies(undefined, entities)).toEqual(new Map());
  });
});

describe("CoSeats", () => {
  const scene = (
    states: Record<number, Partial<{ grounded: boolean; supportId: number }>> = {},
  ) => ({
    bodyState: (id: number) => states[id] as never,
  });

  it("applies each seat's movement to the body it controls at the replayed snapshot", () => {
    const seats = new CoSeats(() => 0);
    const replay = seats.replay(new Map([[1, 5]]), [{ id: 5, jumpHeld: true } as never]);
    const intents = new Map();
    const walking = body(5);
    seats.intents(
      new Map([
        [1, move(1)],
        [2, move(-1)],
      ]),
      new Map([[5, walking]]),
      intents,
      10,
    );
    expect([...intents.keys()]).toEqual([5]); // seat 2 resolves to no body
    expect(intents.get(5)).toMatchObject({ controlUntil: 10 + CONTROL_HOLD_TICKS });
    // The snapshot's held jump seeds the seat's replay: holding it is no new press.
    replay.consume(new Map([[1, move(0, true)]]));
    expect(replay.take()?.get(1)?.jumpPressed).toBe(false);
  });

  it("stores each seat's movement normalized like the primary's", () => {
    const seats = new CoSeats(() => 0);
    const diagonal = { ...move(1), dy: 1 };
    const stored = seats.store(new Map([[1, diagonal]]))?.get(1);
    expect(stored?.dx).toBeCloseTo(Math.SQRT1_2, 12);
    expect(stored?.dy).toBeCloseTo(Math.SQRT1_2, 12);
    // Relative car steering keeps its raw axes.
    const steering = { ...diagonal, relativeDriving: true };
    expect(seats.store(new Map([[1, steering]]))?.get(1)).toMatchObject({ dx: 1, dy: 1 });
    expect(seats.store(new Map())).toBeUndefined();
  });

  it("follows a mount change: a later snapshot moves the seat onto its vehicle", () => {
    const seats = new CoSeats(() => 0);
    seats.store(new Map([[1, move(1)]]));
    seats.replay(new Map([[1, 5]]), []);
    expect(seats.bodyIds()).toEqual([5]);
    seats.replay(new Map([[1, 9]]), []);
    expect(seats.bodyIds()).toEqual([9]);
    const car = { ...createVehicle("compact-1", 0, 0), id: 9 };
    const intents = new Map();
    seats.intents(new Map([[1, move(1)]]), new Map([[9, car]]), intents, 0);
    expect(intents.get(9)).toEqual({
      ...vehicleMotionIntent(car, move(1)),
      controlUntil: CONTROL_HOLD_TICKS,
    });
    // A seat the latest input no longer carries has left.
    seats.store(undefined);
    expect(seats.bodyIds()).toEqual([]);
  });

  it("eases a co-seat's own correction outside the primary's contact group", () => {
    let now = 0;
    const seats = new CoSeats(() => now);
    seats.store(
      new Map([
        [1, move(1)],
        [2, move(1)],
      ]),
    );
    seats.replay(
      new Map([
        [1, 5],
        [2, 6],
      ]),
      [],
    );
    const before = new Map([
      [5, body(5, { position: { wx: 10, wy: 0 }, wz: 2 })],
      [6, body(6, { position: { wx: 20, wy: 0 } })],
    ]);
    const corrections = seats.settle(
      before,
      new Map([
        [5, at(7, 0, 0)],
        [6, at(18)],
      ]),
      new Set([6]),
    );
    expect(corrections).toEqual(
      new Map([
        [5, Math.hypot(3, 2)],
        [6, 2],
      ]),
    );
    // Seat 1 keeps its own easing offset; seat 2 shares the primary's correction.
    expect(seats.offset(5, scene())).toEqual({ x: 3, y: 0, z: 2 });
    expect(seats.offset(6, scene())).toBeUndefined();
    // Never lifted off a solved floor; it decays and is retained into the next commit.
    expect(seats.offset(5, scene({ 5: { grounded: true } }))).toEqual({ x: 3, y: 0, z: 0 });
    now = 0.06;
    expect(seats.offset(5, scene())?.x).toBeCloseTo(3 / Math.E, 9);
    seats.settle(
      new Map([[5, body(5, { position: { wx: 7, wy: 0 } })]]),
      new Map([[5, at(6)]]),
      new Set(),
    );
    expect(seats.offset(5, scene())?.x).toBeCloseTo(1 + 3 / Math.E, 9);
    // A relocation (32 px or more) snaps; a body missing from either pose has none.
    seats.settle(
      new Map([[5, body(5, { position: { wx: 50, wy: 0 } })]]),
      new Map([[5, at(0)]]),
      new Set(),
    );
    expect(seats.offset(5, scene())).toEqual({ x: 0, y: 0, z: 0 });
    seats.settle(new Map(), new Map([[5, at(0)]]), new Set());
    expect(seats.offset(5, scene())).toBeUndefined();
    // A seat that left takes its offset with it.
    seats.settle(
      new Map([[5, body(5, { position: { wx: 8, wy: 0 } })]]),
      new Map([[5, at(6)]]),
      new Set(),
    );
    seats.store(new Map([[2, move(1)]]));
    seats.settle(new Map(), undefined, new Set());
    expect(seats.offset(5, scene())).toBeUndefined();
  });

  it("keeps prediction presented while any co-seat body moves, jumps or rides", () => {
    const seats = new CoSeats(() => 0);
    seats.store(new Map([[1, move(0)]]));
    seats.replay(new Map([[1, 5]]), []);
    const still = new Map([[5, body(5, { velocity: { vx: 1, vy: 1 } })]]);
    expect(seats.moving(still, scene())).toBe(false);
    expect(seats.moving(new Map([[5, body(5, { velocity: { vx: 3, vy: 0 } })]]), scene())).toBe(
      true,
    );
    expect(seats.moving(new Map([[5, body(5, { jumpVZ: 1 })]]), scene())).toBe(true);
    expect(seats.moving(still, scene({ 5: { supportId: 2 } }))).toBe(true);
    expect(seats.moving(new Map(), undefined)).toBe(false);
  });
});
