import RAPIER from "@dimforge/rapier3d-compat";
import { CHUNK_SIZE_PX } from "../../config/constants.js";
import { type AABB, aabbsOverlap, getEntityAABB } from "../../entities/collision.js";
import type { Entity } from "../../entities/Entity.js";
import type { CharacterMotionSource } from "../CharacterPhysics.js";
import { characterShape } from "./CharacterShape.js";
import { compileCollisionGeometry, type OneWayColliders } from "./CollisionGeometry.js";

const SKIN = 0.002;
type Section = {
  identity: unknown;
  revision: string | number;
  props: string;
  checked: number;
  touched: number;
  colliders: RAPIER.Collider[];
};
type Actor = {
  collider: RAPIER.Collider;
  shape: string;
  touched: number;
  entity: Entity;
  center: RAPIER.Vector;
  bounds: AABB;
  rotation: string;
};

/** One persistent collision authority, owned by a Realm or one private predictor.
 * Controlled bodies are colliders, not inferred-velocity kinematics. Query refresh
 * updates Rapier's broad phase but never integrates an actor a second time.
 */
export class PersistentCollisionWorld {
  readonly world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  readonly controller = this.world.createCharacterController(SKIN);
  readonly origin = { x: 0, y: 0, z: 0 };
  readonly water = new Map<number, number>();
  readonly oneWay: OneWayColliders = new Map();
  private sections = new Map<string, Section>();
  private actors = new Map<number, Actor>();
  private frame = 0;
  private initialized = false;
  private freed = false;
  private unsupported = new Map<string, number>();
  reject(reason: string): undefined {
    this.unsupported.set(reason, (this.unsupported.get(reason) ?? 0) + 1);
    return undefined;
  }
  readonly metrics = {
    replacedActorShapes: 0,
    queries: 0,
    rebuiltSections: 0,
    queryMs: 0,
    geometryMs: 0,
    refreshMs: 0,
  };

