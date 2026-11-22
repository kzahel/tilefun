import { controllerInput } from "../input/ControllerInput.js";
import { EXCAVATOR_ACTIONS, type ExcavatorAction } from "../shared/ExcavatorInput.js";
import type { Movement } from "../shared/Movement.js";
import { required } from "../shared/required.js";
import { EQUIPMENT_LABELS, type EquipmentAction } from "../traffic/VehicleEquipment.js";
import { activateMenu, deactivateMenu } from "./MenuNavigation.js";
import type { WorkArmKind } from "./PlacePrompts.js";

const craneLabels = [
  "Slew left",
  "Slew right",
  "Lower boom",
  "Raise boom",
  "Retract boom",
  "Extend boom",
  "Reel in",
  "Pay out",
];
const shortcuts: readonly string[] = ["j", "l", "k", "i", "u", "o", "n", "m"];

const forkliftControls = [
  { action: "stick-in", key: "k", label: "Lower forks" },
  { action: "stick-out", key: "i", label: "Raise forks" },
  { action: "boom-down", key: "u", label: "Tilt forward" },
  { action: "boom-up", key: "o", label: "Tilt back" },
] as const;
const names = {
  crane: "Crane controls",
  excavator: "Excavator controls",
  forklift: "Forklift controls",
};

export class ExcavatorPanel {
  private readonly root = document.createElement("div");
  private returnFocus: HTMLElement | undefined;
  private listeners: AbortController | undefined;
  private held: { action: ExcavatorAction; source: string | number } | undefined;

  constructor(send: (action: EquipmentAction) => void, kind: WorkArmKind) {
    const crane = kind === "crane";
    const controls =
      kind === "forklift"
        ? forkliftControls
        : EXCAVATOR_ACTIONS.map((action, index) => ({
            action,
            key: required(shortcuts[index]),
            label: crane ? required(craneLabels[index]) : EQUIPMENT_LABELS[action],
          }));
    this.root.dataset.excavatorControls = "";
    this.root.setAttribute("role", "group");
    this.root.setAttribute("aria-label", names[kind]);
    this.root.style.cssText =
      "position:absolute;top:12px;right:12px;z-index:81;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;padding:7px;max-width:230px;color:white;background:#243a32f2;border-radius:8px";
    const hint = document.createElement("span");
    hint.textContent = "Hold a button, key or A";
    hint.style.gridColumn = "span 2";
    this.root.append(hint);
    for (const { action, key, label } of controls) {
      const button = document.createElement("button");
      button.type = "button";
      button.style.minHeight = "40px";
      const shortcut = key.toUpperCase();
      button.textContent = `${label} · ${shortcut}`;
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
    }
    if (crane) {
      const add = (action: EquipmentAction, key: string) => {
        const button = document.createElement("button");
        button.type = "button";
        button.style.minHeight = "40px";
        button.textContent = `${EQUIPMENT_LABELS[action]} · ${key}`;
        button.setAttribute("aria-keyshortcuts", key);
        button.onclick = () => send(action);
        this.root.append(button);
      };
      add("crane-hook", "H");
      add("crane-tool", "T");
    }
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Back to driving · Esc / B";
    close.style.gridColumn = "span 2";
    close.onclick = () => this.close();
    this.root.append(close);
    this.root.onkeydown = (event) => {
      const key = event.key.toLowerCase();
      if (crane && (key === "h" || key === "t")) {
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) send(key === "h" ? "crane-hook" : "crane-tool");
        return;
      }
      const action = controls.find((control) => control.key === key)?.action;
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
