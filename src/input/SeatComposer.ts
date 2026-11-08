import type { Direction, Entity } from "../entities/Entity.js";
import { quantizeAxis } from "../shared/binaryCodec.js";
import type { Movement } from "../shared/Movement.js";
import type { ClientMessage } from "../shared/protocol.js";
import {
  hasVehicleLights,
  isEmergencyVehicle,
  isWarningVehicle,
  vehicleLightState,
} from "../traffic/EmergencyVehicle.js";
import { throwDirection } from "./throwDirection.js";

/** Max hold time in seconds before throw force reaches 1.0. */
const THROW_CHARGE_DURATION = 1.0;
/** A held horn is re-sent about this often so a lost release cannot stick. */
const HORN_REFRESH_SECONDS = 0.2;

/** Semantic presses a seat sends alongside its movement commands. */
export type SeatPress = Extract<
  ClientMessage,
  { type: "vehicle-horn" } | { type: "vehicle-emergency" } | { type: "throw-ball" }
>;
type PlayerInput = Extract<ClientMessage, { type: "player-input" }>;

/** One seat's devices this tick, after the view has turned and steered them. */
export interface SeatSample {
  /** Keys, pad and joystick (neutral while locked), in the view's movement frame. */
  manual: Movement;
  /** `manual`, or a tap/hold destination's movement when one applies. */
  steered: Movement;
  honk: boolean;
  lights: boolean;
  style: boolean;
  throw: boolean;
  reverse: boolean;
  /** A horn press since the last tick (a tap shorter than one tick still honks). */
  hornPressed: boolean;
  /** A jump press since the last tick (a tap shorter than one tick still jumps). */
  jumpPressed: boolean;
}

/** The seat's situation this tick. */
export interface SeatSituation {
  /** The vehicle the seat occupies, if any. */
  vehicle: Entity | undefined;
  /** Storage pause, a door transition, menus or lost focus: neutral input. */
  locked: boolean;
  /** Cars use relative steering (the seat's Options choice). */
  steering: boolean;
  /** Touch movement uses the joystick (relative steering applies to it). */
  joystick: boolean;
  /** Sprite facing and first-person look, for throws while standing still. */
  facing?: Direction | undefined;
  look?: { x: number; y: number } | undefined;
}

/** Messages for one device tick: `before` and `after` bracket the movement command. */
export interface SeatTick {
  before: SeatPress[];
  movement: Movement;
  after: SeatPress[];
}

/** The held and pressed seat actions from one input set (keys, pad and touch). */
export function seatPresses(actions: {
  isHeld(action: "honk" | "vehicle_lights" | "vehicle_style" | "throw" | "reverse"): boolean;
  consumeHornPress(): boolean;
}): Omit<SeatSample, "manual" | "steered" | "jumpPressed"> {
  return {
    honk: actions.isHeld("honk"),
    lights: actions.isHeld("vehicle_lights"),
    style: actions.isHeld("vehicle_style"),
    throw: actions.isHeld("throw"),
    reverse: actions.isHeld("reverse"),
    hornPressed: actions.consumeHornPress(),
  };
}

/** Which on-screen controls a seat shows for its vehicle (TouchButtons fields). */
export function vehicleButtons(vehicle: Entity | undefined) {
  return {
    driving: !!vehicle,
    emergency: !!vehicle && isEmergencyVehicle(vehicle),
    warning: !!vehicle && isWarningVehicle(vehicle),
    emergencyState: vehicle ? vehicleLightState(vehicle) : 2,
  };
}

/** Manual car steering keeps raw axes; everything else normalizes diagonals. */
export function normalizesDiagonal(vehicle: Entity | undefined, steering: boolean): boolean {
  return !(vehicle && steering);
}

/**
 * Pure per-seat input composition (tactical 226): turns one seat's sampled
 * devices and situation into its movement command and semantic presses (horn,
 * sirens, throw, jump edge). The game and embedded labs share it; devices,
 * view turning and tap/hold steering stay with the caller.
 */
export class SeatComposer {
  /** Unquantized movement last tick (door walk-through reads it). */
  lastMovement = { dx: 0, dy: 0 };
  private vehicleId: number | undefined;
  private hornHeld = false;
  private hornRefresh = 0;
  private lightsHeld = false;
  private styleHeld = false;
  private throwCharge = 0;
  private throwHeld = false;
  private jumpHeld = false;

  /** Record the occupied vehicle before each `tick`; true when it changed. Keys
   * held while boarding do not toggle sirens or style until released. */
  board(vehicle: Entity | undefined, lights: boolean, style: boolean): boolean {
    if (vehicle?.id === this.vehicleId) return false;
    this.vehicleId = vehicle?.id;
    this.lightsHeld = lights;
    this.styleHeld = style;
    return true;
  }

