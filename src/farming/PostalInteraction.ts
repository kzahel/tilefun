import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import { EMPTY_INVENTORY, type Inventory, itemCount, PARCEL } from "../inventory/Inventory.js";
import { canReachFarmTarget, type FarmChoice } from "./FarmInteraction.js";

export type PostalAction = "collect-parcel" | "deliver-parcel";
export function postalAction(type: string): PostalAction | undefined {
  if (type === "prop-civic-dispatch") return "collect-parcel";
  if (type === "prop-civic-mailbox") return "deliver-parcel";
  return undefined;
}
export function postalChoice(
  player: Entity,
  props: readonly Prop[],
  inventory: Inventory = EMPTY_INVENTORY,
): FarmChoice | undefined {
  for (const prop of props) {
    const action = postalAction(prop.type);
    if (!action || !canReachFarmTarget(player, prop)) continue;
    const carrying = itemCount(inventory, PARCEL) > 0;
    if (action === "collect-parcel" && carrying)
      return { request: null, label: "Deliver your parcel to a blue mailbox" };
    if (action === "deliver-parcel" && !carrying)
      return { request: null, label: "Collect a parcel at the city parcel depot" };
    return {
      request: { type: "farm-action", action, propId: prop.id },
      label: carrying ? "Deliver parcel · earn 1 gem" : "Collect parcel",
      status: carrying ? "Postal delivery" : "Take it to a blue town or neighborhood mailbox",
    };
  }
  return undefined;
}
