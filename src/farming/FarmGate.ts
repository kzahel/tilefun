export const FARM_GATE = "prop-farm-gate";
export const OPEN_FARM_GATE = "prop-farm-gate-open";
export const FARM_GATE_SHEET = "farm-gate";

export function isFarmGate(type: string): boolean {
  return type === FARM_GATE || type === OPEN_FARM_GATE;
}
