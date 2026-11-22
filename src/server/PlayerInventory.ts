import {
  EMPTY_INVENTORY,
  type HotbarSelection,
  heldItem,
  type Inventory,
  type ItemId,
  selectHotbar,
  setHandItem,
  withStarterTools,
} from "../inventory/Inventory.js";
import type { PlayerSession } from "./PlayerSession.js";

/** The private slot sync and public avatar attachment come from the same update. */
export function setInventory(session: PlayerSession, inventory: Inventory): void {
  session.gameplaySession.inventory = inventory;
  setHandItem(session.player, heldItem(inventory));
}

export function selectInventory(session: PlayerSession, selection: HotbarSelection): boolean {
  if (!selection || typeof selection !== "object") return false;
  const current = session.gameplaySession.inventory ?? EMPTY_INVENTORY;
  const updated = selectHotbar(current, selection);
  if (current === updated) return false;
  setInventory(session, updated);
  return true;
}

/** Put a carried item in hand (labs and instruments); starter tools are added if missing. */
export function holdItem(session: PlayerSession, item: ItemId): void {
  const inventory = withStarterTools(session.gameplaySession.inventory ?? EMPTY_INVENTORY);
  const slot = inventory.slots.findIndex((stack) => stack?.item === item);
  if (slot < 0) return;
  setInventory(session, selectHotbar(inventory, { slot }));
}
