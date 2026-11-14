import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import type { PhysicsState } from "../physics/PhysicsState.js";
import type { Movement } from "../shared/Movement.js";
import type { World } from "../world/World.js";
import type { ReplayPose } from "./PredictionSnapshots.js";
import type { SeatMovements, SeatReplay } from "./SeatInputs.js";

export interface StoredInput {
  seq: number;
  tick: number;
  movement: Movement;
  /** Co-seats' movement on the same device tick (226). */
  seats?: SeatMovements;
}

export interface ReplayRequest {
  player: Entity;
  ack: number;
  state: PhysicsState;
  /** Owned by this request until the replay takes it as its private body map. */
  bodies: Map<number, Entity>;
  world: World;
  props: readonly Prop[];
  /** Each co-seat's controlled body at this snapshot (226). */
  seatBodies: ReadonlyMap<number, number>;
}

export interface PredictionReplay {
  request: ReplayRequest;
  physicsInputOffset: number;
  /** A yielded replay finishes this input prefix; later commands stay in history. */
  targetInputTick?: number;
  inputIndex: number;
  jumpHeld: boolean;
  heldMovement?: Movement;
  steps: number;
  ms: number;
  before: Entity;
  beforeInputTick: number;
  beforePhysicsTick: number;
  comparison?: { player: Entity; bodies: Map<number, ReplayPose> };
  pastError: number | undefined;
  inputs: StoredInput[];
  seats: SeatReplay;
}

/** Advance the planned horizon once per local input, including unpublished input
 * after a yielded prefix. A newer snapshot is a lower bound, not another copy
 * of that unpublished time. An ack covering an unpublished suffix rebases it. */
export function replayInputOffset(
  inputTick: number,
  appliedInputTick: number,
  ackInputTick: number,
  beforePhysicsTick: number,
  stateTick: number,
  overdue: boolean,
): number {
  return ackInputTick > appliedInputTick
    ? stateTick - ackInputTick
    : Math.max(beforePhysicsTick + inputTick - appliedInputTick, stateTick + Number(overdue)) -
        inputTick;
}

export function replayTarget(job: PredictionReplay, inputTick: number): number {
  return Math.max(
    job.request.state.tick,
    (job.targetInputTick ?? inputTick) + job.physicsInputOffset,
  );
}
