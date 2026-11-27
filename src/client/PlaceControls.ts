import { type FarmRequest, farmChoice, farmGateChoice } from "../farming/FarmInteraction.js";
import { postalChoice } from "../farming/PostalInteraction.js";
import type { ActionManager } from "../input/ActionManager.js";
import { actionHint, type KeyHint } from "../input/InputHints.js";
import type { TouchMovementMode } from "../input/TapMovement.js";
import { NO_INSET, pageInset } from "../input/ViewRect.js";
import type { InventoryRequest } from "../inventory/Inventory.js";
import type { DeviceSession } from "../session/DeviceSession.js";
import type { CarDrivingStyle } from "../traffic/CarControls.js";
import { DoorControl } from "../ui/DoorControl.js";
import { FarmControl } from "../ui/FarmControl.js";
import { HotbarControl, heldStep } from "../ui/HotbarControl.js";
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
  request(message: PlaceRequest, seat?: number): Promise<unknown>;
}

export type PlaceRequest = DoorRequest | VehicleRequest | FarmRequest | InventoryRequest;

/**
 * E/F place controls: the vehicle prompt (enter, exit, call a train, equipment)
 * takes precedence over the door prompt; door walk-through follows movement.
 * Seat 0's are page controls (inside its view in split screen); guests' are
 * their own keys or pads with prompts in their views (`GuestPlaces`).
 */
export class PlaceControls {
  readonly door: DoorControl;
  readonly vehicle: VehicleControl;
  private readonly farm: FarmControl;
  private readonly hotbar: HotbarControl;
  private readonly guests: GuestPlaces;
  private readonly unsubscribe: (() => void)[];

  constructor(
    private readonly host: PlaceControlsHost,
    private readonly actions: ActionManager,
  ) {
    const keyHint: KeyHint = (action) => actions.hint(action);
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
    }, keyHint);
    this.vehicle = new VehicleControl(async (request) => {
      host.clearPlayInput();
      return host.request(request);
    }, keyHint);
    this.farm = new FarmControl((request) => host.request(request), keyHint);
    this.hotbar = new HotbarControl(
      (selection) => {
        if (this.hotbarAllowed)
          void host.request({ type: "inventory-select", selection }).catch(() => {});
      },
      { hint: (action) => actionHint(action, keyHint) },
    );
    this.guests = new GuestPlaces(host);
    this.unsubscribe = [
      actions.on("hotbar_previous", () => this.hotbar.press(-1)),
      actions.on("hotbar_next", () => this.hotbar.press(1)),
      actions.on("hotbar_swap", () => this.hotbar.choose({ swap: true })),
      actions.on("vehicle_recover", () => {
        if (host.playing && !host.inputBlocked) this.vehicle.activateEquipment();
      }),
      actions.on("enter_place", () => {
        if (!host.playing || host.inputBlocked) return;
        if (this.vehicle.activate()) return;
        this.door.activate();
        if (!host.storagePaused && !host.doorPresentation.busy && !host.overlayOpen)
          this.farm.activate();
      }),
    ];
  }

  private get hotbarAllowed(): boolean {
    const { host } = this;
    return (
      host.playing &&
      !host.overlayOpen &&
      !host.inputBlocked &&
      !host.storagePaused &&
      !host.doorPresentation.busy &&
      !host.stateView.editorEnabled &&
      host.stateView.playerEntity.parentId === undefined
    );
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
    const doorPrompt = this.door.update(
      host.stateView,
      !vehiclePrompt && ready && !host.overlayOpen,
      host.movement,
      dt,
      busy || host.inputBlocked,
    );
    const view = host.stateView;
    const walking = ready && this.hotbarAllowed;
    this.hotbar.update(view.inventory, walking, walking, dt);
    this.hotbar.hold(heldStep(this.actions), dt);
    this.farm.update(
      ready &&
        host.playing &&
        !host.overlayOpen &&
        !busy &&
        !host.inputBlocked &&
        !host.storagePaused &&
        !vehiclePrompt &&
        !doorPrompt &&
        !view.editorEnabled &&
        !view.interior
        ? (postalChoice(view.playerEntity, view.props, view.inventory) ??
            farmGateChoice(view.playerEntity, view.props) ??
            farmChoice(view.playerEntity, view.entities, view.inventory))
        : undefined,
    );
    this.guests.update(dt, ready);
    this.placeInHostView();
  }

  destroy(): void {
    for (const unsubscribe of this.unsubscribe) unsubscribe();
    this.guests.destroy();
    this.door.destroy();
    this.vehicle.destroy();
    this.farm.destroy();
    this.hotbar.destroy();
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
    this.farm.place(inset);
    this.hotbar.place(inset);
  }
}
