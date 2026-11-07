import type { Entity } from "../entities/Entity.js";
import { insideDumpBed } from "../traffic/DumpBed.js";

/** Lab diagnostics for the equipment yard: dump-bed angle and cargo, the tow
 * link, the transporter ramp and its secured load. */
export function recordEquipment(
  dataset: DOMStringMap,
  entities: readonly Entity[],
  handles: Readonly<Record<string, number>>,
) {
  const byName = (name: string) => entities.find((e) => e.id === handles[name]);
  const truck = byName("truck"),
    tow = byName("tow-truck"),
    transporter = byName("transporter");
  dataset.bedTilt = String(truck?.vehicleBedTilt ?? 0);
  dataset.bedCargo = String(
    truck
      ? entities.filter((e) => e.type === "ball" && insideDumpBed(truck, e, truck.vehicleHeading))
          .length
      : 0,
  );
  dataset.towLinked = String(tow?.towTargetId !== undefined);
  dataset.rampDeployed = String(transporter?.vehicleRamp === 1);
  dataset.transportLoaded = String(transporter?.transportLoadId !== undefined);
}
