import { isBoat } from "../boats/Boat.js";
import type { ClientStateView } from "../client/ClientStateView.js";
import { inputHint } from "../input/InputHints.js";
import type { TouchMovementMode } from "../input/TapMovement.js";
import { nearestStationBench } from "../railway/StationBench.js";
import { isTrain } from "../railway/Train.js";
import type { CarDrivingStyle } from "../traffic/CarControls.js";
import { boardingDistance, isDrivable, occupiedVehicle } from "../traffic/Driving.js";
import { bedDriveLocked, hasVehicleBed } from "../traffic/VehicleBed.js";
import {
  bedContents,
  nearbyCargo,
  onBedFloor,
  type VehicleBedAction,
} from "../traffic/VehicleCargo.js";

type VehicleRequest =
  | { type: "vehicle-bed-action"; entityId: number; action: VehicleBedAction }
  | { type: "enter-vehicle"; entityId: number }
  | { type: "exit-vehicle" }
  | { type: "call-train"; benchId: number };
export class VehicleControl {
  readonly root = document.createElement("div");
  readonly button = document.createElement("button");
  private status = document.createElement("p");
  private request: VehicleRequest | null = null;
  private busy = false;
  private error = false;
  private targetKey = "";
  private bedActions = document.createElement("div");
  private bedButtons = new Map<VehicleBedAction, HTMLButtonElement>();
  constructor(private send: (request: VehicleRequest) => Promise<unknown>) {
    this.root.style.cssText =
      "position:fixed;bottom:max(24px,env(safe-area-inset-bottom));left:16px;z-index:80;max-width:min(360px,calc(100vw - 180px));text-align:left;color:white;font:15px sans-serif";
    this.button.style.cssText =
      "font:inherit;padding:12px 18px;min-height:48px;border-radius:8px;border:1px solid #c5d3b6;color:white;background:#243a32;cursor:pointer";
    this.root.dataset.vehicleControl = "";
    this.button.onclick = () => this.activate();
    this.status.setAttribute("role", "status");
    this.status.style.cssText = "background:#243a32;border-radius:6px;margin:4px 0;padding:4px";
    // Keep the button anchored while the first touch replaces keyboard hints
    // or an authority error wraps the status onto another line.
    this.bedActions.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;margin-top:6px";
    for (const [action, label] of [
      ["board", "Ride in bed"],
      ["leave", "Climb out"],
      ["load", "Load cargo"],
      ["unload", "Unload cargo"],
      ["tip", "Tip bed"],
      ["lower", "Lower bed"],
    ] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.style.cssText = this.button.style.cssText;
      button.dataset.bedAction = action;
      this.bedButtons.set(action, button);
      this.bedActions.append(button);
    }
    this.root.append(this.status, this.button, this.bedActions);
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
      entities = view.entities;
    const current = occupiedVehicle(p, entities);
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
    const bench = !candidate ? nearestStationBench(p, view.props) : undefined;
    const bed =
      allowed && !view.editorEnabled
        ? entities
            .filter(
              (e) =>
                hasVehicleBed(e) &&
                boardingDistance(p, e) <= 32 &&
                Math.hypot(e.velocity?.vx ?? 0, e.velocity?.vy ?? 0) <= 0.5 &&
                (p.parentId === undefined || current?.id === e.id) &&
                p.jumpVZ === undefined &&
                Math.abs((e.wz ?? 0) - (p.wz ?? 0)) <= 112,
            )
            .sort((a, b) => boardingDistance(p, a) - boardingDistance(p, b) || a.id - b.id)[0]
        : undefined;
    const inside = bed && onBedFloor(p, bed);
    for (const [action, button] of this.bedButtons) {
      button.hidden =
        !bed ||
        ((action === "tip" || action === "lower") &&
          entities.some((other) => other.parentId === bed.id && other.id !== p.id)) ||
        (action !== "tip" && action !== "lower" && (bedDriveLocked(bed) || !!current)) ||
        (action === "tip"
          ? (bed.vehicleBedTarget ?? 0) > 0
          : action === "lower"
            ? !bedDriveLocked(bed)
            : action === "board"
              ? !!inside
              : action === "leave"
                ? !inside
                : action === "load"
                  ? !nearbyCargo(p, bed, entities).length
                  : !bedContents(bed, entities).length);
      button.disabled = this.busy || locked;
      button.style.display = button.hidden ? "none" : "";
      button.onclick = () => {
        if (bed) this.activateRequest({ type: "vehicle-bed-action", entityId: bed.id, action });
      };
    }
    const key = current
      ? `inside:${current.id}`
      : candidate
        ? `near:${candidate.id}`
        : bench
          ? `bench:${bench.id}`
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
            : bench
              ? { type: "call-train", benchId: bench.id }
              : bed && inside
                ? { type: "vehicle-bed-action", entityId: bed.id, action: "leave" }
                : null
        : null;
    this.root.hidden = !this.request && !bed;
    this.button.hidden = !this.request || this.request.type === "vehicle-bed-action";
    this.button.style.display = this.button.hidden ? "none" : "";
    this.button.disabled = this.busy || locked;
    const action = current
      ? "Get out"
      : candidate && isTrain(candidate)
        ? "Drive train"
        : candidate && isBoat(candidate)
          ? "Drive boat"
          : bench
            ? "Call train"
            : "Drive car";
    const hint = inputHint("E", "Y");
    const label = `${action}${hint ? ` · ${hint}` : ""}`;
    if (this.button.textContent !== label) this.button.textContent = label;
    if (current && !this.busy && !this.error) {
      const hint = isTrain(current)
        ? inputHint("W/S or arrows to drive train", "Left stick ↑/↓ to drive train") ||
          (movementMode === "hold"
            ? "Hold left / right to travel · lift to stop"
            : movementMode === "tap"
              ? "Tap left / right to travel · tap again to stop"
              : "Drag left / right to drive train")
        : (carDriving === "steering"
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
      if (this.status.textContent !== hint) this.status.textContent = hint;
    }
    return !!this.request || !!bed;
  }
  activate(): boolean {
    if (!this.request) return false;
    return this.activateRequest(this.request);
  }
  private activateRequest(request: VehicleRequest): boolean {
    if (this.busy || this.button.disabled) return true;
    this.busy = true;
    this.status.textContent = "";
    this.error = false;
    const targetKey = this.targetKey;
    void this.send(request)
      .then(() => {
        if (request.type === "call-train" && this.targetKey === targetKey)
          this.status.textContent = "Poof! Your train is here.";
      })
      .catch((error) => {
        if (this.targetKey !== targetKey) return;
        this.error = true;
        this.status.textContent = String(error);
      })
      .finally(() => {
        this.busy = false;
      });
    return true;
  }
  destroy(): void {
    this.root.remove();
  }
}
