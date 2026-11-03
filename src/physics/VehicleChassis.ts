import type RAPIER from "@dimforge/rapier3d-compat";
import { vehicleTurningRadius } from "../traffic/Vehicle.js";
import { vehiclePerformance } from "../traffic/VehiclePerformance.js";
import contacts from "../traffic/vehicle-ground-contacts.json" with { type: "json" };
import { PHYSICS_DT, PHYSICS_PIXELS_PER_METRE as SCALE } from "./PhysicsDefaults.js";
import type { MotionIntent } from "./PhysicsState.js";
import { angleDifference } from "./VehicleMotor.js";

const clamp = (n: number, limit: number) => Math.max(-limit, Math.min(limit, n));
const dot = (a: RAPIER.Vector, b: RAPIER.Vector) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: RAPIER.Vector, b: RAPIER.Vector) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const add = (a: RAPIER.Vector, b: RAPIER.Vector) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (a: RAPIER.Vector, n: number) => ({ x: a.x * n, y: a.y * n, z: a.z * n });
function rotate(q: RAPIER.Rotation, v: RAPIER.Vector) {
  const t = mul(cross(q, v), 2);
  return add(v, add(mul(t, q.w), cross(q, t)));
}
export interface WheelContact {
  distance: number;
  normal: RAPIER.Vector;
  body?: RAPIER.RigidBody;
  id?: number;
}
export type WheelQuery = (
  origin: RAPIER.Vector,
  direction: RAPIER.Vector,
  length: number,
) => WheelContact | undefined;

/** Authored axle suspension/tire contacts prepare the ordinary chassis for ONE world step.
 * Queries use current collider poses, including immediately after replay restore.
 * No independent integrator, hidden query warm-up, wheel bodies or pose writes. */
export class VehicleChassis {
  readonly supports = new Set<number>();
  grounded = false;
  private readonly wheelbase: number;
  private readonly radius: number;
  private readonly connections: RAPIER.Vector[];
  private readonly front: boolean[];
  private readonly drivenWheels: number;
  constructor(
    readonly body: RAPIER.RigidBody,
    readonly type: string,
    width: number,
    depth: number,
    height: number,
  ) {
    this.radius = Math.min(5, depth * 0.18) / SCALE;
    const profile = contacts[type.slice(11) as keyof typeof contacts]?.contacts;
    const mounts =
      profile && profile.length >= 4
        ? profile
        : [
            { name: "FL", x: width * 0.34, y: depth * 0.4 },
            { name: "FR", x: width * 0.34, y: -depth * 0.4 },
            { name: "RL", x: -width * 0.34, y: depth * 0.4 },
            { name: "RR", x: -width * 0.34, y: -depth * 0.4 },
          ];
    this.wheelbase = Math.max(...mounts.map((p) => p.x)) - Math.min(...mounts.map((p) => p.x));
    const rest = 0.3,
      sag = 31.25 / (4 * 120);
    this.front = mounts.map((p) => p.name.startsWith("F"));
    this.drivenWheels = this.front.filter((front) => !front).length;
    this.connections = mounts.map((p) => ({
      x: p.x / SCALE,
      y: -height / 2 / SCALE + this.radius + rest - sag,
      z: p.y / SCALE,
    }));
  }
  prepare(input: MotionIntent, heading: number, query: WheelQuery, settled = false) {
    const target = input.driveSpeed ?? 0;
    if (this.body.isSleeping() && target === 0) return [];
    if (target !== 0) this.body.wakeUp();
    const q = this.body.rotation(),
      position = this.body.translation(),
      velocity = this.body.linvel(),
      angular = this.body.angvel();
    const forward = rotate(q, { x: 1, y: 0, z: 0 }),
      up = rotate(q, { x: 0, y: 1, z: 0 }),
      direction = mul(up, -1);
    const speed = dot(velocity, forward) * SCALE;
    const braking = target === 0 || target * speed < 0 || Math.abs(target) < Math.abs(speed);
    const acceleration = vehiclePerformance(this.type).acceleration * (braking ? 2 : 1);
    const engine =
      target === 0
        ? 0
        : (this.body.mass() * clamp((target - speed) / PHYSICS_DT, acceleration)) / SCALE;
    const error = input.heading === undefined ? undefined : angleDifference(input.heading, heading);
    const steer =
      error === undefined
        ? clamp(input.steering ?? 0, 1)
        : clamp((error / 0.7) * Math.sign(speed || target), 1);
    const angle = steer * Math.atan(this.wheelbase / vehicleTurningRadius(this.type));
    const impulses: { point: RAPIER.Vector; impulse: RAPIER.Vector; support?: RAPIER.RigidBody }[] =
      [];
    this.grounded = false;
    this.supports.clear();
    for (const [i, local] of this.connections.entries()) {
      const connection = add(position, rotate(q, local));
      const hit = query(connection, direction, 0.3 + this.radius + 0.22);
      if (!hit || dot(hit.normal, up) < 0.25) continue;
      const compression = 0.3 - (hit.distance - this.radius);
      if (compression <= 0) continue;
      const point = add(connection, mul(direction, hit.distance));
      const arm = add(point, mul(position, -1));
      let relative = add(velocity, cross(angular, arm));
      if (hit.body) relative = add(relative, mul(hit.body.velocityAtPoint(point), -1));
      const mass = this.body.mass();
      const load = clamp(
        Math.max(
          0,
          (mass * (120 * compression - 6 * dot(relative, hit.normal)) * 4) /
            this.connections.length,
        ),
        mass * 125,
      );
      let longitudinal = add(forward, mul(hit.normal, -dot(forward, hit.normal)));
      const length = Math.hypot(longitudinal.x, longitudinal.y, longitudinal.z);
      if (length < 0.001) continue;
      longitudinal = mul(longitudinal, 1 / length);
      let lateral = cross(longitudinal, hit.normal);
      if (this.front[i]) {
        longitudinal = add(mul(longitudinal, Math.cos(angle)), mul(lateral, Math.sin(angle)));
        lateral = cross(longitudinal, hit.normal);
      }
      // Rear-wheel propulsion; front wheels steer through lateral tire contact.
      const drive = !this.front[i] ? engine / this.drivenWheels : 0;
      const brake =
        target === 0
          ? clamp(
              (-dot(relative, longitudinal) * mass) / (2 * this.connections.length) / PHYSICS_DT,
              (mass * acceleration) / SCALE / this.connections.length,
            )
          : 0;
      let tire = add(
        mul(longitudinal, drive + brake),
        mul(lateral, (-dot(relative, lateral) * mass) / (2 * this.connections.length) / PHYSICS_DT),
      );
      const force = Math.hypot(tire.x, tire.y, tire.z),
        capacity = load * 1.5;
      if (force > capacity) tire = mul(tire, capacity / force);
      const impulse = mul(add(mul(hit.normal, load), tire), PHYSICS_DT);
      impulses.push({ point, impulse, ...(hit.body ? { support: hit.body } : {}) });
      this.grounded = true;
      if (hit.id !== undefined) this.supports.add(hit.id);
    }
    if (
      target === 0 &&
      impulses.length === this.connections.length &&
      !impulses.some((i) => i.support?.isDynamic()) &&
      settled &&
      Math.hypot(velocity.x, velocity.z) < 0.06 &&
      Math.hypot(angular.x, angular.y, angular.z) < 0.2
    ) {
      this.body.setLinvel({ x: 0, y: 0, z: 0 }, false);
      this.body.setAngvel({ x: 0, y: 0, z: 0 }, false);
      this.body.sleep();
      return [];
    }
    return impulses;
  }
}
