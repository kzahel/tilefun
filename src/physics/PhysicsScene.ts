import RAPIER from "@dimforge/rapier3d-compat";
import { isBoat } from "../boats/Boat.js";
import { CHUNK_SIZE_PX, JUMP_GRAVITY } from "../config/constants.js";
import { getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import { Direction } from "../entities/Entity.js";
import { applyVehicleFacing } from "../traffic/Vehicle.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import {
  rapierRotation,
  rotateBodyVector,
  rotationsEqual,
  worldRotation,
  yawRotation,
} from "./BodyRotation.js";
import { assistedJumpVelocity } from "./JumpAssist.js";
import { teleportBody } from "./PhysicalEdits.js";
import { physicsBodyDimensions, physicsBodyKind } from "./PhysicsBodies.js";
import {
  initializePhysics,
  PHYSICS_DT,
  PHYSICS_PIXELS_PER_METRE as SCALE,
} from "./PhysicsDefaults.js";
import {
  type CollisionGeometrySource,
  compileCollisionGeometry,
} from "./rapier/CollisionGeometry.js";
import { VehicleChassis, type WheelContact } from "./VehicleChassis.js";
import { vehicleMotor } from "./VehicleMotor.js";

export interface PhysicsGeometry extends CollisionGeometrySource {
  geometryVersion(cx: number, cy: number): { identity: unknown; revision: string | number };
}
export type { PhysicsBodyKind, PhysicsBodyState, PhysicsState } from "./PhysicsState.js";

import {
  MAX_PREDICTION_BODIES,
  type MotionIntent,
  type PhysicsBodyKind,
  type PhysicsBodyState,
  type PhysicsState,
  PREDICTION_RADIUS,
} from "./PhysicsState.js";

let nextSceneEpoch = 1;

interface Body {
  entity: Entity;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  kind: PhysicsBodyKind;
  signature: string;
  halfY: number;
  offsetX: number;
  offsetY: number;
  state: PhysicsBodyState;
  incomingVelocity: RAPIER.Vector;
  chassis?: VehicleChassis;
  queryRadius: number;
  queryCenter: RAPIER.Vector;
}
interface Section {
  identity: unknown;
  revision: string | number;
  parts: RAPIER.ColliderDesc[];
}

/** Shared fixed-step body simulation. No input queue, AI, renderer or transport.
 * Bodies submit intent together; only this scene integrates their physical poses.
 */
export class PhysicsScene {
  readonly world: RAPIER.World;
  readonly origin = { x: 0, y: 0, z: 0 };
  private readonly bodies = new Map<number, Body>();
  private readonly colliderIds = new Map<number, number>();
  private readonly contacts = new Map<number, Set<number>>();
  private readonly sections = new Map<string, Section>();
  private staticGeometry: RAPIER.Collider | undefined;
  private disposed = false;
  private originInitialized = false;
  private tick = 0;
  private epoch = nextSceneEpoch++;
  readonly metrics = {
    worldSteps: 0,
    bodyCreates: 0,
    geometryBuilds: 0,
    geometryRebuilds: 0,
    geometryBuildMs: 0,
    geometryParts: 0,
    supportQueries: 0,
    wheelQueries: 0,
    wheelNarrowQueries: 0,
    stepMs: 0,
  };

  private constructor() {
    this.world = new RAPIER.World({ x: 0, y: -JUMP_GRAVITY / SCALE, z: 0 });
    this.world.timestep = PHYSICS_DT;
  }
  static async create() {
    await initializePhysics();
    return new PhysicsScene();
  }
  get physicsTick() {
    return this.tick;
  }
  /** Reset a private scene between worlds, including geometry/origin ownership. */
  clear() {
    for (const entry of [...this.bodies.values()]) this.remove(entry);
    if (this.staticGeometry) this.world.removeCollider(this.staticGeometry, false);
    this.staticGeometry = undefined;
    this.metrics.geometryParts = 0;
    this.sections.clear();
    this.contacts.clear();
    this.origin.x = this.origin.y = this.origin.z = 0;
    this.originInitialized = false;
    this.tick = 0;
    this.epoch = nextSceneEpoch++;
  }
  get diagnostics() {
    return {
      ...this.metrics,
      tick: this.tick,
      bodies: this.bodies.size,
      sections: this.sections.size,
      colliders: this.world.colliders.len(),
    };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.world.free();
    this.bodies.clear();
    this.sections.clear();
    this.colliderIds.clear();
    this.contacts.clear();
  }

