import { isBoat } from "../boats/Boat.js";
import { originalVehicle } from "./OriginalVehicles.js";

/** Shared gameplay tuning, independent of immutable art/collision snapshots. Units: world px/s. */
export interface VehiclePerformance {
  speed: number;
  acceleration: number;
  pushSpeed: number;
  pushWeight: number;
  /** Shift/boost top-speed multiplier; ordinary vehicles use DEFAULT_BOOST. */
  boost?: number;
}
export const DEFAULT_BOOST = 1.5;
/** Jump-park race tunes (223) on approved original models: faster driven top
 * speeds, quicker acceleration and stronger boosts. Road traffic keeps its own
 * capped cruise, and the art/collision catalog is unchanged. */
const RACE_TUNES: Record<string, Partial<VehiclePerformance>> = {
  "open-wheel-racer": { speed: 240, acceleration: 460, boost: 2.25 },
  "race-coupe": { speed: 220, acceleration: 420, boost: 2.25 },
  "rally-hatchback": { speed: 200, acceleration: 400, boost: 2.25 },
  "beach-buggy": { speed: 180, acceleration: 380, boost: 2.25 },
  "monster-truck": { speed: 150, acceleration: 320, boost: 2.25 },
  "go-kart": { speed: 160, acceleration: 380, boost: 2 },
};
const tuned = new Map(
  Object.entries(RACE_TUNES).flatMap(([model, tune]) => {
    const original = originalVehicle(model);
    return original ? [[model, { ...original.performance, ...tune }] as const] : [];
  }),
);
export const RACE_MODELS = [...tuned.keys()];
const compact: VehiclePerformance = {
  speed: 112,
  acceleration: 224,
  pushSpeed: 40,
  pushWeight: 80,
};
const sedan: VehiclePerformance = { speed: 120, acceleration: 224, pushSpeed: 44, pushWeight: 120 };
const sporty: VehiclePerformance = {
  speed: 156,
  acceleration: 300,
  pushSpeed: 44,
  pushWeight: 120,
};
const bus: VehiclePerformance = { speed: 88, acceleration: 120, pushSpeed: 64, pushWeight: 500 };
const truck: VehiclePerformance = { speed: 80, acceleration: 104, pushSpeed: 72, pushWeight: 600 };
export function vehiclePerformance(type: string): VehiclePerformance {
  if (isBoat({ type })) return { speed: 76, acceleration: 64, pushSpeed: 0, pushWeight: 0 };
  const model = type.replace(/^vehicle-v1:/, "");
  const original = tuned.get(model) ?? originalVehicle(model)?.performance;
  if (original) return original;
  if (model.startsWith("bus-")) return bus;
  if (model.startsWith("garbage-truck-")) return truck;
  if (model.startsWith("fire-truck-")) return { ...truck, speed: 88 };
  if (model === "ambulance") return { ...bus, speed: 112, acceleration: 180 };
  if (model === "police-car") return { ...sedan, speed: 144, acceleration: 280 };
  // Low, long-bodied cars 21–26 share the sportier silhouette in the source roster.
  if (/^car-2[1-6]$/.test(model)) return sporty;
  if (/^car-(1[4-9]|20)$/.test(model)) return { ...sedan, speed: 128, acceleration: 250 };
  if (
    model.startsWith("car-") ||
    model.startsWith("sedan-") ||
    model.startsWith("unindexed-sedan-")
  )
    return sedan;
  return compact;
}
