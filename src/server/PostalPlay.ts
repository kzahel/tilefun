import { canReachFarmTarget } from "../farming/FarmInteraction.js";
import type { PostalAction } from "../farming/PostalInteraction.js";
import { postalAction } from "../farming/PostalInteraction.js";
import { changeStack, EMPTY_INVENTORY, itemCount, PARCEL } from "../inventory/Inventory.js";
import { dryFarmGround } from "./FarmGround.js";
import { setInventory } from "./PlayerInventory.js";
import type { PlayerSession } from "./PlayerSession.js";
import type { Realm } from "./Realm.js";
export function deliverMail(
  realm: Pick<Realm, "propManager" | "world" | "savePlayerData">,
  session: PlayerSession,
  request: { propId: number; action: PostalAction },
) {
  const player = session.player;
  const prop = realm.propManager.props.find((p) => p.id === request.propId);
  if (!prop || postalAction(prop.type) !== request.action)
    throw new Error("Move closer to use this.");
  const z = dryFarmGround(realm.world, prop.position);
  if (z === undefined || !canReachFarmTarget(player, { position: prop.position, wz: z }))
    throw new Error("Move closer to use this.");
  const inventory = session.gameplaySession.inventory ?? EMPTY_INVENTORY;
  const collecting = request.action === "collect-parcel";
  if (collecting && itemCount(inventory, PARCEL))
    throw new Error("Deliver your current parcel first.");
  const next = changeStack(inventory, PARCEL, collecting ? 1 : -1);
  if (!next) throw new Error(collecting ? "Your inventory is full." : "Collect a parcel first.");
  setInventory(session, next);
  if (!collecting) session.gameplaySession.gemsCollected++;
  realm.savePlayerData(session);
}
