import { BOAT_MESH } from "../boats/Boat.js";
import { ORIGINAL_VEHICLES } from "../traffic/OriginalVehicles.js";
import fits from "./vehicle-mesh-fits.json" with { type: "json" };

/** Fixed native side-height calibration under the actual x,y-z game camera. */
export function vehicleMeshHeightScale(vehicle: string): number {
  return fits[vehicle as keyof typeof fits] ?? 1;
}

/** Retained own-model registrations; sprite bodies remain the loading/failure fallback. */
export interface AuthoredVehicleMesh {
  readonly vehicle: string;
  readonly assetId: string;
  readonly path: string;
  readonly radius: number;
  readonly lateralScale: number;
  /** Preserve qualified raster-sensitive source parts while batching siblings. */
  readonly batchPreserveParts?: readonly string[];
}
export const AUTHORED_VEHICLE_MESHES: readonly AuthoredVehicleMesh[] = [
  BOAT_MESH,
  ...ORIGINAL_VEHICLES.map((vehicle) => ({
    vehicle: vehicle.id,
    ...vehicle.mesh,
    ...(vehicle.id === "dump-truck"
      ? {
          assetId: "dump-truck-authored-v2",
          path: "assets/models/vehicles/dump-truck-v2.glb",
          radius: 128,
        }
      : {}),
  })),
  ...([1, 2, 3, 4, 5, 6] as const).map((number) => {
    const revision = number <= 2 ? "v7" : "v1";
    return {
      vehicle: `compact-${number}`,
      assetId: `compact-${number}-authored-${revision}`,
      path: `assets/models/vehicles/compact-${number}-${revision}.glb`,
      radius: 64,
      lateralScale: 1.3,
      batchPreserveParts: ["Hood", "Raised_fender_·_left_·_-17", "Raised_fender_·_right_·_-17"],
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
    batchPreserveParts: ["Rear-roof-edge"],
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
      ...(number >= 14 && number <= 20
        ? { batchPreserveParts: ["Cabin-windows-west", "Windshield-frame"] }
        : {}),
    };
  }),
  ...(
    ["police-car", "garbage-truck-green", "garbage-truck-orange", "fire-truck-ladder-2"] as const
  ).map((vehicle) => {
    const revision = vehicle === "police-car" ? "v2" : "v1";
    return {
      vehicle,
      assetId: `${vehicle}-authored-${revision}`,
      path: `assets/models/vehicles/${vehicle}-${revision}.glb`,
      radius: vehicle === "fire-truck-ladder-2" ? 192 : vehicle === "police-car" ? 80 : 144,
      lateralScale: 1,
      ...(vehicle.startsWith("garbage-truck")
        ? {
            batchPreserveParts: [
              ...Array.from({ length: 6 }, (_, i) => `Chassis-coupling-${i}`),
              "Container-front",
              "Loader-rear-frame-1",
              "Loader-rear-frame--1",
              "Loader-side-east",
              "Loader-side-west",
            ],
          }
        : vehicle === "police-car"
          ? { batchPreserveParts: ["Sedan-west", "Trunk"] }
          : vehicle === "fire-truck-ladder-2"
            ? { batchPreserveParts: ["Cab-roof", "Cab-west"] }
            : {}),
    };
  }),
  {
    vehicle: "ambulance",
    assetId: "ambulance-authored-v3",
    path: "assets/models/vehicles/ambulance-v3.glb",
    radius: 112,
    lateralScale: 1,
    batchPreserveParts: [
      "Roof-panel-0-rear",
      "Roof-panel-0-west",
      "Roof-panel-1-rear",
      "Roof-panel-1-west",
    ],
  },
  {
    vehicle: "fire-truck-ladder-1",
    assetId: "fire-truck-ladder-1-authored-v2",
    path: "assets/models/vehicles/fire-truck-ladder-1-v2.glb",
    radius: 144,
    lateralScale: 1,
    batchPreserveParts: ["Cab-roof", "Cab-west"],
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
