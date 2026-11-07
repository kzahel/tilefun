import { isBoat } from "../boats/Boat.js";
import type { ClientStateView } from "../client/ClientStateView.js";
import type { Entity } from "../entities/Entity.js";
import { hasDumpBed } from "../traffic/DumpBed.js";
import { isTowTruck, towCandidate } from "../traffic/Towing.js";
import { boardingHeightLimit, isTransporter } from "../traffic/Transporter.js";
import { isVehicleOverturned } from "../traffic/Vehicle.js";
import { EQUIPMENT_LABELS, type EquipmentAction } from "../traffic/VehicleEquipment.js";
import {
  boardingDistance,
  isDrivable,
  occupiedVehicle,
  vehicleVerticalDistance,
} from "../traffic/VehicleSeats.js";

export type EquipmentRequest =
  | { type: "recover-vehicle"; entityId: number }
  | { type: "vehicle-equipment"; entityId: number; action: EquipmentAction };

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

/** The nearest stopped, upright, empty vehicle the player can get into. Cars held
 * by a tow truck or transporter stay closed; a car on a deck is reached from the ground. */
export function driveCandidate(player: Entity, entities: readonly Entity[]): Entity | undefined {
  return entities
    .filter(
      (e) =>
        isDrivable(e) &&
        !isVehicleOverturned(e) &&
        (e.towedBy ?? e.transportedBy) === undefined &&
        !entities.some((other) => other.parentId === e.id) &&
        Math.hypot(e.velocity?.vx ?? 0, e.velocity?.vy ?? 0) <= 3 &&
        Math.abs((e.wz ?? 0) - (player.wz ?? 0)) <= boardingHeightLimit(e, entities) &&
        boardingDistance(player, e) <= 32,
    )
    .sort((a, b) => boardingDistance(player, a) - boardingDistance(player, b) || a.id - b.id)[0];
}

const hasEquipment = (e: Entity) => hasDumpBed(e) || isTowTruck(e) || isTransporter(e);

/** The next useful action for one stopped equipment vehicle, if any. */
function equipmentAction(truck: Entity, entities: readonly Entity[]): EquipmentAction | undefined {
  if (hasDumpBed(truck)) return (truck.vehicleBedTarget ?? 0) > 0 ? "lower" : "tip";
  if (isTransporter(truck)) return truck.vehicleRamp === 1 ? "stow" : "deploy";
  if (truck.towTargetId !== undefined) return "release";
  return towCandidate(truck, entities) ? "attach" : undefined;
}

/** The one contextual equipment action: right an overturned car; otherwise the
 * next dump-bed, tow or transporter action for its driver or a person beside it. */
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
  const truck = current
    ? current
    : player.parentId === undefined && player.jumpVZ === undefined
      ? nearest(player, entities, (e) => hasEquipment(e) && !isVehicleOverturned(e), 64)
      : undefined;
  if (!truck || Math.hypot(truck.velocity?.vx ?? 0, truck.velocity?.vy ?? 0) > 3) return null;
  const action = equipmentAction(truck, entities);
  return action
    ? {
        request: { type: "vehicle-equipment", entityId: truck.id, action },
        label: EQUIPMENT_LABELS[action],
      }
    : null;
}
