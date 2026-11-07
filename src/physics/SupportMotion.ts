import type RAPIER from "@dimforge/rapier3d-compat";

/** A support's pre-step motion. A turning chassis also carries riders around its
 * centre of mass, rather than only along it. Its angular state is read lazily:
 * chassis bodies change only through impulses applied after every motor is set. */
export interface SupportMotion {
  linear: RAPIER.Vector;
  chassis?: RAPIER.RigidBody;
}

export function supportVelocityAt(
  motion: SupportMotion | undefined,
  point: RAPIER.Vector,
): RAPIER.Vector | undefined {
  if (!motion?.chassis) return motion?.linear;
  const v = motion.linear,
    w = motion.chassis.angvel(),
    com = motion.chassis.worldCom(),
    rx = point.x - com.x,
    ry = point.y - com.y,
    rz = point.z - com.z;
  return {
    x: v.x + w.y * rz - w.z * ry,
    y: v.y + w.z * rx - w.x * rz,
    z: v.z + w.x * ry - w.y * rx,
  };
}
