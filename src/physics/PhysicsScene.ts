import RAPIER from "@dimforge/rapier3d-compat";
import { CHUNK_SIZE_PX, JUMP_GRAVITY } from "../config/constants.js";
import { getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import { Direction } from "../entities/Entity.js";
import { applyCurveTrainFacing, isCurveTrain } from "../railway/CurveTrain.js";
import { headingFrame } from "../railway/RailPath.js";
import { isTrain } from "../railway/Train.js";
import { applyVehicleFacing } from "../traffic/Vehicle.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import {
  rapierRotation,
  rotateBodyVector,
  rotationsEqual,
  worldRotation,
  yawRotation,
} from "./BodyRotation.js";
import { DumpBedBody } from "./DumpBedBody.js";
import type { GroundMaterial } from "./GroundMaterial.js";
import { assistedJumpVelocity } from "./JumpAssist.js";
import { playerClimbIntent } from "./Ladders.js";
import { teleportBody } from "./PhysicalEdits.js";
import { carryingSupportId, physicsBodyDimensions, physicsBodyKind } from "./PhysicsBodies.js";
import {
  initializePhysics,
  PHYSICS_DT,
  PHYSICS_PIXELS_PER_METRE as SCALE,
} from "./PhysicsDefaults.js";
import { blockedRailGroups, prescribedRailVelocity, railGroup } from "./RailMotion.js";
import {
  type CollisionGeometrySource,
  compileCollisionGeometry,
} from "./rapier/CollisionGeometry.js";
import { createSceneBody, type SceneBody } from "./SceneBody.js";
import { type SupportMotion, supportVelocityAt } from "./SupportMotion.js";
import type { WheelContact } from "./VehicleChassis.js";
import { VehicleCouplings } from "./VehicleCouplings.js";
import { vehicleMotor } from "./VehicleMotor.js";

export interface PhysicsGeometry extends CollisionGeometrySource {
  geometryVersion(cx: number, cy: number): { identity: unknown; revision: string | number };
  /** Surface under a static-ground wheel contact (world px); absent means pavement. */
  groundMaterial?(wx: number, wy: number, wz: number): GroundMaterial;
}
export type { PhysicsBodyKind, PhysicsBodyState, PhysicsState } from "./PhysicsState.js";

import type {
  MotionIntent,
  PhysicsBodyKind,
  PhysicsBodyState,
  PhysicsState,
} from "./PhysicsState.js";
import { selectAround } from "./PredictionSelection.js";

let nextSceneEpoch = 1;

