import { TILE_SIZE } from "../config/constants.js";
import type { SeatSample } from "../input/SeatComposer.js";
import type { Movement } from "../shared/Movement.js";
import type { SeatFrame } from "./DeviceSeats.js";

/** Seconds without any input before a shared-screen seat starts following. */
export const IDLE_FOLLOW_SECONDS = 60;
/** A follower sets off when its leader is farther than this… */
const START_DISTANCE = TILE_SIZE * 2.5;
/** …and stops once it is this close. */
const STOP_DISTANCE = TILE_SIZE * 1.5;
/** Farther than this, the follower runs. */
const SPRINT_DISTANCE = TILE_SIZE * 6;
/** Seconds without getting closer before a stuck follower hops. */
const STALL_JUMP_SECONDS = 0.5;
/** Seconds without getting closer after a hop before it sidesteps. */
const STALL_SIDESTEP_SECONDS = 1.2;
/** How long a sidestep lasts. */
const SIDESTEP_SECONDS = 0.6;

interface Point {
  wx: number;
  wy: number;
}

interface Leader {
  seat: number;
  at: Point;
}

function nearestLeader(leaders: readonly Leader[], at: Point) {
  let nearest: (Leader & { distance: number }) | undefined;
  for (const leader of leaders) {
    const distance = Math.hypot(leader.at.wx - at.wx, leader.at.wy - at.wy);
    if (!nearest || distance < nearest.distance) nearest = { ...leader, distance };
  }
  return nearest;
}

interface SeatIdle {
  idle: number;
  moving: boolean;
  best: number;
  stalled: number;
  jumped: boolean;
  sidestep: number;
  side: 1 | -1;
}

function active(sample: SeatSample): boolean {
  const { manual, steered } = sample;
  return (
    !!manual.dx ||
    !!manual.dy ||
    !!steered.dx ||
    !!steered.dy ||
    manual.sprinting ||
    manual.jump ||
    sample.jumpPressed ||
    sample.use ||
    sample.honk ||
    sample.hornPressed ||
    sample.lights ||
    sample.style ||
    sample.reverse
  );
}

/**
 * Shared-screen idle follow: a seat whose player has touched nothing for
 * `IDLE_FOLLOW_SECONDS` walks after the nearest active player, as an NPC
 * companion would, until its player presses anything again. Client intent only:
 * the follower's synthesized sample becomes an ordinary command, so prediction and
 * authority need nothing new. A follower in a vehicle, or with nobody active to
 * follow, stays put.
 */
export class IdleFollow {
  private readonly seats = new Map<number, SeatIdle>();
  private readonly leaders = new Map<number, number>();

  /** The seat this seat is following now, if it is following. */
  leaderOf(seat: number): number | undefined {
    return this.leaders.get(seat);
  }

  /** Forget every timer (split screen, a new play scene). */
  reset(): void {
    this.seats.clear();
    this.leaders.clear();
  }

  /**
   * Count idle time and steer followers: `frames` are this device tick's seat frames
   * (seat 0 first); a follower's sample is replaced in place. `position` finds a
   * seat's controlled body. A locked tick (menus, travel) neither counts nor steers.
   */
  steer(frames: SeatFrame[], position: (seat: number) => Point | undefined, dt: number): void {
    const present = new Set(frames.map((frame) => frame.seat.seat));
    for (const seat of this.seats.keys()) if (!present.has(seat)) this.seats.delete(seat);
    this.leaders.clear();
    if (frames.length < 2) {
      this.reset();
      return;
    }
    for (const { seat, sample, situation } of frames) {
      const state = this.state(seat.seat);
      if (active(sample)) {
        Object.assign(state, this.fresh());
      } else if (!situation.locked) state.idle += dt;
    }
    const idle = (seat: number) => (this.seats.get(seat)?.idle ?? 0) >= IDLE_FOLLOW_SECONDS;
    const leaders = frames
      .filter((frame) => !idle(frame.seat.seat))
      .map((frame) => ({ seat: frame.seat.seat, at: position(frame.seat.seat) }))
      .filter((leader): leader is Leader => !!leader.at);
    for (const frame of frames) {
      const seat = frame.seat.seat;
      if (!idle(seat)) continue;
      const at = position(seat);
      if (!at) continue;
      const nearest = nearestLeader(leaders, at);
      if (!nearest) continue;
      this.leaders.set(seat, nearest.seat);
      if (frame.situation.locked || frame.situation.vehicle) continue;
      const movement = this.follow(this.state(seat), at, nearest.at, nearest.distance, dt);
      if (movement)
        frame.sample = {
          ...frame.sample,
          manual: movement,
          steered: movement,
          jumpPressed: movement.jump,
        };
    }
  }

  private follow(
    state: SeatIdle,
    at: Point,
    target: Point,
    distance: number,
    dt: number,
  ): Movement | undefined {
    if (distance > START_DISTANCE) state.moving = true;
    if (distance <= STOP_DISTANCE || !state.moving) {
      state.moving = false;
      state.best = Infinity;
      state.stalled = 0;
      state.jumped = false;
      return undefined;
    }
    if (distance < state.best - 0.5) {
      state.best = distance;
      state.stalled = 0;
      state.jumped = false;
    } else state.stalled += dt;
    let dx = (target.wx - at.wx) / distance,
      dy = (target.wy - at.wy) / distance;
    let jump = false;
    if (state.sidestep > 0) {
      state.sidestep -= dt;
      // Perpendicular, leaning slightly toward the leader.
      [dx, dy] = [-dy * state.side + dx * 0.3, dx * state.side + dy * 0.3];
      const length = Math.hypot(dx, dy);
      dx /= length;
      dy /= length;
    } else if (!state.jumped && state.stalled >= STALL_JUMP_SECONDS) {
      jump = true;
      state.jumped = true;
    } else if (state.stalled >= STALL_SIDESTEP_SECONDS) {
      state.sidestep = SIDESTEP_SECONDS;
      state.side = state.side === 1 ? -1 : 1;
      state.stalled = 0;
      state.best = Infinity;
      state.jumped = false;
    }
    return { dx, dy, sprinting: distance > SPRINT_DISTANCE, jump };
  }

  private state(seat: number): SeatIdle {
    let state = this.seats.get(seat);
    if (!state) {
      state = this.fresh();
      this.seats.set(seat, state);
    }
    return state;
  }

  private fresh(): SeatIdle {
    return {
      idle: 0,
      moving: false,
      best: Infinity,
      stalled: 0,
      jumped: false,
      sidestep: 0,
      side: 1,
    };
  }
}
