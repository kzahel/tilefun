import { describe, expect, it } from "vitest";
import type { Entity } from "../entities/Entity.js";
import { neutralSample } from "../input/SeatInput.js";
import { ClientSeat } from "./ClientSeat.js";
import type { SeatFrame } from "./DeviceSeats.js";
import { IDLE_FOLLOW_SECONDS, IdleFollow } from "./IdleFollow.js";

const DT = 1 / 60;
const seats = [new ClientSeat(0), new ClientSeat(1)];
const walking = { dx: 1, dy: 0, sprinting: false, jump: false };

function frames(active: Set<number>, extra: Partial<SeatFrame["situation"]> = {}): SeatFrame[] {
  return seats.map((seat) => ({
    seat,
    sample: active.has(seat.seat)
      ? { ...neutralSample(), manual: walking, steered: walking }
      : neutralSample(),
    situation: { vehicle: undefined, locked: false, steering: false, joystick: false, ...extra },
  }));
}

/** Seat 1 idles past the threshold while seat 0 walks. */
function idleSeatOne(follow: IdleFollow, at: Record<number, { wx: number; wy: number }>) {
  const ticks = Math.ceil(IDLE_FOLLOW_SECONDS / DT) + 1;
  for (let i = 0; i < ticks; i++) follow.steer(frames(new Set([0])), (seat) => at[seat], DT);
}

describe("IdleFollow", () => {
  it("leaves a seat alone until it has been idle for a minute", () => {
    const follow = new IdleFollow();
    const at = { 0: { wx: 200, wy: 0 }, 1: { wx: 0, wy: 0 } };
    for (let i = 0; i < (IDLE_FOLLOW_SECONDS - 1) / DT; i++) {
      const tick = frames(new Set([0]));
      follow.steer(tick, (seat) => at[seat as 0 | 1], DT);
      expect(tick[1]?.sample.steered.dx).toBe(0);
    }
    expect(follow.leaderOf(1)).toBeUndefined();
  });

  it("walks an idle seat toward the nearest active player and runs when far", () => {
    const follow = new IdleFollow();
    const at = { 0: { wx: 0, wy: 200 }, 1: { wx: 0, wy: 0 } };
    idleSeatOne(follow, at);
    const tick = frames(new Set([0]));
    follow.steer(tick, (seat) => at[seat as 0 | 1], DT);
    expect(follow.leaderOf(1)).toBe(0);
    expect(tick[1]?.sample.steered).toMatchObject({ dx: 0, dy: 1, sprinting: true });
    // The active seat's own input is untouched.
    expect(tick[0]?.sample.steered).toBe(walking);
  });

  it("stops close to the leader and starts again once it moves away", () => {
    const follow = new IdleFollow();
    const at = { 0: { wx: 20, wy: 0 }, 1: { wx: 0, wy: 0 } };
    idleSeatOne(follow, at);
    let tick = frames(new Set([0]));
    follow.steer(tick, (seat) => at[seat as 0 | 1], DT);
    expect(tick[1]?.sample.steered.dx).toBe(0);
    at[0].wx = 60;
    tick = frames(new Set([0]));
    follow.steer(tick, (seat) => at[seat as 0 | 1], DT);
    expect(tick[1]?.sample.steered).toMatchObject({ dx: 1, sprinting: false });
  });

  it("hands control back on any input", () => {
    const follow = new IdleFollow();
    const at = { 0: { wx: 200, wy: 0 }, 1: { wx: 0, wy: 0 } };
    idleSeatOne(follow, at);
    const tick = frames(new Set([0, 1]));
    follow.steer(tick, (seat) => at[seat as 0 | 1], DT);
    expect(follow.leaderOf(1)).toBeUndefined();
    expect(tick[1]?.sample.steered).toBe(walking);
  });

  it("hops when stuck against an obstacle", () => {
    const follow = new IdleFollow();
    const at = { 0: { wx: 200, wy: 0 }, 1: { wx: 0, wy: 0 } };
    idleSeatOne(follow, at);
    let jumped = false;
    for (let i = 0; i < 60 && !jumped; i++) {
      const tick = frames(new Set([0]));
      follow.steer(tick, (seat) => at[seat as 0 | 1], DT);
      jumped = !!tick[1]?.sample.jumpPressed;
    }
    expect(jumped).toBe(true);
  });

  it("does not count locked time or steer a seat in a vehicle", () => {
    const follow = new IdleFollow();
    const at = { 0: { wx: 200, wy: 0 }, 1: { wx: 0, wy: 0 } };
    for (let i = 0; i < (IDLE_FOLLOW_SECONDS + 5) / DT; i++)
      follow.steer(frames(new Set(), { locked: true }), (seat) => at[seat as 0 | 1], DT);
    expect(follow.leaderOf(1)).toBeUndefined();
    idleSeatOne(follow, at);
    const tick = frames(new Set([0]), { vehicle: { id: 9 } as Entity });
    follow.steer(tick, (seat) => at[seat as 0 | 1], DT);
    expect(tick[1]?.sample.steered.dx).toBe(0);
  });
});
