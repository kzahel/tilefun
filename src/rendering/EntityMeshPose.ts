import { Direction, type Entity } from "../entities/Entity.js";
import { emergencyEnabled } from "../traffic/EmergencyVehicle.js";
import { authoredTrainForType } from "./AuthoredTrainMeshes.js";
import { authoredVehicleForType } from "./AuthoredVehicleMeshes.js";
import { COMPACT_CAR_MESH, type MeshInstance, vehicleMeshRadius } from "./MeshPresentation.js";

interface Pose {
  angle: number;
  time: number;
  orientation: [number, number, number, number];
  x: number;
  y: number;
  travel: number;
  instance: MeshInstance & {
    wheelTravel: number;
    emergencyEnabled?: boolean;
    presentationTime?: number;
  };
}
export function meshAssetFor(
  entity: Pick<Entity, "type">,
  allCars3d = false,
  trainPrototype = false,
): string | undefined {
  return (
    (trainPrototype ? authoredTrainForType(entity.type)?.assetId : undefined) ??
    authoredVehicleForType(entity.type)?.assetId ??
    (allCars3d && entity.type.startsWith("vehicle-v1:") ? COMPACT_CAR_MESH : undefined)
  );
}
/** Physical ends follow the increasing path tangent on both travel directions.
 * Velocity supplies a continuous tangent, oriented by the replicated heading.
 * Straight grade carriages retain the native horizontal consist orientation. */
export function trainMeshHeading(entity: Entity): number {
  if (!entity.type.startsWith("train-curve-proof-v1")) return 0;
  const heading = ((entity.sprite?.frameRow ?? 0) * Math.PI * 2) / 256;
  const velocity = entity.velocity;
  if (!velocity || Math.hypot(velocity.vx, velocity.vy) <= 0.01) return heading;
  const moving = Math.atan2(velocity.vy, velocity.vx);
  return Math.cos(moving - heading) < 0 ? moving + Math.PI : moving;
}
export function entityHeading(entity: Entity): number {
  const velocity = entity.velocity;
  if (velocity && Math.hypot(velocity.vx, velocity.vy) > 0.01)
    return Math.atan2(velocity.vy, velocity.vx);
  return entityFacingHeading(entity);
}
export function entityFacingHeading(entity: Pick<Entity, "sprite">): number {
  switch (entity.sprite?.direction) {
    case Direction.Down:
      return Math.PI / 2;
    case Direction.Up:
      return -Math.PI / 2;
    case Direction.Left:
      return Math.PI;
    default:
      return 0;
  }
}
/** Cosmetic, view-owned orientation. Neither mesh selection nor backend clocks
 * drive it. View-owned IDs survive borrowed render clones; retain() evicts
 * unloaded entities, and scene teardown clears the view.
 */
export class EntityMeshPose {
  private poses = new Map<number, Pose>();
  constructor(
    readonly allCars3d = false,
    readonly trainPrototype = false,
  ) {}
  assetFor(entity: Pick<Entity, "type">) {
    return meshAssetFor(entity, this.allCars3d, this.trainPrototype);
  }
  retain(entities: readonly Entity[]) {
    const ids = new Set(entities.filter((e) => this.assetFor(e)).map((e) => e.id));
    for (const id of this.poses.keys()) if (!ids.has(id)) this.poses.delete(id);
  }
  evaluate(entity: Entity, time: number, position = entity.position): MeshInstance | undefined {
    const assetId = this.assetFor(entity);
    if (!assetId) return undefined;
    const train = this.trainPrototype && !!authoredTrainForType(entity.type);
    const target = train ? trainMeshHeading(entity) : entityHeading(entity);
    let pose = this.poses.get(entity.id);
    if (!pose) {
      const orientation: [number, number, number, number] = [
        0,
        0,
        Math.sin(target / 2),
        Math.cos(target / 2),
      ];
      pose = {
        angle: target,
        time,
        orientation,
        x: position.wx,
        y: position.wy,
        travel: 0,
        instance: {
          assetId,
          orientation,
          radius: vehicleMeshRadius(assetId),
          wheelTravel: 0,
        },
      };
      this.poses.set(entity.id, pose);
    } else {
      const elapsed = time - pose.time;
      const dx = position.wx - pose.x,
        dy = position.wy - pose.y;
      // Teleports, visibility gaps and clock fences establish a new sample,
      // rather than spinning wheels through an unseen displacement.
      const distance = Math.hypot(dx, dy);
      if (elapsed > 0 && elapsed <= 0.25 && distance <= 32) {
        pose.travel += dx * Math.cos(target) + dy * Math.sin(target);
        // Point along this body's displayed motion, with no separate turn lag.
        // Repeated/resting samples retain the last heading, including diagonals.
        if (distance > 0.001 && !train) pose.angle = Math.atan2(dy, dx);
      } else if (
        elapsed > 0 &&
        entity.velocity &&
        Math.hypot(entity.velocity.vx, entity.velocity.vy) > 0.01
      ) {
        // A new timeline/teleport sample uses velocity, never teleport displacement.
        pose.angle = target;
      }
      pose.x = position.wx;
      pose.y = position.wy;
      pose.instance.wheelTravel = pose.travel;
      pose.time = time;
      if (train) pose.angle = target;
      pose.orientation[2] = Math.sin(pose.angle / 2);
      pose.orientation[3] = Math.cos(pose.angle / 2);
    }
    pose.instance.emergencyEnabled = emergencyEnabled(entity.emergencyState);
    pose.instance.presentationTime = time;
    return pose.instance;
  }
  clear() {
    this.poses.clear();
  }
}
