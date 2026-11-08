import { actionHint, inputHint, movementKeysHint } from "../input/InputHints.js";
import type { TouchMovementMode } from "../input/TapMovement.js";
import { type PageInset, shift } from "../input/ViewRect.js";
import { type CarDrivingStyle, DEFAULT_CAR_DRIVING } from "../traffic/CarControls.js";
import {
  type PlaceView,
  type VehicleChoice,
  type VehicleRequest,
  vehicleChoice,
} from "./PlacePrompts.js";

/** Basic land-vehicle interactions, shared by touch, keyboard and controller: the
 * primary seat button plus one contextual equipment button (right car / dump bed). */
export class VehicleControl {
  readonly root = document.createElement("div");
  readonly button = document.createElement("button");
  readonly equipmentButton = document.createElement("button");
  private equipment: VehicleChoice["equipment"] = null;
  private status = document.createElement("p");
  private request: VehicleRequest | null = null;
  private busy = false;
  private error = false;
  private targetKey = "";
  constructor(private send: (request: VehicleRequest) => Promise<unknown>) {
    this.root.style.cssText =
      "position:fixed;bottom:calc(196px + env(safe-area-inset-bottom));left:16px;z-index:80;max-width:min(360px,calc(100vw - 212px));text-align:left;color:white;font:15px sans-serif";
    this.button.style.cssText =
      "position:fixed;right:20px;bottom:calc(274px + env(safe-area-inset-bottom));width:64px;min-height:52px;padding:4px;font:13px sans-serif;border-radius:14px;border:1px solid #c5d3b6;color:white;background:#243a32;cursor:pointer";
    this.root.dataset.vehicleControl = "";
    this.button.onclick = () => this.activate();
    this.equipmentButton.style.cssText = this.button.style.cssText;
    this.equipmentButton.style.bottom = "calc(336px + env(safe-area-inset-bottom))";
    this.equipmentButton.onclick = () => this.activateEquipment();
    this.equipmentButton.hidden = true;
    this.equipmentButton.style.display = "none";
    this.status.setAttribute("role", "status");
    this.status.style.cssText = "background:#243a32;border-radius:6px;margin:4px 0;padding:4px";
    this.root.append(this.status, this.button, this.equipmentButton);
    this.root.hidden = true;
    document.body.append(this.root);
  }
  update(
    view: PlaceView,
    allowed: boolean,
    locked: boolean,
    movementMode: TouchMovementMode = "joystick",
    carDriving: CarDrivingStyle = DEFAULT_CAR_DRIVING,
  ): boolean {
    const choice = vehicleChoice(view, allowed);
    const { equipment } = choice;
    this.equipment = equipment;
    this.equipmentButton.hidden = !equipment;
    this.equipmentButton.style.display = equipment ? "" : "none";
    this.equipmentButton.disabled = this.busy || locked;
    if (equipment)
      this.equipmentButton.textContent = `${equipment.label} · ${actionHint("vehicle_recover") || "F"}`;
    if (choice.key !== this.targetKey) {
      this.status.textContent = "";
      this.error = false;
      this.targetKey = choice.key;
    }
    this.request = choice.request;
    this.root.hidden = !this.request && !equipment;
    this.button.hidden = !this.request;
    this.button.style.display = this.request ? "" : "none";
    this.button.disabled = this.busy || locked;
    const hint = actionHint("enter_place");
    this.button.textContent = `${choice.label}${hint ? ` · ${hint}` : ""}`;
    if (choice.inside && !this.busy && !this.error)
      this.status.textContent = drivingHint(movementMode, carDriving);
    return !!this.request || !!equipment;
  }
  /** Seat 0's page controls sit inside its view in split screen. */
  place(inset: PageInset): void {
    shift(this.root, inset.left, -inset.bottom);
    shift(this.button, -inset.right, -inset.bottom);
    shift(this.equipmentButton, -inset.right, -inset.bottom);
  }
  activateEquipment(): boolean {
    if (this.equipmentButton.disabled) return !!this.equipment;
    return this.activate(this.equipment?.request ?? null);
  }
  activate(request: VehicleRequest | null = this.request): boolean {
    if (!request) return false;
    if (this.busy || this.button.disabled) return true;
    this.busy = true;
    this.error = false;
    this.status.textContent = "";
    const key = this.targetKey;
    void this.send(request)
      .then(() => {
        if (request.type === "call-train" && this.targetKey === key)
          this.status.textContent = "Poof! Your train is here.";
      })
      .catch((error) => {
        if (this.targetKey === key) {
          this.error = true;
          this.status.textContent = String(error);
        }
      })
      .finally(() => {
        this.busy = false;
      });
    return true;
  }
  mountEmbedded(container: HTMLElement) {
    this.root.style.position = "absolute";
    this.root.style.bottom = "24px";
    this.equipmentButton.style.position = "absolute";
    this.equipmentButton.style.bottom = "84px";
    this.button.style.position = "absolute";
    this.button.style.bottom = "24px";
    container.append(this.root, this.button, this.equipmentButton);
  }
  destroy() {
    this.equipmentButton.remove();
    this.button.remove();
    this.root.remove();
  }
}

/** How to drive, for the device in use (touch: the chosen movement mode). */
function drivingHint(movementMode: TouchMovementMode, carDriving: CarDrivingStyle): string {
  return (
    (carDriving === "steering"
      ? inputHint("↑/↓ Forward/Reverse · ←/→ Steer", "Stick ↑/↓ Forward/Reverse · ←/→ Steer")
      : inputHint(
          `${movementKeysHint()} / arrows · aim behind to reverse`,
          "Left stick · aim behind to reverse",
        )) ||
    (movementMode === "hold"
      ? "Hold a direction · aim behind to reverse"
      : movementMode === "tap"
        ? "Tap a destination · tap behind to reverse"
        : carDriving === "steering"
          ? "Joystick ↑/↓ Forward/Reverse · ←/→ Steer"
          : "Drag a direction · aim behind to reverse")
  );
}
