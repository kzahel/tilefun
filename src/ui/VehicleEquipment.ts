import { isBoat } from "../boats/Boat.js";
import type { ClientStateView } from "../client/ClientStateView.js";
import type { Entity } from "../entities/Entity.js";
import { hasDumpBed } from "../traffic/DumpBed.js";
import { isVehicleOverturned } from "../traffic/Vehicle.js";
import {
  boardingDistance,
  isDrivable,
  occupiedVehicle,
  vehicleVerticalDistance,
} from "../traffic/VehicleSeats.js";

export type EquipmentRequest =
  | { type: "recover-vehicle"; entityId: number }
  | { type: "vehicle-bed"; entityId: number; action: "tip" | "lower" };

function nearest(
  player: Entity,
  entities: readonly Entity[],
  match: (e: Entity) => boolean,
  height: number,
): Entity | undefined {
  return entities
    .filter(
      (e) =>
        match(e) &&
        !entities.some((other) => other.parentId === e.id) &&
        boardingDistance(player, e) <= 32 &&
        vehicleVerticalDistance(player, e) <= height,
    )
    .sort((a, b) => boardingDistance(player, a) - boardingDistance(player, b) || a.id - b.id)[0];
}

/** The one contextual equipment action: right an overturned car, otherwise tip or
 * lower a stopped dump bed for its driver or a person beside or inside the bed. */
export function equipmentPrompt(
  view: Pick<ClientStateView, "playerEntity" | "entities" | "editorEnabled">,
  allowed: boolean,
): { request: EquipmentRequest; label: string } | null {
  const player = view.playerEntity,
    entities = view.entities,
    current = occupiedVehicle(player, entities);
  if (!allowed || view.editorEnabled) return null;
  const recovery =
    current ??
    nearest(player, entities, (e) => isDrivable(e) && !isBoat(e) && isVehicleOverturned(e), 16);
  if (recovery && !isBoat(recovery) && isVehicleOverturned(recovery))
    return { request: { type: "recover-vehicle", entityId: recovery.id }, label: "Right car" };
  const bed = current
    ? current
    : player.parentId === undefined && player.jumpVZ === undefined
      ? nearest(player, entities, (e) => hasDumpBed(e) && !isVehicleOverturned(e), 64)
      : undefined;
  if (!bed || !hasDumpBed(bed) || Math.hypot(bed.velocity?.vx ?? 0, bed.velocity?.vy ?? 0) > 3)
    return null;
  const lowering = (bed.vehicleBedTarget ?? 0) > 0;
  return {
    request: { type: "vehicle-bed", entityId: bed.id, action: lowering ? "lower" : "tip" },
    label: lowering ? "Lower bed" : "Tip bed",
  };
}
