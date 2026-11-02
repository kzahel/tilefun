import { PLAYER_SPEED, PLAYER_SPRINT_MULTIPLIER } from "../config/constants.js";
import type { Entity } from "../entities/Entity.js";
import type { Movement } from "../input/ActionManager.js";
import { vehicleNoseHeading } from "../traffic/Vehicle.js";
import { vehiclePerformance } from "../traffic/VehiclePerformance.js";
import { PHYSICS_DT } from "./PhysicsDefaults.js";
import type { MotionIntent } from "./PhysicsState.js";

export interface ControlCommand extends Movement {
  seq: number;
}
const NEUTRAL: Movement = { dx: 0, dy: 0, jump: false, sprinting: false };
export const CONTROL_HOLD_TICKS = 15;

/** Network arrivals update held controls; only shared physics ticks add travel.
 * A burst can replace held axes, but cannot add integration time or lose a jump edge.
 */
export class PlayerControls {
  private held: Movement = { ...NEUTRAL };
  private receivedAt = -Infinity;
  private sequence = 0;

  reset(ack = this.sequence) {
    this.sequence = ack;
    this.held = { ...NEUTRAL };
    this.receivedAt = -Infinity;
  }
  admit(queue: readonly ControlCommand[], tick: number) {
    let jumpPressed = false;
    for (const command of queue) {
      if (command.seq <= this.sequence) continue;
      jumpPressed ||= command.jumpPressed === true || (command.jump && !this.held.jump);
      const length = command.relativeDriving ? 1 : Math.max(1, Math.hypot(command.dx, command.dy));
      this.held = {
        ...command,
        dx: command.dx / length,
        dy: command.dy / length,
        jumpPressed: false,
      };
      this.sequence = command.seq;
      this.receivedAt = tick;
    }
    if (tick - this.receivedAt >= CONTROL_HOLD_TICKS) this.held = { ...NEUTRAL };
    return {
      movement: { ...this.held, jumpPressed },
      ack: this.sequence,
      expiresIn: Math.max(0, CONTROL_HOLD_TICKS - (tick - this.receivedAt)),
    };
  }
}

export function playerMotionIntent(movement: Movement): MotionIntent {
  const speed = PLAYER_SPEED * (movement.sprinting ? PLAYER_SPRINT_MULTIPLIER : 1);
  return {
    vx: movement.dx * speed,
    vy: movement.dy * speed,
    jump: movement.jump,
    jumpPressed: movement.jumpPressed ?? false,
  };
}

/** Input mapping only; the scene owns all vehicle motion and collision. */
export function vehicleMotionIntent(vehicle: Entity, movement: Movement): MotionIntent {
  let heading = vehicleNoseHeading(vehicle);
  const maxSpeed = vehiclePerformance(vehicle.type).speed * (movement.sprinting ? 1.5 : 1);
  if (movement.relativeDriving) {
    heading += movement.dx * 2.5 * PHYSICS_DT;
    const speed = -movement.dy * maxSpeed;
    return { vx: Math.cos(heading) * speed, vy: Math.sin(heading) * speed, heading };
  }
  if (movement.reversing)
    return {
      vx: -Math.cos(heading) * maxSpeed * 0.5,
      vy: -Math.sin(heading) * maxSpeed * 0.5,
      heading,
    };
  if (movement.dx || movement.dy) heading = Math.atan2(movement.dy, movement.dx);
  return { vx: movement.dx * maxSpeed, vy: movement.dy * maxSpeed, heading };
}
