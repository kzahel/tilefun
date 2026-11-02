import type { RailPath } from "./RailPath.js";
import type { RailLine } from "./RailwayPlanner.js";

/** Legacy straight tile route, or an opt-in world-pixel alignment with station distances. */
export type RailRoute = Pick<RailLine, "id" | "y" | "start" | "end"> & {
  stations?: Pick<RailLine, "stations">["stations"];
  path?: RailPath;
  /** Authored straight grade proof. Generated services retain their flat whole-train body. */
  surfaceFollowing?: { startZ: number; endZ: number; startAtEnd?: boolean };
};
export interface RailRouteSource {
  query(bounds: { minX: number; maxX: number; minY: number; maxY: number }): RailRoute[];
}
