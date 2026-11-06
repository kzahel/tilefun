import { applyPlayerModel } from "../characters/PlayerModels.js";
import {
  setSpriteClip,
  setSpriteClipElapsed,
  tickSpriteAnimation,
} from "../entities/spriteAnimation.js";
import { applyCurveTrainFacing } from "../railway/CurveTrain.js";
import { applyVehicleFacing } from "../traffic/Vehicle.js";
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
import { ENTITY_DEFS } from "../entities/EntityDefs.js";
import { applyMirroredFields, diffFields, type EntityDelta } from "./entityFields.js";
import type { EntitySnapshot } from "./protocol.js";

export type { EntityDelta } from "./entityFields.js";

// ---- Snapshot diffing (server-side) ----

/**
 * Compare two entity snapshots and return a delta, or null if identical.
 * Both snapshots must have the same entity ID and type.
 */
export function diffEntitySnapshots(
  prev: EntitySnapshot,
  curr: EntitySnapshot,
): EntityDelta | null {
  const moved = prev.position.wx !== curr.position.wx || prev.position.wy !== curr.position.wy;
  return diffFields(prev, curr, moved ? { id: curr.id, position: curr.position } : null);
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

  if (delta.spriteState) {
    setSpriteClip(entity, delta.spriteState.clip);
    setSpriteClipElapsed(entity, delta.spriteState.clipElapsedMs);
    tickSpriteAnimation(entity, 0);
    applyPlayerModel(entity, delta.spriteState.model);
  }
  if (delta.wanderAIState !== undefined) {
    if (delta.wanderAIState === null) {
      entity.wanderAI = null;
    } else if (entity.wanderAI) {
      // Update in-place
      entity.wanderAI.state = delta.wanderAIState.state as NonNullable<Entity["wanderAI"]>["state"];
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
    if (entity.wanderAI && delta.wanderAIState?.befriendable !== undefined)
      entity.wanderAI.befriendable = delta.wanderAIState.befriendable;
  }

  // Optional fields (null = remove); vehicle/train facing runs after them and owns noShadow.
  applyMirroredFields(entity, delta);
  applyVehicleFacing(entity);
  applyCurveTrainFacing(entity);
}
