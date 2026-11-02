import RAPIER from "@dimforge/rapier3d-compat";
import {
  CHUNK_SIZE_PX,
  DEFAULT_PHYSICAL_HEIGHT,
  JUMP_GRAVITY,
  JUMP_VELOCITY,
} from "../config/constants.js";
import { getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import { Direction } from "../entities/Entity.js";
import { applyVehicleFacing, vehicleBodySize, vehicleNoseHeading } from "../traffic/Vehicle.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import {
  initializePhysics,
  PHYSICS_DT,
  PHYSICS_PIXELS_PER_METRE as SCALE,
} from "./PhysicsDefaults.js";
import {
  type CollisionGeometrySource,
  compileCollisionGeometry,
} from "./rapier/CollisionGeometry.js";

export interface PhysicsGeometry extends CollisionGeometrySource {
  geometryVersion(cx: number, cy: number): { identity: unknown; revision: string | number };
}
export interface MotionIntent {
  vx: number;
  vy: number;
  jump?: boolean;
  jumpPressed?: boolean;
  /** Prescribed flight/platform altitude; still integrated in the shared scene. */
  altitude?: number;
  heading?: number;
}
export type PhysicsBodyKind = "character" | "vehicle" | "loose" | "fixed";
export interface PhysicsBodyState {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  heading: number;
  jumpHeld: boolean;
  grounded: boolean;
  groundZ: number;
  desiredVx: number;
  desiredVy: number;
  altitude?: number;
  desiredHeading?: number;
  normalX: number;
  normalY: number;
  normalZ: number;
  supportId?: number;
}
export interface PhysicsState {
  tick: number;
  bodies: PhysicsBodyState[];
}
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
}
interface Section {
  identity: unknown;
  revision: string | number;
  colliders: RAPIER.Collider[];
}

