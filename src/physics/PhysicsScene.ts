import RAPIER from "@dimforge/rapier3d-compat";
import { CHUNK_SIZE_PX, JUMP_GRAVITY } from "../config/constants.js";
import type { Entity } from "../entities/Entity.js";
import { wake } from "../entities/naps.js";
import { isTrain } from "../railway/Train.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import { admitEntityEdits } from "./BodyEdits.js";
import { driveMotor, isIdle, supportMotions } from "./BodyMotor.js";
import { keepRest, publishBody } from "./BodyReadback.js";
import { rapierRotation, rotateBodyVector, worldRotation, yawRotation } from "./BodyRotation.js";
import { DumpBedBody } from "./DumpBedBody.js";
import type { GroundMaterial } from "./GroundMaterial.js";
import {
  hold,
  meetBody,
  NOBODY,
  reachedSections,
  resettle,
  restingBodies,
  restNow,
  restsUnread,
  unedited,
  wokenBodies,
} from "./HeldBodies.js";
import { playerClimbIntent } from "./Ladders.js";
import { teleportBody } from "./PhysicalEdits.js";
import { physicsBodyDimensions, physicsBodyKind } from "./PhysicsBodies.js";
import {
  initializePhysics,
  PHYSICS_DT,
  PHYSICS_PIXELS_PER_METRE as SCALE,
} from "./PhysicsDefaults.js";
import { blockedRailGroups, railGroup } from "./RailMotion.js";
import {
  type CollisionGeometrySource,
  compileCollisionGeometry,
} from "./rapier/CollisionGeometry.js";
import { createSceneBody, type SceneBody } from "./SceneBody.js";
import type { WheelContact } from "./VehicleChassis.js";
import { VehicleCouplings } from "./VehicleCouplings.js";
import { WheelGrid } from "./WheelGrid.js";

export interface PhysicsGeometry extends CollisionGeometrySource {
  geometryVersion(cx: number, cy: number): { identity: unknown; revision: string | number };
  /** Surface under a static-ground wheel contact (world px); absent means pavement. */
  groundMaterial?(wx: number, wy: number, wz: number): GroundMaterial;
}
export type { PhysicsBodyKind, PhysicsBodyState, PhysicsState } from "./PhysicsState.js";

import { PhysicsRestore } from "./PhysicsRestore.js";
import type {
  MotionIntent,
  PhysicsBodyKind,
  PhysicsBodyState,
  PhysicsState,
} from "./PhysicsState.js";
import { selectAround } from "./PredictionSelection.js";