  /** Synchronize membership/explicit edits once, not once per neighboring motor. */
  synchronize(entities: readonly Entity[], kinds?: ReadonlyMap<number, PhysicsBodyKind>) {
    if (this.disposed) throw Error("Physics scene is disposed");
    const present = new Set<number>();
    if (!this.originInitialized && entities[0]) {
      this.origin.x = (Math.floor(entities[0].position.wx / 4096) * 4096) / SCALE;
      this.origin.z = (Math.floor(entities[0].position.wy / 4096) * 4096) / SCALE;
      this.originInitialized = true;
    }
    for (const entity of entities) {
      const c = entity.collider;
      const kind = kinds?.get(entity.id) ?? physicsBodyKind(entity);
      if (!c || entity.parentId !== undefined || (c.solid === false && kind !== "loose")) continue;
      if (present.has(entity.id)) throw Error(`Duplicate physics body ${entity.id}`);
      present.add(entity.id);
      const dimensions = physicsBodyDimensions(entity);
      const width = dimensions.width,
        height = dimensions.depth;
      const signature = `${kind}:${width}:${height}:${dimensions.height}:${dimensions.offsetX}:${dimensions.offsetY}`;
      let entry = this.bodies.get(entity.id);
      if (entry && entry.signature !== signature) {
        this.remove(entry);
        entry = undefined;
      }
      if (!entry) {
        const halfY = dimensions.height / 2 / SCALE;
        const car = kind === "vehicle" && !isBoat(entity);
        const rotation = entity.bodyRotation ?? yawRotation(dimensions.yaw);
        const center = rotateBodyVector(rotation, 0, 0, halfY);
        const offsetX = dimensions.offsetX / SCALE,
          offsetY = dimensions.offsetY / SCALE;
        const desc =
          kind === "fixed"
            ? RAPIER.RigidBodyDesc.fixed()
            : RAPIER.RigidBodyDesc.dynamic().setCcdEnabled(true);
        desc.setTranslation(
          entity.position.wx / SCALE + offsetX + center.x - this.origin.x,
          (entity.wz ?? 0) / SCALE + center.z,
          entity.position.wy / SCALE + offsetY + center.y - this.origin.z,
        );
        if (kind === "vehicle") {
          desc.setRotation(rapierRotation(rotation));
        }
        if (car) desc.setAngularDamping(0.35);
        else if (kind !== "loose") desc.enabledRotations(false, kind === "vehicle", false);
        else desc.lockRotations().setLinearDamping(1.5);
        const body = this.world.createRigidBody(desc);
        body.setLinvel(
          {
            x: (entity.velocity?.vx ?? 0) / SCALE,
            y: (entity.jumpVZ ?? 0) / SCALE,
            z: (entity.velocity?.vy ?? 0) / SCALE,
          },
          true,
        );
        const hx = width / 2 / SCALE,
          hz = height / 2 / SCALE;
        // Keep the exact outer box footprint, with a fixed subpixel bevel so
        // the bottom edge clears adjacent ramp/slab seams. CCD resolves actual
        // travel instead of soft-CCD's premature face constraint at the seam.
        const bevel = Math.min(0.01, hx / 4, halfY / 4, hz / 4);
        const clearance = car ? Math.min(4, dimensions.height * 0.22) / SCALE : 0;
        const shape =
          entity.type === "ball"
            ? RAPIER.ColliderDesc.ball(Math.min(hx, hz, halfY))
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
          .setFriction(car ? 0.4 : kind === "loose" ? 0.5 : 0)
          .setRestitution(entity.type === "ball" ? 0.55 : 0);
        if (kind === "character" || (kind === "vehicle" && !car))
          shape.setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min);
        shape.setMass(kind === "vehicle" ? 8 : kind === "loose" ? 0.2 : 1);
        const collider = this.world.createCollider(shape, body);
        entry = {
          entity,
          body,
          collider,
          kind,
          signature,
          halfY,
          offsetX,
          offsetY,
          incomingVelocity: { x: 0, y: 0, z: 0 },
          queryRadius: Math.hypot(hx, halfY, hz) + 0.1,
          queryCenter: body.translation(),
          state: {
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
            heading: kind === "vehicle" ? dimensions.yaw : 0,
            prevHeading: kind === "vehicle" ? dimensions.yaw : 0,
            ...(kind === "vehicle"
              ? {
                  rotation,
                  prevRotation: rotation,
                  angularVelocity: entity.bodyAngularVelocity ?? ([0, 0, 0] as const),
                }
              : {}),
            jumpHeld: !!((entity.jumpInputState ?? 0) & 2),
            grounded: entity.jumpVZ === undefined,
            groundZ: entity.groundZ ?? entity.wz ?? 0,
            desiredVx: 0,
            desiredVy: 0,
            normalX: 0,
            normalY: 1,
            normalZ: 0,
          },
        };
        if (car)
          entry.chassis = new VehicleChassis(body, entity.type, width, height, dimensions.height);
        if (entity.bodyAngularVelocity) {
          const [x, y, z] = entity.bodyAngularVelocity;
          body.setAngvel({ x: -x, y: -z, z: -y }, true);
        }
        this.bodies.set(entity.id, entry);
        this.colliderIds.set(collider.handle, entity.id);
        this.metrics.bodyCreates++;
      } else {
        entry.entity = entity;
        this.admitEntityEdits(entry);
      }
    }
    for (const [id, body] of this.bodies) if (!present.has(id)) this.remove(body);
  }
  /** Commit explicit entity edits without integrating. Publication uses the same
   * boundary, so a paused teleport/launch cannot mix new entities with old bodies. */
  private admitEntityEdits(entry: Body) {
    const entity = entry.entity,
      s = entry.state;
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
    const rotation = entity.bodyRotation ?? s.rotation ?? yawRotation(s.heading);
    const center = rotateBodyVector(rotation, 0, 0, entry.halfY);
    if (rotated) {
      entry.body.setRotation(rapierRotation(rotation), true);
      const [x, y, z] = entity.bodyAngularVelocity ?? [0, 0, 0];
      entry.body.setAngvel({ x: -x, y: -z, z: -y }, true);
      s.rotation = s.prevRotation = rotation;
      s.angularVelocity = entity.bodyAngularVelocity ?? [0, 0, 0];
    }
    if (moved || rotated)
      entry.body.setTranslation(
        {
          x: entity.position.wx / SCALE + entry.offsetX + center.x - this.origin.x,
          y: (entity.wz ?? 0) / SCALE + center.z,
          z: entity.position.wy / SCALE + entry.offsetY + center.y - this.origin.z,
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
    for (const neighbor of this.contacts.get(entity.id) ?? [])
      this.contacts.get(neighbor)?.delete(entity.id);
    this.contacts.delete(entity.id);
  }

  private remove(entry: Body) {
    this.colliderIds.delete(entry.collider.handle);
    this.world.removeRigidBody(entry.body);
    this.bodies.delete(entry.entity.id);
  }

  private prepareGeometry(source: PhysicsGeometry) {
    const started = performance.now();
    let changed = false;
    const needed = new Map<string, { cx: number; cy: number }>();
    for (const entry of this.bodies.values()) {
      const c = entry.entity.collider;
      if (!c) continue;
      const box = getEntityAABB(entry.entity.position, c);
      const v = entry.body.linvel();
      const margin = 32 + Math.hypot(v.x, v.z) * SCALE * PHYSICS_DT;
      for (
        let cy = Math.floor((box.top - margin) / CHUNK_SIZE_PX);
        cy <= Math.floor((box.bottom + margin) / CHUNK_SIZE_PX);
        cy++
      )
        for (
          let cx = Math.floor((box.left - margin) / CHUNK_SIZE_PX);
          cx <= Math.floor((box.right + margin) / CHUNK_SIZE_PX);
          cx++
        )
          needed.set(`${cx},${cy}`, { cx, cy });
    }
    if (needed.size > 512) throw Error("Physics section residency exceeds 512 sections");
    for (const key of this.sections.keys())
      if (!needed.has(key)) {
        this.sections.delete(key);
        changed = true;
      }
    for (const [key, { cx, cy }] of needed) {
      const version = source.geometryVersion(cx, cy),
        old = this.sections.get(key);
      if (old && old.identity === version.identity && old.revision === version.revision) continue;
      const parts = compileCollisionGeometry(
        {
          getHeight: (x, y) => source.getHeight(x, y),
          queryProps: (bounds) => source.queryProps(bounds),
          // Water is a gameplay volume/habitat, not an infinite solid wall shared
          // by swimmers and airborne bodies. Realm owns water landing consequences.
          getCollision: (x, y) => source.getCollision(x, y) & ~CollisionFlag.Water,
        },
        {
          left: cx * CHUNK_SIZE_PX,
          top: cy * CHUNK_SIZE_PX,
          right: (cx + 1) * CHUNK_SIZE_PX,
          bottom: (cy + 1) * CHUNK_SIZE_PX,
        },
        this.origin,
        -4096,
        4096,
      );
      this.sections.set(key, { ...version, parts });
      this.metrics.geometryBuilds++;
      changed = true;
    }
    if (!changed) return;
    const parts = [...this.sections.values()].flatMap((section) => section.parts);
    this.metrics.geometryParts = parts.length;
    if (parts.length) {
      const shape = new RAPIER.Compound(
        parts.map((part) => part.shape),
        parts.map((part) => part.translation),
        parts.map((part) => part.rotation),
        RAPIER.CompoundFlags.FIX_INTERNAL_EDGES,
      );
      if (this.staticGeometry) this.staticGeometry.setShape(shape);
      else this.staticGeometry = this.world.createCollider(new RAPIER.ColliderDesc(shape));
    } else if (this.staticGeometry) {
      this.world.removeCollider(this.staticGeometry, false);
      this.staticGeometry = undefined;
    }
    this.metrics.geometryRebuilds++;
    this.metrics.geometryBuildMs = performance.now() - started;
  }

  private wheelContact(
    origin: RAPIER.Vector,
    direction: RAPIER.Vector,
    length: number,
    owner: Body,
  ): WheelContact | undefined {
    this.metrics.wheelQueries++;
    const ray = new RAPIER.Ray(origin, direction);
    const ground = this.staticGeometry?.castRayAndGetNormal(ray, length, true);
    let hit: WheelContact | undefined = ground
      ? { distance: ground.timeOfImpact, normal: ground.normal }
      : undefined;
    // Cheap bounding spheres reject distant residents before entering WASM. Direct
    // collider queries stay correct on the FIRST tick and after arbitrary restores.
    for (const other of this.bodies.values()) {
      if (other === owner) continue;
      const p = other.queryCenter,
        dx = p.x - origin.x,
        dy = p.y - origin.y,
        dz = p.z - origin.z;
      const t = Math.max(
        0,
        Math.min(length, dx * direction.x + dy * direction.y + dz * direction.z),
      );
      if (
        (dx - direction.x * t) ** 2 + (dy - direction.y * t) ** 2 + (dz - direction.z * t) ** 2 >
        other.queryRadius ** 2
      )
        continue;
      this.metrics.wheelNarrowQueries++;
      const contact = other.collider.castRayAndGetNormal(ray, hit?.distance ?? length, true);
      if (contact && (!hit || contact.timeOfImpact < hit.distance))
        hit = {
          distance: contact.timeOfImpact,
          normal: contact.normal,
          body: other.body,
          id: other.entity.id,
        };
    }
    return hit;
  }

  step(intents: ReadonlyMap<number, MotionIntent>, geometry: PhysicsGeometry, gravity = 1) {
    if (this.disposed) throw Error("Physics scene is disposed");
    const started = performance.now();
    this.prepareGeometry(geometry);
    this.world.propagateModifiedBodyPositionsToColliders();
    this.world.gravity = { x: 0, y: (-JUMP_GRAVITY * gravity) / SCALE, z: 0 };
    // Read support motion before changing any motors: actor order cannot change it.
    const vehicleInputs: { entry: Body; input: MotionIntent }[] = [];
    const supportVelocities = new Map<number, RAPIER.Vector>();
    for (const [id, entry] of this.bodies) supportVelocities.set(id, entry.body.linvel());
    for (const [id, entry] of this.bodies) {
      if (entry.kind === "loose") {
        const v = entry.body.linvel();
        entry.incomingVelocity = v;
        continue;
      }
      if (entry.kind === "fixed") continue;
      const submitted = intents.get(id) ?? { vx: 0, vy: 0 };
      if (submitted.controlUntil === undefined) delete entry.state.controlUntil;
      else entry.state.controlUntil = submitted.controlUntil;
      const input =
        submitted.controlUntil !== undefined && this.tick >= submitted.controlUntil
          ? { vx: 0, vy: 0, jump: false }
          : submitted;
      entry.state.desiredVx = input.vx;
      entry.state.desiredVy = input.vy;
      if (input.altitude === undefined) delete entry.state.altitude;
      else entry.state.altitude = input.altitude;
      if (input.heading === undefined) delete entry.state.desiredHeading;
      else entry.state.desiredHeading = input.heading;
      if (input.driveSpeed === undefined) delete entry.state.desiredDriveSpeed;
      else entry.state.desiredDriveSpeed = input.driveSpeed;
      if (input.steering === undefined) delete entry.state.desiredSteering;
      else entry.state.desiredSteering = input.steering;
      if (entry.chassis) {
        vehicleInputs.push({ entry, input });
        continue;
      }
      const velocity = entry.body.linvel();
      const support =
        entry.state.supportId === undefined
          ? undefined
          : supportVelocities.get(entry.state.supportId);
      const jump = input.jumpPressed || (input.jump && !entry.state.jumpHeld);
      entry.state.jumpHeld = input.jump ?? false;
      const drive =
        entry.kind === "vehicle"
          ? vehicleMotor(
              entry.entity.type,
              entry.state.heading,
              (velocity.x - (support?.x ?? 0)) * SCALE,
              (velocity.z - (support?.z ?? 0)) * SCALE,
              entry.state.grounded,
              input,
            )
          : undefined;
      const x = (drive?.vx ?? input.vx) / SCALE + (support?.x ?? 0),
        z = (drive?.vy ?? input.vy) / SCALE + (support?.z ?? 0);
      // A grounded motor follows the support tangent. Keeping last tick's tiny
      // downward velocity makes a fixed box snag at a ramp/deck junction.
      let vertical = entry.state.grounded
        ? -(entry.state.normalX * x + entry.state.normalZ * z) / Math.max(0.5, entry.state.normalY)
        : velocity.y;
      if (input.altitude !== undefined) {
        // A prescribed landing may meet a loose body or an edited higher floor.
        // Do not keep driving through solved support: the solver would accumulate
        // an upward separation velocity that launches the actor on motor release.
        if (!entry.state.grounded || input.altitude > entry.state.groundZ + 0.15)
          vertical =
            (input.altitude / SCALE + entry.halfY - entry.body.translation().y) / PHYSICS_DT;
      } else if (jump && entry.state.grounded) {
        vertical =
          assistedJumpVelocity(entry.entity, entry.state, this.bodies.values(), gravity) / SCALE;
        entry.state.grounded = false;
        delete entry.state.supportId;
      }
      entry.body.setLinvel(
        {
          x,
          y: vertical,
          z,
        },
        true,
      );
      if (drive?.yawRate !== undefined)
        entry.body.setAngvel({ x: 0, y: -drive.yawRate, z: 0 }, true);
    }
    // A body's pose is immutable during preparation. Read it once, rather than
    // crossing JS/WASM again for every wheel/neighbour pair. Parked fleets skip it.
    if (
      vehicleInputs.some(
        ({ entry, input }) => !entry.body.isSleeping() || (input.driveSpeed ?? 0) !== 0,
      )
    )
      for (const entry of this.bodies.values()) entry.queryCenter = entry.body.translation();
    // All chassis read the same pre-impulse state, including dynamic supports.
    const prepared = vehicleInputs.map(({ entry, input }) => ({
      entry,
      impulses:
        entry.chassis?.prepare(
          input,
          entry.state.heading,
          (origin, direction, length) => this.wheelContact(origin, direction, length, entry),
          Math.abs(entry.state.z - entry.state.prevZ) < 0.01,
        ) ?? [],
    }));
    for (const { entry, impulses } of prepared)
      for (const { point, impulse, support } of impulses) {
        entry.body.applyImpulseAtPoint(impulse, point, false);
        if (support?.isDynamic())
          support.applyImpulseAtPoint({ x: -impulse.x, y: -impulse.y, z: -impulse.z }, point, true);
      }
    for (const { entry } of prepared) entry.incomingVelocity = entry.body.linvel();
    this.world.step();
    this.contacts.clear();
    this.tick++;
    this.metrics.worldSteps++;
    for (const entry of this.bodies.values()) this.readBody(entry);
    this.metrics.stepMs = performance.now() - started;
  }

  private readBody(entry: Body) {
    const p = entry.body.translation(),
      v = entry.body.linvel(),
      q = entry.body.rotation();
    const state = entry.state;
    const rotation = worldRotation(q);
    const center = rotateBodyVector(rotation, 0, 0, entry.halfY);
    if (entry.kind === "vehicle") {
      state.sleeping = entry.body.isSleeping();
      state.prevRotation = state.rotation ?? rotation;
      state.rotation = rotation;
      const angular = entry.body.angvel();
      state.angularVelocity = [-angular.x, -angular.z, -angular.y];
    }
    state.prevX = state.x;
    state.prevY = state.y;
    state.prevZ = state.z;
    state.prevHeading = state.heading;
    state.x = (p.x + this.origin.x - entry.offsetX - center.x) * SCALE;
    state.y = (p.z + this.origin.z - entry.offsetY - center.y) * SCALE;
    state.z = (p.y - center.z) * SCALE;
    state.vx = v.x * SCALE;
    state.vy = v.z * SCALE;
    state.vz = v.y * SCALE;
    const forward = rotateBodyVector(rotation, 1, 0, 0);
    if (Math.hypot(forward.x, forward.y) > 0.001) state.heading = Math.atan2(forward.y, forward.x);
    state.grounded = entry.kind === "fixed" || (entry.body.isSleeping() && state.grounded);
    if (!entry.body.isSleeping()) delete state.supportId;
    this.world.contactPairsWith(entry.collider, (other) => {
      this.world.contactPair(entry.collider, other, (manifold, flipped) => {
        const otherId = this.colliderIds.get(other.handle);
        // Use the contact constraints Rapier actually solves, including its
        // resting margin. Raw manifold distance can remain positive after sleep.
        const touching = manifold.numSolverContacts() > 0;
        // Compound edge correction can reduce a part's solver points to zero
        // while retaining its resting geometric manifold. It still supplies
        // support, but a distant speculative manifold must not ground a body.
        let resting = touching;
        if (!resting && other.handle === this.staticGeometry?.handle)
          for (let i = 0; i < manifold.numContacts(); i++)
            if (
              manifold.contactDist(i) <=
              this.world.integrationParameters.normalizedAllowedLinearError * this.world.lengthUnit
            ) {
              resting = true;
              break;
            }
        if (otherId !== undefined && touching) {
          let neighbors = this.contacts.get(entry.entity.id);
          if (!neighbors) {
            neighbors = new Set();
            this.contacts.set(entry.entity.id, neighbors);
          }
          neighbors.add(otherId);
        }
        const normal = manifold.normal(),
          factor = flipped ? -1 : 1;
        const ny = normal.y * factor;
        const supportVelocity = other.parent()?.linvel();
        const separating =
          -(
            normal.x * (v.x - (supportVelocity?.x ?? 0)) +
            normal.y * (v.y - (supportVelocity?.y ?? 0)) +
            normal.z * (v.z - (supportVelocity?.z ?? 0))
          ) * factor;
        // Ignore small solver separation velocities; a requested jump is far
        // above this threshold and immediately leaves support.
        const landingMotor = state.altitude !== undefined && state.altitude <= state.z + 0.15;
        if (ny < -0.5 && resting && (separating < 0.25 || landingMotor)) {
          // At a ramp/deck seam both support manifolds may exist. Keep the
          // rising tangent instead of letting contact iteration order flatten it.
          if (state.grounded && -ny >= state.normalY) return;
          state.grounded = true;
          state.normalX = -normal.x * factor;
          state.normalY = -ny;
          state.normalZ = -normal.z * factor;
          const id = this.colliderIds.get(other.handle);
          if (id !== undefined) state.supportId = id;
        }
      });
    });
    if (entry.chassis) {
      state.grounded ||= entry.chassis.grounded;
      for (const support of entry.chassis.supports) {
        state.supportId ??= support;
        let contacts = this.contacts.get(entry.entity.id);
        if (!contacts) {
          contacts = new Set();
          this.contacts.set(entry.entity.id, contacts);
        }
        contacts.add(support);
        let reverse = this.contacts.get(support);
        if (!reverse) {
          reverse = new Set();
          this.contacts.set(support, reverse);
        }
        reverse.add(entry.entity.id);
      }
    }
    const entity = entry.entity;
    entity.prevPosition = { ...entity.position };
    entity.prevWz = entity.wz ?? 0;
    entity.position.wx = state.x;
    entity.position.wy = state.y;
    entity.wz = state.z;
    if (entity.velocity) {
      entity.velocity.vx = state.vx;
      entity.velocity.vy = state.vy;
    }
    if (state.grounded) {
      delete entity.jumpVZ;
      entity.groundZ = state.z;
      entity.jumpZ = 0;
    } else {
      entity.jumpVZ = state.vz;
      this.metrics.supportQueries++;
      const hit = this.world.castRay(
        new RAPIER.Ray({ x: p.x, y: p.y - entry.halfY + 0.01, z: p.z }, { x: 0, y: -1, z: 0 }),
        512,
        true,
        undefined,
        undefined,
        entry.collider,
      );
      entity.groundZ = hit ? state.z + 0.16 - hit.timeOfImpact * SCALE : state.z;
      entity.jumpZ = Math.max(0, state.z - entity.groundZ);
    }
    state.groundZ = entity.groundZ ?? state.z;
    if (entry.kind === "vehicle") {
      entity.prevBodyRotation = state.prevRotation ?? rotation;
      entity.bodyRotation = state.rotation ?? rotation;
      entity.bodyAngularVelocity = state.angularVelocity ?? [0, 0, 0];
      entity.prevVehicleHeading = entity.vehicleHeading ?? state.heading;
      entity.vehicleHeading = state.heading;
      const x = Math.cos(state.heading),
        y = Math.sin(state.heading);
      applyVehicleFacing(
        entity,
        Math.abs(x) >= Math.abs(y)
          ? x >= 0
            ? Direction.Right
            : Direction.Left
          : y >= 0
            ? Direction.Down
            : Direction.Up,
      );
      if (entity.sprite) entity.sprite.moving = Math.hypot(state.vx, state.vy) > 1;
    }
    entity.jumpInputState = state.jumpHeld ? 3 : 0;
  }

  /** Explicit recovery uses this same world's support and clearance, never another solver. */
  recoverVehicle(id: number) {
    const entry = this.bodies.get(id);
    if (!entry?.chassis) throw Error("This vehicle cannot be righted.");
    const p = entry.body.translation(),
      rotation = yawRotation(entry.state.heading);
    const hit = this.world.castRay(
      new RAPIER.Ray({ x: p.x, y: p.y + 0.01, z: p.z }, { x: 0, y: -1, z: 0 }),
      512,
      true,
      undefined,
      undefined,
      entry.collider,
      entry.body,
    );
    if (!hit) throw Error("No ground beneath the vehicle.");
    const floor = p.y + 0.01 - hit.timeOfImpact;
    const relative = entry.collider.translationWrtParent();
    const proposed = { x: p.x, y: floor + entry.halfY + 0.02 + (relative?.y ?? 0), z: p.z };
    if (
      this.world.intersectionWithShape(
        proposed,
        rapierRotation(rotation),
        entry.collider.shape,
        undefined,
        undefined,
        entry.collider,
        entry.body,
      ) !== null
    )
      throw Error("There is not enough room to right the vehicle here.");
    teleportBody(entry.entity, {
      wx: (p.x + this.origin.x) * SCALE,
      wy: (p.z + this.origin.z) * SCALE,
      wz: (floor + 0.02) * SCALE,
    });
    entry.entity.bodyRotation = entry.entity.prevBodyRotation = rotation;
    entry.entity.bodyAngularVelocity = [0, 0, 0];
    this.admitEntityEdits(entry);
    entry.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    entry.state.angularVelocity = [0, 0, 0];
    entry.state.sleeping = false;
  }

  /** Spawn clearance is a read-only query of this same collision authority. */
  canPlaceSphere(x: number, y: number, z: number, radius: number, excludeId?: number): boolean {
    return (
      this.world.intersectionWithShape(
        { x: x / SCALE - this.origin.x, y: (z + radius) / SCALE, z: y / SCALE - this.origin.z },
        { x: 0, y: 0, z: 0, w: 1 },
        new RAPIER.Ball(radius / SCALE),
        undefined,
        undefined,
        undefined,
        excludeId === undefined ? undefined : this.bodies.get(excludeId)?.body,
      ) === null
    );
  }

  contactIds(id: number): ReadonlySet<number> | undefined {
    return this.contacts.get(id);
  }

  /** Contact consequences need incident speed, before the solver removes it. */
  incomingSpeed(id: number): number {
    const v = this.bodies.get(id)?.incomingVelocity;
    return v ? Math.hypot(v.x, v.y, v.z) * SCALE : 0;
  }

  /** Projectile speed towards this contact before the solver changed velocities.
   * Walking into a resting ball, or pushing it away, is not a projectile hit. */
  incomingContactSpeed(id: number, otherId: number): number {
    const source = this.bodies.get(id),
      target = this.bodies.get(otherId);
    if (!source || !target) return 0;
    let speed = 0;
    this.world.contactPair(source.collider, target.collider, (manifold, flipped) => {
      const n = manifold.normal(),
        v = source.incomingVelocity;
      speed = Math.max(speed, (v.x * n.x + v.y * n.y + v.z * n.z) * (flipped ? -1 : 1) * SCALE);
    });
    return speed;
  }

  bodyState(id: number): Readonly<PhysicsBodyState> | undefined {
    return this.bodies.get(id)?.state;
  }

  /** Keep the anchor's contact graph, then nearby bodies, with an explicit cap.
   * Reads cached numerical states; never serializes or copies a WASM world.
   */
  snapshotAround(anchorId: number, visible: ReadonlySet<number>): PhysicsState {
    const anchor = this.bodies.get(anchorId);
    if (!anchor)
      return { epoch: this.epoch, tick: this.tick, omitted: 0, bodies: [], contacts: [] };
    const selected = new Map<number, Body>();
    const required = new Set<number>();
    const queue = [anchorId];
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i];
      if (id === undefined || required.has(id) || !this.bodies.has(id)) continue;
      required.add(id);
      for (const neighbor of this.contacts.get(id) ?? [])
        if (!required.has(neighbor)) queue.push(neighbor);
      const support = this.bodies.get(id)?.state.supportId;
      if (support !== undefined && !required.has(support)) queue.push(support);
    }
    const candidates: { id: number; distance: number }[] = [];
    for (const [id, entry] of this.bodies) {
      const half =
        Math.hypot(entry.entity.collider?.width ?? 0, entry.entity.collider?.height ?? 0) / 2;
      const distance = Math.hypot(
        entry.entity.position.wx - anchor.entity.position.wx,
        entry.entity.position.wy - anchor.entity.position.wy,
      );
      if (distance <= PREDICTION_RADIUS + half || required.has(id))
        candidates.push({ id, distance });
    }
    candidates.sort(
      (a, b) =>
        Number(required.has(b.id)) - Number(required.has(a.id)) ||
        a.distance - b.distance ||
        a.id - b.id,
    );
    for (const { id } of candidates)
      if (visible.has(id) && selected.size < MAX_PREDICTION_BODIES) {
        const entry = this.bodies.get(id);
        if (entry) selected.set(id, entry);
      }
    return {
      epoch: this.epoch,
      tick: this.tick,
      omitted: candidates.length - selected.size,
      bodies: [...selected.values()].map((entry) => this.copyBodyState(entry)),
      contacts: this.copyContacts(selected),
    };
  }

  private copyContacts(selected: ReadonlyMap<number, Body>): [number, number][] {
    const pairs: [number, number][] = [];
    for (const id of selected.keys())
      for (const other of this.contacts.get(id) ?? [])
        if (id < other && selected.has(other)) pairs.push([id, other]);
    return pairs;
  }

  private copyBodyState(entry: Body): PhysicsBodyState {
    return { ...entry.state };
  }
  snapshot(): PhysicsState {
    return {
      epoch: this.epoch,
      omitted: 0,
      tick: this.tick,
      bodies: [...this.bodies.values()].map((entry) => this.copyBodyState(entry)),
      contacts: this.copyContacts(this.bodies),
    };
  }
  /** Restore body/motor state at an authoritative physics tick; no hidden step. */
  restore(snapshot: PhysicsState) {
    this.tick = snapshot.tick;
    this.epoch = snapshot.epoch;
    this.contacts.clear();
    for (const state of snapshot.bodies) {
      const entry = this.bodies.get(state.id);
      if (!entry || entry.kind !== state.kind)
        throw Error(`Missing or incompatible physics body ${state.id} during restore`);
      const rotation = state.rotation ?? yawRotation(state.heading);
      const center = rotateBodyVector(rotation, 0, 0, entry.halfY);
      entry.body.setTranslation(
        {
          x: state.x / SCALE + entry.offsetX + center.x - this.origin.x,
          y: state.z / SCALE + center.z,
          z: state.y / SCALE + entry.offsetY + center.y - this.origin.z,
        },
        true,
      );
      entry.body.setLinvel({ x: state.vx / SCALE, y: state.vz / SCALE, z: state.vy / SCALE }, true);
      entry.body.setRotation(rapierRotation(rotation), true);
      const [ax, ay, az] = state.angularVelocity ?? [0, 0, 0];
      entry.body.setAngvel({ x: -ax, y: -az, z: -ay }, true);
      if (state.sleeping) entry.body.sleep();
      entry.state = { ...state };
      // Publish state and contact membership supplied by the same snapshot.
      entry.entity.prevPosition = { wx: state.prevX, wy: state.prevY };
      entry.entity.prevWz = state.prevZ;
      if (entry.kind === "vehicle") {
        entry.entity.bodyRotation = state.rotation ?? rotation;
        entry.entity.prevBodyRotation = state.prevRotation ?? rotation;
        entry.entity.bodyAngularVelocity = state.angularVelocity ?? [0, 0, 0];
        entry.entity.vehicleHeading = state.heading;
        entry.entity.prevVehicleHeading = state.prevHeading;
      }
      entry.entity.position.wx = state.x;
      entry.entity.position.wy = state.y;
      entry.entity.wz = state.z;
      entry.entity.groundZ = state.groundZ;
      entry.entity.jumpZ = Math.max(0, state.z - state.groundZ);
      entry.entity.jumpInputState = state.jumpHeld ? 3 : 0;
      if (entry.entity.velocity) {
        entry.entity.velocity.vx = state.vx;
        entry.entity.velocity.vy = state.vy;
      }
      if (state.grounded) delete entry.entity.jumpVZ;
      else entry.entity.jumpVZ = state.vz;
    }
    for (const [a, b] of snapshot.contacts) {
      if (!this.bodies.has(a) || !this.bodies.has(b) || a === b)
        throw Error("Invalid restored physics contact");
      for (const [id, other] of [
        [a, b],
        [b, a],
      ] as const) {
        let neighbors = this.contacts.get(id);
        if (!neighbors) {
          neighbors = new Set();
          this.contacts.set(id, neighbors);
        }
        neighbors.add(other);
      }
    }
  }
}
