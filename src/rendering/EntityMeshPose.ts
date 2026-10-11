import { Direction, type Entity } from "../entities/Entity.js";
import { COMPACT_CAR_MESH, type MeshInstance } from "./MeshPresentation.js";

interface Pose {
  angle: number;
  time: number;
  orientation: [number, number, number, number];
  x: number;
  y: number;
  travel: number;
  instance: MeshInstance & { wheelTravel: number };
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
 * drive it. View-owned IDs survive borrowed render clones; retain() evicts
 * unloaded entities, and scene teardown clears the view.
 */
export class EntityMeshPose {
  private poses = new Map<number, Pose>();
  retain(entities: readonly Entity[]) {
    const ids = new Set(entities.filter((e) => meshAssetFor(e)).map((e) => e.id));
    for (const id of this.poses.keys()) if (!ids.has(id)) this.poses.delete(id);
  }
  evaluate(entity: Entity, time: number, position = entity.position): MeshInstance | undefined {
    const assetId = meshAssetFor(entity);
    if (!assetId) return undefined;
    const target = entityHeading(entity);
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
        instance: { assetId, orientation, radius: 64, wheelTravel: 0 },
      };
      this.poses.set(entity.id, pose);
    } else {
      const elapsed = time - pose.time;
      const dx = position.wx - pose.x,
        dy = position.wy - pose.y;
      // Teleports, visibility gaps and clock fences establish a new sample,
      // rather than spinning wheels through an unseen displacement.
      if (elapsed > 0 && elapsed <= 0.25 && Math.hypot(dx, dy) <= 32)
        pose.travel += dx * Math.cos(target) + dy * Math.sin(target);
      pose.x = position.wx;
      pose.y = position.wy;
      pose.instance.wheelTravel = pose.travel;
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
    this.poses.clear();
  }
}
