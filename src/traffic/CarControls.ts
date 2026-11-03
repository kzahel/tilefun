import type { Movement } from "../input/ActionManager.js";

export type CarDrivingStyle = "direction" | "steering";
export const DEFAULT_CAR_DRIVING: CarDrivingStyle = "steering";

export function carDrivingStyle(value: unknown): CarDrivingStyle {
  return value === "direction" ? "direction" : DEFAULT_CAR_DRIVING;
}

/** Manual lab controls use the same default as gameplay; scripted inputs remain explicit. */
export function manualCarMovement(movement: Movement): Movement {
  return { ...movement, jump: false, relativeDriving: DEFAULT_CAR_DRIVING === "steering" };
}
