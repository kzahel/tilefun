/** Original open motorboat. Road catalogs remain road-only; boats share driving/records. */
export const BOAT_MODEL = "explorer-boat";
export const BOAT_TYPE = `vehicle-v1:${BOAT_MODEL}`;
export const BOAT_SIZE = 80;
export const BOAT_SEAT_Z = 8;
export const BOAT_MESH = {
  vehicle: BOAT_MODEL,
  assetId: "explorer-boat-authored-v1",
  path: "assets/models/vehicles/explorer-boat-v1.glb",
  radius: 64,
  lateralScale: 1,
  batchPreserveParts: ["Boat_Propeller"],
};
export const BOAT_SPRITE = "assets/vehicles/explorer-boat-v1.png";
export const isBoat = (entity: { type?: string }) => entity.type === BOAT_TYPE;
export const BOAT_VIEWS = ["south", "north", "west", "east"].map((direction, row) => ({
  id: `original-boat:explorer-v1:${direction}`,
  vehicleId: BOAT_MODEL,
  direction,
  rect: [32, row * 224 + 80, 128, 128],
  metadata: {
    name: `Explorer motorboat · ${direction}`,
    category: "vehicle",
    kind: "prop",
    tags: ["boat", "original", "water"],
    settings: ["water"],
    facing: direction,
    anchor: [64, 104],
    footprint: [-40, -80, 80, 80],
    colliders: [{ offsetX: 0, offsetY: 0, width: BOAT_SIZE, height: BOAT_SIZE, zHeight: 16 }],
    depthOffset: -40,
  },
}));

export interface BoatPlacement {
  identity: string;
  wx: number;
  wy: number;
}
