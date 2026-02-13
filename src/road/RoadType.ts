/** Road surface types. Stored per-tile in Chunk.roadGrid. */
export enum RoadType {
  None = 0,
  Asphalt = 1,
  Sidewalk = 2,
  LineWhite = 3,
  LineYellow = 4,
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
