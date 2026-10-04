import { Direction, type Entity } from "../entities/Entity.js";
import { COMPACT_CAR_MESH, type MeshInstance } from "./MeshPresentation.js";

interface Pose {
  angle: number;
  time: number;
  orientation: [number, number, number, number];
  instance: MeshInstance;
}
export function meshAssetFor(entity: Pick<Entity, "type">): string | undefined {
  return entity.type === "vehicle-v1:compact-1" ? COMPACT_CAR_MESH : undefined;
}
export function entityHeading(entity: Entity): number {
  const velocity = entity.velocity;
  if (velocity && Math.hypot(velocity.vx, velocity.vy) > 0.01)
    return Math.atan2(velocity.vy, velocity.vx);
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
 * drive it. Weak entity keys cannot retain unloaded entities or recycled IDs.
 */
export class EntityMeshPose {
  private poses = new WeakMap<Entity, Pose>();
  evaluate(entity: Entity, time: number): MeshInstance | undefined {
    const assetId = meshAssetFor(entity);
    if (!assetId) return undefined;
    const target = entityHeading(entity);
    let pose = this.poses.get(entity);
    if (!pose) {
      const orientation: [number, number, number, number] = [
        0,
        0,
        Math.sin(target / 2),
        Math.cos(target / 2),
      ];
      pose = { angle: target, time, orientation, instance: { assetId, orientation, radius: 64 } };
      this.poses.set(entity, pose);
    } else {
      const dt = Math.max(0, Math.min(0.1, time - pose.time));
      const difference = Math.atan2(Math.sin(target - pose.angle), Math.cos(target - pose.angle));
      pose.angle += Math.max(-dt * Math.PI * 2, Math.min(dt * Math.PI * 2, difference));
      pose.time = time;
      pose.orientation[2] = Math.sin(pose.angle / 2);
      pose.orientation[3] = Math.cos(pose.angle / 2);
    }
    return pose.instance;
  }
  clear() {
    this.poses = new WeakMap();
  }
}
