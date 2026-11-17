import type { ActorPlacement } from "../Generator.js";
import type { Bounds, Point } from "./RegionalPlanner.js";

export interface DistrictStreet {
  id: string;
  points: Point[];
  width: number;
  sidewalk: number;
  kind: "avenue" | "street" | "alley";
}
export interface DistrictLot {
  id: string;
  bounds: Bounds;
  buildingType: string;
  anchor: Point;
  entrance: Point;
  facing: "south";
}
export interface DistrictBlock {
  id: string;
  bounds: Bounds;
  kind: "homes" | "shops" | "park";
  lots: DistrictLot[];
}
export interface DistrictPlan {
  readonly actors?: ActorPlacement[];
  id: string;
  settlementId: string;
  bounds: Bounds;
  streets: DistrictStreet[];
  blocks: DistrictBlock[];
  park: Bounds;
}
