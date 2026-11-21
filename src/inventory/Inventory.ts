/** Four saved slots. Item codes also identify the shared avatar attachment sprites. */
export const HOTBAR_SIZE = 4;
export const CORN = 1;
export const WOOD = 2;
export type ItemId = typeof CORN | typeof WOOD;
export const ITEMS = {
  [CORN]: { label: "Corn", icon: "🌽" },
  [WOOD]: { label: "Wood", icon: "🪵" },
} as const;

export interface ItemStack {
  readonly item: ItemId;
  readonly count: number;
}
export interface Inventory {
  readonly slots: readonly (ItemStack | null)[];
  readonly selected: number | null;
}

/** Read only from pre-hotbar saves. */
export interface LegacyFarmBasket {
  corn: number;
  wood: number;
}

export const EMPTY_INVENTORY: Inventory = { slots: [null, null, null, null], selected: null };
export type HotbarSelection = { slot: number | null } | { step: -1 | 1 };
export type InventoryRequest = { type: "inventory-select"; selection: HotbarSelection };

export function inventoryFromSave(
  saved: Inventory | undefined,
  legacy?: LegacyFarmBasket,
): Inventory {
  if (saved?.slots?.length === HOTBAR_SIZE) return saved;
  if (!legacy) return EMPTY_INVENTORY;
  return {
    slots: [
      legacy.corn > 0 ? { item: CORN, count: legacy.corn } : null,
      legacy.wood > 0 ? { item: WOOD, count: legacy.wood } : null,
      null,
      null,
    ],
    selected: null,
  };
}

export function heldItem(inventory: Inventory | undefined): ItemId | undefined {
  if (!inventory || inventory.selected === null) return undefined;
  return inventory.slots[inventory.selected]?.item;
}

export function itemCount(inventory: Inventory, item: ItemId): number {
  return inventory.slots.find((stack) => stack?.item === item)?.count ?? 0;
}

export function changeStack(inventory: Inventory, item: ItemId, delta: number): Inventory | null {
  const slots = [...inventory.slots];
  let index = slots.findIndex((stack) => stack?.item === item);
  if (index < 0 && delta > 0) index = slots.indexOf(null);
  if (index < 0) return null;
  const count = (slots[index]?.count ?? 0) + delta;
  if (!Number.isSafeInteger(count) || count < 0) return null;
  slots[index] = count > 0 ? { item, count } : null;
  return {
    slots,
    selected: count === 0 && inventory.selected === index ? null : inventory.selected,
  };
}

export function selectHotbar(inventory: Inventory, selection: HotbarSelection): Inventory {
  let selected: number | null;
  if ("step" in selection) {
    if (selection.step !== -1 && selection.step !== 1) return inventory;
    const occupied = inventory.slots.flatMap((stack, i) => (stack ? [i] : []));
    const choices = [null, ...occupied];
    const current = Math.max(0, choices.indexOf(inventory.selected));
    selected = choices[(current + choices.length + selection.step) % choices.length] ?? null;
  } else {
    const { slot } = selection;
    if (slot !== null && (!Number.isInteger(slot) || !inventory.slots[slot])) return inventory;
    selected = slot;
  }
  return inventory.selected === selected ? inventory : { ...inventory, selected };
}

export const HELD_SHEET = "farm-held-items";
export const HELD_IMAGE = "assets/farming/held-items.png";
