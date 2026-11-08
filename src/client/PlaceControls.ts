import type { ActionManager } from "../input/ActionManager.js";
import type { TouchMovementMode } from "../input/TapMovement.js";
import { NO_INSET, pageInset } from "../input/ViewRect.js";
import type { DeviceSession } from "../session/DeviceSession.js";
import type { CarDrivingStyle } from "../traffic/CarControls.js";
import { DoorControl } from "../ui/DoorControl.js";
import type { DoorRequest, VehicleRequest } from "../ui/PlacePrompts.js";
import { VehicleControl } from "../ui/VehicleControl.js";
import type { RemoteStateView } from "./ClientStateView.js";
import type { DoorPresentation } from "./DoorPresentation.js";
import { GuestPlaces } from "./GuestPlaces.js";

/** Client state the place controls read lazily (getters on the client). */
export interface PlaceControlsHost {
  readonly stateView: RemoteStateView;
  readonly doorPresentation: DoorPresentation;
  /** The device's seats and views (226): guests' controls, seat 0's region. */
  readonly session: Pick<DeviceSession, "seats" | "views" | "replica" | "prediction">;
  readonly canvas: HTMLCanvasElement;
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
  /** A request from a seat (a guest's travels in its envelope). */
  request(message: DoorRequest | VehicleRequest, seat?: number): Promise<unknown>;
}

/**
 * E/F place controls: the vehicle prompt (enter, exit, call a train, equipment)
 * takes precedence over the door prompt; door walk-through follows movement.
 * Seat 0's are page controls (inside its view in split screen); guests' are
 * their own keys or pads with prompts in their views (`GuestPlaces`).
 */
export class PlaceControls {
  readonly door: DoorControl;
  readonly vehicle: VehicleControl;
  private readonly guests: GuestPlaces;
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
    this.guests = new GuestPlaces(host);
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
    this.guests.update(dt, ready);
    this.placeInHostView();
  }

  destroy(): void {
    for (const unsubscribe of this.unsubscribe) unsubscribe();
    this.guests.destroy();
    this.door.destroy();
    this.vehicle.destroy();
  }

  /** In split screen seat 0's page controls move inside its view's region. */
  private placeInHostView(): void {
    const { views } = this.host.session;
    const own = views.length > 1 ? views.find((view) => view.seat === 0) : undefined;
    const page = () => document.documentElement;
    const inset = own
      ? pageInset(this.host.canvas, own.region, {
          width: page().clientWidth,
          height: page().clientHeight,
        })
      : NO_INSET;
    this.door.place(inset);
    this.vehicle.place(inset);
  }
}
