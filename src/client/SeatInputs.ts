import type { Entity } from "../entities/Entity.js";
import { updatePlayerSpriteFromInput } from "../entities/Player.js";
import type { MotionIntent } from "../physics/PhysicsState.js";
import {
  CONTROL_HOLD_TICKS,
  playerMotionIntent,
  vehicleMotionIntent,
} from "../physics/PlayerControls.js";
import type { Movement } from "../shared/Movement.js";

/**
 * Other local seats on one device, replayed by the same predictor as the
 * primary seat (tactical 226). Keyed by each seat's controlled body id: the
 * seat's own body on foot, or the vehicle it drives. All seats share one input
 * sequence, so one acknowledgement covers every seat's movement.
 */
export type SeatMovements = ReadonlyMap<number, Movement>;

/** Axis normalization shared by the primary seat and co-seats. */
export function normalizedMovement(movement: Movement): Movement {
  const length = movement.relativeDriving ? 1 : Math.max(1, Math.hypot(movement.dx, movement.dy));
  return { ...movement, dx: movement.dx / length, dy: movement.dy / length };
}

export function normalizedSeats(seats: SeatMovements | undefined): SeatMovements | undefined {
  if (!seats?.size) return undefined;
  return new Map([...seats].map(([id, movement]) => [id, normalizedMovement(movement)]));
}

export function hasMovement(movement: Movement): boolean {
  return !!(movement.dx || movement.dy || movement.jump || movement.jumpPressed);
}

/** Per-replay held movement and jump edges for co-seats, mirroring the primary seat. */
export class SeatReplay {
  private readonly held = new Map<number, { movement: Movement; jumpHeld: boolean }>();
  private readonly pressed = new Set<number>();

  /** `snapshotJumpHeld` seeds a seat's jump state from the replayed snapshot. */
  constructor(private readonly snapshotJumpHeld: (id: number) => boolean) {}

  /** One retained input became due; coalesce axes and keep jump press edges.
   * Every seat on the device is in every input, so an absent seat has left. */
  consume(seats: SeatMovements | undefined): void {
    for (const id of this.held.keys())
      if (!seats?.has(id)) {
        this.held.delete(id);
        this.pressed.delete(id);
      }
    for (const [id, movement] of seats ?? []) {
      const jumpHeld = this.held.get(id)?.jumpHeld ?? this.snapshotJumpHeld(id);
      if (movement.jumpPressed === true || (movement.jump && !jumpHeld)) this.pressed.add(id);
      this.held.set(id, { movement, jumpHeld: movement.jump });
    }
  }

  /** Movement to apply on this replay step, if any seat is held; press edges apply once. */
  take(): Map<number, Movement> | undefined {
    if (!this.held.size) return undefined;
    const due = new Map<number, Movement>();
    for (const [id, held] of this.held)
      due.set(id, { ...held.movement, jumpPressed: this.pressed.has(id) });
    this.pressed.clear();
    return due;
  }
}

/** Set each co-seat's motor intent for the next fixed step. */
export function applySeatIntents(
  seats: SeatMovements | undefined,
  bodies: ReadonlyMap<number, Entity>,
  intents: Map<number, MotionIntent>,
  physicsTick: number,
): void {
  for (const [id, movement] of seats ?? []) {
    const body = bodies.get(id);
    if (!body) continue;
    const vehicle = body.type.startsWith("vehicle-v1:");
    const intent = vehicle ? vehicleMotionIntent(body, movement) : playerMotionIntent(movement);
    intents.set(id, { ...intent, controlUntil: physicsTick + CONTROL_HOLD_TICKS });
    if (!vehicle) updatePlayerSpriteFromInput(body, movement);
  }
}

/** Each co-seat's correction at the committed physics tick: the pose shown before
 * reconciliation versus the replayed pose at that same tick. */
export function seatCorrections(
  ids: Iterable<number>,
  before: ReadonlyMap<number, Entity>,
  compared: ReadonlyMap<number, { x: number; y: number; z: number }> | undefined,
): Map<number, number> {
  const corrections = new Map<number, number>();
  for (const id of ids) {
    const shown = before.get(id),
      replayed = compared?.get(id);
    if (!shown || !replayed) continue;
    corrections.set(
      id,
      Math.hypot(
        shown.position.wx - replayed.x,
        shown.position.wy - replayed.y,
        (shown.wz ?? 0) - replayed.z,
      ),
    );
  }
  return corrections;
}