export function physicsBodyKind(entity: Entity): PhysicsBodyKind {
  if (entity.type.startsWith("vehicle-v1:")) return "vehicle";
  if (entity.type === "ball" || entity.workItem) return "loose";
  if (entity.type === "player" || entity.wanderAI || entity.routeAI || entity.resident)
    return "character";
  return "fixed";
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
  private disposed = false;
  private originInitialized = false;
  private tick = 0;
  readonly metrics = {
    worldSteps: 0,
    bodyCreates: 0,
    geometryBuilds: 0,
    supportQueries: 0,
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
  synchronize(entities: readonly Entity[]) {
    if (this.disposed) throw Error("Physics scene is disposed");
    const present = new Set<number>();
    if (!this.originInitialized && entities[0]) {
      this.origin.x = (Math.floor(entities[0].position.wx / 4096) * 4096) / SCALE;
      this.origin.z = (Math.floor(entities[0].position.wy / 4096) * 4096) / SCALE;
      this.originInitialized = true;
    }
    for (const entity of entities) {
      const c = entity.collider;
      if (
        !c ||
        entity.parentId !== undefined ||
        (c.solid === false && entity.type !== "ball" && !entity.workItem)
      )
        continue;
      if (present.has(entity.id)) throw Error(`Duplicate physics body ${entity.id}`);
      present.add(entity.id);
      const kind = physicsBodyKind(entity);
      const vehicleSize = kind === "vehicle" ? vehicleBodySize(entity.type, 0) : undefined;
      const width = vehicleSize?.width ?? c.width,
        height = vehicleSize?.height ?? c.height;
      const signature = `${kind}:${width}:${height}:${c.physicalHeight}:${kind === "vehicle" ? 0 : c.offsetX}:${kind === "vehicle" ? 0 : c.offsetY}`;
      let entry = this.bodies.get(entity.id);
      if (entry && entry.signature !== signature) {
        this.remove(entry);
        entry = undefined;
      }
      if (!entry) {
        const halfY = (c.physicalHeight ?? DEFAULT_PHYSICAL_HEIGHT) / 2 / SCALE;
        const offsetX = kind === "vehicle" ? 0 : c.offsetX / SCALE,
          offsetY = kind === "vehicle" ? 0 : (c.offsetY - c.height / 2) / SCALE;
        const desc =
          kind === "fixed"
            ? RAPIER.RigidBodyDesc.fixed()
            : RAPIER.RigidBodyDesc.dynamic().setCcdEnabled(true);
        desc.setTranslation(
          entity.position.wx / SCALE + offsetX - this.origin.x,
          (entity.wz ?? 0) / SCALE + halfY,
          entity.position.wy / SCALE + offsetY - this.origin.z,
        );
        if (kind === "vehicle") {
          const angle = vehicleNoseHeading(entity);
          desc.setRotation({ x: 0, y: -Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) });
        }
        if (kind !== "loose") desc.enabledRotations(false, kind === "vehicle", false);
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
        const shape =
          entity.type === "ball"
            ? RAPIER.ColliderDesc.ball(Math.min(hx, hz, halfY))
            : kind === "character"
              ? RAPIER.ColliderDesc.roundCuboid(hx - bevel, halfY - bevel, hz - bevel, bevel)
              : RAPIER.ColliderDesc.cuboid(hx, halfY, hz);
        shape
          .setFriction(kind === "loose" ? 0.5 : 0)
          .setRestitution(entity.type === "ball" ? 0.55 : 0);
        if (kind === "character" || kind === "vehicle")
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
          state: {
            id: entity.id,
            x: entity.position.wx,
            y: entity.position.wy,
            z: entity.wz ?? 0,
            vx: entity.velocity?.vx ?? 0,
            vy: entity.velocity?.vy ?? 0,
            vz: entity.jumpVZ ?? 0,
            heading: kind === "vehicle" ? vehicleNoseHeading(entity) : 0,
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
        this.bodies.set(entity.id, entry);
        this.colliderIds.set(collider.handle, entity.id);
        this.metrics.bodyCreates++;
      } else {
        // Spawn/teleport/editor APIs may explicitly change the published entity.
        // Ordinary movement leaves it at the last readback and does not re-upload.
        const s = entry.state;
        if (entity.position.wx !== s.x || entity.position.wy !== s.y || (entity.wz ?? 0) !== s.z) {
          entry.body.setTranslation(
            {
              x: entity.position.wx / SCALE + entry.offsetX - this.origin.x,
              y: (entity.wz ?? 0) / SCALE + entry.halfY,
              z: entity.position.wy / SCALE + entry.offsetY - this.origin.z,
            },
            true,
          );
          s.grounded = entity.jumpVZ === undefined;
        }
        // Explicit throws/launches or script velocity changes are admitted once.
        // AI and controls use intent and never overwrite this readback velocity.
        if (
          (entity.velocity?.vx ?? 0) !== s.vx ||
          (entity.velocity?.vy ?? 0) !== s.vy ||
          (entity.jumpVZ !== undefined && entity.jumpVZ !== s.vz)
        ) {
          entry.body.setLinvel(
            {
              x: (entity.velocity?.vx ?? 0) / SCALE,
              y: (entity.jumpVZ ?? 0) / SCALE,
              z: (entity.velocity?.vy ?? 0) / SCALE,
            },
            true,
          );
          s.grounded = entity.jumpVZ === undefined;
        }
        entry.entity = entity;
      }
    }
    for (const [id, body] of this.bodies) if (!present.has(id)) this.remove(body);
  }
  private remove(entry: Body) {
    this.colliderIds.delete(entry.collider.handle);
    this.world.removeRigidBody(entry.body);
    this.bodies.delete(entry.entity.id);
  }

  private prepareGeometry(source: PhysicsGeometry) {
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
    for (const [key, section] of this.sections)
      if (!needed.has(key)) {
        for (const c of section.colliders) this.world.removeCollider(c, false);
        this.sections.delete(key);
      }
    for (const [key, { cx, cy }] of needed) {
      const version = source.geometryVersion(cx, cy),
        old = this.sections.get(key);
      if (old && old.identity === version.identity && old.revision === version.revision) continue;
      if (old) for (const c of old.colliders) this.world.removeCollider(c, false);
      const section: Section = { ...version, colliders: [] };
      compileCollisionGeometry(
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
        (desc) => {
          const collider = this.world.createCollider(desc);
          section.colliders.push(collider);
          return collider;
        },
      );
      this.sections.set(key, section);
      this.metrics.geometryBuilds++;
    }
  }

  step(intents: ReadonlyMap<number, MotionIntent>, geometry: PhysicsGeometry, gravity = 1) {
    if (this.disposed) throw Error("Physics scene is disposed");
    const started = performance.now();
    this.prepareGeometry(geometry);
    this.world.gravity = { x: 0, y: (-JUMP_GRAVITY * gravity) / SCALE, z: 0 };
    // Read support motion before changing any motors: actor order cannot change it.
    const supportVelocities = new Map<number, RAPIER.Vector>();
    for (const [id, entry] of this.bodies) supportVelocities.set(id, entry.body.linvel());
    for (const [id, entry] of this.bodies) {
      if (entry.kind === "fixed" || entry.kind === "loose") continue;
      const input = intents.get(id) ?? { vx: 0, vy: 0 };
      entry.state.desiredVx = input.vx;
      entry.state.desiredVy = input.vy;
      if (input.altitude === undefined) delete entry.state.altitude;
      else entry.state.altitude = input.altitude;
      if (input.heading === undefined) delete entry.state.desiredHeading;
      else entry.state.desiredHeading = input.heading;
      const velocity = entry.body.linvel();
      const support =
        entry.state.supportId === undefined
          ? undefined
          : supportVelocities.get(entry.state.supportId);
      const jump = input.jumpPressed || (input.jump && !entry.state.jumpHeld);
      entry.state.jumpHeld = input.jump ?? false;
      const x = input.vx / SCALE + (support?.x ?? 0),
        z = input.vy / SCALE + (support?.z ?? 0);
      // A grounded motor follows the support tangent. Keeping last tick's tiny
      // downward velocity makes a fixed box snag at a ramp/deck junction.
      let vertical = entry.state.grounded
        ? -(entry.state.normalX * x + entry.state.normalZ * z) / Math.max(0.5, entry.state.normalY)
        : velocity.y;
      if (input.altitude !== undefined)
        vertical = (input.altitude / SCALE + entry.halfY - entry.body.translation().y) / PHYSICS_DT;
      else if (jump && entry.state.grounded) {
        vertical = JUMP_VELOCITY / SCALE;
        entry.state.grounded = false;
        delete entry.state.supportId;
      }
      entry.body.setLinvel(
        {
          x: input.vx / SCALE + (support?.x ?? 0),
          y: vertical,
          z: input.vy / SCALE + (support?.z ?? 0),
        },
        true,
      );
      if (entry.kind === "vehicle" && input.heading !== undefined) {
        const angle = entry.state.heading,
          delta = Math.atan2(Math.sin(input.heading - angle), Math.cos(input.heading - angle));
        entry.body.setAngvel(
          { x: 0, y: -Math.max(-3, Math.min(3, delta / PHYSICS_DT)), z: 0 },
          true,
        );
      }
    }
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
    state.x = (p.x + this.origin.x - entry.offsetX) * SCALE;
    state.y = (p.z + this.origin.z - entry.offsetY) * SCALE;
    state.z = (p.y - entry.halfY) * SCALE;
    state.vx = v.x * SCALE;
    state.vy = v.z * SCALE;
    state.vz = v.y * SCALE;
    state.heading = -2 * Math.atan2(q.y, q.w);
    state.grounded = entry.kind === "fixed";
    delete state.supportId;
    this.world.contactPairsWith(entry.collider, (other) => {
      this.world.contactPair(entry.collider, other, (manifold, flipped) => {
        const otherId = this.colliderIds.get(other.handle);
        let touching = false;
        for (let i = 0; i < manifold.numContacts(); i++)
          if (manifold.contactDist(i) <= 0.005) {
            touching = true;
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
        if (ny < -0.5 && touching && separating < 0.25) {
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

  contactIds(id: number): ReadonlySet<number> | undefined {
    return this.contacts.get(id);
  }

  bodyState(id: number): Readonly<PhysicsBodyState> | undefined {
    return this.bodies.get(id)?.state;
  }

  snapshot(): PhysicsState {
    return {
      tick: this.tick,
      bodies: [...this.bodies.values()].map((entry) => ({ ...entry.state })),
    };
  }
  /** Restore body/motor state at an authoritative physics tick; no hidden step. */
  restore(snapshot: PhysicsState) {
    this.tick = snapshot.tick;
    for (const state of snapshot.bodies) {
      const entry = this.bodies.get(state.id);
      if (!entry) throw Error(`Missing physics body ${state.id} during restore`);
      entry.body.setTranslation(
        {
          x: state.x / SCALE + entry.offsetX - this.origin.x,
          y: state.z / SCALE + entry.halfY,
          z: state.y / SCALE + entry.offsetY - this.origin.z,
        },
        true,
      );
      entry.body.setLinvel({ x: state.vx / SCALE, y: state.vz / SCALE, z: state.vy / SCALE }, true);
      entry.body.setRotation(
        { x: 0, y: -Math.sin(state.heading / 2), z: 0, w: Math.cos(state.heading / 2) },
        true,
      );
      entry.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      entry.state = { ...state };
      // Publish only state supplied by the snapshot, without inventing contacts.
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
  }
}
