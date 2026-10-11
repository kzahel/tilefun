/** Retained own-model registrations; sprite bodies remain the loading/failure fallback. */
export interface AuthoredVehicleMesh {
  readonly vehicle: string;
  readonly assetId: string;
  readonly path: string;
  readonly radius: number;
  readonly lateralScale: number;
}
export const AUTHORED_VEHICLE_MESHES: readonly AuthoredVehicleMesh[] = [
  ...([1, 2, 3, 4, 5, 6] as const).map((number) => {
    const revision = number <= 2 ? "v7" : "v1";
    return {
      vehicle: `compact-${number}`,
      assetId: `compact-${number}-authored-${revision}`,
      path: `assets/models/vehicles/compact-${number}-${revision}.glb`,
      radius: 64,
      lateralScale: 1.3,
    };
  }),
  ...(["red", "beige", "cyan", "orange", "silver", "olive", "dark"] as const).map((color) => ({
    vehicle: `unindexed-sedan-${color}`,
    assetId: `unindexed-sedan-${color}-authored-v1`,
    path: `assets/models/vehicles/unindexed-sedan-${color}-v1.glb`,
    radius: 80,
    lateralScale: 1,
  })),
  ...([1, 2, 3, 4, 5, 6] as const).map((number) => ({
    vehicle: `bus-${number}`,
    assetId: `bus-${number}-authored-v1`,
    path: `assets/models/vehicles/bus-${number}-v1.glb`,
    radius: 112,
    lateralScale: 1,
  })),
  ...Array.from({ length: 20 }, (_, index) => {
    const number = index + 7;
    const vehicle = number === 12 ? "sedan-12" : `car-${number}`;
    return {
      vehicle,
      assetId: `${vehicle}-authored-v1`,
      path: `assets/models/vehicles/${vehicle}-v1.glb`,
      radius: 80,
      lateralScale: 1,
    };
  }),
  {
    vehicle: "ambulance",
    assetId: "ambulance-authored-v2",
    path: "assets/models/vehicles/ambulance-v2.glb",
    radius: 112,
    lateralScale: 1,
  },
  {
    vehicle: "fire-truck-ladder-1",
    assetId: "fire-truck-ladder-1-authored-v2",
    path: "assets/models/vehicles/fire-truck-ladder-1-v2.glb",
    radius: 144,
    lateralScale: 1,
  },
];
const byType = new Map(AUTHORED_VEHICLE_MESHES.map((d) => [`vehicle-v1:${d.vehicle}`, d]));
const byAsset = new Map(AUTHORED_VEHICLE_MESHES.map((d) => [d.assetId, d]));
export function authoredVehicleForType(type: string): AuthoredVehicleMesh | undefined {
  return byType.get(type);
}
export function authoredVehicleForAsset(assetId: string): AuthoredVehicleMesh | undefined {
  return byAsset.get(assetId);
}
