/** Eight saved slots. Item codes also identify the shared avatar attachment sprites. */
export const HOTBAR_SIZE = 8;
export const CORN = 1;
export const WOOD = 2;
export const BALL = 3;
export const STICK = 4;
export const AXE = 5;
export type ItemId = typeof CORN | typeof WOOD | typeof BALL | typeof STICK | typeof AXE;

interface ItemInfo {
  readonly label: string;
  readonly icon: string;
  /** What the use button does while this is in hand ("Throw"). */
  readonly verb?: string;
  /** Tools never run out and are never spent; their slot shows no count. */
  readonly tool?: true;
}
export const ITEMS: { readonly [K in ItemId]: ItemInfo } = {
  [CORN]: { label: "Corn", icon: "🌽", verb: "Scatter" },
  [WOOD]: { label: "Wood", icon: "🪵" },
  [BALL]: { label: "Ball", icon: "🔴", verb: "Throw", tool: true },
  [STICK]: { label: "Stick", icon: "🏒", verb: "Swing", tool: true },
  [AXE]: { label: "Axe", icon: "🪓", verb: "Chop", tool: true },
};
/** Every player carries these; a creative-first game does not make children earn them. */
export const STARTER_TOOLS = [BALL, STICK, AXE] as const;
/** Empty hands wave: the use button is never dead. */
export const EMPTY_HAND_VERB = "Wave";

export function itemVerb(item: ItemId | undefined): string | undefined {
  return item === undefined ? EMPTY_HAND_VERB : ITEMS[item].verb;
}

export interface ItemStack {
  readonly item: ItemId;
  readonly count: number;
}
export interface Inventory {
  readonly slots: readonly (ItemStack | null)[];
  readonly selected: number | null;
  /** The selection before the current one, for the quick swap back. */
  readonly previous?: number | null;
}

/** Read only from pre-hotbar saves. */
export interface LegacyFarmBasket {
  corn: number;
  wood: number;
}

export const EMPTY_INVENTORY: Inventory = {
  slots: Array.from({ length: HOTBAR_SIZE }, () => null),
  selected: null,
};
export type HotbarSelection = { slot: number | null } | { step: -1 | 1 } | { swap: true };
export type InventoryRequest = { type: "inventory-select"; selection: HotbarSelection };

function isItem(value: unknown): value is ItemId {
  return typeof value === "number" && Object.hasOwn(ITEMS, value);
}

function savedSlots(saved: Inventory | undefined): (ItemStack | null)[] | undefined {
  const slots = saved?.slots;
  if (!Array.isArray(slots) || slots.length > HOTBAR_SIZE) return undefined;
  const padded = [...slots, ...Array.from({ length: HOTBAR_SIZE - slots.length }, () => null)];
  return padded.every(
    (stack) =>
      stack === null ||
      (isItem(stack.item) && Number.isSafeInteger(stack.count) && stack.count > 0),
  )
    ? padded
    : undefined;
}

/** Saved slots pad out to the current size; every player keeps the starter tools. */
export function inventoryFromSave(
  saved: Inventory | undefined,
  legacy?: LegacyFarmBasket,
): Inventory {
  const slots = savedSlots(saved);
  if (slots && saved) {
    const selected =
      saved.selected !== null && Number.isInteger(saved.selected) && slots[saved.selected]
        ? saved.selected
        : null;
    return withStarterTools({ slots, selected });
  }
  if (!legacy) return withStarterTools(EMPTY_INVENTORY);
  const stacks: (ItemStack | null)[] = [
    legacy.corn > 0 ? { item: CORN, count: legacy.corn } : null,
    legacy.wood > 0 ? { item: WOOD, count: legacy.wood } : null,
  ];
  return withStarterTools({
    slots: [...stacks, ...EMPTY_INVENTORY.slots.slice(stacks.length)],
    selected: null,
  });
}

/**
 * Missing tools go into the first free slots. A player who gains them now holds
 * the ball if their hands were empty, so the use button keeps throwing as before.
 */
