import type { Entity } from "../entities/Entity.js";

/** Bit 0 enables lights/sound; bits 1–2 select quiet, two-tone or wail. */
export function isEmergencyVehicle(entity: Pick<Entity, "type">): boolean {
  return ["ambulance", "police-car", "fire-truck-ladder-1", "fire-truck-ladder-2"].some(
    (model) => entity.type === `vehicle-v1:${model}`,
  );
}
export function emergencyEnabled(state = 2): boolean {
  return (state & 1) !== 0;
}
export function sirenStyle(state = 2): number {
  return state >> 1;
}
export function validEmergencyState(state: unknown): state is number {
  return typeof state === "number" && Number.isInteger(state) && state >= 0 && state <= 5;
}
export function nextEmergencyState(state = 2, action: "toggle" | "style"): number {
  return action === "toggle" ? state ^ 1 : (state & 1) | (((sirenStyle(state) + 1) % 3) << 1);
}

/** Amber work beacons share replicated enable state, without a siren style. */
export function isWarningVehicle(entity: Pick<Entity, "type">): boolean {
  return (
    entity.type === "vehicle-v1:garbage-truck-green" ||
    entity.type === "vehicle-v1:garbage-truck-orange"
  );
}
export function hasVehicleLights(entity: Pick<Entity, "type">): boolean {
  return isEmergencyVehicle(entity) || isWarningVehicle(entity);
}
export function vehicleLightState(entity: Pick<Entity, "type" | "emergencyState">): number {
  return entity.emergencyState ?? (isWarningVehicle(entity) ? 0 : 2);
}
export function validVehicleLightState(
  entity: Pick<Entity, "type">,
  state: unknown,
): state is number {
  return isEmergencyVehicle(entity)
    ? validEmergencyState(state)
    : isWarningVehicle(entity) && (state === 0 || state === 1);
}
export function nextVehicleLightState(
  entity: Pick<Entity, "type" | "emergencyState">,
  action: "toggle" | "style",
): number {
  const state = vehicleLightState(entity);
  return isWarningVehicle(entity)
    ? action === "toggle"
      ? state ^ 1
      : state
    : nextEmergencyState(state, action);
}
