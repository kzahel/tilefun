import type { Entity } from "../entities/Entity.js";
import { DUMP_BED, hasDumpBed } from "../traffic/DumpBed.js";
import { isTowTruck, towCandidate } from "../traffic/Towing.js";
import { isTransporter, transporterLoadCandidate } from "../traffic/Transporter.js";
import { isVehicleOverturned } from "../traffic/Vehicle.js";
import { EQUIPMENT_ACTIONS, type EquipmentAction } from "../traffic/VehicleEquipment.js";
import { linkedPartnerId, linkVehicles, unlinkVehicle } from "../traffic/VehicleLinks.js";
import type { VehicleState } from "../traffic/VehicleRegistry.js";
import { boardingDistance, vehicleVerticalDistance } from "../traffic/VehicleSeats.js";
import type { PlayerSession } from "./PlayerSession.js";
import type { Realm } from "./Realm.js";
import type { VehicleControl } from "./VehicleControl.js";

interface Context {
  realm: Realm;
  truck: Entity;
  partner: (id: number | undefined) => Entity | undefined;
}
/** Each action changes only durable targets and couplings on its vehicle type. */
const ACTIONS: Record<EquipmentAction, [(e: Entity) => boolean, (c: Context) => void]> = {
  tip: [
    hasDumpBed,
    ({ truck }) => {
      truck.vehicleBedTarget = Math.fround(DUMP_BED.maxTilt);
    },
  ],
  lower: [
    hasDumpBed,
    ({ truck }) => {
      delete truck.vehicleBedTarget;
    },
  ],
  attach: [
    isTowTruck,
    ({ realm, truck }) => {
      if (truck.vehicleLink) throw Error("Release the current car first.");
      const target = towCandidate(truck, realm.entityManager.entities);
      if (!target) throw Error("Back up to the front wheels of a parked car.");
      linkVehicles(truck, target, "tow");
    },
  ],
  release: [
    isTowTruck,
    ({ truck, partner }) => {
      if (truck.vehicleLink?.kind !== "tow") throw Error("Nothing is attached.");
      unlinkVehicle(truck, partner(truck.towTargetId));
    },
  ],
  deploy: [
    isTransporter,
    ({ realm, truck, partner }) => {
      if (!realm.physicsScene?.rampClear(truck.id))
        throw Error("Park with a clear, level space behind the ramp.");
      truck.vehicleRamp = 1;
      // Deploying releases a secured car so it can drive down the ramp.
      if (truck.vehicleLink?.kind === "carry") unlinkVehicle(truck, partner(truck.transportLoadId));
    },
  ],
  stow: [
    isTransporter,
    ({ realm, truck }) => {
      if (realm.physicsScene?.rampOccupied(truck.id))
        throw Error("Clear the ramp before stowing it.");
      delete truck.vehicleRamp;
      // A car standing wholly on the deck is secured for the journey.
      const load = transporterLoadCandidate(truck, realm.entityManager.entities);
      if (load && !truck.vehicleLink) linkVehicles(truck, load, "carry");
    },
  ],
};

/** The cab driver, or a grounded unmounted person beside the stopped, upright vehicle. */
function checkOperator(vehicles: VehicleControl, session: PlayerSession, car: VehicleState) {
  const truck = car.entity,
    driving = vehicles.get(session);
  if (
    session.editorEnabled ||
    session.transitioning ||
    session.retired ||
    session.debugPaused ||
    (driving !== undefined && driving !== truck) ||
    (driving === undefined && session.player.parentId !== undefined)
  )
    throw Error("Vehicle equipment is unavailable right now.");
  if (car.driverId !== undefined && car.driverId !== session.player.id)
    throw Error("The driver controls the equipment.");
  if (
    driving !== truck &&
    (boardingDistance(session.player, truck) > 32 ||
      vehicleVerticalDistance(session.player, truck) > 64)
  )
    throw Error("Stand beside the vehicle.");
  if (isVehicleOverturned(truck)) throw Error("Right the vehicle first.");
  if (Math.hypot(truck.velocity?.vx ?? 0, truck.velocity?.vy ?? 0) > 3)
    throw Error("Wait for the vehicle to stop.");
  return driving === truck;
}

/** Ordinary equipment requests. The shared physics step owns bed angles, ramp
 * collision, tow/carry joints and drive locks; requests only set their inputs. */
export function runEquipment(
  vehicles: VehicleControl,
  session: PlayerSession,
  { entityId, action }: { entityId: number; action: EquipmentAction },
): void {
  const realm = vehicles.realm,
    registry = realm.vehicleRegistry,
    car = Number.isSafeInteger(entityId) ? registry?.states.get(entityId) : undefined;
  const entry = EQUIPMENT_ACTIONS.includes(action) ? ACTIONS[action] : undefined;
  if (!car || !registry || !entry?.[0](car.entity)) throw Error("Vehicle equipment unavailable.");
  const driving = checkOperator(vehicles, session, car),
    truck = car.entity;
  const before = registry.states.get(linkedPartnerId(truck) ?? -1);
  entry[1]({ realm, truck, partner: (id) => realm.entityManager.byId.get(id ?? -1) });
  const after = registry.states.get(linkedPartnerId(truck) ?? -1);
  if (driving) vehicles.stop(session);
  // Working equipment parks a generated traffic vehicle.
  car.autonomous = false;
  delete car.route;
  for (const state of new Set([car, before, after])) if (state) registry.onChange?.(state, false);
}