  tick(sample: SeatSample, situation: SeatSituation, dt: number): SeatTick {
    const { vehicle, locked } = situation;
    const before: SeatPress[] = [];
    const after: SeatPress[] = [];
    const honk = !!vehicle && !locked && (sample.honk || sample.hornPressed);
    this.hornRefresh += dt;
    if (honk !== this.hornHeld || (honk && this.hornRefresh >= HORN_REFRESH_SECONDS)) {
      before.push({ type: "vehicle-horn", active: honk });
      this.hornRefresh = 0;
    }
    this.hornHeld = honk;
    const lights = !locked && sample.lights;
    const style = !locked && sample.style;
    if (vehicle && hasVehicleLights(vehicle)) {
      if (lights && !this.lightsHeld) before.push({ type: "vehicle-emergency", action: "toggle" });
      if (isEmergencyVehicle(vehicle) && style && !this.styleHeld)
        before.push({ type: "vehicle-emergency", action: "style" });
    }
    this.lightsHeld = lights;
    this.styleHeld = style;

    const raw = vehicle ? { ...sample.steered, jump: false } : sample.steered;
    this.lastMovement = { dx: raw.dx, dy: raw.dy };
    const jumpPressed = this.jumpEdge(sample.jumpPressed, raw.jump) && !locked && !vehicle;
    const movement: Movement = {
      dx: quantizeAxis(raw.dx),
      dy: quantizeAxis(raw.dy),
      sprinting: raw.sprinting,
      jump: raw.jump,
      jumpPressed,
      reversing: !!vehicle && !locked && sample.reverse,
      // Tap/hold destinations always aim in world space, even when the manual
      // keyboard/controller/joystick controls use relative car steering.
      relativeDriving:
        !!vehicle &&
        situation.steering &&
        (!!sample.manual.dx || !!sample.manual.dy || situation.joystick),
    };

    const throwing = !vehicle && !locked && sample.throw;
    if (throwing) this.throwCharge += dt;
    else if (this.throwHeld && !locked && !vehicle) {
      const force = Math.min(this.throwCharge / THROW_CHARGE_DURATION, 1);
      after.push({
        type: "throw-ball",
        ...throwDirection(movement, situation.facing, situation.look),
        force,
      });
      this.throwCharge = 0;
    }
    this.throwHeld = throwing;
    return { before, movement, after };
  }

  /** Drop movement, jump and throw state (cancelled input; the horn is separate). */
  cancel(): void {
    this.lastMovement = { dx: 0, dy: 0 };
    this.jumpHeld = false;
    this.dropThrow();
  }

  /** Forget a charging throw, so a release during skipped ticks never throws. */
  dropThrow(): void {
    this.throwHeld = false;
    this.throwCharge = 0;
  }

  /** Forget held horn and siren keys (play stopped); the caller sends the horn release. */
  stop(): void {
    this.hornHeld = false;
    this.hornRefresh = 0;
    this.lightsHeld = false;
    this.styleHeld = false;
  }

  private jumpEdge(latched: boolean, held: boolean): boolean {
    const pressed = latched || (held && !this.jumpHeld);
    this.jumpHeld = held;
    return pressed;
  }
}

/** A seat's command for one device tick, keyed by its controlled body. */
export interface SeatCommand {
  /** The seat's body, or the vehicle it drives (matches `SeatMovements`). */
  body: number;
  movement: Movement;
}

/**
 * One input packet per device tick: every local seat shares `seq`. Seat 0 is
 * today's `player-input`; until server seats exist (226 slice 4b) the other
 * seats ride along only as the predictor's co-seat movement.
 */
export function devicePacket(
  seq: number,
  seats: readonly SeatCommand[],
): { input: PlayerInput; coSeats: Map<number, Movement> | undefined } {
  const [primary, ...others] = seats;
  if (!primary) throw new Error("A device tick needs at least one seat");
  if (new Set(seats.map((seat) => seat.body)).size !== seats.length)
    throw new Error("Two seats cannot control the same body");
  const m = primary.movement;
  const input: PlayerInput = {
    type: "player-input",
    seq,
    dx: m.dx,
    dy: m.dy,
    sprinting: m.sprinting,
    jump: m.jump,
    jumpPressed: m.jumpPressed ?? false,
    reversing: m.reversing ?? false,
    relativeDriving: m.relativeDriving ?? false,
  };
  return {
    input,
    coSeats: others.length ? new Map(others.map((seat) => [seat.body, seat.movement])) : undefined,
  };
}
