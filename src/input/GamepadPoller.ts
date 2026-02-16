import type { XRSessionManager } from "../xr/XRSessionManager.js";
import type { Movement } from "./ActionManager.js";

const DEAD_ZONE = 0.15;

export class GamepadPoller {
  xrManager: XRSessionManager | null = null;

  poll(): Movement {
    // XR input takes priority when an immersive session is active.
    if (this.xrManager?.active) return this.xrManager.movement;
    if (typeof navigator.getGamepads !== "function")
      return { dx: 0, dy: 0, sprinting: false, jump: false };
    const gamepads = navigator.getGamepads();
    const gp = gamepads[0] ?? gamepads[1] ?? gamepads[2] ?? gamepads[3];
    if (!gp) return { dx: 0, dy: 0, sprinting: false, jump: false };

    // Left stick: axes 0 (X) and 1 (Y)
    let dx = gp.axes[0] ?? 0;
    let dy = -(gp.axes[1] ?? 0);

    // Apply dead zone per-axis
    if (Math.abs(dx) < DEAD_ZONE) dx = 0;
    if (Math.abs(dy) < DEAD_ZONE) dy = 0;

    // Cap magnitude to 1
    const mag = Math.hypot(dx, dy);
    if (mag > 1) {
      dx /= mag;
      dy /= mag;
    }

    // Button 0 = A (Xbox) / Cross (PlayStation) = sprint
    const sprinting = gp.buttons[0]?.pressed ?? false;
    // Button 1 = B (Xbox) / Circle (PlayStation) = jump
    const jump = gp.buttons[1]?.pressed ?? false;

    return { dx, dy, sprinting, jump };
  }
}
