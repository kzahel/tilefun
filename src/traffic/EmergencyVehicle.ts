import type { Entity } from "../entities/Entity.js";

/** Bit 0 enables lights/sound; bits 1–2 select quiet, two-tone or wail. */
export function isEmergencyVehicle(entity: Pick<Entity, "type">): boolean {
  return entity.type === "vehicle-v1:ambulance";
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
