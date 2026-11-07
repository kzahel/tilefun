import { DUMP_BED, hasDumpBed } from "../traffic/DumpBed.js";
import { isVehicleOverturned } from "../traffic/Vehicle.js";
import { boardingDistance, vehicleVerticalDistance } from "../traffic/VehicleSeats.js";
import type { PlayerSession } from "./PlayerSession.js";
import type { VehicleControl } from "./VehicleControl.js";

/** Request a dump-bed target for the cab driver or a person beside/inside the bed.
 * The shared physics step owns the angle clock, clearance and drive lock. */
export function controlDumpBed(
  vehicles: VehicleControl,
  session: PlayerSession,
  { entityId, action }: { entityId: number; action: "tip" | "lower" },
): void {
  const realm = vehicles.realm,
    car = Number.isSafeInteger(entityId) ? realm.vehicleRegistry?.states.get(entityId) : undefined,
    truck = car?.entity;
  if (!car || !truck || !hasDumpBed(truck) || (action !== "tip" && action !== "lower"))
    throw Error("Truck bed unavailable.");
  const driving = vehicles.get(session);
  if (
    session.editorEnabled ||
    session.transitioning ||
    session.retired ||
    session.debugPaused ||
    (driving !== undefined && driving !== truck) ||
    (driving === undefined && session.player.parentId !== undefined)
  )
    throw Error("Truck bed control is unavailable right now.");
  if (car.driverId !== undefined && car.driverId !== session.player.id)
    throw Error("The driver controls the bed.");
  if (
    driving !== truck &&
    (boardingDistance(session.player, truck) > 32 ||
      vehicleVerticalDistance(session.player, truck) > 64)
  )
    throw Error("Stand beside or inside the truck bed.");
  if (isVehicleOverturned(truck)) throw Error("Right the truck first.");
  if (Math.hypot(truck.velocity?.vx ?? 0, truck.velocity?.vy ?? 0) > 3)
    throw Error("Wait for the truck to stop.");
  if (action === "tip") truck.vehicleBedTarget = Math.fround(DUMP_BED.maxTilt);
  else delete truck.vehicleBedTarget;
  if (driving === truck) vehicles.stop(session);
  // A tipped generated truck parks; it does not resume a lane with its bed raised.
  car.autonomous = false;
  delete car.route;
  realm.vehicleRegistry?.onChange?.(car, false);
}
