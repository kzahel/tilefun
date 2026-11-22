import catalog from "./original-vehicles.json" with { type: "json" };

/** Original assets have their own retained catalog; the source sprite bank stays immutable. */
export const ORIGINAL_VEHICLES = catalog.vehicles;
export const STAGED_VEHICLE_MODELS: ReadonlySet<string> = new Set(catalog.stagedOnly);
const byId = new Map(ORIGINAL_VEHICLES.map((vehicle) => [vehicle.id, vehicle]));
export function originalVehicle(model: string) {
  return byId.get(model);
}
