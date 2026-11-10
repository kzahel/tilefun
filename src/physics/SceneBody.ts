import RAPIER from "@dimforge/rapier3d-compat";
import { isBoat } from "../boats/Boat.js";
import type { Entity } from "../entities/Entity.js";
import { isTrain } from "../railway/Train.js";
import { hasDumpBed } from "../traffic/DumpBed.js";
import { isTransporter } from "../traffic/Transporter.js";
import { rapierRotation, rotateBodyVector, yawRotation } from "./BodyRotation.js";
import { DumpBedBody, setChassisBoxMass } from "./DumpBedBody.js";
import type { physicsBodyDimensions } from "./PhysicsBodies.js";
import { PHYSICS_PIXELS_PER_METRE as SCALE } from "./PhysicsDefaults.js";
import type { PhysicsBodyKind, PhysicsBodyState } from "./PhysicsState.js";
import { TransporterBody } from "./TransporterBody.js";
import { VehicleChassis } from "./VehicleChassis.js";

/** Wheeled chassis centre-of-mass height as a fraction of body height above its base. */
export const CHASSIS_CENTRE_OF_MASS = 0.3;

/** One admitted body in the shared scene: its Rapier body/collider, cached numerical
 * state, and optional chassis or articulated equipment. */
export interface SceneBody {
  entity: Entity;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  kind: PhysicsBodyKind;
  /** Outer dimensions the body was built from. */
  shape: Dimensions;
  /** The synchronize pass that last admitted this body. */
  syncPass: number;
  halfY: number;
  offsetX: number;
  offsetY: number;
  state: PhysicsBodyState;
  incomingVelocity: RAPIER.Vector;
  chassis?: VehicleChassis;
  bed?: DumpBedBody;
  transporter?: TransporterBody;
  queryRadius: number;
  queryCenter: RAPIER.Vector;
  /** Consecutive readbacks that found the body asleep, capped at two. */
  rested: number;
  /** A resting motor on static ground whose idle intent needs no further work. */
  dormant: boolean;
  /** `queryCenter` was captured while the body rested and is still its pose. */
  centred: boolean;
  /** The last readback found the pose bit-identical to the tick before. */
  unmoved: boolean;
  /** Bodies in solved contact at the last full readback. */
  touching: number[];
}

type Dimensions = ReturnType<typeof physicsBodyDimensions>;

function rigidBody(
  world: RAPIER.World,
  origin: { x: number; z: number },
  entity: Entity,
  kind: PhysicsBodyKind,
  d: Dimensions,
  car: boolean,
) {
  const halfY = d.height / 2 / SCALE;
  const rotation = entity.bodyRotation ?? yawRotation(d.yaw);
  const center = rotateBodyVector(rotation, 0, 0, halfY);
  const desc = isTrain(entity)
    ? RAPIER.RigidBodyDesc.kinematicVelocityBased()
    : kind === "fixed"
      ? RAPIER.RigidBodyDesc.fixed()
      : RAPIER.RigidBodyDesc.dynamic().setCcdEnabled(true);
  desc.setTranslation(
    entity.position.wx / SCALE + d.offsetX / SCALE + center.x - origin.x,
    (entity.wz ?? 0) / SCALE + center.z,
    entity.position.wy / SCALE + d.offsetY / SCALE + center.y - origin.z,
  );
  if (kind === "vehicle") desc.setRotation(rapierRotation(rotation));
  if (car) desc.setAngularDamping(0.35);
  else if (kind !== "loose") desc.enabledRotations(false, kind === "vehicle", false);
  else desc.lockRotations().setLinearDamping(1.5);
  const body = world.createRigidBody(desc);
  body.setLinvel(
    {
      x: (entity.velocity?.vx ?? 0) / SCALE,
      y: (entity.jumpVZ ?? 0) / SCALE,
      z: (entity.velocity?.vy ?? 0) / SCALE,
    },
    true,
  );
  if (entity.bodyAngularVelocity) {
    const [x, y, z] = entity.bodyAngularVelocity;
    body.setAngvel({ x: -x, y: -z, z: -y }, true);
  }
  return { body, rotation };
}

