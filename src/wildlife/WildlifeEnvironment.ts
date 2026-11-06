import type { Entity, PositionComponent } from "../entities/Entity.js";
import type { AiPlanningScheduler } from "../server/AiPlanningScheduler.js";
import type { BrowsingRock } from "./BrowsingRocks.js";
import type { RobinPerch } from "./Robin.js";
import type { ClimbTree } from "./TreeClimbing.js";

/** Synchronous occupancy queries need geometry, not an actor's AI/persistent state. */
export type WildlifeBody = Pick<Entity, "collider" | "wz">;

export interface WildlifeEnvironment {
  /** Ready local actors, excluding inert materials; acquisition still has its normal quota. */
  huntCandidates?(hunter: Entity, radius: number): readonly Entity[];
  animalWork?(animal: Entity, dt: number, planning?: AiPlanningScheduler): boolean;
  ensurePredatorDen?(animal: Entity): void;
  predatorPerches?(home: PositionComponent, radius: number): readonly RobinPerch[];
  canOccupy(body: WildlifeBody, point: PositionComponent): boolean;
  isWater(point: PositionComponent): boolean;
  isDeepWater?(point: PositionComponent): boolean;
  surfaceZ?(point: PositionComponent): number;
  climbTrees?(home: PositionComponent, radius: number): readonly ClimbTree[];
  browsingRocks?(home: PositionComponent, radius: number): readonly BrowsingRock[];
  perches?(home: PositionComponent, radius: number): readonly RobinPerch[];
}
