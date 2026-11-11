import type RAPIER from "@dimforge/rapier3d-compat";
import { JUMP_GRAVITY } from "../config/constants.js";
import { vehicleTurningRadius } from "../traffic/Vehicle.js";
import { SURFACE_GRIP, SURFACE_SPEED } from "../traffic/VehicleHandling.js";
import { vehiclePerformance } from "../traffic/VehiclePerformance.js";
import type { GroundMaterial } from "./GroundMaterial.js";
import { PHYSICS_DT, PHYSICS_PIXELS_PER_METRE as SCALE } from "./PhysicsDefaults.js";
import type { MotionIntent } from "./PhysicsState.js";
import { vehicleAxles } from "./VehicleAxles.js";
import { angleDifference } from "./VehicleMotor.js";
import { VehicleVectors, WheelImpulses } from "./VehicleVectors.js";

/** Drive/brake tire friction coefficient (fraction of wheel load). */
export const TIRE_GRIP = 1.5;
/** Cornering friction coefficient; below TIRE_GRIP so hard turns slide rather than roll. */
export const TIRE_CORNERING_GRIP = 1.2;
/** Full-lock lateral demand at speed (world px/s²), slightly under cornering grip. */
export const STEERING_LATERAL_ACCELERATION = 0.9 * TIRE_CORNERING_GRIP * JUMP_GRAVITY;
/** Most surface drag (sand, water) as a multiple of a vehicle's acceleration rating. */
export const SURFACE_DRAG_LIMIT = 3;

const clamp = (n: number, limit: number) => Math.max(-limit, Math.min(limit, n));
const dot = (a: RAPIER.Vector, b: RAPIER.Vector) => a.x * b.x + a.y * b.y + a.z * b.z;
const FORWARD = { x: 1, y: 0, z: 0 },
  UP = { x: 0, y: 1, z: 0 };