  beginFrame() {
    this.frame++;
  }
  endFrame() {
    for (const [key, section] of this.sections)
      if (section.touched < this.frame - 1) {
        this.removeSection(section);
        this.sections.delete(key);
      }
    for (const [id, actor] of this.actors)
      if (actor.touched < this.frame - 1) {
        this.world.removeCollider(actor.collider, false);
        this.actors.delete(id);
      }
  }
  get diagnostics() {
    return {
      ...this.metrics,
      sections: this.sections.size,
      actors: this.actors.size,
      colliders: this.world.colliders.len(),
      unsupported: Object.fromEntries(this.unsupported),
    };
  }
  dispose() {
    if (!this.freed) {
      this.freed = true;
      this.world.free();
    }
  }
  private removeSection(section: Section) {
    for (const c of section.colliders) {
      this.water.delete(c.handle);
      this.oneWay.delete(c.handle);
      this.world.removeCollider(c, false);
    }
  }
  prepare(entity: Entity, bounds: AABB, source: CharacterMotionSource) {
    if (this.freed) throw Error("Collision world has been disposed");
    const started = performance.now();
    // Rebase all collider positions together; section identities remain world-space.
    const center = characterShape(entity, "box").center;
    if (
      !this.initialized ||
      Math.hypot(center.x - this.origin.x, center.z - this.origin.z) > 1024
    ) {
      const next = {
        x: Math.floor(center.x / 16) * 16,
        y: Math.floor(center.y / 16) * 16,
        z: Math.floor(center.z / 16) * 16,
      };
      this.world.colliders.forEach((c) => {
        const p = c.translation();
        c.setTranslation({
          x: p.x + this.origin.x - next.x,
          y: p.y + this.origin.y - next.y,
          z: p.z + this.origin.z - next.z,
        });
      });
      Object.assign(this.origin, next);
      for (const actor of this.actors.values()) actor.center = actor.collider.translation();
      this.initialized = true;
    }
    for (
      let cy = Math.floor(bounds.top / CHUNK_SIZE_PX);
      cy <= Math.floor(bounds.bottom / CHUNK_SIZE_PX);
      cy++
    )
      for (
        let cx = Math.floor(bounds.left / CHUNK_SIZE_PX);
        cx <= Math.floor(bounds.right / CHUNK_SIZE_PX);
        cx++
      ) {
        const key = `${cx},${cy}`,
          old = this.sections.get(key);
        const version = source.geometryVersion?.(cx, cy);
        if (
          old &&
          old.checked === this.frame &&
          version?.identity === old.identity &&
          version?.revision === old.revision
        ) {
          old.touched = this.frame;
          continue;
        }
        const area = {
          left: cx * CHUNK_SIZE_PX,
          top: cy * CHUNK_SIZE_PX,
          right: (cx + 1) * CHUNK_SIZE_PX,
          bottom: (cy + 1) * CHUNK_SIZE_PX,
        };
        const props = JSON.stringify(
          source.queryProps(area).map((p) => [p.id, p.position, p.collider, p.walls]),
        );
        // Direct test callers without chunk versions use a content signature.
        let revision = version?.revision;
        if (revision === undefined) {
          const values: number[] = [];
          for (let y = cy * 16; y < (cy + 1) * 16; y++)
            for (let x = cx * 16; x < (cx + 1) * 16; x++)
              values.push(source.getCollision(x, y), source.getHeight(x, y));
          revision = values.join(",");
        }
        if (
          old &&
          old.identity === version?.identity &&
          old.revision === revision &&
          old.props === props
        ) {
          old.checked = old.touched = this.frame;
          continue;
        }
        if (old) this.removeSection(old);
        const section: Section = {
          identity: version?.identity,
          revision,
          props,
          checked: this.frame,
          touched: this.frame,
          colliders: [],
        };
        const low = Math.min(
          -64,
          ...source
            .queryProps(area)
            .flatMap((prop) =>
              (prop.walls ?? (prop.collider ? [prop.collider] : [])).map((c) =>
                c.surface
                  ? c.surface.z +
                    Math.min(0, c.surface.riseX) +
                    Math.min(0, c.surface.riseY) -
                    c.surface.thickness -
                    64
                  : (c.zBase ?? 0) - 64,
              ),
            ),
        );
        const compiled = compileCollisionGeometry(source, area, this.origin, low, 4096, (desc) => {
          const c = this.world.createCollider(desc);
          section.colliders.push(c);
          return c;
        });
        for (const [id, z] of compiled.water) this.water.set(id, z);
        for (const [id, p] of compiled.oneWay) this.oneWay.set(id, p);
        this.sections.set(key, section);
        this.metrics.rebuiltSections++;
      }
    if (this.sections.size > 512)
      throw Error("Rapier realm section residency exceeds 512 sections");
    this.metrics.geometryMs += performance.now() - started;
  }
  actor(entity: Entity, capsule: boolean) {
    const hull = characterShape(entity, capsule ? "capsule" : "box", true);
    const shape = `${capsule}:${hull.half.x}:${hull.half.y}:${hull.half.z}`;
    let actor = this.actors.get(entity.id);
    if (actor && actor.shape !== shape) {
      this.metrics.replacedActorShapes++;
      this.world.removeCollider(actor.collider, false);
      this.actors.delete(entity.id);
      actor = undefined;
    }
    const center = {
      x: hull.center.x - this.origin.x,
      y: hull.center.y - this.origin.y + SKIN,
      z: hull.center.z - this.origin.z,
    };
    if (!actor) {
      actor = {
        collider: this.world.createCollider(
          hull.descriptor.setTranslation(center.x, center.y, center.z),
        ),
        shape,
        entity,
        touched: this.frame,
        center,
        rotation: JSON.stringify(hull.rotation),
        bounds: getEntityAABB(
          entity.position,
          entity.collider ?? { offsetX: 0, offsetY: 0, width: 0, height: 0 },
        ),
      };
      this.actors.set(entity.id, actor);
    } else {
      if (
        center.x !== actor.center.x ||
        center.y !== actor.center.y ||
        center.z !== actor.center.z
      ) {
        actor.collider.setTranslation(center);
        actor.center = center;
        if (entity.collider) actor.bounds = getEntityAABB(entity.position, entity.collider);
      }
      const rotation = JSON.stringify(hull.rotation);
      if (actor.rotation !== rotation) {
        actor.collider.setRotation(hull.rotation);
        actor.rotation = rotation;
      }
      actor.entity = entity;
      actor.touched = this.frame;
    }
    return actor.collider;
  }
  synchronizeNeighborhood(bounds: AABB, entities: readonly Entity[], self: Entity) {
    const ids = new Set([self.id, ...entities.map((e) => e.id)]);
    for (const [id, actor] of this.actors)
      if (!ids.has(id) && aabbsOverlap(bounds, actor.bounds)) {
        this.world.removeCollider(actor.collider, false);
        this.actors.delete(id);
      }
  }
  /** Rotation validation uses the same colliders as the movement query. Padding
   * covers the displacement between adjacent angular samples in local X/Z. */
  canOccupy(entity: Entity, source: CharacterMotionSource, mode: number, padding = 0): boolean {
    if (!entity.collider) return true;
    const footprint = getEntityAABB(entity.position, entity.collider);
    const bounds = {
      left: footprint.left - 32,
      top: footprint.top - 32,
      right: footprint.right + 32,
      bottom: footprint.bottom + 32,
    };
    this.prepare(entity, bounds, source);
    const bodies = source
      .queryEntities(bounds)
      .filter(
        (other) =>
          other.id !== entity.id &&
          other.parentId === undefined &&
          !!other.collider &&
          (other.collider.solid !== false || other.type === "ball") &&
          !source.excludeIds.has(other.id),
      );
    this.synchronizeNeighborhood(bounds, bodies, entity);
    for (const body of bodies)
      this.actor(body, mode === 4 && (body.type === "player" || !!body.wanderAI));
    const self = this.actor(entity, false);
    this.refresh(1 / 60);
    const hull = characterShape(entity, "box", true);
    return !this.world.intersectionWithShape(
      {
        x: hull.center.x - this.origin.x,
        y: hull.center.y - this.origin.y + SKIN,
        z: hull.center.z - this.origin.z,
      },
      hull.rotation,
      new RAPIER.Cuboid(hull.half.x + padding, hull.half.y, hull.half.z + padding),
      undefined,
      undefined,
      self,
      undefined,
      (other) =>
        !this.oneWay.has(other.handle) &&
        !(entity.jumpVZ !== undefined && this.water.has(other.handle)),
    );
  }
  refresh(dt: number) {
    const t = performance.now();
    this.world.timestep = dt;
    this.world.step();
    this.metrics.refreshMs += performance.now() - t;
  }
  recordQuery(ms: number) {
    this.metrics.queries++;
    this.metrics.queryMs += ms;
  }
}
