/** Original open motorboat. Road catalogs remain road-only; boats share driving/records. */
export const BOAT_MODEL = "explorer-boat";
export const BOAT_TYPE = `vehicle-v1:${BOAT_MODEL}`;
export const BOAT_LENGTH = 72;
export const BOAT_BEAM = 35;
/** Leave enough water beside a natural mooring to swing the full hull. */
export const BOAT_MOORING_RADIUS = Math.ceil(Math.hypot(BOAT_LENGTH, BOAT_BEAM) / 2);
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
    anchor: [64, 64 + (row < 2 ? BOAT_LENGTH : BOAT_BEAM) / 2],
    footprint: [
      -(row < 2 ? BOAT_BEAM : BOAT_LENGTH) / 2,
      -(row < 2 ? BOAT_LENGTH : BOAT_BEAM),
      row < 2 ? BOAT_BEAM : BOAT_LENGTH,
      row < 2 ? BOAT_LENGTH : BOAT_BEAM,
    ],
    colliders: [
      {
        offsetX: 0,
        offsetY: 0,
        width: row < 2 ? BOAT_BEAM : BOAT_LENGTH,
        height: row < 2 ? BOAT_LENGTH : BOAT_BEAM,
        zHeight: 16,
      },
    ],
    depthOffset: -(row < 2 ? BOAT_LENGTH : BOAT_BEAM) / 2,
  },
}));

export interface BoatPlacement {
  identity: string;
  wx: number;
  wy: number;
}
