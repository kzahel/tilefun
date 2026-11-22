import { actionHint, type KeyHint } from "../input/InputHints.js";
import { type PageInset, shift } from "../input/ViewRect.js";
import {
  EMPTY_HAND_VERB,
  EMPTY_INVENTORY,
  type HotbarSelection,
  type Inventory,
  ITEMS,
} from "../inventory/Inventory.js";
import "./HotbarControl.css";

/** A held step key starts repeating after this long, then steps at this interval. */
const REPEAT_DELAY = 0.4;
const REPEAT_INTERVAL = 0.22;
/** The picker strip (the selected item's name) stays this long after a change. */
const PICKER_SECONDS = 1.4;

/** Which hotbar step key is held: -1, 1, or 0 for neither (or both). */
export function heldStep(input: {
  isHeld(action: "hotbar_previous" | "hotbar_next"): boolean;
}): -1 | 0 | 1 {
  const previous = input.isHeld("hotbar_previous");
  const next = input.isHeld("hotbar_next");
  return previous === next ? 0 : previous ? -1 : 1;
}

/**
 * The hotbar: tap or click a slot, step with the D-pad/keys (hold to keep
 * stepping) or swap back to the last item. A picker strip names the selected
 * item and what the use button does with it while choosing. The game keeps
 * running, so co-op partners are never paused.
 */
export class HotbarControl {
  private readonly root = document.createElement("div");
  private readonly hint = document.createElement("small");
  private readonly picker = document.createElement("strong");
  private readonly slots: HTMLButtonElement[];
  private inventory: Inventory = EMPTY_INVENTORY;
  private allowed = false;
  private heldStep: -1 | 0 | 1 = 0;
  private repeatIn = 0;
  private pickerFor = 0;
  private shownSelection: number | null | undefined;

  constructor(
    private readonly select: (selection: HotbarSelection) => void,
    private readonly presentation?: { label?: string; hint: KeyHint },
  ) {
    this.root.className = presentation?.label ? "play-hotbar guest-hotbar" : "play-hotbar";
    this.root.hidden = true;
    this.root.setAttribute("role", "group");
    this.root.setAttribute("aria-label", presentation?.label ?? "Hotbar");
    this.picker.className = "hotbar-picker";
    this.picker.setAttribute("role", "status");
    this.picker.hidden = true;
    this.slots = EMPTY_INVENTORY.slots.map((_, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.onclick = () =>
        this.choose({ slot: this.inventory.selected === index ? null : index });
      return button;
    });
    this.root.append(...this.slots, this.hint, this.picker);
    document.body.append(this.root);
  }

  update(inventory: Inventory | undefined, visible: boolean, allowed: boolean, dt = 0): void {
    this.root.hidden = !visible;
    this.allowed = allowed;
    if (!allowed) this.release();
    if (!visible) return;
    this.inventory = inventory ?? EMPTY_INVENTORY;
    const inputHint = this.presentation?.hint ?? actionHint;
    const hint = [inputHint("hotbar_previous"), inputHint("hotbar_next")]
      .filter(Boolean)
      .join(" / ");
    if (this.hint.textContent !== hint) this.hint.textContent = hint;
    this.slots.forEach((button, i) => {
      const stack = this.inventory.slots[i];
      const info = stack && ITEMS[stack.item];
      const label =
        !stack || !info
          ? `Empty slot ${i + 1}`
          : info.tool
            ? info.label
            : `${info.label} ×${stack.count}`;
      const text = !stack || !info ? "·" : info.tool ? info.icon : `${info.icon} ${stack.count}`;
      const selected = this.inventory.selected === i;
      if (button.textContent !== text) button.textContent = text;
      button.setAttribute("aria-label", label);
      button.setAttribute("aria-pressed", String(selected));
      button.disabled = !allowed || !stack;
    });
    this.updatePicker(dt);
    this.hint.hidden = !hint || !this.picker.hidden;
  }

  choose(selection: HotbarSelection): void {
    if (this.allowed) this.select(selection);
  }

  /** A fresh step press: step now, and keep stepping while it is held (`hold`). */
  press(step: -1 | 1): void {
    this.choose({ step });
    this.heldStep = step;
    this.repeatIn = REPEAT_DELAY;
    this.pickerFor = PICKER_SECONDS;
  }

  /** Per frame: which step key is still held (0 for neither) and the frame time. */
  hold(step: -1 | 0 | 1, dt: number): void {
    if (step === 0 || step !== this.heldStep || !this.allowed) {
      this.release();
      return;
    }
    this.pickerFor = PICKER_SECONDS;
    this.repeatIn -= dt;
    if (this.repeatIn > 0) return;
    this.repeatIn += REPEAT_INTERVAL;
    this.choose({ step });
  }

  place(inset: PageInset, width?: number): void {
    shift(this.root, (inset.left - inset.right) / 2, -inset.bottom);
    if (width !== undefined) {
      const maxWidth = `${Math.max(0, Math.floor(width) - 8)}px`;
      if (this.root.style.maxWidth !== maxWidth) this.root.style.maxWidth = maxWidth;
    }
  }

  destroy(): void {
    this.root.remove();
  }

  private release(): void {
    this.heldStep = 0;
  }

  /** Name the selection while choosing: it shows on any change and fades after a pause. */
  private updatePicker(dt: number): void {
    const { selected } = this.inventory;
    if (this.shownSelection !== undefined && selected !== this.shownSelection)
      this.pickerFor = PICKER_SECONDS;
    this.shownSelection = selected;
    this.pickerFor = Math.max(0, this.pickerFor - dt);
    const stack = selected === null ? null : this.inventory.slots[selected];
    const info = stack ? ITEMS[stack.item] : undefined;
    const name = info ? `${info.icon} ${info.label}` : "Empty hands";
    const verb = info ? info.verb : EMPTY_HAND_VERB;
    const use = (this.presentation?.hint ?? actionHint)("use_item");
    const text = verb ? `${name} · ${[use, verb].filter(Boolean).join(" ")}` : name;
    if (this.picker.textContent !== text) this.picker.textContent = text;
    this.picker.hidden = this.pickerFor <= 0;
  }
}
