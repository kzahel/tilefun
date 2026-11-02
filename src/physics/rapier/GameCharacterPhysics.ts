import RAPIER from "@dimforge/rapier3d-compat";
import {
  ELEVATION_PX,
  JUMP_GRAVITY,
  PLAYER_SPEED,
  STEP_UP_THRESHOLD,
  TILE_SIZE,
} from "../../config/constants.js";
import { type AABB, aabbsOverlap, getEntityAABB } from "../../entities/collision.js";
import type { Entity } from "../../entities/Entity.js";
import { CollisionFlag } from "../../world/TileRegistry.js";
import { clipAirMomentum } from "../AirborneMomentum.js";
import { CharacterMotionBudget } from "../CharacterMotionBudget.js";
import type { CharacterMotionBackend, CharacterMotionSource } from "../CharacterPhysics.js";
import type { MovementPhysicsParams } from "../PlayerMovement.js";
import { surfaceZAt } from "../SurfacePatch.js";
import {
  characterSidesOverlap,
  guardCharacterSideContact,
  shareCharacterContact,
} from "./CharacterContact.js";
import { characterShape, PHYSICS_PIXELS_PER_METRE as SCALE } from "./CharacterShape.js";
import { clippedTerrainVertices } from "./ClippedTerrain.js";
import { initRapier } from "./RapierWorld.js";

const SKIN = 0.002;
const MAX_COLLIDERS = 512;
const MAX_SPAN = 512;

/** Disposable bounded query scene: no simulation history, dynamics or hidden carry.
 * Rebuilt in canonical order so scratch replay cannot inherit another scene's cache.
 */