export function withStarterTools(inventory: Inventory): Inventory {
  let updated = inventory;
  for (const tool of STARTER_TOOLS) {
    if (updated.slots.some((stack) => stack?.item === tool)) continue;
    const free = updated.slots.indexOf(null);
    if (free < 0) break;
    const slots = [...updated.slots];
    slots[free] = { item: tool, count: 1 };
    updated = { ...updated, slots };
  }
  if (updated === inventory || inventory.selected !== null) return updated;
  const ball = updated.slots.findIndex((stack) => stack?.item === BALL);
  return ball < 0 ? updated : { ...updated, selected: ball };
}

export function heldItem(inventory: Inventory | undefined): ItemId | undefined {
  if (!inventory || inventory.selected === null) return undefined;
  return inventory.slots[inventory.selected]?.item;
}

export function itemCount(inventory: Inventory, item: ItemId): number {
  return inventory.slots.find((stack) => stack?.item === item)?.count ?? 0;
}

/** Add or spend countable items; tools are never counted, gained or spent. */
export function changeStack(inventory: Inventory, item: ItemId, delta: number): Inventory | null {
  if (ITEMS[item].tool) return null;
  const slots = [...inventory.slots];
  let index = slots.findIndex((stack) => stack?.item === item);
  if (index < 0 && delta > 0) index = slots.indexOf(null);
  if (index < 0) return null;
  const count = (slots[index]?.count ?? 0) + delta;
  if (!Number.isSafeInteger(count) || count < 0) return null;
  slots[index] = count > 0 ? { item, count } : null;
  const emptied = (slot: number | null | undefined) => count === 0 && slot === index;
  const { previous } = inventory;
  return {
    slots,
    selected: emptied(inventory.selected) ? null : inventory.selected,
    ...(previous !== undefined && { previous: emptied(previous) ? null : previous }),
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
  } else if ("swap" in selection) {
    if (selection.swap !== true) return inventory;
    const previous = inventory.previous ?? null;
    selected = previous !== null && inventory.slots[previous] ? previous : null;
  } else {
    const { slot } = selection;
    if (slot !== null && (!Number.isInteger(slot) || !inventory.slots[slot])) return inventory;
    selected = slot;
  }
  return inventory.selected === selected
    ? inventory
    : { ...inventory, selected, previous: inventory.selected };
}

export const HELD_SHEET = "farm-held-items";
export const HELD_IMAGE = "assets/farming/held-items.png";
/** Sheet column of the open hand that waves when nothing is held. */
export const HAND_FRAME = 5;

/**
 * One replicated byte for an avatar's hand: the equipped item code in the low
 * five bits and a three-bit use counter above it. Viewers start a use pose when
 * the counter changes, so swings and waves need no separate event channel or
 * another entity mask bit.
 */
const ITEM_BITS = 5;
const ITEM_MASK = (1 << ITEM_BITS) - 1;
const USE_MASK = 0b111;

interface HandBody {
  hand?: number | undefined;
}

export function handItem(body: HandBody): ItemId | undefined {
  const item = (body.hand ?? 0) & ITEM_MASK;
  return item !== 0 && Object.hasOwn(ITEMS, item) ? (item as ItemId) : undefined;
}

export function handUses(body: HandBody): number {
  return ((body.hand ?? 0) >> ITEM_BITS) & USE_MASK;
}

function write(body: HandBody, item: ItemId | undefined, uses: number): void {
  const byte = (item ?? 0) | ((uses & USE_MASK) << ITEM_BITS);
  if (byte === 0) delete body.hand;
  else body.hand = byte;
}

/** Equip an item (or empty hands), keeping the use counter. */
export function setHandItem(body: HandBody, item: ItemId | undefined): void {
  write(body, item, handUses(body));
}

/** Count one use of whatever is in hand; viewers play its pose once. */
export function countHandUse(body: HandBody): void {
  write(body, handItem(body), handUses(body) + 1);
}
