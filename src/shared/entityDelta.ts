/**
 * Entity delta compression — diff and apply functions for per-entity
 * incremental updates. Part of Protocol Phase 3 (entity delta compression).
 *
 * Convention (JSON Merge Patch, RFC 7396):
 * - Field absent from delta = unchanged
 * - Field present with value = changed to that value
 * - Field present with null = field removed (for optional entity-level fields)
 */

import type { Entity } from "../entities/Entity.js";
import type { SpriteState, WanderAIState } from "../entities/EntityDefs.js";
import { ENTITY_DEFS } from "../entities/EntityDefs.js";
import type { EntitySnapshot } from "./protocol.js";

/** Partial entity update — only changed fields are present. */
export interface EntityDelta {
  id: number;
  position?: { wx: number; wy: number };
  velocity?: { vx: number; vy: number } | null;
  spriteState?: SpriteState | null;
  wanderAIState?: WanderAIState | null;
  // Entity-level fields (null = field removed):
  flashHidden?: boolean | null;
  noShadow?: boolean | null;
  deathTimer?: number | null;
  jumpZ?: number | null;
  jumpVZ?: number | null;
  wz?: number | null;
  parentId?: number | null;
  localOffsetX?: number | null;
  localOffsetY?: number | null;
}

// ---- Snapshot diffing (server-side) ----

/**
 * Compare two entity snapshots and return a delta, or null if identical.
 * Both snapshots must have the same entity ID and type.
 */
export function diffEntitySnapshots(
  prev: EntitySnapshot,
  curr: EntitySnapshot,
): EntityDelta | null {
  let delta: EntityDelta | null = null;

  function ensure(): EntityDelta {
    if (!delta) delta = { id: curr.id };
    return delta;
  }

  // Position
  if (prev.position.wx !== curr.position.wx || prev.position.wy !== curr.position.wy) {
    ensure().position = curr.position;
  }

  // Velocity
  if (prev.velocity === null && curr.velocity === null) {
    // both null, no change
  } else if (prev.velocity === null || curr.velocity === null) {
    ensure().velocity = curr.velocity;
  } else if (prev.velocity.vx !== curr.velocity.vx || prev.velocity.vy !== curr.velocity.vy) {
    ensure().velocity = curr.velocity;
  }

  // SpriteState
  if (!spriteStatesEqual(prev.spriteState, curr.spriteState)) {
    ensure().spriteState = curr.spriteState;
  }

  // WanderAIState
  if (!wanderAIStatesEqual(prev.wanderAIState, curr.wanderAIState)) {
    ensure().wanderAIState = curr.wanderAIState;
  }

  // Entity-level optional fields — use null sentinel for removal
  diffOptionalBool("flashHidden", prev, curr, ensure);
  diffOptionalBool("noShadow", prev, curr, ensure);
  diffOptionalNum("deathTimer", prev, curr, ensure);
  diffOptionalNum("jumpZ", prev, curr, ensure);
  diffOptionalNum("jumpVZ", prev, curr, ensure);
  diffOptionalNum("wz", prev, curr, ensure);
  diffOptionalNum("parentId", prev, curr, ensure);
  diffOptionalNum("localOffsetX", prev, curr, ensure);
  diffOptionalNum("localOffsetY", prev, curr, ensure);

  return delta;
}

function spriteStatesEqual(a: SpriteState | null, b: SpriteState | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return (
    a.direction === b.direction &&
    a.moving === b.moving &&
    a.frameRow === b.frameRow &&
    a.flipX === b.flipX &&
    a.frameDuration === b.frameDuration
  );
}

function wanderAIStatesEqual(a: WanderAIState | null, b: WanderAIState | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return (
    a.state === b.state && a.dirX === b.dirX && a.dirY === b.dirY && a.following === b.following
  );
}

type OptionalBoolField = "flashHidden" | "noShadow";
type OptionalNumField =
  | "deathTimer"
  | "jumpZ"
  | "jumpVZ"
  | "wz"
  | "parentId"
  | "localOffsetX"
  | "localOffsetY";

function diffOptionalBool(
  field: OptionalBoolField,
  prev: EntitySnapshot,
  curr: EntitySnapshot,
  ensure: () => EntityDelta,
): void {
  const pv = prev[field];
  const cv = curr[field];
  if (pv === cv) return;
  if (cv === undefined) {
    // Field was removed
    ensure()[field] = null;
  } else {
    ensure()[field] = cv;
  }
}

function diffOptionalNum(
  field: OptionalNumField,
  prev: EntitySnapshot,
  curr: EntitySnapshot,
  ensure: () => EntityDelta,
): void {
  const pv = prev[field];
  const cv = curr[field];
  if (pv === cv) return;
  if (cv === undefined) {
    // Field was removed
    ensure()[field] = null;
  } else {
    ensure()[field] = cv;
  }
}

// ---- Delta application (client-side) ----

/**
 * Apply an EntityDelta to an existing Entity in-place.
 * Fields present in the delta overwrite the entity's values.
 * Null values remove the field from the entity.
 */
