import { required } from "../art/ArtCatalog.js";
import { aabbOverlapsPropWalls, aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import type { EntityManager } from "../entities/EntityManager.js";
import type { PropManager } from "../entities/PropManager.js";
import { RoadType } from "../road/RoadType.js";
import type { World } from "../world/World.js";
import { createCurveTrain, curveOffsets } from "./CurveTrain.js";
import { railAlignment, wrapDistance } from "./RailPath.js";
import { drivenTrainSpeed, type RailService } from "./RailwaySystem.js";
import { carryTrainPassengers, planTrainPassengers } from "./TrainPassengers.js";

/** One exclusive service per path, advancing by arc length, never by global X. */
export function stepCurvedTrain(
  s: RailService,
  dt: number,
  world: World,
  entities: EntityManager,
  props: PropManager,
  excludedRiderIds?: ReadonlySet<number>,
): void {
  const alignment = railAlignment(required(s.line.path));
  const record = s.record;
  if (s.driverId === undefined && record.dwell > 0) {
    record.dwell = Math.max(0, record.dwell - dt);
    s.speed = 0;
    return;
  }
  if (s.driverId !== undefined && s.speed === 0 && s.driveInput)
    record.target = s.driveInput > 0 ? 1 : 0;
  const stop = required(
    alignment.path.stops[
      s.driverId !== undefined
        ? record.target
          ? alignment.path.stops.length - 1
          : 0
        : required(record.nextStop)
    ],
  );
  const direction = record.target ? 1 : -1;
  const distance =
    s.driverId !== undefined && alignment.path.closed
      ? Infinity
      : alignment.path.closed
        ? wrapDistance((stop.distance - required(record.distance)) * direction, alignment.length)
        : Math.abs(stop.distance - required(record.distance));
  if (distance < 0.001) {
    record.distance = stop.distance;
    s.speed = 0;
    if (s.driverId !== undefined) return;
    record.dwell = 8;
    if (
      !alignment.path.closed &&
      (record.nextStop === 0 || record.nextStop === alignment.path.stops.length - 1)
    )
      record.target = record.target === 0 ? 1 : 0;
    record.nextStop =
      (required(record.nextStop) + (record.target ? 1 : -1) + alignment.path.stops.length) %
      alignment.path.stops.length;
    return;
  }
  if (s.driverId !== undefined) drivenTrainSpeed(s, dt, distance);
  else s.speed = Math.min(192, s.speed + 96 * dt, Math.sqrt(2 * 96 * distance));
  const travel = Math.min(distance, s.speed * dt);
  const nextDistance =
    travel >= distance
      ? stop.distance
      : alignment.path.closed
        ? wrapDistance(required(record.distance) + direction * travel, alignment.length)
        : required(record.distance) + direction * travel;
  const poses = createCurveTrain(alignment, nextDistance);
  const offsets = curveOffsets(alignment, nextDistance);
  const passengers: NonNullable<ReturnType<typeof planTrainPassengers>> = [];
  for (const [i, nextCar] of poses.entries()) {
    const car = required(s.carriages[i]);
    const plan = planTrainPassengers(car, nextCar, entities, props, world, excludedRiderIds);
    if (!plan) {
      s.speed = 0;
      return;
    }
    passengers.push(...plan);
    const current = getEntityAABB(car.position, required(car.collider));
    const next = getEntityAABB(nextCar.position, required(nextCar.collider));
    // Conservative swept envelopes bound the rotation as well as translation.
    const swept = {
      left: Math.min(current.left, next.left) - 1,
      right: Math.max(current.right, next.right) + 1,
      top: Math.min(current.top, next.top) - 1,
      bottom: Math.max(current.bottom, next.bottom) + 1,
    };
    for (let x = Math.floor(swept.left / 16); x <= Math.floor(swept.right / 16); x++)
      for (let y = Math.floor(swept.top / 16); y <= Math.floor(swept.bottom / 16); y++)
        if (
          !world.getChunkIfLoaded(Math.floor(x / 16), Math.floor(y / 16)) ||
          world.getHeightAt(x, y) !== 0
        ) {
          s.speed = 0;
          return;
        }
    // Wheels follow the rail centerline; the carriage may overhang a curve.
    for (const bogie of [-36, 0, 36]) {
      const p = alignment.sample(nextDistance + required(offsets[i]) + bogie);
      if (world.getRoadAt(Math.floor(p.x / 16), Math.floor(p.y / 16)) !== RoadType.RailCurveProof) {
        s.speed = 0;
        return;
      }
    }
    const r = {
      minCx: Math.floor(swept.left / 256),
      maxCx: Math.floor(swept.right / 256),
      minCy: Math.floor(swept.top / 256),
      maxCy: Math.floor(swept.bottom / 256),
    };
    for (const p of props.getPropsInChunkRange(r.minCx, r.minCy, r.maxCx, r.maxCy))
      if (aabbOverlapsPropWalls(swept, p.position, p, 0, 44)) {
        s.speed = 0;
        return;
      }
    for (const other of entities.spatialHash.queryRange(r.minCx, r.minCy, r.maxCx, r.maxCy)) {
      if (
        s.carriages.includes(other) ||
        !other.collider ||
        other.collider.solid === false ||
        other.flashHidden ||
        (other.wz ?? 0) >= 44 ||
        (other.wz ?? 0) + (other.collider.physicalHeight ?? Infinity) <= 0
      )
        continue;
      if (aabbsOverlap(swept, getEntityAABB(other.position, other.collider))) {
        s.speed = 0;
        return;
      }
    }
  }
  // Commit atomically only after every body has cleared its next pose.
  record.distance = nextDistance;
  carryTrainPassengers(passengers, entities);
  for (const [i, car] of s.carriages.entries()) {
    const next = required(poses[i]);
    car.velocity = {
      vx: (next.position.wx - car.position.wx) / dt,
      vy: (next.position.wy - car.position.wy) / dt,
    };
    car.position = next.position;
    car.collider = next.collider;
    required(car.sprite).frameRow = required(next.sprite).frameRow;
  }
}
