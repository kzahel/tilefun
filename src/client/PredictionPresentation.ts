import { getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import { interpolateRotation } from "../physics/BodyRotation.js";
import type { PhysicsScene } from "../physics/PhysicsScene.js";
import { interpolateHeading } from "../rendering/PresentationTimeline.js";

/** Select nearby bodies during active play so potential contacts share a tick. */
export function activePresentationIds(
  player: Entity,
  published: ReadonlyMap<number, Entity>,
  local: ReadonlySet<number>,
): Set<number> {
  const root = player.parentId ?? player.id;
  const ids = new Set(local);
  const anchor = published.get(root) ?? player;
  if (!anchor.collider) return ids;
  const a = getEntityAABB(anchor.position, anchor.collider);
  for (const entity of published.values()) {
    if (!entity.collider) continue;
    const b = getEntityAABB(entity.position, entity.collider);
    const dx = Math.max(a.left - b.right, b.left - a.right, 0);
    const dy = Math.max(a.top - b.bottom, b.top - a.bottom, 0);
    if (Math.hypot(dx, dy) <= 24) ids.add(entity.id);
  }
  return ids;
}

/** Include every solved contact and every member of a prescribed group. */
export function expandCoherentMembers(
  members: Set<number>,
  published: ReadonlyMap<number, Entity>,
  scene: Pick<PhysicsScene, "contactIds"> | undefined,
): void {
  const groups = new Map<number, number[]>();
  for (const e of published.values()) {
    if (e.physicsGroupId === undefined) continue;
    const ids = groups.get(e.physicsGroupId) ?? [];
    ids.push(e.id);
    groups.set(e.physicsGroupId, ids);
  }
  for (const id of members) {
    for (const neighbor of scene?.contactIds(id) ?? []) members.add(neighbor);
    const group = published.get(id)?.physicsGroupId;
    if (group !== undefined) for (const member of groups.get(group) ?? []) members.add(member);
  }
}

/** Resolve the committed interpolation interval once, before any scene drawing. */
export function samplePredictedPose(
  predicted: Entity,
  alpha: number,
  sprite: Entity["sprite"],
  offset = { x: 0, y: 0, z: 0 },
): Entity {
  const prev = predicted.prevPosition ?? predicted.position;
  const position = {
    wx: prev.wx + (predicted.position.wx - prev.wx) * alpha + offset.x,
    wy: prev.wy + (predicted.position.wy - prev.wy) * alpha + offset.y,
  };
  const z =
    (predicted.prevWz ?? predicted.wz ?? 0) * (1 - alpha) + (predicted.wz ?? 0) * alpha + offset.z;
  const rotation =
    predicted.bodyRotation &&
    interpolateRotation(
      predicted.prevBodyRotation ?? predicted.bodyRotation,
      predicted.bodyRotation,
      alpha,
    );
  return {
    ...predicted,
    sprite,
    position,
    prevPosition: position,
    wz: z,
    prevWz: z,
    ...(rotation ? { bodyRotation: rotation, prevBodyRotation: rotation } : {}),
    ...(predicted.vehicleHeading === undefined
      ? {}
      : {
          vehicleHeading: interpolateHeading(
            predicted.prevVehicleHeading ?? predicted.vehicleHeading,
            predicted.vehicleHeading,
            alpha,
          ),
        }),
  };
}
