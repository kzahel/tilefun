import type { Entity } from "../entities/Entity.js";
import { DUMP_BED, DUMP_TRUCK_TYPE } from "./DumpBed.js";
import { type ShoppingVisit, validShoppingVisit } from "./ShoppingVisits.js";

/** Durable equipment state on a saved vehicle: dump-bed angles, a deployed
 * transporter ramp, a tow/carry coupling by procedural identity, and an
 * in-progress shopping trip. */
export interface SavedEquipment {
  visit?: ShoppingVisit;
  bed?: readonly [tilt: number, target: number];
  ramp?: 1;
  link?: { kind: "tow" | "carry"; lead: boolean; partner: string };
}
type EquipmentEntity = Pick<
  Entity,
  "vehicleBedTilt" | "vehicleBedTarget" | "vehicleRamp" | "vehicleLink"
>;

export function savedEquipment(e: EquipmentEntity, visit?: ShoppingVisit): SavedEquipment {
  return {
    ...(visit ? { visit: { ...visit } } : {}),
    ...(e.vehicleBedTilt || e.vehicleBedTarget
      ? { bed: [e.vehicleBedTilt ?? 0, e.vehicleBedTarget ?? 0] as const }
      : {}),
    ...(e.vehicleRamp === 1 ? { ramp: 1 as const } : {}),
    ...(e.vehicleLink ? { link: { ...e.vehicleLink } } : {}),
  };
}
const angle = (n: unknown) => typeof n === "number" && n >= 0 && n <= DUMP_BED.maxTilt + 1e-6;
export function validSavedEquipment(model: string, record: SavedEquipment): boolean {
  const { bed, ramp, link } = record;
  return (
    validShoppingVisit(record.visit) &&
    (bed === undefined ||
      (`vehicle-v1:${model}` === DUMP_TRUCK_TYPE &&
        Array.isArray(bed) &&
        bed.length === 2 &&
        bed.every(angle))) &&
    (ramp === undefined || (ramp === 1 && model === "car-transporter")) &&
    (link === undefined ||
      (!!link &&
        (link.kind === "tow" || link.kind === "carry") &&
        typeof link.lead === "boolean" &&
        typeof link.partner === "string" &&
        link.partner.length > 0 &&
        link.partner.length <= 512))
  );
}
export function restoreSavedEquipment(e: EquipmentEntity, record: SavedEquipment) {
  if (record.bed?.[0]) e.vehicleBedTilt = record.bed[0];
  if (record.bed?.[1]) e.vehicleBedTarget = record.bed[1];
  if (record.ramp === 1) e.vehicleRamp = 1;
  if (record.link) e.vehicleLink = { ...record.link };
}
