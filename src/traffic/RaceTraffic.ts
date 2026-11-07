import { CHUNK_SIZE_PX, ELEVATION_PX } from "../config/constants.js";
import { physicsBodyDimensions } from "../physics/PhysicsBodies.js";
import type { MotionIntent } from "../physics/PhysicsState.js";
import { CONTROL_HOLD_TICKS } from "../physics/PlayerControls.js";
import { angleDifference } from "../physics/VehicleMotor.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import { type Lane, type LaneGraph, nextLanes, samplePath } from "./LaneGraph.js";
import { projectRoad } from "./RoadProjection.js";
import { vehicleNoseHeading, vehicleTurningRadius } from "./Vehicle.js";
import type { VehicleRegistry, VehicleState } from "./VehicleRegistry.js";

const inRanges = (ranges: readonly ChunkRange[], x: number, y: number) =>
  ranges.some(
    (a) =>
      x >= a.minCx * CHUNK_SIZE_PX &&
      x < (a.maxCx + 1) * CHUNK_SIZE_PX &&
      y >= a.minCy * CHUNK_SIZE_PX &&
      y < (a.maxCy + 1) * CHUNK_SIZE_PX,
  );

/** A fixed, durable starting grid: one racer at the middle of each speedway quarter.
 * Moved racers keep their identity; deleted ones never refill their slot. */
export function populateRacers(
  r: VehicleRegistry,
  graph: LaneGraph,
  ranges: readonly ChunkRange[],
  identities: Set<string | undefined>,
) {
  for (const lane of graph.lanes.values()) {
    if (!lane.race) continue;
    const p = samplePath(lane.path, lane.path.length / 2);
    const identity = `traffic-v1:${lane.id}:racer`;
    if (!inRanges(ranges, p.x, p.y) || identities.has(identity) || !r.canSpawn(identity, p.x, p.y))
      continue;
    const ground = r.world.getHeightAt(Math.floor(p.x / 16), Math.floor(p.y / 16)) * ELEVATION_PX;
    const state = r.place(lane.race.model, p.x, p.y, p.direction, undefined, identity, ground);
    if (!state) continue;
    state.entity.vehicleHeading = Math.atan2(
      samplePath(lane.path, lane.path.length / 2 + 1).y - p.y,
      samplePath(lane.path, lane.path.length / 2 + 1).x - p.x,
    );
    state.autonomous = true;
    state.route = { laneId: lane.id, choices: 0 };
    identities.add(identity);
    r.onChange?.(state, false);
  }
}

/** Racers follow their closed ring at its race speed. Quarter lanes join on a
 * shared tangent, so there is no junction, reservation or turn path. Following
 * distance still stops them for people, cars and edits on the circuit. */
export function planRacer(
  r: VehicleRegistry,
  state: VehicleState,
  lane: Lane,
  graph: LaneGraph,
  physicsTick: number,
  following: (speed: number, halfLength: number, halfWidth: number) => number,
): MotionIntent | undefined {
  if (!lane.race) return undefined;
  const e = state.entity,
    size = physicsBodyDimensions(e);
  const next = nextLanes(graph, lane).find((l) => l.race);
  const progress = projectRoad(lane.path, e.position.wx, e.position.wy).progress;
  const rolling = Math.hypot(e.velocity?.vx ?? 0, e.velocity?.vy ?? 0);
  const lookahead = Math.max(32, Math.min(96, 24 + rolling * 0.4));
  const ahead = progress + lookahead;
  const aim =
    ahead > lane.path.length && next
      ? samplePath(next.path, ahead - lane.path.length)
      : samplePath(lane.path, ahead);
  const error = angleDifference(
    Math.atan2(aim.y - e.position.wy, aim.x - e.position.wx),
    vehicleNoseHeading(e),
  );
  let speed = following(lane.race.speed, size.width / 2, size.depth / 2);
  if (
    r.world.getCollisionIfLoaded(Math.floor(aim.x / 16), Math.floor(aim.y / 16)) &
    CollisionFlag.Solid
  )
    speed = 0;
  if (lane.path.length - progress <= 6 && next && state.route) {
    state.route = { laneId: next.id, choices: state.route.choices + 1 };
    r.onChange?.(state, false);
  }
  return {
    vx: 0,
    vy: 0,
    controlUntil: physicsTick + CONTROL_HOLD_TICKS,
    driveSpeed: speed,
    steering: Math.max(
      -1,
      Math.min(1, (2 * vehicleTurningRadius(e.type) * Math.sin(error)) / lookahead),
    ),
  };
}
