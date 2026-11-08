import type { Entity } from "../entities/Entity.js";
import { updatePlayerSpriteFromInput } from "../entities/Player.js";
import type { MotionIntent, PhysicsBodyState } from "../physics/PhysicsState.js";
import {
  CONTROL_HOLD_TICKS,
  playerMotionIntent,
  vehicleMotionIntent,
} from "../physics/PlayerControls.js";
import type { Movement } from "../shared/Movement.js";

/**
 * Other local seats on one device, replayed by the same predictor as the
 * primary seat (tactical 226). Keyed by seat number; each reconcile resolves a
 * seat's controlled body (its vehicle or mount, else its own body) from the
 * stream's seat list, as authority does. All seats share one input sequence,
 * so one acknowledgement covers every seat's movement.
 */
export type SeatMovements = ReadonlyMap<number, Movement>;

/** Axis normalization shared by the primary seat and co-seats. */
export function normalizedMovement(movement: Movement): Movement {
  const length = movement.relativeDriving ? 1 : Math.max(1, Math.hypot(movement.dx, movement.dy));
  return { ...movement, dx: movement.dx / length, dy: movement.dy / length };
}

export function hasMovement(movement: Movement): boolean {
  return !!(movement.dx || movement.dy || movement.jump || movement.jumpPressed);
}

/** Per-replay held movement and jump edges for co-seats, mirroring the primary seat. */
export class SeatReplay {
  private readonly held = new Map<number, { movement: Movement; jumpHeld: boolean }>();
  private readonly pressed = new Set<number>();

  /** `snapshotJumpHeld` seeds a seat's jump state from the replayed snapshot. */
  constructor(private readonly snapshotJumpHeld: (seat: number) => boolean) {}

  /** One retained input became due; coalesce axes and keep jump press edges.
   * Every seat on the device is in every input, so an absent seat has left. */
  consume(seats: SeatMovements | undefined): void {
    for (const seat of this.held.keys())
      if (!seats?.has(seat)) {
        this.held.delete(seat);
        this.pressed.delete(seat);
      }
    for (const [seat, movement] of seats ?? []) {
      const jumpHeld = this.held.get(seat)?.jumpHeld ?? this.snapshotJumpHeld(seat);
      if (movement.jumpPressed === true || (movement.jump && !jumpHeld)) this.pressed.add(seat);
      this.held.set(seat, { movement, jumpHeld: movement.jump });
    }
  }

  /** Movement to apply on this replay step, if any seat is held; press edges apply once. */
  take(): Map<number, Movement> | undefined {
    if (!this.held.size) return undefined;
    const due = new Map<number, Movement>();
    for (const [seat, held] of this.held)
      due.set(seat, { ...held.movement, jumpPressed: this.pressed.has(seat) });
    this.pressed.clear();
    return due;
  }
}

/** Each co-seat's controlled body: the seat's parent (vehicle or mount) or its own body. */
export function seatBodies(
  seats: ReadonlyMap<number, number> | undefined,
  entities: readonly Entity[],
): Map<number, number> {
  const bodies = new Map<number, number>();
  for (const [seat, entityId] of seats ?? []) {
    if (seat === 0) continue; // The primary seat resolves its own body.
    const entity = entities.find((e) => e.id === entityId);
    if (entity) bodies.set(seat, entity.parentId ?? entity.id);
  }
  return bodies;
}

type Offset = { x: number; y: number; z: number };
type BodyStates = { bodyState(id: number): Readonly<PhysicsBodyState> | undefined };
const NO_OFFSET: Offset = { x: 0, y: 0, z: 0 };
/** Same easing and relocation limit as the primary seat's display correction. */
const EASE_SECONDS = 0.06;
const RELOCATION = 32;

/**
 * The predictor's co-seats (226): which seats the latest input carried, the body
 * each controls at the replayed snapshot, and each body's own display correction
 * while it is outside the primary seat's contact group (inside it, the body shares
 * the primary's correction).
 */
export class CoSeats {
  private keys = new Set<number>();
  private bodies: ReadonlyMap<number, number> = new Map();
  private readonly errors = new Map<number, Offset & { at: number }>();

  constructor(private readonly clock: () => number) {}

  clear(): void {
    this.keys.clear();
    this.bodies = new Map();
    this.errors.clear();
  }

  /** Record the seats a stored input carries; returns their normalized movement. */
  store(seats: SeatMovements | undefined): SeatMovements | undefined {
    this.keys = new Set(seats?.keys() ?? []);
    if (!seats?.size) return undefined;
    return new Map([...seats].map(([seat, movement]) => [seat, normalizedMovement(movement)]));
  }

  /** Bodies the latest input's co-seats control at the replayed snapshot. */
  bodyIds(): number[] {
    const ids: number[] = [];
    for (const seat of this.keys) {
      const id = this.bodies.get(seat);
      if (id !== undefined) ids.push(id);
    }
    return ids;
  }