export interface WheelContact {
  distance: number;
  normal: RAPIER.Vector;
  body?: RAPIER.RigidBody;
  id?: number;
  /** Surface under the wheel; absent means pavement. */
  material?: GroundMaterial;
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
  private readonly vectors = new VehicleVectors();
  private readonly output = new WheelImpulses();
  grounded = false;
  private readonly axles: ReturnType<typeof vehicleAxles>;
  constructor(
    readonly body: RAPIER.RigidBody,
    readonly type: string,
    width: number,
    depth: number,
    height: number,
  ) {
    this.axles = vehicleAxles(type, width, depth, height);
  }
  /** Results are borrowed until the next prepare on THIS chassis; all chassis prepare
   * before any impulses are applied. @param coast free-rolling towed wheels. */
  prepare(input: MotionIntent, heading: number, query: WheelQuery, coast = false) {
    const v = this.vectors,
      impulses = this.output.values;
    v.reset();
    this.output.reset();
    const target = input.driveSpeed ?? 0;
    if (this.body.isSleeping() && target === 0) return impulses;
    if (target !== 0) this.body.wakeUp();
    const q = this.body.rotation(),
      position = this.body.translation(),
      velocity = this.body.linvel(),
      angular = this.body.angvel();
    const forward = v.rotate(q, FORWARD),
      up = v.rotate(q, UP),
      direction = v.mul(up, -1);
    const speed = dot(velocity, forward) * SCALE;
    const braking = target === 0 || target * speed < 0 || Math.abs(target) < Math.abs(speed);
    const performance = vehiclePerformance(this.type);
    const acceleration = performance.acceleration * (braking ? 2 : 1);
    const engine =
      target === 0
        ? 0
        : (this.body.mass() * clamp((target - speed) / PHYSICS_DT, acceleration)) / SCALE;
    const steer =
      input.heading === undefined
        ? clamp(input.steering ?? 0, 1)
        : clamp((angleDifference(input.heading, heading) / 0.7) * Math.sign(speed || target), 1);
    // Full lock reaches the authored turning radius at low speed; faster, the
    // angle narrows so the bicycle-model lateral demand v²·tan(a)/wheelbase
    // stays near tire grip instead of rolling the chassis over.
    const lock = Math.min(
      Math.atan(this.axles.wheelbase / vehicleTurningRadius(this.type)),
      Math.atan(
        (STEERING_LATERAL_ACCELERATION * this.axles.wheelbase) / Math.max(1, speed * speed),
      ),
    );
    const angle = steer * lock;
    this.grounded = false;
    this.supports.clear();
    for (let i = 0; i < this.axles.connections.length; i++) {
      const local = this.axles.connections[i];
      if (!local) continue;
      const connection = v.add(position, v.rotate(q, local));
      const hit = query(connection, direction, 0.3 + this.axles.radius + 0.22);
      if (!hit || dot(hit.normal, up) < 0.25) continue;
      const compression = 0.3 - (hit.distance - this.axles.radius);
      if (compression <= 0) continue;
      const point = v.add(connection, v.mul(direction, hit.distance));
      const arm = v.add(point, v.mul(position, -1));
      let relative = v.add(velocity, v.cross(angular, arm));
      if (hit.body) relative = v.add(relative, v.mul(hit.body.velocityAtPoint(point), -1));
      const mass = this.body.mass();
      const load = clamp(
        Math.max(
          0,
          (mass * (120 * compression - 6 * dot(relative, hit.normal)) * 4) /
            this.axles.connections.length,
        ),
        mass * 125,
      );
      let longitudinal = v.add(forward, v.mul(hit.normal, -dot(forward, hit.normal)));
      const length = Math.hypot(longitudinal.x, longitudinal.y, longitudinal.z);
      if (length < 0.001) continue;
      longitudinal = v.mul(longitudinal, 1 / length);
      // Engine force follows the chassis' rolling direction on every layout:
      // lateral tire grip responds one tick late, so a steered push from rest
      // would strafe the body. Front drive is felt through the shared front
      // grip budget instead (power in a turn runs wide).
      const rolling = longitudinal;
      let lateral = v.cross(longitudinal, hit.normal);
      if (this.axles.front[i]) {
        longitudinal = v.add(v.mul(longitudinal, Math.cos(angle)), v.mul(lateral, Math.sin(angle)));
        lateral = v.cross(longitudinal, hit.normal);
      }
      const drive = this.axles.driven[i] ? engine / this.axles.drivenWheels : 0;
      const brake =
        target === 0 && !coast
          ? clamp(
              (-dot(relative, longitudinal) * mass) /
                (2 * this.axles.connections.length) /
                PHYSICS_DT,
              (mass * acceleration) / SCALE / this.axles.connections.length,
            )
          : 0;
      // Friction ellipse: full drive/brake grip, lower cornering grip so a hard
      // turn slides before the ground-level tire force rolls the chassis. The
      // tire/surface pair scales both (pavement is the ceiling).
      const material = hit.material ?? "paved";
      const grip = SURFACE_GRIP[this.axles.handling.tires][material];
      const across =
        (-dot(relative, lateral) * mass) / (2 * this.axles.connections.length) / PHYSICS_DT;
      // Drive acts along the chassis, so on a steered wheel it has a component
      // across the tire; budget the actual resultant in the wheel's frame.
      const usage =
        Math.hypot(
          (drive * dot(rolling, longitudinal) + brake) / (TIRE_GRIP * grip),
          (across + drive * dot(rolling, lateral)) / (TIRE_CORNERING_GRIP * grip),
        ) / Math.max(load, 1e-9);
      const scale = usage > 1 ? 1 / usage : 1;
      // Rolling drag (sand, water) outside the grip budget: quadratic in rolling
      // speed so launches stay brisk, rated so full engine force balances at that
      // surface's fraction of base top speed, capped at SURFACE_DRAG_LIMIT× the
      // acceleration rating so arriving at boost speed slows rather than stops.
      // Each wheel's share follows its load (a skimming wheel barely drags).
      const sustained = SURFACE_SPEED[this.axles.handling.tires][material];
      const rollingSpeed = (dot(relative, longitudinal) * SCALE) / (sustained * performance.speed);
      const weight = clamp(
        load / ((mass * JUMP_GRAVITY) / SCALE / this.axles.connections.length),
        2,
      );
      const drag =
        sustained < 1
          ? (-clamp(rollingSpeed * Math.abs(rollingSpeed), SURFACE_DRAG_LIMIT) *
              Math.max(0, weight) *
              mass *
              performance.acceleration) /
            SCALE /
            this.axles.connections.length
          : 0;
      const tire = v.add(
        v.add(v.mul(rolling, drive * scale), v.mul(longitudinal, brake * scale + drag)),
        v.mul(lateral, across * scale),
      );
      const impulse = v.mul(v.add(v.mul(hit.normal, load), tire), PHYSICS_DT);
      this.output.push(point, impulse, hit.body);
      this.grounded = true;
      if (hit.id !== undefined) this.supports.add(hit.id);
    }
    return impulses;
  }
}
