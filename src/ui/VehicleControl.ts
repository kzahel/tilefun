import type { ClientStateView } from "../client/ClientStateView.js";
import { isTrain } from "../railway/Train.js";
import { boardingDistance, isDrivable, occupiedVehicle } from "../traffic/Driving.js";

type VehicleRequest = { type: "enter-vehicle"; entityId: number } | { type: "exit-vehicle" };
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
      "position:fixed;bottom:max(24px,env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);z-index:80;max-width:85vw;text-align:center;color:white;font:15px sans-serif";
    this.button.style.cssText =
      "font:inherit;padding:12px 18px;min-height:48px;border-radius:8px;border:1px solid #c5d3b6;color:white;background:#243a32;cursor:pointer";
    this.root.dataset.vehicleControl = "";
    this.button.onclick = () => this.activate();
    this.status.setAttribute("role", "status");
    this.status.style.cssText = "background:#243a32;border-radius:6px;margin:4px 0;padding:4px";
    this.root.append(this.button, this.status);
    this.root.hidden = true;
    document.body.append(this.root);
  }
  update(view: ClientStateView, allowed: boolean, locked: boolean, tapMode = false): boolean {
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
    const key = current ? `inside:${current.id}` : candidate ? `near:${candidate.id}` : "";
    if (key !== this.targetKey) {
      this.status.textContent = "";
      this.error = false;
      this.targetKey = key;
    }
    this.request =
      allowed && !view.editorEnabled && candidate
        ? current
          ? { type: "exit-vehicle" }
          : { type: "enter-vehicle", entityId: candidate.id }
        : null;
    this.root.hidden = !this.request;
    this.button.disabled = this.busy || locked;
    const label = current
      ? "Get out · E"
      : candidate && isTrain(candidate)
        ? "Drive train · E"
        : "Drive car · E";
    if (this.button.textContent !== label) this.button.textContent = label;
    if (current && !this.busy && !this.error) {
      const hint = isTrain(current)
        ? tapMode
          ? "Tap left / right to travel · tap again to stop"
          : "W/S or arrows to drive train"
        : tapMode
          ? "Tap a destination to drive"
          : "WASD or arrows to drive car";
      if (this.status.textContent !== hint) this.status.textContent = hint;
    }
    return !!this.request;
  }
  activate(): boolean {
    if (!this.request) return false;
    if (this.busy || this.button.disabled) return true;
    this.busy = true;
    this.status.textContent = "";
    this.error = false;
    void this.send(this.request)
      .catch((error) => {
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