  /** A replay restores `state`: co-seats now control the bodies it resolved. */
  replay(bodies: ReadonlyMap<number, number>, states: readonly PhysicsBodyState[]): SeatReplay {
    this.bodies = bodies;
    return new SeatReplay(
      (seat) => states.find((b) => b.id === bodies.get(seat))?.jumpHeld ?? false,
    );
  }

  /**
   * Co-seats riding a body presented here (an animal; riders in cars are hidden)
   * are drawn at that body's presented pose plus their seat offset and lift, as
   * seat 0's rider is, rather than at their buffered pose behind it. `keep` holds
   * the poses a replay keeps showing.
   */
  presentRiders(
    presented: Entity[],
    buffered: readonly Entity[],
    keep: Map<number, Entity>,
  ): Entity[] {
    const bodies = new Set(this.bodyIds());
    if (!bodies.size) return presented;
    const shown = new Map(presented.map((entity) => [entity.id, entity]));
    return presented.map((rider) => {
      const parentId = rider.parentId;
      const parent =
        parentId !== undefined && bodies.has(parentId) ? shown.get(parentId) : undefined;
      const under = parent && buffered.find((entity) => entity.id === parentId);
      if (!parent || !under || parent === under) return rider;
      const position = {
        wx: parent.position.wx + (rider.localOffsetX ?? 0),
        wy: parent.position.wy + (rider.localOffsetY ?? 0),
      };
      const wz = (parent.wz ?? 0) + (rider.wz ?? 0) - (under.wz ?? 0);
      const placed = { ...rider, position, prevPosition: position, wz, prevWz: wz };
      keep.set(rider.id, placed);
      return placed;
    });
  }

  /** Set each co-seat's motor intent for the next fixed step. */
  intents(
    seats: SeatMovements | undefined,
    bodies: ReadonlyMap<number, Entity>,
    intents: Map<number, MotionIntent>,
    physicsTick: number,
  ): void {
    for (const [seat, movement] of seats ?? []) {
      const body = bodies.get(this.bodies.get(seat) ?? -1);
      if (!body) continue;
      const vehicle = body.type.startsWith("vehicle-v1:");
      const intent = vehicle ? vehicleMotionIntent(body, movement) : playerMotionIntent(movement);
      intents.set(body.id, { ...intent, controlUntil: physicsTick + CONTROL_HOLD_TICKS });
      if (!vehicle) updatePlayerSpriteFromInput(body, movement);
    }
  }

  /**
   * After a replay commits: each co-seat body's correction at the committed tick
   * (the pose shown before versus the replayed pose then). A body outside the
   * primary's contact group keeps it as its own easing display error.
   */
  settle(
    before: ReadonlyMap<number, Entity>,
    compared: ReadonlyMap<number, { x: number; y: number; z: number }> | undefined,
    sharedWithPrimary: ReadonlySet<number>,
  ): Map<number, number> {
    const corrections = new Map<number, number>();
    const ids = new Set(this.bodyIds());
    for (const id of this.errors.keys()) if (!ids.has(id)) this.errors.delete(id);
    for (const id of ids) {
      const shown = before.get(id),
        replayed = compared?.get(id);
      if (!shown || !replayed) {
        this.errors.delete(id);
        continue;
      }
      const x = shown.position.wx - replayed.x,
        y = shown.position.wy - replayed.y,
        z = (shown.wz ?? 0) - replayed.z;
      corrections.set(id, Math.hypot(x, y, z));
      if (sharedWithPrimary.has(id)) {
        this.errors.delete(id);
        continue;
      }
      const kept = this.decayed(id);
      const error = { x: x + kept.x, y: y + kept.y, z: z + kept.z };
      const relocated = Math.hypot(error.x, error.y, error.z) >= RELOCATION;
      this.errors.set(id, { ...(relocated ? NO_OFFSET : error), at: this.clock() });
    }
    return corrections;
  }

  /** A co-seat body's easing display offset; never lifts a body off its solved floor. */
  offset(id: number, scene: BodyStates): Offset | undefined {
    if (!this.errors.has(id)) return undefined;
    const error = this.decayed(id);
    const state = scene.bodyState(id);
    const floored = !!state?.grounded && state.supportId === undefined;
    return floored ? { ...error, z: 0 } : error;
  }

  /** Any co-seat body still moving, airborne or carried keeps prediction presented. */
  moving(published: ReadonlyMap<number, Entity>, scene: BodyStates | undefined): boolean {
    return this.bodyIds().some((id) => {
      const body = published.get(id);
      return (
        !!body &&
        (body.jumpVZ !== undefined ||
          Math.hypot(body.velocity?.vx ?? 0, body.velocity?.vy ?? 0) > 2 ||
          scene?.bodyState(id)?.supportId !== undefined)
      );
    });
  }

  private decayed(id: number): Offset {
    const error = this.errors.get(id);
    if (!error) return NO_OFFSET;
    const decay = Math.exp(-Math.max(0, this.clock() - error.at) / EASE_SECONDS);
    return { x: error.x * decay, y: error.y * decay, z: error.z * decay };
  }
}
