import { actionHint } from "../input/InputHints.js";
import { type PageInset, shift } from "../input/ViewRect.js";
import {
  EMPTY_INVENTORY,
  type HotbarSelection,
  type Inventory,
  ITEMS,
} from "../inventory/Inventory.js";
import "./HotbarControl.css";

export class HotbarControl {
  private readonly root = document.createElement("div");
  private readonly hint = document.createElement("small");
  private readonly slots: HTMLButtonElement[];
  private inventory: Inventory = EMPTY_INVENTORY;
  private allowed = false;

  constructor(private readonly select: (selection: HotbarSelection) => void) {
    this.root.className = "play-hotbar";
    this.root.hidden = true;
    this.root.setAttribute("role", "group");
    this.root.setAttribute("aria-label", "Hotbar");
    this.slots = EMPTY_INVENTORY.slots.map((_, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.onclick = () =>
        this.choose({ slot: this.inventory.selected === index ? null : index });
      return button;
    });
    this.root.append(...this.slots, this.hint);
    document.body.append(this.root);
  }

  update(inventory: Inventory | undefined, visible: boolean, allowed: boolean): void {
    this.root.hidden = !visible;
    this.allowed = allowed;
    if (!visible) return;
    this.inventory = inventory ?? EMPTY_INVENTORY;
    const hint = [actionHint("hotbar_previous"), actionHint("hotbar_next")]
      .filter(Boolean)
      .join(" / ");
    if (this.hint.textContent !== hint) this.hint.textContent = hint;
    this.hint.hidden = !hint;
    this.slots.forEach((button, i) => {
      const stack = this.inventory.slots[i];
      const label = stack ? `${ITEMS[stack.item].label} ×${stack.count}` : `Empty slot ${i + 1}`;
      const text = stack ? `${ITEMS[stack.item].icon} ${stack.count}` : "·";
      const selected = this.inventory.selected === i;
      if (button.textContent !== text) {
        button.textContent = text;
        button.setAttribute("aria-label", label);
      }
      button.setAttribute("aria-pressed", String(selected));
      button.disabled = !allowed || !stack;
    });
  }

  choose(selection: HotbarSelection): void {
    if (this.allowed) this.select(selection);
  }

  place(inset: PageInset): void {
    shift(this.root, (inset.left - inset.right) / 2, -inset.bottom);
  }

  destroy(): void {
    this.root.remove();
  }
}
