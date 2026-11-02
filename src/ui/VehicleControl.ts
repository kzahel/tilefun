import type { ClientStateView } from "../client/ClientStateView.js";
import { actionHint, inputHint } from "../input/InputHints.js";
import type { TouchMovementMode } from "../input/TapMovement.js";
import type { CarDrivingStyle } from "../traffic/CarControls.js";
import { boardingDistance, isDrivable, occupiedVehicle } from "../traffic/VehicleSeats.js";

type VehicleRequest = { type: "enter-vehicle"; entityId: number } | { type: "exit-vehicle" };
/** The one basic land-vehicle interaction, shared by touch, keyboard and controller. */
export class VehicleControl {
  readonly root = document.createElement("div");
  readonly button = document.createElement("button");
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
    this.status.setAttribute("role", "status");
    this.status.style.cssText = "background:#243a32;border-radius:6px;margin:4px 0;padding:4px";
    this.root.append(this.status, this.button);
    this.root.hidden = true;
    document.body.append(this.root);
  }
  update(
    view: ClientStateView,
    allowed: boolean,
    locked: boolean,
    movementMode: TouchMovementMode = "joystick",
    carDriving: CarDrivingStyle = "direction",
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
            !entities.some((other) => other.parentId === e.id) &&
            Math.hypot(e.velocity?.vx ?? 0, e.velocity?.vy ?? 0) <= 3 &&
            Math.abs((e.wz ?? 0) - (p.wz ?? 0)) <= 12 &&
            boardingDistance(p, e) <= 32,
        )
        .sort((a, b) => boardingDistance(p, a) - boardingDistance(p, b) || a.id - b.id)[0];
    const key = current ? `inside:${current.id}` : candidate ? `near:${candidate.id}` : "";
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
    this.root.hidden = !this.request;
    this.button.hidden = !this.request;
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
    return !!this.request;
  }
  activate(): boolean {
    const request = this.request;
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
    this.button.style.position = "absolute";
    this.button.style.bottom = "24px";
    container.append(this.root, this.button);
  }
  destroy() {
    this.button.remove();
    this.root.remove();
  }
}
