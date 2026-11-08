import type { Entity } from "../entities/Entity.js";
import type { Movement } from "../shared/Movement.js";
import { DEFAULT_CAR_DRIVING } from "../traffic/CarControls.js";
import type { ActionName } from "./ActionMap.js";
import { normalizesDiagonal, type SeatSample, seatPresses } from "./SeatComposer.js";

/** Still movement: a locked, cancelled or device-less seat's command. */
export const NEUTRAL_MOVEMENT: Movement = { dx: 0, dy: 0, sprinting: false, jump: false };

/** A sample with no movement and no jump press; held presses pass through. */
export function neutralSample(
  sample?: Omit<SeatSample, "manual" | "steered" | "jumpPressed">,
): SeatSample {
  return {
    honk: false,
    lights: false,
    style: false,
    throw: false,
    reverse: false,
    hornPressed: false,
    ...sample,
    manual: NEUTRAL_MOVEMENT,
    steered: NEUTRAL_MOVEMENT,
    jumpPressed: false,
  };
}

/**
 * A guest seat's input set (226): keys of one keyboard scheme, a pad or touch,
 * sampled once per device tick. Seat 0 keeps the play scene's own sampling
 * (first-person turning, tap and hold destinations).
 */
export interface SeatInput {
  /** Cars use relative steering (the seat's Options choice). */
  readonly steering: boolean;
  /** Lights and style keys held now: boarding ignores keys held while getting in. */
  held(action: "vehicle_lights" | "vehicle_style"): boolean;
  /** This tick's devices; still movement while `locked`. */
  sample(locked: boolean, vehicle: Entity | undefined): SeatSample;
  /** Release held keys and latched presses (play stopped or the seat was cancelled). */
  clear(): void;
  /** Remove listeners (the seat left). */
  dispose(): void;
}

/** The action-set calls a seat reads (an `ActionManager` for one scheme or pad). */
export interface SeatActions {
  getMovement(normalizeDiagonal: boolean): Movement;
  isHeld(action: ActionName): boolean;
  consumeHornPress(): boolean;
  on(action: "jump", callback: () => void): () => void;
  clearHeld(): void;
}

/** A seat's input set over one action set: movement, presses and a latched jump.
 * `release` frees the devices behind it (a keyboard scheme's listeners, a pad). */
export class ActionSeatInput implements SeatInput {
  private jumped = false;
  private readonly off: () => void;

  constructor(
    private readonly actions: SeatActions,
    readonly steering = DEFAULT_CAR_DRIVING === "steering",
    private readonly release?: () => void,
  ) {
    this.off = actions.on("jump", () => {
      this.jumped = true;
    });
  }

  held(action: "vehicle_lights" | "vehicle_style"): boolean {
    return this.actions.isHeld(action);
  }

  sample(locked: boolean, vehicle: Entity | undefined): SeatSample {
    const jumpPressed = this.jumped;
    this.jumped = false;
    const presses = seatPresses(this.actions);
    if (locked) return neutralSample(presses);
    const manual = this.actions.getMovement(normalizesDiagonal(vehicle, this.steering));
    return { manual, steered: manual, ...presses, jumpPressed };
  }

  clear(): void {
    this.jumped = false;
    this.actions.consumeHornPress();
    this.actions.clearHeld();
  }

  dispose(): void {
    this.off();
    this.release?.();
  }
}
