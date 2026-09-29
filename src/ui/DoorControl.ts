import type { ClientStateView } from "../client/ClientStateView.js";
import { exteriorEntrance, INTERIOR_EXIT } from "../interiors/GameplayInterior.js";

type DoorRequest = { type: "enter-building"; featureId: string } | { type: "exit-building" };
/** Small host control; proximity and realm changes remain authoritative. */
export class DoorControl {
  private readonly root = document.createElement("div");
  private readonly button = document.createElement("button");
  private readonly status = document.createElement("p");
  private request: DoorRequest | null = null;
  private busy = false;
  constructor(private readonly send: (request: DoorRequest) => Promise<unknown>) {
    this.root.style.cssText =
      "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:80;max-width:80vw;text-align:center;color:white;font:13px monospace;";
    this.button.style.cssText =
      "font:inherit;padding:10px 16px;border-radius:6px;border:1px solid #c5d3b6;color:white;background:#243a32;cursor:pointer;";
    this.button.hidden = true;
    this.button.onclick = () => this.activate();
    this.status.setAttribute("role", "status");
    this.status.style.cssText = "background:#243a32;margin:6px 0 0;border-radius:4px;";
    this.root.append(this.button, this.status);
    document.body.append(this.root);
  }
  update(view: ClientStateView, allowed: boolean): void {
    this.request = null;
    let label = "";
    if (allowed) {
      const p = view.playerEntity.position;
      if (view.interior) {
        if (Math.hypot(p.wx - INTERIOR_EXIT.wx, p.wy - INTERIOR_EXIT.wy) <= 40) {
          this.request = { type: "exit-building" };
          label = "Return to street · E";
        }
      } else if ((view.playerEntity.wz ?? 0) <= 8) {
        let best = 32;
        for (const prop of view.props) {
          if (!prop.proceduralId) continue;
          const door = exteriorEntrance(prop);
          if (!door) continue;
          const distance = Math.hypot(p.wx - door.wx, p.wy - door.wy);
          if (distance > best) continue;
          best = distance;
          this.request = { type: "enter-building", featureId: prop.proceduralId };
          label =
            prop.type === "prop-country-house"
              ? "Enter home · E"
              : prop.type.includes("bakery") || prop.type.includes("shop")
                ? "Enter shop · E"
                : "Enter apartment · E";
        }
      }
    }
    this.button.hidden = !this.request;
    if (this.button.textContent !== label) this.button.textContent = label;
    this.button.disabled = this.busy;
  }
  activate(): void {
    if (!this.request || this.busy) return;
    this.busy = true;
    this.status.textContent = "";
    void this.send(this.request)
      .catch((error) => {
        this.status.textContent = String(error);
      })
      .finally(() => {
        this.busy = false;
      });
  }
  destroy(): void {
    this.root.remove();
  }
}