type Body = SceneBody;
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
  private readonly couplings = new VehicleCouplings();
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
        entry = createSceneBody(this.world, this.origin, entity, kind, dimensions, signature);
        const { collider } = entry;
        this.bodies.set(entity.id, entry);
        this.colliderIds.set(collider.handle, entity.id);
        this.metrics.bodyCreates++;
      } else {
        entry.entity = entity;
        this.admitEntityEdits(entry);
      }
    }
    for (const [id, body] of this.bodies) if (!present.has(id)) this.remove(body);
    this.couplings.sync(this.world, this.bodies);
  }
  /** Commit explicit entity edits without integrating. Publication uses the same
   * boundary, so a paused teleport/launch cannot mix new entities with old bodies. */
  private admitEntityEdits(entry: Body) {
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
    const rotation = entity.bodyRotation ?? s.rotation ?? yawRotation(s.heading);
    const center = rotateBodyVector(rotation, 0, 0, entry.halfY);
    if (rotated) {
      entry.body.setRotation(rapierRotation(rotation), true);
      const [x, y, z] = entity.bodyAngularVelocity ?? [0, 0, 0];
      entry.body.setAngvel({ x: -x, y: -z, z: -y }, true);
      s.rotation = s.prevRotation = rotation;
      const forward = rotateBodyVector(rotation, 1, 0, 0);
      if (Math.hypot(forward.x, forward.y) > 0.001)
        s.heading = s.prevHeading = Math.atan2(forward.y, forward.x);
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
    delete s.inheritedVx;
    delete s.inheritedVy;
    delete s.jumpQueued;
    for (const neighbor of this.contacts.get(entity.id) ?? [])
      this.contacts.get(neighbor)?.delete(entity.id);
    this.contacts.delete(entity.id);
  }

  private remove(entry: Body) {
    this.couplings.remove(this.world, entry.entity.id);
    this.colliderIds.delete(entry.collider.handle);
    this.world.removeRigidBody(entry.body);
    this.bodies.delete(entry.entity.id);
  }

  private prepareGeometry(
    source: PhysicsGeometry,
    extra: readonly { left: number; right: number; top: number; bottom: number }[] = [],
  ) {
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
    for (const box of extra)
      for (
        let cy = Math.floor(box.top / CHUNK_SIZE_PX);
        cy <= Math.floor(box.bottom / CHUNK_SIZE_PX);
        cy++
      )
        for (
          let cx = Math.floor(box.left / CHUNK_SIZE_PX);
          cx <= Math.floor(box.right / CHUNK_SIZE_PX);
          cx++
        )
          needed.set(`${cx},${cy}`, { cx, cy });
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
    geometry: PhysicsGeometry,
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
    // Static ground only: other bodies (decks, roofs) drive as pavement.
    if (hit && !hit.body && geometry.groundMaterial)
      hit.material = geometry.groundMaterial(
        (origin.x + direction.x * hit.distance + this.origin.x) * SCALE,
        (origin.z + direction.z * hit.distance + this.origin.z) * SCALE,
        (origin.y + direction.y * hit.distance + this.origin.y) * SCALE,
      );
    return hit;
  }

  step(intents: ReadonlyMap<number, MotionIntent>, geometry: PhysicsGeometry, gravity = 1) {
    if (this.disposed) throw Error("Physics scene is disposed");
    const started = performance.now();
    this.prepareGeometry(geometry);
    this.world.propagateModifiedBodyPositionsToColliders();
    for (const e of this.bodies.values())
      e.bed?.advance(e.state, e.body, e.collider, this.staticGeometry);
    this.world.gravity = { x: 0, y: (-JUMP_GRAVITY * gravity) / SCALE, z: 0 };
    const bodies = [...this.bodies.values()];
    const blockedRails = blockedRailGroups(bodies, this.staticGeometry, intents);
    // Read support motion before changing any motors: actor order cannot change it.
    // Prescribed supports use this tick's admitted trajectory, so riders do not
    // lag a start or slide one extra tick after a station stop.
    const vehicleInputs: { entry: Body; input: MotionIntent }[] = [];
    const supports = new Map<number, SupportMotion>();
    for (const [id, entry] of this.bodies)
      supports.set(
        id,
        isTrain(entry.entity)
          ? {
              linear: prescribedRailVelocity(
                entry.state,
                intents.get(id),
                blockedRails.has(railGroup(entry.entity)),
                this.tick,
              ),
            }
          : {
              linear: entry.body.linvel(),
              ...(entry.chassis ? { chassis: entry.body } : {}),
            },
      );
    for (const [id, entry] of this.bodies) {
      if (entry.kind === "loose") {
        const v = entry.body.linvel();
        entry.incomingVelocity = v;
        continue;
      }
      if (entry.kind === "fixed") continue;
      const input = this.motorInput(entry, intents.get(id) ?? { vx: 0, vy: 0 }, geometry);
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
      if (isTrain(entry.entity)) {
        const blocked = blockedRails.has(railGroup(entry.entity));
        const angle = blocked ? entry.state.heading : (input.heading ?? entry.state.heading);
        if (blocked) {
          entry.state.desiredVx = entry.state.desiredVy = 0;
          entry.state.desiredHeading = angle;
        }
        const delta = Math.atan2(
          Math.sin(angle - entry.state.heading),
          Math.cos(angle - entry.state.heading),
        );
        entry.body.setLinvel(
          {
            x: blocked ? 0 : input.vx / SCALE,
            y: ((input.altitude ?? entry.state.z) - entry.state.z) / SCALE / PHYSICS_DT,
            z: blocked ? 0 : input.vy / SCALE,
          },
          true,
        );
        entry.body.setAngvel({ x: 0, y: -delta / PHYSICS_DT, z: 0 }, true);
        continue;
      }
      if (entry.chassis) {
        // A secured car is carried by its joint; its wheels do not act.
        if (this.couplings.carried(id)) continue;
        const locked = this.couplings.driveIntent(
          entry.entity,
          entry.state.heading,
          input,
          this.bodies,
        );
        vehicleInputs.push({ entry, input: DumpBedBody.driveIntent(entry.state, locked) });
        continue;
      }
      const velocity = entry.body.linvel();
      const support = supportVelocityAt(
        supports.get(carryingSupportId(entry.entity, entry.state.supportId, this.bodies)),
        entry.body.translation(),
      );
      const pressed = input.jumpPressed || (input.jump && !entry.state.jumpHeld);
      entry.state.jumpHeld = input.jump ?? false;
      if (!entry.state.jumpHeld && !input.jumpPressed) delete entry.state.jumpQueued;
      if (pressed && !entry.state.grounded) entry.state.jumpQueued = true;
      const jump = pressed || entry.state.jumpQueued;
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
      if (entry.state.grounded) {
        if (support?.x) entry.state.inheritedVx = support.x * SCALE;
        else delete entry.state.inheritedVx;
        if (support?.z) entry.state.inheritedVy = support.z * SCALE;
        else delete entry.state.inheritedVy;
      }
      const x = ((drive?.vx ?? input.vx) + (entry.state.inheritedVx ?? 0)) / SCALE,
        z = ((drive?.vy ?? input.vy) + (entry.state.inheritedVy ?? 0)) / SCALE;
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
        delete entry.state.jumpQueued;
        vertical =
          assistedJumpVelocity(entry.entity, entry.state, this.bodies.values(), gravity) / SCALE +
          (support?.y ?? 0);
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
          (origin, direction, length) =>
            this.wheelContact(origin, direction, length, entry, geometry),
          this.couplings.towed(entry.entity.id),
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
    for (const pair of this.couplings.pairs()) this.addContact(...pair);
    this.metrics.stepMs = performance.now() - started;
  }

  /** Expired network control holds still; players may climb ladders. */
  private motorInput(entry: Body, submitted: MotionIntent, geometry: PhysicsGeometry) {
    if (submitted.controlUntil === undefined) delete entry.state.controlUntil;
    else entry.state.controlUntil = submitted.controlUntil;
    const expired = submitted.controlUntil !== undefined && this.tick >= submitted.controlUntil;
    const input = expired ? { vx: 0, vy: 0, jump: false } : submitted;
    if (entry.entity.type !== "player") return input;
    return playerClimbIntent(input, entry.state, entry.entity.collider, geometry);
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
    state.grounded =
      isTrain(entry.entity) ||
      entry.kind === "fixed" ||
      (entry.body.isSleeping() && state.grounded);
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
        if (touching && Math.abs(ny) < 0.5) {
          // A wall consumes inherited flight momentum; it must not reappear
          // after the motor walks clear of the obstacle on a later air tick.
          const nx = normal.x * factor,
            nz = normal.z * factor;
          const into = (state.inheritedVx ?? 0) * nx + (state.inheritedVy ?? 0) * nz;
          const horizontal = nx * nx + nz * nz;
          if (into > 0 && horizontal > 0) {
            state.inheritedVx = (state.inheritedVx ?? 0) - (into * nx) / horizontal;
            state.inheritedVy = (state.inheritedVy ?? 0) - (into * nz) / horizontal;
            if (Math.abs(state.inheritedVx) < 0.001) delete state.inheritedVx;
            if (Math.abs(state.inheritedVy) < 0.001) delete state.inheritedVy;
          }
        }
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
        this.addContact(entry.entity.id, support);
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
    entry.bed?.publish(entity, state, entry.collider);
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
      if (isCurveTrain(entity) && entity.sprite) {
        entity.sprite.frameRow = headingFrame(state.heading);
        applyCurveTrainFacing(entity);
      }
      if (entity.sprite) entity.sprite.moving = Math.hypot(state.vx, state.vy) > 1;
    }
    entity.jumpInputState = state.jumpHeld ? 3 : 0;
  }

  /** Solved dependency pair (contact, wheel support or coupling) for snapshot closure. */
  private addContact(a: number, b: number) {
    for (const [id, other] of [
      [a, b],
      [b, a],
    ] as const) {
      const neighbors = this.contacts.get(id) ?? new Set<number>();
      this.contacts.set(id, neighbors);
      neighbors.add(other);
    }
  }

  /** Transporter ramp queries against this same world; read-only. */
  rampClear(id: number): boolean {
    const e = this.bodies.get(id);
    return !!e?.transporter?.rampClear(e.collider, this.staticGeometry);
  }
  rampOccupied(id: number): boolean {
    const e = this.bodies.get(id);
    return !!e?.transporter?.rampOccupied(this.world, e.collider, e.body);
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

  /** Recall admission compiles the destination into this same world, without
   * moving or stepping any body. Normal ticks subsequently retain its sections. */
  canPlaceTrain(
    cars: readonly Entity[],
    poses: readonly { x: number; y: number; angle: number }[],
    geometry: PhysicsGeometry,
  ) {
    const queries = cars.map((e, i) => {
      const p = poses[i];
      if (!p) throw Error("Missing train pose");
      const d = physicsBodyDimensions(e),
        radius = Math.hypot(d.width, d.depth) / 2;
      return {
        e,
        p,
        d,
        box: { left: p.x - radius, right: p.x + radius, top: p.y - radius, bottom: p.y + radius },
      };
    });
    this.prepareGeometry(
      geometry,
      queries.map((q) => q.box),
    );
    const ids = new Set(cars.map((c) => c.id));
    for (const { p, d } of queries) {
      const shape = new RAPIER.Cuboid(
        d.width / 2 / SCALE - 0.01,
        d.height / 2 / SCALE - 0.02,
        d.depth / 2 / SCALE - 0.01,
      );
      const position = {
          x: p.x / SCALE - this.origin.x,
          y: d.height / 2 / SCALE,
          z: p.y / SCALE - this.origin.z,
        },
        rotation = rapierRotation(yawRotation(p.angle));
      for (const c of [
        this.staticGeometry,
        ...[...this.bodies.values()].filter((e) => !ids.has(e.entity.id)).map((e) => e.collider),
      ])
        if (c?.intersectsShape(shape, position, rotation)) return false;
    }
    return true;
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

  /** Keep each anchor's contact graph, then nearby bodies, with an explicit cap: one
   * anchor per local seat (226). Reads cached numerical states; never copies a WASM world.
   */
  snapshotAround(anchors: number | readonly number[], visible: ReadonlySet<number>): PhysicsState {
    const ids = typeof anchors === "number" ? [anchors] : anchors;
    const { selected, omitted } = selectAround(this.bodies, this.contacts, ids, visible);
    return {
      epoch: this.epoch,
      tick: this.tick,
      omitted,
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
      entry.bed?.publish(entry.entity, entry.state, entry.collider);
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
