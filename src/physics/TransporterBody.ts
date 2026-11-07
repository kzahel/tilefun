import RAPIER from "@dimforge/rapier3d-compat";
import type { Entity } from "../entities/Entity.js";
import { TRANSPORTER } from "../traffic/Transporter.js";
import { PHYSICS_PIXELS_PER_METRE as SCALE } from "./PhysicsDefaults.js";

/** Truck-local boxes [x0, x1, y0, y1, z0, z1, rise]: deck block, cab, cab guard,
 * low side guides; the deployed ramp adds two tracks rising from the toe to the
 * deck. Same retained registration as TransporterSurfacePose. */
type Part = readonly [number, number, number, number, number, number, number?];
const { rear, front, halfWidth, height, toe } = TRANSPORTER;
const BODY: Part[] = [
  [rear, front, -halfWidth, halfWidth, 0, height],
  [36, 78, -26, 26, 0, 42],
  [34, 36, -halfWidth, halfWidth, 22, 34],
  [-75, 37, -26, -24, 22.5, 25.5],
  [-75, 37, 24, 26, 22.5, 25.5],
];
// One full-width ramp: cars stay supported if they wander slightly off the two
// visible tracks. (The rendered central gap is narrower than a car's track.)
// The toe floats just above level ground (the parked chassis rides ~0.3px up).
const RAMP: Part[] = [[toe, rear, -halfWidth + 2, halfWidth - 2, 0.5, 2.5, height - 2.5]];
/** Deployment clearance: the ramp's footprint just above level ground (slight
 * suspension pitch must not count), so walls, props and raised terrain block it. */
const RAMP_CLEARANCE: Part = [toe, rear, -halfWidth + 2, halfWidth - 2, 4, 6, height - 6];
/** Pedestrian/car occupancy volume over the deployed ramp. */
const RAMP_SPACE: Part = [toe, rear, -halfWidth, halfWidth, 0.5, 40];

/** The car transporter's deck and walkable ramp in the shared world. The ramp is
 * an instantaneous replicated state; its tracks join the chassis compound. */
export class TransporterBody {
  private deployed: boolean;
  constructor(
    entity: Entity,
    private readonly halfY: number,
    private readonly clearance: number,
  ) {
    this.deployed = entity.vehicleRamp === 1;
  }
  private hull([x0, x1, y0, y1, z0, z1, rise = 0]: Part, minZ = this.clearance * SCALE) {
    const points = [z0, z1].flatMap((z) =>
      [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ].flatMap(([x = 0, y = 0]) => {
        const lift = (rise * (x - x0)) / (x1 - x0);
        return [
          x / SCALE,
          (Math.max(minZ, z) + lift) / SCALE - this.halfY - this.clearance / 2,
          y / SCALE,
        ];
      }),
    );
    const desc = RAPIER.ColliderDesc.convexHull(new Float32Array(points));
    if (!desc) throw Error("Invalid transporter part");
    return desc.shape;
  }
  private compound(parts: readonly Part[], minZ?: number) {
    const shapes = parts.map((part) => this.hull(part, minZ));
    return new RAPIER.Compound(
      shapes,
      shapes.map(() => ({ x: 0, y: 0, z: 0 })),
      shapes.map(() => ({ x: 0, y: 0, z: 0, w: 1 })),
    );
  }
  private shape() {
    // Ramp tracks reach down to the ground at the toe, below the chassis clearance.
    const body = BODY.map((part) => this.hull(part));
    const ramp = this.deployed ? RAMP.map((part) => this.hull(part, -Infinity)) : [];
    const shapes = [...body, ...ramp];
    return new RAPIER.Compound(
      shapes,
      shapes.map(() => ({ x: 0, y: 0, z: 0 })),
      shapes.map(() => ({ x: 0, y: 0, z: 0, w: 1 })),
    );
  }
  colliderDesc() {
    return new RAPIER.ColliderDesc(this.shape());
  }
  /** A deployed ramp parks the truck as fixed geometry: driving is locked, and
   * loading cars or walkers cannot shove or yaw it through the long ramp lever. */
  anchor(body: RAPIER.RigidBody) {
    const type = this.deployed ? RAPIER.RigidBodyType.Fixed : RAPIER.RigidBodyType.Dynamic;
    if (body.bodyType() !== type) body.setBodyType(type, true);
  }
  /** Ramp state is an explicit replicated edit; compile it into the collider. */
  admit(entity: Entity, collider: RAPIER.Collider, body: RAPIER.RigidBody) {
    const deployed = entity.vehicleRamp === 1;
    if (deployed === this.deployed) return;
    this.deployed = deployed;
    collider.setShape(this.shape());
    this.anchor(body);
    body.wakeUp();
  }
  /** Deployment needs the ramp's ground footprint clear of terrain and props. */
  rampClear(collider: RAPIER.Collider, statics: RAPIER.Collider | undefined) {
    return !statics?.intersectsShape(
      this.compound([RAMP_CLEARANCE], -Infinity),
      collider.translation(),
      collider.rotation(),
    );
  }
  /** Stowing must not swing the ramp through a person, cargo or a car. */
  rampOccupied(world: RAPIER.World, collider: RAPIER.Collider, body: RAPIER.RigidBody) {
    return (
      world.intersectionWithShape(
        collider.translation(),
        collider.rotation(),
        this.compound([RAMP_SPACE], -Infinity),
        undefined,
        undefined,
        collider,
        body,
        (other) => other.parent() !== null,
      ) !== null
    );
  }
}
