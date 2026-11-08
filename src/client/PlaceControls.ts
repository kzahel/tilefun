import type { ActionManager } from "../input/ActionManager.js";
import type { TouchMovementMode } from "../input/TapMovement.js";
import type { CarDrivingStyle } from "../traffic/CarControls.js";
import { DoorControl, type DoorRequest } from "../ui/DoorControl.js";
import { VehicleControl, type VehicleRequest } from "../ui/VehicleControl.js";
import type { RemoteStateView } from "./ClientStateView.js";
import type { DoorPresentation } from "./DoorPresentation.js";

/** Client state the place controls read lazily (getters on the client). */
export interface PlaceControlsHost {
  readonly stateView: RemoteStateView;
  readonly doorPresentation: DoorPresentation;
  /** The play scene is on top; E/F and vehicle prompts act only in play. */
  readonly playing: boolean;
  /** An idea, world map, menu or catalog scene hides door prompts. */
  readonly overlayOpen: boolean;
  /** Menus, Options, lost focus or a hidden page. */
  readonly inputBlocked: boolean;
  readonly storagePaused: boolean;
  readonly movementMode: TouchMovementMode;
  readonly carDriving: CarDrivingStyle;
  /** The play scene's last composed movement, else the held movement keys. */
  readonly movement: { dx: number; dy: number };
  clearPlayInput(sendNeutral?: boolean): void;
  request(message: DoorRequest | VehicleRequest): Promise<unknown>;
}

/**
 * E/F place controls: the vehicle prompt (enter, exit, call a train, equipment)
 * takes precedence over the door prompt; door walk-through follows movement.
 */
export class PlaceControls {
  readonly door: DoorControl;
  readonly vehicle: VehicleControl;
  private readonly unsubscribe: (() => void)[];

  constructor(
    private readonly host: PlaceControlsHost,
    actions: ActionManager,
  ) {
    this.door = new DoorControl(async (request) => {
      if (host.doorPresentation.busy) return;
      // Authority validates a walking approach against the last directional input.
      // Queue that request before neutral input; the busy presentation locks the next tick.
      host.clearPlayInput(!request.walkThrough);
      if (request.walkThrough) host.doorPresentation.begin();
      try {
        await host.request(request);
      } catch (error) {
        host.doorPresentation.cancel();
        throw error;
      }
    });
    this.vehicle = new VehicleControl(async (request) => {
      host.clearPlayInput();
      return host.request(request);
    });
    this.unsubscribe = [
      actions.on("vehicle_recover", () => {
        if (host.playing && !host.inputBlocked) this.vehicle.activateEquipment();
      }),
      actions.on("enter_place", () => {
        if (!host.playing || host.inputBlocked) return;
        if (!this.vehicle.activate()) this.door.activate();
      }),
    ];
  }

  /** `ready`: startup is done and the player's room or terrain is presentable. */
  update(dt: number, ready: boolean): void {
    const { host } = this;
    const busy = host.doorPresentation.busy;
    const vehiclePrompt = this.vehicle.update(
      host.stateView,
      ready && host.playing,
      busy || host.inputBlocked || host.storagePaused,
      host.movementMode,
      host.carDriving,
    );
    this.door.update(
      host.stateView,
      !vehiclePrompt && ready && !host.overlayOpen,
      host.movement,
      dt,
      busy || host.inputBlocked,
    );
  }

  destroy(): void {
    for (const unsubscribe of this.unsubscribe) unsubscribe();
    this.door.destroy();
    this.vehicle.destroy();
  }
}
