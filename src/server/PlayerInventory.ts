import {
  EMPTY_INVENTORY,
  type HotbarSelection,
  heldItem,
  type Inventory,
  selectHotbar,
} from "../inventory/Inventory.js";
import type { PlayerSession } from "./PlayerSession.js";

/** The private slot sync and public avatar attachment come from the same update. */
export function setInventory(session: PlayerSession, inventory: Inventory): void {
  session.gameplaySession.inventory = inventory;
  const item = heldItem(inventory);
  if (item === undefined) delete session.player.heldItem;
  else session.player.heldItem = item;
}

export function selectInventory(session: PlayerSession, selection: HotbarSelection): boolean {
  if (!selection || typeof selection !== "object") return false;
  const current = session.gameplaySession.inventory ?? EMPTY_INVENTORY;
  const updated = selectHotbar(current, selection);
  if (current === updated) return false;
  setInventory(session, updated);
  return true;
}
