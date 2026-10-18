/** Shared gameplay tuning, independent of immutable art/collision snapshots. Units: world px/s. */
export interface VehiclePerformance {
  speed: number;
  acceleration: number;
  pushSpeed: number;
  pushWeight: number;
}
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
export const TRAIN_PUSH = { pushSpeed: 80, pushWeight: 1000 };
export function vehiclePerformance(type: string): VehiclePerformance {
  const model = type.replace(/^vehicle-v1:/, "");
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
