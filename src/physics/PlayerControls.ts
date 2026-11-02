import { PLAYER_SPEED, PLAYER_SPRINT_MULTIPLIER } from "../config/constants.js";
import type { Movement } from "../input/ActionManager.js";
import type { MotionIntent } from "./PhysicsScene.js";

export interface ControlCommand extends Movement {
  seq: number;
  dtMs?: number;
}
const NEUTRAL: Movement = { dx: 0, dy: 0, jump: false, sprinting: false };
const STALE_TICKS = 15;

/** Network arrivals update held controls; only shared physics ticks add travel.
 * A burst can replace held axes, but cannot add integration time or lose a jump edge.
 */
export class PlayerControls {
  private held: Movement = { ...NEUTRAL };
  private receivedAt = -Infinity;
  private sequence = 0;

  reset(ack = this.sequence) {
    this.sequence = Math.max(this.sequence, ack);
    this.held = { ...NEUTRAL };
    this.receivedAt = -Infinity;
  }
  admit(queue: readonly ControlCommand[], tick: number): { movement: Movement; ack: number } {
    let jumpPressed = false;
    for (const command of queue) {
      if (command.seq <= this.sequence) continue;
      jumpPressed ||= command.jumpPressed === true || (command.jump && !this.held.jump);
      const length = Math.max(1, Math.hypot(command.dx, command.dy));
      this.held = {
        ...command,
        dx: command.dx / length,
        dy: command.dy / length,
        jumpPressed: false,
      };
      this.sequence = command.seq;
      this.receivedAt = tick;
    }
    if (tick - this.receivedAt >= STALE_TICKS) this.held = { ...NEUTRAL };
    return { movement: { ...this.held, jumpPressed }, ack: this.sequence };
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