class GameCharacterPhysics implements CharacterMotionBackend {
  step(entity: Entity, dt: number, physics: MovementPhysicsParams, source: CharacterMotionSource) {
    if (!entity.collider || !entity.velocity)
      return { landed: false, groundZ: entity.groundZ ?? entity.wz ?? 0 };
    const previousFeet = entity.wz ?? 0;
    const wasAirborne = entity.jumpVZ !== undefined;
    const vertical = wasAirborne
      ? (entity.jumpVZ ?? 0) - JUMP_GRAVITY * physics.gravityScale * dt
      : 0;
    const desired = {
      x: (entity.velocity.vx * dt) / SCALE,
      // Grounded movement uses KCC snap/support detection, not an artificial
      // downward velocity. Combining that probe with a box on a nearly-unit
      // floor normal can make KCC's nonslip projection discard horizontal input.
      y: wasAirborne ? (vertical * dt) / SCALE : 0,
      z: (entity.velocity.vy * dt) / SCALE,
    };
    const budget = source.motionBudget ?? new CharacterMotionBudget();
    const walkSpeed = physics.walkSpeed ?? PLAYER_SPEED;
    const admitted = budget.admit(
      entity.id,
      desired.x * SCALE,
      desired.z * SCALE,
      dt,
      Math.max(walkSpeed, Math.hypot(entity.velocity.vx, entity.velocity.vy)),
      true,
    );
    desired.x = admitted.x / SCALE;
    desired.z = admitted.y / SCALE;
    const hull = characterShape(entity, physics.characterPhysics === 2 ? "capsule" : "box");
    const origin = {
      x: Math.floor(hull.center.x),
      y: Math.floor(hull.center.y),
      z: Math.floor(hull.center.z),
    };
    const start = getEntityAABB(entity.position, entity.collider);
    const bounds = {
      left: Math.min(start.left, start.left + desired.x * SCALE) - 32,
      right: Math.max(start.right, start.right + desired.x * SCALE) + 32,
      top: Math.min(start.top, start.top + desired.z * SCALE) - 32,
      bottom: Math.max(start.bottom, start.bottom + desired.z * SCALE) + 32,
    };
    if (bounds.right - bounds.left > MAX_SPAN || bounds.bottom - bounds.top > MAX_SPAN)
      throw Error("Experimental character query exceeds bounded extent");
    const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    world.timestep = dt;
    let colliders = 0;
    const add = (desc: RAPIER.ColliderDesc) => {
      if (++colliders > MAX_COLLIDERS)
        throw Error("Experimental character query exceeds collider budget");
      return world.createCollider(desc);
    };
    try {
      const props = source
        .queryProps(bounds)
        .filter((prop) => {
          return (prop.walls ?? (prop.collider ? [prop.collider] : [])).some((c) =>
            aabbsOverlap(bounds, getEntityAABB(prop.position, c)),
          );
        })
        .sort((a, b) => a.id - b.id);
      // Partition at authored excavation edges as well as tile edges. Ground is
      // a solid base; elevated slabs retain empty space below their underside.
      const cuts = props.flatMap((prop) =>
        (prop.walls ?? (prop.collider ? [prop.collider] : [])).flatMap((c) =>
          c.surface?.excavation
            ? [{ patch: c.surface, bounds: getEntityAABB(prop.position, c) }]
            : [],
        ),
      );
      const water = new Map<number, number>();
      const oneWay = new Map<
        number,
        { bounds: AABB; collider: import("../../entities/Prop.js").PropCollider }
      >();
      const xs = new Set<number>(),
        zs = new Set<number>();
      const minX = Math.floor(bounds.left / TILE_SIZE),
        maxX = Math.floor(bounds.right / TILE_SIZE);
      const minZ = Math.floor(bounds.top / TILE_SIZE),
        maxZ = Math.floor(bounds.bottom / TILE_SIZE);
      for (let x = minX; x <= maxX + 1; x++) xs.add(x * TILE_SIZE);
      for (let z = minZ; z <= maxZ + 1; z++) zs.add(z * TILE_SIZE);
      for (const prop of props)
        for (const c of prop.walls ?? (prop.collider ? [prop.collider] : []))
          if (c.surface?.excavation) {
            const b = getEntityAABB(prop.position, c);
            for (const x of [b.left, b.right])
              if (x > minX * TILE_SIZE && x < (maxX + 1) * TILE_SIZE) xs.add(x);
            for (const z of [b.top, b.bottom])
              if (z > minZ * TILE_SIZE && z < (maxZ + 1) * TILE_SIZE) zs.add(z);
          }
      const xx = [...xs].sort((a, b) => a - b),
        zz = [...zs].sort((a, b) => a - b);
      const box = (b: AABB, bottom: number, top: number) => {
        // Clip infinite/deep columns to this complete swept vertical interval.
        // Huge floor extents degrade f32 shape-cast precision for a small box.
        bottom = Math.max(bottom, Math.min(previousFeet, previousFeet + desired.y * SCALE) - 64);
        top = Math.min(
          top,
          Math.max(previousFeet, previousFeet + desired.y * SCALE) + 2 * hull.half.y * SCALE + 64,
        );
        if (top <= bottom) return;
        return add(
          RAPIER.ColliderDesc.cuboid(
            (b.right - b.left) / 2 / SCALE,
            (top - bottom) / 2 / SCALE,
            (b.bottom - b.top) / 2 / SCALE,
          ).setTranslation(
            (b.left + b.right) / 2 / SCALE - origin.x,
            (top + bottom) / 2 / SCALE - origin.y,
            (b.top + b.bottom) / 2 / SCALE - origin.z,
          ),
        );
      };
      if (xx.length * zz.length > MAX_COLLIDERS * 4)
        throw Error("Experimental geometry partition budget exceeded");
      const ground: { bounds: AABB; height: number }[] = [];
      let previousRow = new Map<string, { bounds: AABB; height: number }>();
      for (let zi = 1; zi < zz.length; zi++) {
        const row: { bounds: AABB; height: number }[] = [];
        for (let xi = 1; xi < xx.length; xi++) {
          const b = {
            left: xx[xi - 1] ?? 0,
            right: xx[xi] ?? 0,
            top: zz[zi - 1] ?? 0,
            bottom: zz[zi] ?? 0,
          };
          const tx = Math.floor((b.left + b.right) / 2 / TILE_SIZE),
            tz = Math.floor((b.top + b.bottom) / 2 / TILE_SIZE);
          const flags = source.getCollision(tx, tz);
          const floor = source.getHeight(tx, tz) * ELEVATION_PX;
          const wall = !!(flags & CollisionFlag.Solid);
          if (!wall && flags & CollisionFlag.Water) {
            const barrier = box(b, floor, Math.max(4096, previousFeet + 128));
            if (barrier) water.set(barrier.handle, floor);
          }
          const cellCuts = wall ? [] : cuts.filter((cut) => aabbsOverlap(cut.bounds, b));
          if (cellCuts.length) {
            const points = clippedTerrainVertices(
              b,
              Math.min(previousFeet, previousFeet + desired.y * SCALE) - 64,
              Math.min(
                floor,
                Math.max(previousFeet, previousFeet + desired.y * SCALE) +
                  2 * hull.half.y * SCALE +
                  64,
              ),
              cellCuts,
            );
            if (points.length >= 4) {
              const descriptor = RAPIER.ColliderDesc.convexHull(
                new Float32Array(
                  points.flatMap((p) => [
                    p.x / SCALE - origin.x,
                    p.y / SCALE - origin.y,
                    p.z / SCALE - origin.z,
                  ]),
                ),
              );
              if (descriptor) add(descriptor);
            }
            continue;
          }
          const height = wall ? Math.max(4096, previousFeet + 128) : floor;
          const last = row[row.length - 1];
          if (last && last.height === height && last.bounds.right === b.left)
            last.bounds.right = b.right;
          else row.push({ bounds: b, height });
        }
        const nextRow = new Map<string, { bounds: AABB; height: number }>();
        for (const cell of row) {
          const key = `${cell.bounds.left}:${cell.bounds.right}:${cell.height}`;
          const previous = previousRow.get(key);
          if (previous && previous.bounds.bottom === cell.bounds.top) {
            previous.bounds.bottom = cell.bounds.bottom;
            nextRow.set(key, previous);
          } else {
            ground.push(cell);
            nextRow.set(key, cell);
          }
        }
        previousRow = nextRow;
      }
      for (const cell of ground) box(cell.bounds, -4096, cell.height);
      for (const prop of props)
        for (const c of prop.walls ?? (prop.collider ? [prop.collider] : [])) {
          const authored = getEntityAABB(prop.position, c);
          const b = {
            left: Math.max(authored.left, bounds.left),
            right: Math.min(authored.right, bounds.right),
            top: Math.max(authored.top, bounds.top),
            bottom: Math.min(authored.bottom, bounds.bottom),
          };
          if (b.left >= b.right || b.top >= b.bottom) continue;
          if (c.passable && !c.surface && !c.walkableTop) continue;
          if (c.surface) {
            const vertices: number[] = [];
            for (const down of [0, c.surface.thickness])
              for (const [x, z] of [
                [b.left, b.top],
                [b.right, b.top],
                [b.right, b.bottom],
                [b.left, b.bottom],
              ])
                vertices.push(
                  (x ?? 0) / SCALE - origin.x,
                  (surfaceZAt(c.surface, authored, x ?? 0, z ?? 0) - down) / SCALE - origin.y,
                  (z ?? 0) / SCALE - origin.z,
                );
            const descriptor = RAPIER.ColliderDesc.convexHull(new Float32Array(vertices));
            if (!descriptor) throw Error("Invalid authored surface hull");
            const collider = add(descriptor);
            if (c.passable) oneWay.set(collider.handle, { bounds: authored, collider: c });
          } else {
            const collider = box(
              b,
              c.zBase ?? 0,
              c.zHeight === undefined
                ? Math.max(4096, previousFeet + 128)
                : (c.zBase ?? 0) + c.zHeight,
            );
            if (c.passable && collider)
              oneWay.set(collider.handle, { bounds: authored, collider: c });
          }
        }
      const bodies = source
        .queryEntities(bounds)
        .filter(
          (other) =>
            other.id !== entity.id &&
            !source.excludeIds.has(other.id) &&
            other.collider &&
            (source.shouldEntityBlock?.(other) ?? other.collider.solid !== false) &&
            aabbsOverlap(bounds, getEntityAABB(other.position, other.collider)),
        )
        .sort((a, b) => a.id - b.id);
      const actors = new Map<
        number,
        { entity: Entity; collider: RAPIER.Collider; sideHalfHeight: number }
      >();
      for (const other of bodies) {
        const shape = characterShape(
          other,
          other.type === "player" && physics.characterPhysics === 2 ? "capsule" : "box",
        );
        actors.set(other.id, {
          entity: other,
          sideHalfHeight: shape.sideHalfHeight,
          collider: add(
            shape.descriptor.setTranslation(
              shape.center.x - origin.x,
              shape.center.y - origin.y + (other.type === "player" ? SKIN : 0),
              shape.center.z - origin.z,
            ),
          ),
        });
      }
      // The collider offset is physical skin, not a change to the saved foot anchor.
      const character = add(
        hull.descriptor.setTranslation(
          hull.center.x - origin.x,
          hull.center.y - origin.y + SKIN,
          hull.center.z - origin.z,
        ),
      );
      const controller = world.createCharacterController(SKIN);
      controller.enableAutostep(STEP_UP_THRESHOLD / SCALE, 0.1, false);
      if (!wasAirborne) controller.enableSnapToGround(STEP_UP_THRESHOLD / SCALE);
      controller.setMaxSlopeClimbAngle(Math.PI / 4);
      controller.setMinSlopeSlideAngle(wasAirborne ? 0 : Math.PI / 3);
      controller.setApplyImpulsesToDynamicBodies(false);
      world.step();
      let target: { entity: Entity; collider: RAPIER.Collider; sideHalfHeight: number } | undefined;
      let firstImpact = Infinity;
      if (source.pushBody)
        for (const actor of actors.values())
          if (
            actor.entity.type === "player" &&
            actor.entity.jumpVZ === undefined &&
            characterSidesOverlap(
              character.translation().y,
              hull.sideHalfHeight,
              actor.collider.translation().y,
              actor.sideHalfHeight,
              SKIN,
            )
          ) {
            const hit = character.castCollider(
              desired,
              actor.collider,
              { x: 0, y: 0, z: 0 },
              SKIN,
              1,
              false,
            );
            if (hit && Math.abs(hit.normal1.y) < 0.5 && hit.time_of_impact < firstImpact) {
              target = actor;
              firstImpact = hit.time_of_impact;
            }
          }
      let supportId: number | undefined;
      const actorByCollider = new Map(
        [...actors.values()].map((actor) => [
          actor.collider.handle,
          { ...actor, centerY: actor.collider.translation().y },
        ]),
      );
      const movingActor = (collider: RAPIER.Collider) =>
        collider.handle === character.handle
          ? entity
          : actorByCollider.get(collider.handle)?.entity;
      const filter = (
        collider: RAPIER.Collider,
        exclude?: RAPIER.Collider,
        intent?: RAPIER.Vector,
      ) => {
        const mover = movingActor(collider);
        const moverY = collider.translation().y;
        const sideHalf =
          collider.handle === character.handle
            ? hull.sideHalfHeight
            : actorByCollider.get(collider.handle)?.sideHalfHeight;
        return (other: RAPIER.Collider) => {
          if (
            other.handle === character.handle ||
            other.handle === collider.handle ||
            other.handle === exclude?.handle ||
            (collider.handle === character.handle && other.handle === target?.collider.handle)
          )
            return false;
          const peer = actorByCollider.get(other.handle);
          // An idle lower motor must not manufacture sideways motion to clear
          // its rider. Upward or horizontal intent still queries that obstacle.
          if (
            mover?.type === "player" &&
            peer?.entity.type === "player" &&
            sideHalf !== undefined &&
            (intent?.y ?? 0) <= 0 &&
            Math.hypot(intent?.x ?? 0, intent?.z ?? 0) < 1e-8 &&
            peer.centerY > moverY &&
            !characterSidesOverlap(moverY, sideHalf, peer.centerY, peer.sideHalfHeight, SKIN)
          )
            return false;
          if (
            water.has(other.handle) &&
            (mover?.jumpVZ !== undefined ||
              (mover?.wz ?? 0) > (water.get(other.handle) ?? 0) + STEP_UP_THRESHOLD)
          )
            return false;
          const platform = oneWay.get(other.handle);
          if (platform) {
            const c = platform.collider;
            const top = c.surface
              ? surfaceZAt(
                  c.surface,
                  platform.bounds,
                  mover?.position.wx ?? 0,
                  mover?.position.wy ?? 0,
                )
              : (c.zBase ?? 0) + (c.zHeight ?? 0);
            if (
              (collider.handle === character.handle ? vertical : (mover?.jumpVZ ?? 0)) > 0 ||
              (mover?.wz ?? 0) + (mover?.jumpVZ === undefined ? STEP_UP_THRESHOLD : SKIN * SCALE) <
                top
            )
              return false;
          }
          return true;
        };
      };
      const supportAt = (
        collider: RAPIER.Collider,
        delta: RAPIER.Vector,
        exclude?: RAPIER.Collider,
      ) => {
        const position = collider.translation();
        const hit = world.castShape(
          { x: position.x + delta.x, y: position.y + delta.y, z: position.z + delta.z },
          collider.rotation(),
          { x: 0, y: -1, z: 0 },
          collider.shape,
          0,
          SKIN * 3,
          false,
          undefined,
          undefined,
          collider,
          undefined,
          filter(collider, exclude),
        );
        return hit && hit.normal1.y > 0.5 ? hit : null;
      };
      const supportActorId = (support: ReturnType<typeof supportAt>) =>
        [...actors.values()].find((actor) => actor.collider.handle === support?.collider.handle)
          ?.entity.id;
      let queryGrounded = false;
      let hitCeiling = false;
      const query = (collider: RAPIER.Collider, move: RAPIER.Vector, exclude?: RAPIER.Collider) => {
        const mover = movingActor(collider);
        if (mover?.jumpVZ === undefined) controller.enableSnapToGround(STEP_UP_THRESHOLD / SCALE);
        else controller.disableSnapToGround();
        controller.setMinSlopeSlideAngle(mover?.jumpVZ === undefined ? Math.PI / 3 : 0);
        controller.computeColliderMovement(
          collider,
          move,
          undefined,
          undefined,
          filter(collider, exclude, move),
        );
        const resolved = controller.computedMovement();
        // KCC's grounded flag can anticipate support before the requested fall
        // reaches it. Landing effects require contact at the resolved endpoint.
        const support = move.y <= 0 ? supportAt(collider, resolved, exclude) : null;
        queryGrounded = !!support;
        if (collider.handle === character.handle) {
          supportId = supportActorId(support);
          hitCeiling = false;
          for (let i = 0; i < controller.numComputedCollisions(); i++)
            if ((controller.computedCollision(i)?.normal1.y ?? 0) < -0.5) hitCeiling = true;
        }
        return resolved;
      };
      const clearEndpoint = (collider: RAPIER.Collider, delta: RAPIER.Vector) => {
        const p = collider.translation();
        return !world.intersectionWithShape(
          { x: p.x + delta.x, y: p.y + delta.y, z: p.z + delta.z },
          collider.rotation(),
          collider.shape,
          undefined,
          undefined,
          collider,
          undefined,
          filter(collider, undefined, delta),
        );
      };
      let move = query(character, desired);
      let grounded = queryGrounded;
      const pushes: { before: Entity; after: Entity }[] = [];
      // Controlled recipients have no inferred future input here. Their own
      // motor is advanced by its owner; this transaction supplies passive push.
      for (const actor of target ? [target] : []) {
        const otherMove = { x: 0, y: 0, z: 0 };
        const hit = character.castCollider(move, actor.collider, otherMove, SKIN, 1, false);
        if (!hit) continue;
        if (
          !shareCharacterContact(
            move,
            otherMove,
            hit.normal1,
            hit.time_of_impact,
            (walkSpeed * dt) / SCALE,
          )
        )
          continue;
        const passive = budget.admit(
          actor.entity.id,
          otherMove.x * SCALE,
          otherMove.z * SCALE,
          dt,
          Math.max(
            walkSpeed,
            Math.hypot(actor.entity.velocity?.vx ?? 0, actor.entity.velocity?.vy ?? 0),
          ),
          false,
          entity.id,
        );
        otherMove.x = passive.x / SCALE;
        otherMove.z = passive.y / SCALE;
        // This side-contact transaction owns horizontal pushing only. Preserve
        // the primary motor's vertical intent; let each KCC resolve support.
        // Refeeding its tiny downward skin correction as a new proposal can
        // make a grounded box's nonslip projection discard horizontal motion.
        otherMove.y = 0;
        move.y = desired.y;
        const received = query(actor.collider, otherMove, actor.collider);
        move = query(character, move);
        grounded = queryGrounded;
        const guard = character.castCollider(move, actor.collider, received, SKIN / 2, 1, false);
        if (guard) guardCharacterSideContact(move, received, guard.normal1, guard.time_of_impact);
        const endpoint = (collider: RAPIER.Collider, delta: RAPIER.Vector) => {
          const p = collider.translation();
          return { x: p.x + delta.x, y: p.y + delta.y, z: p.z + delta.z };
        };
        const pairOverlap = character.shape.intersectsShape(
          endpoint(character, move),
          character.rotation(),
          actor.collider.shape,
          endpoint(actor.collider, received),
          actor.collider.rotation(),
        );
        // Net autostep movement is not necessarily a straight safe prefix.
        // A conservative pair guard must not commit an endpoint inside terrain.
        if (
          pairOverlap ||
          !clearEndpoint(character, move) ||
          !clearEndpoint(actor.collider, received)
        ) {
          // Retry the ordinary engine query with the peer as an obstacle.
          // Cancelling a horizontal push must not also cancel vertical travel.
          target = undefined;
          move = query(character, desired);
          received.x = received.y = received.z = 0;
          grounded = queryGrounded;
        }
        // Pair guards can shorten or cancel autostep. Commit support metadata
        // from those final endpoints, not the KCC's unguarded destination.
        const finalSupport = desired.y <= 0 ? supportAt(character, move) : null;
        grounded = !!finalSupport;
        supportId = supportActorId(finalSupport);
        const recipientGrounded = !!supportAt(actor.collider, received, actor.collider);
        pushes.push({
          before: actor.entity,
          after: {
            ...actor.entity,
            position: {
              wx: actor.entity.position.wx + received.x * SCALE,
              wy: actor.entity.position.wy + received.z * SCALE,
            },
            wz: (actor.entity.wz ?? 0) + received.y * SCALE,
            ...(actor.entity.jumpVZ === undefined && recipientGrounded
              ? { groundZ: (actor.entity.wz ?? 0) + received.y * SCALE, jumpZ: 0 }
              : actor.entity.jumpVZ === undefined
                ? { jumpVZ: 0 }
                : {}),
          },
        });
      }
      budget.record(entity.id, move.x * SCALE, move.z * SCALE);
      for (const push of pushes)
        budget.record(
          push.before.id,
          push.after.position.wx - push.before.position.wx,
          push.after.position.wy - push.before.position.wy,
        );
      entity.position.wx += move.x * SCALE;
      entity.position.wy += move.z * SCALE;
      entity.wz = previousFeet + move.y * SCALE;
      if (grounded && vertical <= 0) {
        delete entity.jumpVZ;
        entity.groundZ = entity.wz;
        entity.jumpZ = 0;
      } else {
        entity.jumpVZ = hitCeiling && vertical > 0 ? 0 : vertical;
        // Actual landing is a KCC contact, not legacy surface integration.
        const ray = world.castRay(
          new RAPIER.Ray(
            {
              x: hull.center.x - origin.x + move.x,
              y: hull.center.y - origin.y + move.y - hull.half.y,
              z: hull.center.z - origin.z + move.z,
            },
            { x: 0, y: -1, z: 0 },
          ),
          8192 / SCALE,
          true,
          undefined,
          undefined,
          character,
          undefined,
          filter(character),
        );
        entity.groundZ = ray
          ? entity.wz + SKIN * SCALE - ray.timeOfImpact * SCALE
          : source.getHeight(
              Math.floor(entity.position.wx / TILE_SIZE),
              Math.floor(entity.position.wy / TILE_SIZE),
            ) * ELEVATION_PX;
        entity.jumpZ = Math.max(0, entity.wz - entity.groundZ);
      }
      // Only clipping voluntary movement into a wall changes its retained
      // velocity. Passive recipient displacement never becomes motor velocity.
      if (pushes.length === 0) {
        if (Math.abs(move.x) < Math.abs(desired.x) - SKIN && move.x * desired.x >= 0) {
          entity.velocity.vx = (move.x * SCALE) / dt;
          clipAirMomentum(entity, "x");
        }
        if (Math.abs(move.z) < Math.abs(desired.z) - SKIN && move.z * desired.z >= 0) {
          entity.velocity.vy = (move.z * SCALE) / dt;
          clipAirMomentum(entity, "y");
        }
      }
      for (const push of pushes) source.pushBody?.(push.before, push.after);
      return {
        landed: wasAirborne && grounded && vertical <= 0,
        groundZ: entity.groundZ ?? entity.wz ?? 0,
        ...(supportId !== undefined ? { supportEntityId: supportId } : {}),
      };
    } finally {
      world.free();
    }
  }
}
export async function createGameCharacterPhysics(): Promise<CharacterMotionBackend> {
  await initRapier();
  return new GameCharacterPhysics();
}
