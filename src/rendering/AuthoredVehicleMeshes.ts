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
