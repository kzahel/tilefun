import { rapierRotation, rotateBodyVector, rotationsEqual, yawRotation } from "./BodyRotation.js";
import { PHYSICS_PIXELS_PER_METRE as SCALE } from "./PhysicsDefaults.js";
import type { SceneBody } from "./SceneBody.js";

/** Commit explicit entity edits without integrating. Publication uses the same
 * boundary, so a paused teleport/launch cannot mix new entities with old bodies. */
export function admitEntityEdits(
  entry: SceneBody,
  origin: { x: number; z: number },
  contacts: Map<number, Set<number>>,
) {
  const entity = entry.entity,
    s = entry.state;
  entry.bed?.admit(entity, s, entry.collider);
  entry.transporter?.admit(entity, entry.collider, entry.body);
  const moved =
    entity.position.wx !== s.x || entity.position.wy !== s.y || (entity.wz ?? 0) !== s.z;
  const velocityChanged =
    (entity.velocity?.vx ?? 0) !== s.vx ||
    (entity.velocity?.vy ?? 0) !== s.vy ||
    (entity.jumpVZ !== undefined && entity.jumpVZ !== s.vz);
  const grounded = entity.jumpVZ === undefined;
  const rotated =
    entry.kind === "vehicle" &&
    !!entity.bodyRotation &&
    !rotationsEqual(entity.bodyRotation, s.rotation);
  if (!moved && !rotated && !velocityChanged && grounded === s.grounded) return;
  entry.rested = 0;
  entry.dormant = entry.centred = false;
  const rotation = entity.bodyRotation ?? s.rotation ?? yawRotation(s.heading);
  const center = rotateBodyVector(rotation, 0, 0, entry.halfY);
  if (rotated) turnBody(entry, rotation);
  if (moved || rotated)
    entry.body.setTranslation(
      {
        x: entity.position.wx / SCALE + entry.offsetX + center.x - origin.x,
        y: (entity.wz ?? 0) / SCALE + center.z,
        z: entity.position.wy / SCALE + entry.offsetY + center.y - origin.z,
      },
      true,
    );
  if (velocityChanged || grounded !== s.grounded)
    entry.body.setLinvel(
      {
        x: (entity.velocity?.vx ?? 0) / SCALE,
        y: (entity.jumpVZ ?? 0) / SCALE,
        z: (entity.velocity?.vy ?? 0) / SCALE,
      },
      true,
    );
  adoptEdit(entry, moved, grounded, contacts);
}

/** The cached state follows the edited entity; solved support and contacts are void. */
function adoptEdit(
  entry: SceneBody,
  moved: boolean,
  grounded: boolean,
  contacts: Map<number, Set<number>>,
) {
  const entity = entry.entity,
    s = entry.state;
  s.x = entity.position.wx;
  s.y = entity.position.wy;
  s.z = entity.wz ?? 0;
  if (moved) {
    s.prevX = s.x;
    s.prevY = s.y;
    s.prevZ = s.z;
    s.prevHeading = s.heading;
  }
  s.vx = entity.velocity?.vx ?? 0;
  s.vy = entity.velocity?.vy ?? 0;
  s.vz = entity.jumpVZ ?? 0;
  s.grounded = grounded;
  s.groundZ = entity.groundZ ?? s.z;
  s.normalX = s.normalZ = 0;
  s.normalY = 1;
  delete s.supportId;
  delete s.inheritedVx;
  delete s.inheritedVy;
  delete s.jumpQueued;
  for (const neighbor of contacts.get(entity.id) ?? []) contacts.get(neighbor)?.delete(entity.id);
  contacts.delete(entity.id);
}

function turnBody(entry: SceneBody, rotation: NonNullable<SceneBody["state"]["rotation"]>) {
  const entity = entry.entity,
    s = entry.state;
  entry.body.setRotation(rapierRotation(rotation), true);
  const [x, y, z] = entity.bodyAngularVelocity ?? [0, 0, 0];
  entry.body.setAngvel({ x: -x, y: -z, z: -y }, true);
  s.rotation = s.prevRotation = rotation;
  const forward = rotateBodyVector(rotation, 1, 0, 0);
  if (Math.hypot(forward.x, forward.y) > 0.001)
    s.heading = s.prevHeading = Math.atan2(forward.y, forward.x);
  s.angularVelocity = entity.bodyAngularVelocity ?? [0, 0, 0];
}