let nextSceneEpoch = 1;
/** The body was built for this kind and outer size; yaw is state, not shape. */
function sameShape(entry: SceneBody, kind: PhysicsBodyKind, d: SceneBody["shape"]) {
  const s = entry.shape;
  return (
    entry.kind === kind &&
    s.width === d.width &&
    s.depth === d.depth &&
    s.height === d.height &&
    s.offsetX === d.offsetX &&
    s.offsetY === d.offsetY
  );
}
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
  /** Bodies taking part this tick, and those held out of it: see `synchronize`. */
  private readonly live: Body[] = [];
  private readonly held: Body[] = [];
  private readonly heldTouching: Body[] = [];
  private readonly handles = new Map<number, Body>();
  private readonly colliderIds = new Map<number, number>();
  private readonly contacts = new Map<number, Set<number>>();
  private readonly sections = new Map<string, Section>();
  private readonly couplings = new VehicleCouplings();
  private readonly wheelGrid = new WheelGrid();
  private readonly restorer = new PhysicsRestore();
  private readonly readVector = { x: 0, y: 0, z: 0 };
  /** The static geometry was rebuilt for the step in progress. */
  private reshaped = false;
  /** Sleeping bodies about to be landed on (see `meetBody`). */
  private readonly rousing: RAPIER.RigidBody[] = [];
  private staticGeometry: RAPIER.Collider | undefined;
  private disposed = false;
  private originInitialized = false;
  private tick = 0;
  private syncPass = 0;
  private epoch = nextSceneEpoch++;
  readonly metrics = {
    worldSteps: 0,
    bodyCreates: 0,
    geometryBuilds: 0,
    geometryRebuilds: 0,
    geometryBuildMs: 0,
    geometryParts: 0,
    supportQueries: 0,
    /** Bodies whose pose and contacts were read back from the solver. */
    bodyReads: 0,
    /** Motors that evaluated their intent (the rest were dormant). */
    motorUpdates: 0,
    /** Bodies held out of the last step. */
    heldBodies: 0,
    wheelQueries: 0,
    wheelNarrowQueries: 0,
    stepMs: 0,
  };

  private constructor() {
    this.world = new RAPIER.World({ x: 0, y: -JUMP_GRAVITY / SCALE, z: 0 });
    this.world.timestep = PHYSICS_DT;
    // Continue a fast collision's remaining interval instead of leaving the
    // whole landing velocity for the next tick. The public step stays 1/60 s.
    this.world.integrationParameters.maxCcdSubsteps = 2;
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
    for (const map of [this.bodies, this.sections, this.colliderIds, this.contacts]) map.clear();
    this.wheelGrid.reset();
  }

  /** Synchronize membership/explicit edits once, not once per neighboring motor.
   * `held` actors are napping (see RealmNaps): their bodies stay in the world, asleep,
   * and are neither edited, motored nor read until the solver itself wakes them. */
  synchronize(
    entities: readonly Entity[],
    kinds?: ReadonlyMap<number, PhysicsBodyKind>,
    held: readonly Entity[] = [],
  ) {
    if (this.disposed) throw Error("Physics scene is disposed");
    const pass = ++this.syncPass;
    if (!this.originInitialized && entities[0]) {
      this.origin.x = (Math.floor(entities[0].position.wx / 4096) * 4096) / SCALE;
      this.origin.z = (Math.floor(entities[0].position.wy / 4096) * 4096) / SCALE;
      this.originInitialized = true;
    }
    this.live.length = this.held.length = this.heldTouching.length = 0;
    for (const entity of entities) this.admit(entity, kinds, pass);
    for (const entity of held) {
      const entry = this.bodies.get(entity.id);
      if (entry?.entity !== entity) {
        this.admit(entity, kinds, pass);
        continue;
      }
      if (entry.syncPass === pass) throw Error(`Duplicate physics body ${entity.id}`);
      if (!entry.held) hold(entry);
      entry.syncPass = pass;
      this.held.push(entry);
      if (entry.touching.length) this.heldTouching.push(entry);
    }
    this.metrics.heldBodies = this.held.length;
    if (this.live.length + this.held.length !== this.bodies.size)
      for (const body of [...this.bodies.values()]) if (body.syncPass !== pass) this.remove(body);
    this.couplings.sync(this.world, this.bodies);
    return pass;
  }

  private admit(
    entity: Entity,
    kinds: ReadonlyMap<number, PhysicsBodyKind> | undefined,
    pass: number,
  ) {
    const c = entity.collider;
    const kind = kinds?.get(entity.id) ?? physicsBodyKind(entity);
    if (!c || entity.parentId !== undefined || (c.solid === false && kind !== "loose")) return;
    let entry = this.bodies.get(entity.id);
    if (entry?.syncPass === pass) throw Error(`Duplicate physics body ${entity.id}`);
    const dimensions = physicsBodyDimensions(entity);
    if (entry && !sameShape(entry, kind, dimensions)) {
      this.remove(entry);
      entry = undefined;
    }
    if (!entry) {
      entry = createSceneBody(this.world, this.origin, entity, kind, dimensions);
      const { collider } = entry;
      this.bodies.set(entity.id, entry);
      this.handles.set(entry.body.handle, entry);
      this.colliderIds.set(collider.handle, entity.id);
      this.metrics.bodyCreates++;
    } else {
      // A replaced entity object has not received the cached pose yet.
      if (entry.entity !== entity) {
        entry.rested = 0;
        entry.dormant = entry.centred = false;
      }
      entry.entity = entity;
      entry.held = false;
      admitEntityEdits(entry, this.origin, this.contacts);
    }
    entry.syncPass = pass;
    this.live.push(entry);
  }

  /** A body that would do nothing this tick whether or not it took part: asleep on
   * static ground with an idle motor and carrying no pending edit. */
  restful(entity: Entity): boolean {
    const entry = this.bodies.get(entity.id);
    return (
      entry?.entity === entity &&
      entry.dormant &&
      entry.unmoved &&
      restsUnread(entry) &&
      unedited(entry)
    );
  }

  private remove(entry: Body) {
    this.couplings.remove(this.world, entry.entity.id);
    this.colliderIds.delete(entry.collider.handle);
    this.handles.delete(entry.body.handle);
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
    reachedSections(this.live, needed);
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
    // Held bodies stand where they stood: ask after them only before dropping a section.
    if (this.held.length)
      for (const key of this.sections.keys())
        if (!needed.has(key)) {
          reachedSections(this.held, needed);
          break;
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
    this.reshaped = true;
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
    for (const other of this.wheelGrid.near(this.bodies.values(), origin, direction, length)) {
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
    // Rebuilding the static geometry wakes every body resting on it.
    const resting = this.reshaped ? restingBodies(this.bodies.values()) : NOBODY;
    this.reshaped = false;
    this.world.propagateModifiedBodyPositionsToColliders();
    for (const e of this.live) e.bed?.advance(e.state, e.body, e.collider, this.staticGeometry);
    this.world.gravity = { x: 0, y: (-JUMP_GRAVITY * gravity) / SCALE, z: 0 };
    const blockedRails = blockedRailGroups(this.live, this.bodies, this.staticGeometry, intents);
    // Read support motion before changing any motors: actor order cannot change it.
    // Prescribed supports use this tick's admitted trajectory, so riders do not
    // lag a start or slide one extra tick after a station stop.
    const vehicleInputs: { entry: Body; input: MotionIntent }[] = [];
    const supports = supportMotions(this.live, this.bodies, intents, blockedRails, this.tick);
    for (const entry of this.live) {
      const id = entry.entity.id;
      if (entry.kind === "loose") {
        const v = entry.body.linvel();
        entry.incomingVelocity = v;
        continue;
      }
      if (entry.kind === "fixed") continue;
      const submitted = intents.get(id);
      // Nothing below can change for a resting motor that is still asked for nothing.
      if (entry.dormant && isIdle(submitted)) continue;
      this.metrics.motorUpdates++;
      const input = this.motorInput(entry, submitted ?? { vx: 0, vy: 0 }, geometry);
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
      driveMotor(entry, input, isIdle(submitted), supports, this.bodies, gravity);
    }
    // A body's pose is immutable during preparation. Read it once, rather than
    // crossing JS/WASM again for every wheel/neighbour pair. Parked fleets skip it.
    if (
      vehicleInputs.some(
        ({ entry, input }) => !entry.body.isSleeping() || (input.driveSpeed ?? 0) !== 0,
      )
    )
      for (const entry of this.live) {
        // A centre captured while the body rested stays exact until it wakes.
        if (entry.centred && entry.rested === 2) continue;
        entry.queryCenter = entry.body.translation();
        entry.centred = entry.rested === 2;
      }
    this.wheelGrid.reset();
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
    resettle(resting, -this.world.gravity.y * PHYSICS_DT);
    this.contacts.clear();
    this.tick++;
    this.metrics.worldSteps++;
    for (const entry of this.live) this.readBody(entry);
    // A held body's solved contacts are those it rested with.
    for (const entry of this.heldTouching) if (entry.held) keepRest(entry, this.contacts);
    // Only the solver wakes a held body; it reports the few that are awake.
    if (this.held.length)
      for (const entry of wokenBodies(this.world, this.handles)) {
        // An edit made during the nap is admitted next tick; reading now would undo it.
        if (unedited(entry)) this.readBody(entry);
        // Put back to sleep after a geometry rebuild: its nap goes on undisturbed.
        if (entry.rested !== 2 || !entry.body.isSleeping()) {
          entry.held = false;
          wake(entry.entity);
        }
      }
    // Woken once every body is read: no readback depends on the order of bodies.
    for (const body of this.rousing.splice(0)) body.wakeUp();
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
    const asleep = entry.body.isSleeping();
    if (asleep && restsUnread(entry)) keepRest(entry, this.contacts);
    else this.readMotion(entry, asleep);
    restNow(entry, asleep);
    entry.rested = asleep ? Math.min(entry.rested + 1, 2) : 0;
    if (!asleep) entry.centred = false;
    if (entry.chassis) {
      entry.state.grounded ||= entry.chassis.grounded;
      for (const support of entry.chassis.supports) {
        entry.state.supportId ??= support;
        this.addContact(entry.entity.id, support);
      }
    }
    publishBody(entry, this.world, this.metrics, this.rousing);
  }

  private readMotion(entry: Body, asleep: boolean) {
    entry.dormant = false;
    this.metrics.bodyReads++;
    const p = entry.body.translation(),
      v = entry.body.linvel(),
      q = entry.body.rotation();
    const state = entry.state;
    const rotation = worldRotation(q);
    const center = rotateBodyVector(rotation, 0, 0, entry.halfY, this.readVector);
    if (entry.kind === "vehicle") {
      state.sleeping = asleep;
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
    entry.unmoved = state.x === state.prevX && state.y === state.prevY && state.z === state.prevZ;
    state.vx = v.x * SCALE;
    state.vy = v.z * SCALE;
    state.vz = v.y * SCALE;
    const forward = rotateBodyVector(rotation, 1, 0, 0, this.readVector);
    if (Math.hypot(forward.x, forward.y) > 0.001) state.heading = Math.atan2(forward.y, forward.x);
    state.grounded = isTrain(entry.entity) || entry.kind === "fixed" || (asleep && state.grounded);
    if (!asleep) delete state.supportId;
    entry.touching.length = 0;
    entry.beside = false;
    this.world.contactPairsWith(entry.collider, (other) => {
      if (other.handle !== this.staticGeometry?.handle)
        meetBody(entry, other, asleep ? 0 : v.y, this.rousing);
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
          entry.touching.push(otherId);
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
    admitEntityEdits(entry, this.origin, this.contacts);
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

  /** This exact entity object was admitted as a body by synchronize pass `pass`. */
  admitted(entity: Entity, pass: number): boolean {
    const entry = this.bodies.get(entity.id);
    return entry?.entity === entity && entry.syncPass === pass;
  }

  /** Borrowed cached numbers, valid until the next scene operation. Use snapshot
   * or snapshotAround for independently retained state. */
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
      this.restorer.body(entry, state, this.origin);
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