export function applyEntityDelta(entity: Entity, delta: EntityDelta): void {
  if (delta.position) {
    entity.position.wx = delta.position.wx;
    entity.position.wy = delta.position.wy;
  }

  if (delta.velocity !== undefined) {
    if (delta.velocity === null) {
      entity.velocity = null;
    } else if (entity.velocity) {
      entity.velocity.vx = delta.velocity.vx;
      entity.velocity.vy = delta.velocity.vy;
    } else {
      entity.velocity = { vx: delta.velocity.vx, vy: delta.velocity.vy };
    }
  }

  if (delta.spriteState !== undefined) {
    if (delta.spriteState === null) {
      entity.sprite = null;
    } else {
      // Merge with def to reconstruct full SpriteComponent
      const def = ENTITY_DEFS[entity.type];
      if (entity.sprite) {
        // Update in-place — preserves client-side animTimer/frameCol
        entity.sprite.direction = delta.spriteState.direction;
        entity.sprite.moving = delta.spriteState.moving;
        entity.sprite.frameRow = delta.spriteState.frameRow;
        if (delta.spriteState.flipX !== undefined) {
          entity.sprite.flipX = delta.spriteState.flipX;
        } else {
          delete entity.sprite.flipX;
        }
        if (delta.spriteState.frameDuration !== undefined) {
          entity.sprite.frameDuration = delta.spriteState.frameDuration;
        } else if (def?.sprite) {
          entity.sprite.frameDuration = def.sprite.frameDuration;
        }
      } else if (def?.sprite) {
        // Reconstruct full sprite from def + state
        entity.sprite = {
          sheetKey: def.sprite.sheetKey,
          spriteWidth: def.sprite.spriteWidth,
          spriteHeight: def.sprite.spriteHeight,
          frameCount: def.sprite.frameCount,
          frameDuration: delta.spriteState.frameDuration ?? def.sprite.frameDuration,
          frameCol: 0,
          frameRow: delta.spriteState.frameRow,
          animTimer: 0,
          direction: delta.spriteState.direction,
          moving: delta.spriteState.moving,
        };
        if (def.sprite.drawOffsetY !== undefined)
          entity.sprite.drawOffsetY = def.sprite.drawOffsetY;
        if (delta.spriteState.flipX !== undefined) entity.sprite.flipX = delta.spriteState.flipX;
      }
    }
  }

  if (delta.wanderAIState !== undefined) {
    if (delta.wanderAIState === null) {
      entity.wanderAI = null;
    } else if (entity.wanderAI) {
      // Update in-place
      entity.wanderAI.state = delta.wanderAIState.state as
        | "idle"
        | "walking"
        | "chasing"
        | "following"
        | "ridden";
      entity.wanderAI.dirX = delta.wanderAIState.dirX;
      entity.wanderAI.dirY = delta.wanderAIState.dirY;
      if (delta.wanderAIState.following !== undefined) {
        entity.wanderAI.following = delta.wanderAIState.following;
      } else {
        delete entity.wanderAI.following;
      }
    } else {
      // Reconstruct full wanderAI from def + state
      const def = ENTITY_DEFS[entity.type];
      if (def?.wanderAI) {
        entity.wanderAI = {
          state: delta.wanderAIState.state as
            | "idle"
            | "walking"
            | "chasing"
            | "following"
            | "ridden",
          timer: 0,
          dirX: delta.wanderAIState.dirX,
          dirY: delta.wanderAIState.dirY,
          idleMin: def.wanderAI.idleMin,
          idleMax: def.wanderAI.idleMax,
          walkMin: def.wanderAI.walkMin,
          walkMax: def.wanderAI.walkMax,
          speed: def.wanderAI.speed,
          directional: def.wanderAI.directional,
        };
        if (delta.wanderAIState.following !== undefined)
          entity.wanderAI.following = delta.wanderAIState.following;
        if (def.wanderAI.chaseRange !== undefined)
          entity.wanderAI.chaseRange = def.wanderAI.chaseRange;
        if (def.wanderAI.chaseSpeed !== undefined)
          entity.wanderAI.chaseSpeed = def.wanderAI.chaseSpeed;
        if (def.wanderAI.hostile !== undefined) entity.wanderAI.hostile = def.wanderAI.hostile;
        if (def.wanderAI.befriendable !== undefined)
          entity.wanderAI.befriendable = def.wanderAI.befriendable;
        if (def.wanderAI.followDistance !== undefined)
          entity.wanderAI.followDistance = def.wanderAI.followDistance;
        if (def.wanderAI.followLeash !== undefined)
          entity.wanderAI.followLeash = def.wanderAI.followLeash;
        if (def.wanderAI.rideSpeed !== undefined)
          entity.wanderAI.rideSpeed = def.wanderAI.rideSpeed;
      }
    }
  }

  // Entity-level optional fields: null = remove, value = set
  applyOptionalBool(entity, delta, "flashHidden");
  applyOptionalBool(entity, delta, "noShadow");
  applyOptionalNum(entity, delta, "deathTimer");
  applyOptionalNum(entity, delta, "jumpZ");
  applyOptionalNum(entity, delta, "jumpVZ");
  applyOptionalNum(entity, delta, "wz");
  applyOptionalNum(entity, delta, "parentId");
  applyOptionalNum(entity, delta, "localOffsetX");
  applyOptionalNum(entity, delta, "localOffsetY");
}

function applyOptionalBool(entity: Entity, delta: EntityDelta, field: OptionalBoolField): void {
  const value = delta[field];
  if (value === undefined) return; // unchanged
  if (value === null) {
    delete entity[field];
  } else {
    entity[field] = value;
  }
}

function applyOptionalNum(entity: Entity, delta: EntityDelta, field: OptionalNumField): void {
  const value = delta[field];
  if (value === undefined) return; // unchanged
  if (value === null) {
    delete entity[field];
  } else {
    entity[field] = value;
  }
}
