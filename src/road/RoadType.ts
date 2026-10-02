/** Road surface types. Stored per-tile in Chunk.roadGrid. */
export enum RoadType {
  None = 0,
  Asphalt = 1,
  Sidewalk = 2,
  LineWhite = 3,
  LineYellow = 4,
  // Pinned city-surfaces-v1 semantic cells. Existing IDs remain frozen.
  CityAsphalt = 5,
  CityPavement = 6,
  CityLineHTop = 7,
  CityLineHBottom = 8,
  CityLineVLeft = 9,
  CityLineVRight = 10,
  CityCrossHLeft = 11,
  CityCrossHRight = 12,
  CityCrossVTop = 13,
  CityCrossVBottom = 14,
  // 15–75: immutable commercial-city-assets-v1 cell bank (regional-v6).
  CommercialStart = 15,
}

/** True if the road type is any non-None road (draws asphalt base). */
export function isRoad(type: number): boolean {
  return type !== RoadType.None;
}

/** ME autotile sheet key for each overlay road type. */
export function getRoadSheetKey(type: RoadType): string | null {
  switch (type) {
    case RoadType.Sidewalk:
      return "me21";
    case RoadType.LineWhite:
      return "me25";
    case RoadType.LineYellow:
      return "me26";
    default:
      return null;
  }
}
