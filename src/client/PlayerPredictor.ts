import {
  aabbOverlapsPropWalls,
  aabbOverlapsSolid,
  aabbsOverlap,
  getEntityAABB,
  getSpeedMultiplier,
} from "../entities/collision.js";
import type { Entity, PositionComponent } from "../entities/Entity.js";
import { updatePlayerFromInput } from "../entities/Player.js";
import type { Prop } from "../entities/Prop.js";
import type { Movement } from "../input/ActionManager.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import type { World } from "../world/World.js";

/** If predicted and server positions diverge by more than this, snap immediately. */
const SNAP_THRESHOLD = 32;

/** Ring buffer capacity for stored inputs (replay-based reconciliation). */
const INPUT_BUFFER_SIZE = 128;

export interface StoredInput {
  seq: number;
  movement: Movement;
  dt: number;
}

/**
 * Client-side player prediction with input replay reconciliation.
 *
 * Maintains a predicted player entity that is updated locally each client tick
 * using the same physics as the server. When authoritative server state arrives,
 * the predictor snaps to the server position and replays all unacknowledged
 * inputs to rebuild the correct predicted position.
 */
export class PlayerPredictor {
  /** The predicted player entity. */
  private predicted: Entity | null = null;

  /** Whether noclip is active (skip collision in prediction). */
  noclip = false;

  /** Previous predicted position for render interpolation. */
  private _prevPosition: PositionComponent = { wx: 0, wy: 0 };

  /** Ring buffer of recent inputs for replay-based reconciliation. */
  private inputBuffer: StoredInput[] = [];

  /**
   * Initialize or re-initialize prediction from a server entity.
   * Called on first server state and on world load.
   */
  reset(serverPlayer: Entity): void {
    this.predicted = this.clonePlayer(serverPlayer);
    this._prevPosition = {
      wx: this.predicted.position.wx,
      wy: this.predicted.position.wy,
    };
    this.inputBuffer = [];
  }

  /**
   * Store an input in the ring buffer for replay-based reconciliation.
   */
  storeInput(seq: number, movement: Movement, dt: number): void {
    if (this.inputBuffer.length >= INPUT_BUFFER_SIZE) {
      this.inputBuffer.shift();
    }
    this.inputBuffer.push({ seq, movement, dt });
  }

  /**
   * Run one prediction tick. Called from PlayScene.update() at FIXED_DT rate.
   * Applies movement input + collision using the client's world data.
   */
  update(
    dt: number,
    movement: Movement,
    world: World,
    props: readonly Prop[],
    entities: readonly Entity[],
  ): void {
    if (!this.predicted) return;

    // Save previous position for render interpolation
    this._prevPosition = {
      wx: this.predicted.position.wx,
      wy: this.predicted.position.wy,
    };

    this.applyInput(movement, dt, world, props, entities);
  }

  /**
   * Reconcile predicted position against authoritative server state using
   * input replay. Called when a new GameStateMessage is applied.
   *
   * 1. Snap to server's authoritative position
   * 2. Discard acknowledged inputs (seq <= lastProcessedInputSeq)
   * 3. Replay remaining unacknowledged inputs with full collision
   *
   * This eliminates drift from lost/overwritten inputs while preserving
   * responsive local prediction.
   */
  reconcile(
    serverPlayer: Entity,
    lastProcessedInputSeq: number,
    world: World,
    props: readonly Prop[],
    entities: readonly Entity[],
  ): void {
    if (!this.predicted) {
      this.reset(serverPlayer);
      return;
    }

    const oldX = this.predicted.position.wx;
    const oldY = this.predicted.position.wy;

    // Snap to server's authoritative position
    this.predicted.position.wx = serverPlayer.position.wx;
    this.predicted.position.wy = serverPlayer.position.wy;

    // Trim acknowledged inputs
    const firstUnackedIdx = this.inputBuffer.findIndex((i) => i.seq > lastProcessedInputSeq);
    if (firstUnackedIdx === -1) {
      // All inputs acknowledged
      this.inputBuffer = [];
    } else if (firstUnackedIdx > 0) {
      this.inputBuffer = this.inputBuffer.slice(firstUnackedIdx);
    }

    // Replay unacknowledged inputs on top of server position
    for (const input of this.inputBuffer) {
      this.applyInput(input.movement, input.dt, world, props, entities);
    }

    // If position changed drastically (teleport/knockback), also snap
    // the previous position so render interpolation doesn't create a slide
    const dx = this.predicted.position.wx - oldX;
    const dy = this.predicted.position.wy - oldY;
    if (dx * dx + dy * dy > SNAP_THRESHOLD * SNAP_THRESHOLD) {
      this._prevPosition = {
        wx: this.predicted.position.wx,
        wy: this.predicted.position.wy,
      };
    }

    // Copy server-authoritative state that we don't predict
    this.predicted.id = serverPlayer.id;
    this.predicted.collider = serverPlayer.collider;
    this.predicted.sprite = serverPlayer.sprite;
    if (serverPlayer.flashHidden !== undefined)
      this.predicted.flashHidden = serverPlayer.flashHidden;
    if (serverPlayer.sortOffsetY !== undefined)
      this.predicted.sortOffsetY = serverPlayer.sortOffsetY;
    if (serverPlayer.noShadow !== undefined) this.predicted.noShadow = serverPlayer.noShadow;
    if (serverPlayer.deathTimer !== undefined) this.predicted.deathTimer = serverPlayer.deathTimer;
  }

