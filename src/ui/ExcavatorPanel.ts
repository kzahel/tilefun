import { controllerInput } from "../input/ControllerInput.js";
import { EXCAVATOR_ACTIONS, type ExcavatorAction } from "../shared/ExcavatorInput.js";
import type { Movement } from "../shared/Movement.js";
import { required } from "../shared/required.js";
import { EQUIPMENT_LABELS } from "../traffic/VehicleEquipment.js";
import { activateMenu, deactivateMenu } from "./MenuNavigation.js";

const shortcuts: readonly string[] = ["j", "l", "k", "i", "u", "o", "n", "m"];

export class ExcavatorPanel {
  private readonly root = document.createElement("div");
  private returnFocus: HTMLElement | undefined;
  private listeners: AbortController | undefined;
  private held: { action: ExcavatorAction; source: string | number } | undefined;

  constructor(send: (action: ExcavatorAction) => void) {
    this.root.dataset.excavatorControls = "";
    this.root.setAttribute("role", "group");
    this.root.setAttribute("aria-label", "Excavator controls");
    this.root.style.cssText =
      "position:absolute;top:12px;right:12px;z-index:81;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;padding:7px;max-width:230px;color:white;background:#243a32f2;border-radius:8px";
    const hint = document.createElement("span");
    hint.textContent = "Hold a button, key or A";
    hint.style.gridColumn = "span 2";
    this.root.append(hint);
    EXCAVATOR_ACTIONS.forEach((action, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.style.minHeight = "40px";
      const shortcut = required(shortcuts[index]).toUpperCase();
      button.textContent = `${EQUIPMENT_LABELS[action]} · ${shortcut}`;
      button.setAttribute("aria-keyshortcuts", shortcut);
      button.style.touchAction = "none";
      button.onpointerdown = (event) => {
        if (event.button !== 0) return;
        button.focus();
        button.setPointerCapture(event.pointerId);
        this.held = { action, source: event.pointerId };
      };
      const release = (event: PointerEvent) => this.release(event.pointerId);
      button.onpointerup = button.onpointercancel = button.onlostpointercapture = release;
      button.onclick = (event) => {
        if (event.detail > 0) return;
        if (controllerInput.confirmHeld) this.held = { action, source: "gamepad" };
        else send(action); // Assistive technologies can invoke the button as a discrete action.
      };
      button.onkeydown = (event) => {
        if (event.code === "Enter" || event.code === "Space") this.holdKey(event, action);
      };
      this.root.append(button);
    });
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Back to driving · Esc / B";
    close.style.gridColumn = "span 2";
    close.onclick = () => this.close();
    this.root.append(close);
    this.root.onkeydown = (event) => {
      const actionIndex = shortcuts.indexOf(event.key.toLowerCase());
      const action = EXCAVATOR_ACTIONS[actionIndex];
      if (!action) return;
      this.holdKey(event, action);
    };
    this.root.addEventListener("focusout", (event) => {
      if (!(event.relatedTarget instanceof Node) || !this.root.contains(event.relatedTarget))
        this.held = undefined;
    });
  }

  get movement(): Movement | undefined {
    if (!this.root.isConnected) return undefined;
    if (this.held?.source === "gamepad" && !controllerInput.confirmHeld) this.release("gamepad");
    return {
      dx: 0,
      dy: 0,
      jump: false,
      sprinting: false,
      ...(this.held && { excavatorAction: this.held.action }),
    };
  }

  private holdKey(event: KeyboardEvent, action: ExcavatorAction) {
    event.preventDefault();
    event.stopPropagation();
    if (!event.repeat) this.held = { action, source: event.code };
  }

  private release(source: string | number) {
    if (this.held?.source === source) this.held = undefined;
  }

  open(parent: HTMLElement, trigger: HTMLElement): void {
    if (this.root.isConnected) {
      this.close();
      return;
    }
    const focus = document.activeElement;
    this.returnFocus =
      focus instanceof HTMLCanvasElement ? focus : (parent.querySelector("canvas") ?? trigger);
    // A short Workshop canvas needs the touch controls below the picture.
    const docked = !!parent.querySelector("canvas") && parent.clientWidth < 580;
    this.root.style.position = docked ? "relative" : "absolute";
    this.root.style.top = docked ? "0" : "12px";
    this.root.style.right = docked ? "0" : "12px";
    this.root.style.marginTop = docked ? "8px" : "0";
    this.root.style.maxWidth = docked ? "none" : "230px";
    if (docked) parent.after(this.root);
    else parent.append(this.root);
    this.listeners = new AbortController();
    const options = { signal: this.listeners.signal };
    window.addEventListener("keyup", (event) => this.release(event.code), options);
    window.addEventListener("blur", () => (this.held = undefined), options);
    document.addEventListener("visibilitychange", () => (this.held = undefined), options);
    activateMenu(this.root, () => this.close());
  }

  close(restore = true): void {
    if (!this.root.isConnected) return;
    this.listeners?.abort();
    this.listeners = undefined;
    this.held = undefined;
    deactivateMenu(this.root);
    this.root.remove();
    if (restore) this.returnFocus?.focus();
    this.returnFocus = undefined;
  }
}