/** Outer box footprint (or ball/articulated compound), friction and mass. */
function colliderDesc(
  entity: Entity,
  kind: PhysicsBodyKind,
  hx: number,
  halfY: number,
  hz: number,
  car: boolean,
  clearance: number,
  articulated: DumpBedBody | TransporterBody | undefined,
) {
  // Keep the exact outer box footprint, with a fixed subpixel bevel so
  // the bottom edge clears adjacent ramp/slab seams. CCD resolves actual
  // travel instead of soft-CCD's premature face constraint at the seam.
  const bevel = Math.min(0.01, hx / 4, halfY / 4, hz / 4);
  const shape =
    entity.type === "ball"
      ? RAPIER.ColliderDesc.ball(Math.min(hx, hz, halfY))
      : articulated
        ? articulated.colliderDesc()
        : kind === "character" || kind === "vehicle"
          ? RAPIER.ColliderDesc.roundCuboid(
              hx - bevel,
              halfY - clearance / 2 - bevel,
              hz - bevel,
              bevel,
            )
          : RAPIER.ColliderDesc.cuboid(hx, halfY, hz);
  shape
    .setTranslation(0, clearance / 2, 0)
    // The transporter's ramp and deck carry cars on their wheels, not by scraping.
    .setFriction(
      articulated instanceof TransporterBody ? 0 : car ? 0.4 : kind === "loose" ? 0.5 : 0,
    )
    .setRestitution(entity.type === "ball" ? 0.55 : 0);
  if (kind === "character" || (kind === "vehicle" && !car))
    shape.setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min);
  if (car)
    // Centre of mass CHASSIS_CENTRE_OF_MASS of the body height above its base
    // (collider frame is raised by clearance/2), for rollover resistance in turns.
    setChassisBoxMass(
      shape,
      hx,
      halfY - clearance / 2,
      hz,
      8,
      halfY * (2 * CHASSIS_CENTRE_OF_MASS - 1) - clearance / 2,
    );
  else shape.setMass(kind === "vehicle" ? 8 : kind === "loose" ? 0.2 : 1);
  return shape;
}

function initialState(
  entity: Entity,
  kind: PhysicsBodyKind,
  d: Dimensions,
  rotation: ReturnType<typeof yawRotation>,
  bed: DumpBedBody | undefined,
): PhysicsBodyState {
  const vehicle = kind === "vehicle";
  return {
    id: entity.id,
    kind,
    x: entity.position.wx,
    y: entity.position.wy,
    z: entity.wz ?? 0,
    prevX: entity.position.wx,
    prevY: entity.position.wy,
    prevZ: entity.wz ?? 0,
    vx: entity.velocity?.vx ?? 0,
    vy: entity.velocity?.vy ?? 0,
    vz: entity.jumpVZ ?? 0,
    heading: vehicle ? d.yaw : 0,
    prevHeading: vehicle ? d.yaw : 0,
    ...(vehicle
      ? {
          rotation,
          prevRotation: rotation,
          angularVelocity: entity.bodyAngularVelocity ?? ([0, 0, 0] as const),
        }
      : {}),
    ...bed?.initialState(entity),
    jumpHeld: !!((entity.jumpInputState ?? 0) & 2),
    grounded: entity.jumpVZ === undefined,
    groundZ: entity.groundZ ?? entity.wz ?? 0,
    desiredVx: 0,
    desiredVy: 0,
    normalX: 0,
    normalY: 1,
    normalZ: 0,
  };
}

/** Build a body from an entity's dimensions and current explicit state. */
export function createSceneBody(
  world: RAPIER.World,
  origin: { x: number; z: number },
  entity: Entity,
  kind: PhysicsBodyKind,
  d: Dimensions,
): SceneBody {
  const car = kind === "vehicle" && !isBoat(entity) && !isTrain(entity);
  const halfY = d.height / 2 / SCALE,
    hx = d.width / 2 / SCALE,
    hz = d.depth / 2 / SCALE;
  const clearance = car ? Math.min(4, d.height * 0.22) / SCALE : 0;
  const bed = car && hasDumpBed(entity) ? new DumpBedBody(entity, halfY, clearance) : undefined;
  const transporter =
    car && isTransporter(entity) ? new TransporterBody(entity, halfY, clearance) : undefined;
  const { body, rotation } = rigidBody(world, origin, entity, kind, d, car);
  const collider = world.createCollider(
    colliderDesc(entity, kind, hx, halfY, hz, car, clearance, bed ?? transporter),
    body,
  );
  transporter?.anchor(body);
  return {
    entity,
    body,
    collider,
    kind,
    shape: d,
    syncPass: 0,
    halfY,
    offsetX: d.offsetX / SCALE,
    offsetY: d.offsetY / SCALE,
    incomingVelocity: { x: 0, y: 0, z: 0 },
    ...(bed ? { bed } : {}),
    ...(transporter ? { transporter } : {}),
    ...(car ? { chassis: new VehicleChassis(body, entity.type, d.width, d.depth, d.height) } : {}),
    // A raised tub or deployed ramp reaches beyond the level body envelope.
    queryRadius: Math.hypot(hx, halfY, hz) + (bed ? 1.5 : transporter ? 5 : 0.1),
    queryCenter: body.translation(),
    rested: 0,
    dormant: false,
    centred: false,
    unmoved: false,
    touching: [],
    state: initialState(entity, kind, d, rotation, bed),
  };
}