  /** Get the predicted player entity (or null before first server state). */
  get player(): Entity | null {
    return this.predicted;
  }

  /** Get previous predicted position for render interpolation. */
  get prevPosition(): PositionComponent {
    return this._prevPosition;
  }

  // ---- Private helpers ----

  /**
   * Apply a single input tick: set velocity from movement, then resolve
   * collision. Shared between live prediction (update) and replay (reconcile).
   */
  private applyInput(
    movement: Movement,
    dt: number,
    world: World,
    props: readonly Prop[],
    entities: readonly Entity[],
  ): void {
    if (!this.predicted) return;

    updatePlayerFromInput(this.predicted, movement, dt);

    if (this.predicted.velocity) {
      const getCollision = (tx: number, ty: number) => world.getCollisionIfLoaded(tx, ty);
      const speedMult =
        this.predicted.collider && !this.noclip
          ? getSpeedMultiplier(this.predicted.position, getCollision)
          : 1.0;
      const dx = this.predicted.velocity.vx * dt * speedMult;
      const dy = this.predicted.velocity.vy * dt * speedMult;

      if (this.predicted.collider && !this.noclip) {
        const blockMask = CollisionFlag.Solid | CollisionFlag.Water;
        this.resolvePlayerCollision(dx, dy, getCollision, blockMask, props, entities);
      } else {
        this.predicted.position.wx += dx;
        this.predicted.position.wy += dy;
      }
    }
  }

  private clonePlayer(serverPlayer: Entity): Entity {
    const clone: Entity = {
      id: serverPlayer.id,
      type: serverPlayer.type,
      position: {
        wx: serverPlayer.position.wx,
        wy: serverPlayer.position.wy,
      },
      velocity: serverPlayer.velocity
        ? { vx: serverPlayer.velocity.vx, vy: serverPlayer.velocity.vy }
        : null,
      sprite: serverPlayer.sprite ? { ...serverPlayer.sprite } : null,
      collider: serverPlayer.collider ? { ...serverPlayer.collider } : null,
      wanderAI: null,
    };
    if (serverPlayer.sortOffsetY !== undefined) clone.sortOffsetY = serverPlayer.sortOffsetY;
    return clone;
  }

  /**
   * Simplified collision resolution for player prediction.
   * Per-axis sliding — same algorithm as resolveCollision in collision.ts,
   * plus prop wall/collider checks and clientSolid entity checks.
   */
  private resolvePlayerCollision(
    dx: number,
    dy: number,
    getCollision: (tx: number, ty: number) => number,
    blockMask: number,
    props: readonly Prop[],
    entities: readonly Entity[],
  ): void {
    const entity = this.predicted;
    if (!entity) return;
    if (!entity.collider) {
      entity.position.wx += dx;
      entity.position.wy += dy;
      return;
    }

    const playerId = entity.id;
    const isBlocked = (aabb: {
      left: number;
      top: number;
      right: number;
      bottom: number;
    }): boolean => {
      if (aabbOverlapsSolid(aabb, getCollision, blockMask)) return true;
      for (const prop of props) {
        if (aabbOverlapsPropWalls(aabb, prop.position, prop)) return true;
      }
      for (const other of entities) {
        if (other.id === playerId || !other.collider?.clientSolid) continue;
        if (aabbsOverlap(aabb, getEntityAABB(other.position, other.collider))) return true;
      }
      return false;
    };

    // Try X axis
    const testX = { wx: entity.position.wx + dx, wy: entity.position.wy };
    const xBox = getEntityAABB(testX, entity.collider);
    if (!isBlocked(xBox)) {
      entity.position.wx = testX.wx;
    }

    // Try Y axis (using updated X)
    const testY = { wx: entity.position.wx, wy: entity.position.wy + dy };
    const yBox = getEntityAABB(testY, entity.collider);
    if (!isBlocked(yBox)) {
      entity.position.wy = testY.wy;
    }
  }
}
