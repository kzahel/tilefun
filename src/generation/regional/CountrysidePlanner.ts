import type { ActorPlacement } from "../Generator.js";
import type { FeaturePlacement } from "./DistrictStrategy.js";
import type { Bounds, Point } from "./RegionalPlanner.js";

export interface CountryPlan {
  id: string;
  kind: "farm" | "woodland";
  name: string;
  owner: { cx: number; cy: number };
  bounds: Bounds;
  center: Point;
  paths: Point[][];
  props: FeaturePlacement[];
  actors: ActorPlacement[];
}
