import { inputHint, keyboardHint } from "../input/InputHints.js";
import { type PageInset, shift } from "../input/ViewRect.js";
import { type DoorRequest, DoorWalk, doorChoice, type PlaceView } from "./PlacePrompts.js";

/** Small host control; proximity and realm changes remain authoritative. */
export class DoorControl {
  private readonly root = document.createElement("div");
  private readonly button = document.createElement("button");
  private readonly status = document.createElement("p");
  private request: DoorRequest | null = null;
  private busy = false;
  private readonly walk = new DoorWalk();
  constructor(private readonly send: (request: DoorRequest) => Promise<unknown>) {
    this.root.style.cssText =
      "position:fixed;bottom:max(24px,env(safe-area-inset-bottom));left:16px;z-index:80;max-width:min(360px,calc(100vw - 180px));text-align:center;color:white;font:15px sans-serif;";
    this.button.style.cssText =
      "font:inherit;padding:10px 16px;border-radius:6px;border:1px solid #c5d3b6;color:white;background:#243a32;cursor:pointer;";
    this.button.hidden = true;
    this.button.onclick = () => this.activate();
    this.status.setAttribute("role", "status");
    this.status.style.cssText = "background:#243a32;margin:6px 0 0;border-radius:4px;";
    this.root.append(this.button, this.status);
    document.body.append(this.root);
  }
  update(
    view: PlaceView,
    allowed: boolean,
    movement: { dx: number; dy: number },
    dt: number,
    locked: boolean,
  ): void {
    const choice = doorChoice(view, allowed);
    this.request = choice.request;
    if (this.walk.update(view, choice, allowed, locked, movement, dt)) this.activate(true);
    this.button.hidden = !this.request;
    const hint = inputHint(keyboardHint("enter_place"), "Y");
    const label = choice.label && hint ? `${choice.label} · ${hint}` : choice.label;
    if (this.button.textContent !== label) this.button.textContent = label;
    this.button.disabled = this.busy || locked;
  }
  /** Seat 0's page controls sit inside its view in split screen. */
  place(inset: PageInset): void {
    shift(this.root, inset.left, -inset.bottom);
  }
  activate(walkThrough = false): void {
    if (!this.request || this.busy) return;
    this.busy = true;
    this.status.textContent = "";
    void this.send({ ...this.request, ...(walkThrough ? { walkThrough: true } : {}) })
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
