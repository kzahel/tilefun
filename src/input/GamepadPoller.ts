import type { Movement } from "../shared/Movement.js";
import type { XRSessionManager } from "../xr/XRSessionManager.js";

import { controllerInput } from "./ControllerInput.js";

export class GamepadPoller {
  xrManager: XRSessionManager | null = null;

  poll(): Movement {
    // XR input takes priority when an immersive session is active.
    if (this.xrManager?.active) return this.xrManager.movement;
    return controllerInput.movement;
  }
}
