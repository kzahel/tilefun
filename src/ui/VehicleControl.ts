import { isBoat } from "../boats/Boat.js";
import type { ClientStateView } from "../client/ClientStateView.js";
import { actionHint, inputHint } from "../input/InputHints.js";
import type { TouchMovementMode } from "../input/TapMovement.js";
import { type CarDrivingStyle, DEFAULT_CAR_DRIVING } from "../traffic/CarControls.js";
import { isVehicleOverturned } from "../traffic/Vehicle.js";
import {
  boardingDistance,
  isDrivable,
  occupiedVehicle,
  vehicleVerticalDistance,
} from "../traffic/VehicleSeats.js";

type VehicleRequest =
  | { type: "enter-vehicle"; entityId: number }
  | { type: "exit-vehicle" }
  | { type: "recover-vehicle"; entityId: number };
/** The one basic land-vehicle interaction, shared by touch, keyboard and controller. */
export class VehicleControl {
  readonly root = document.createElement("div");
  readonly button = document.createElement("button");
  readonly recoveryButton = document.createElement("button");
  private recoveryRequest: VehicleRequest | null = null;
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
    this.recoveryButton.style.cssText = this.button.style.cssText;
    this.recoveryButton.style.bottom = "calc(336px + env(safe-area-inset-bottom))";
    this.recoveryButton.onclick = () => this.activateRecovery();
    this.recoveryButton.hidden = true;
    this.recoveryButton.style.display = "none";
    this.status.setAttribute("role", "status");
    this.status.style.cssText = "background:#243a32;border-radius:6px;margin:4px 0;padding:4px";
    this.root.append(this.status, this.button, this.recoveryButton);
    this.root.hidden = true;
    document.body.append(this.root);
  }
  update(
    view: ClientStateView,
    allowed: boolean,
    locked: boolean,
    movementMode: TouchMovementMode = "joystick",
    carDriving: CarDrivingStyle = DEFAULT_CAR_DRIVING,
  ): boolean {
    const p = view.playerEntity,
      entities = view.entities,
      current = occupiedVehicle(p, entities);
    const candidate =
      current ??
      entities
        .filter(
          (e) =>
            isDrivable(e) &&
            !isVehicleOverturned(e) &&
            !entities.some((other) => other.parentId === e.id) &&
            Math.hypot(e.velocity?.vx ?? 0, e.velocity?.vy ?? 0) <= 3 &&
            Math.abs((e.wz ?? 0) - (p.wz ?? 0)) <= 12 &&
            boardingDistance(p, e) <= 32,
        )
        .sort((a, b) => boardingDistance(p, a) - boardingDistance(p, b) || a.id - b.id)[0];
    const recovery =
      current ??
      entities
        .filter(
          (e) =>
            isDrivable(e) &&
            !isBoat(e) &&
            isVehicleOverturned(e) &&
            !entities.some((other) => other.parentId === e.id) &&
            boardingDistance(p, e) <= 32 &&
            vehicleVerticalDistance(p, e) <= 16,
        )
        .sort((a, b) => boardingDistance(p, a) - boardingDistance(p, b))[0];
    this.recoveryRequest =
      allowed &&
      !view.editorEnabled &&
      recovery &&
      !isBoat(recovery) &&
      isVehicleOverturned(recovery)
        ? { type: "recover-vehicle", entityId: recovery.id }
        : null;
    this.recoveryButton.hidden = !this.recoveryRequest;
    this.recoveryButton.style.display = this.recoveryRequest ? "" : "none";
    this.recoveryButton.disabled = this.busy || locked;
    this.recoveryButton.textContent = `Right car · ${actionHint("vehicle_recover") || "F"}`;
    const key = current
      ? `inside:${current.id}`
      : candidate
        ? `near:${candidate.id}`
        : recovery
          ? `recover:${recovery.id}`
          : "";
    if (key !== this.targetKey) {
      this.status.textContent = "";
      this.error = false;
      this.targetKey = key;
    }
    this.request =
      allowed && !view.editorEnabled
        ? current
          ? { type: "exit-vehicle" }
          : candidate
            ? { type: "enter-vehicle", entityId: candidate.id }
            : null
        : null;
    this.root.hidden = !this.request && !this.recoveryRequest;
    this.button.hidden = !this.request;
    this.button.style.display = this.request ? "" : "none";
    this.button.disabled = this.busy || locked;
    const hint = actionHint("enter_place");
    this.button.textContent = `${current ? "Get out" : "Drive car"}${hint ? ` · ${hint}` : ""}`;
    if (current && !this.busy && !this.error)
      this.status.textContent =
        (carDriving === "steering"
          ? inputHint("↑/↓ Forward/Reverse · ←/→ Steer", "Stick ↑/↓ Forward/Reverse · ←/→ Steer")
          : inputHint(
              "WASD / arrows · aim behind to reverse",
              "Left stick · aim behind to reverse",
            )) ||
        (movementMode === "hold"
          ? "Hold a direction · aim behind to reverse"
          : movementMode === "tap"
            ? "Tap a destination · tap behind to reverse"
            : carDriving === "steering"
              ? "Joystick ↑/↓ Forward/Reverse · ←/→ Steer"
              : "Drag a direction · aim behind to reverse");
    return !!this.request || !!this.recoveryRequest;
  }
  activateRecovery(): boolean {
    if (this.recoveryButton.disabled) return !!this.recoveryRequest;
    return this.activate(this.recoveryRequest);
  }
  activate(request: VehicleRequest | null = this.request): boolean {
    if (!request) return false;
    if (this.busy || this.button.disabled) return true;
    this.busy = true;
    this.error = false;
    this.status.textContent = "";
    const key = this.targetKey;
    void this.send(request)
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
    this.recoveryButton.style.position = "absolute";
    this.recoveryButton.style.bottom = "84px";
    this.button.style.position = "absolute";
    this.button.style.bottom = "24px";
    container.append(this.root, this.button, this.recoveryButton);
  }
  destroy() {
    this.recoveryButton.remove();
    this.button.remove();
    this.root.remove();
  }
}
