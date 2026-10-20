export type CarDrivingStyle = "direction" | "steering";

export function carDrivingStyle(value: unknown): CarDrivingStyle {
  return value === "steering" ? "steering" : "direction";
}
