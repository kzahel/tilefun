import {
  JUMP_GRAVITY,
  JUMP_VELOCITY,
  PLAYER_SPEED,
  PLAYER_SPRINT_MULTIPLIER,
  TILE_SIZE,
} from "../config/constants.js";
import {
  aabbOverlapsPropWalls,
  aabbOverlapsSolid,
  aabbsOverlap,
  getEntityAABB,
  getSpeedMultiplier,
  isElevationBlocked,
} from "../entities/collision.js";
import { Direction, type Entity, type PositionComponent } from "../entities/Entity.js";
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
 *
 * When the player is riding a mount, the predictor also maintains a predicted
 * mount entity. Input is applied to the mount's velocity, and the player's
 * position is derived from the mount + local offset.
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

  /** The predicted mount entity (null when not riding). */
  private predictedMount: Entity | null = null;

  /** Mount entity ID from the latest server state. */
  private _mountId: number | null = null;

  /** Local offset of rider on mount. */
  private mountOffsetX = 0;
  private mountOffsetY = 0;

  /** Previous mount position for render interpolation. */
  private _mountPrevPosition: PositionComponent = { wx: 0, wy: 0 };

  /**
   * Initialize or re-initialize prediction from a server entity.
   * Called on first server state and on world load.
   */
  reset(serverPlayer: Entity, serverMount?: Entity): void {
    this.predicted = this.clonePlayer(serverPlayer);
    this._prevPosition = {
      wx: this.predicted.position.wx,
      wy: this.predicted.position.wy,
    };
    this.inputBuffer = [];

    if (serverMount && serverPlayer.parentId === serverMount.id) {
      this.predictedMount = this.clonePlayer(serverMount);
      this._mountId = serverMount.id;
      this.mountOffsetX = serverPlayer.localOffsetX ?? 0;
      this.mountOffsetY = serverPlayer.localOffsetY ?? 0;
      this._mountPrevPosition = {
        wx: this.predictedMount.position.wx,
        wy: this.predictedMount.position.wy,
      };
    } else {
      this.predictedMount = null;
      this._mountId = null;
    }
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

    // Save previous positions for render interpolation
    this._prevPosition = {
      wx: this.predicted.position.wx,
      wy: this.predicted.position.wy,
    };
    if (this.predictedMount) {
      this._mountPrevPosition = {
        wx: this.predictedMount.position.wx,
        wy: this.predictedMount.position.wy,
      };
    }

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
    mountEntityId?: number,
  ): void {
    if (!this.predicted) {
      const serverMount =
        serverPlayer.parentId !== undefined
          ? entities.find((e) => e.id === serverPlayer.parentId)
          : undefined;
      this.reset(serverPlayer, serverMount);
      return;
    }

    // Detect mount from server state
    const serverMount =
      mountEntityId !== undefined ? (entities.find((e) => e.id === mountEntityId) ?? null) : null;

    if (serverMount) {
      // ── Riding: predict the mount ──
      if (!this.predictedMount || this._mountId !== serverMount.id) {
        // Just started riding or mount changed
        this.predictedMount = this.clonePlayer(serverMount);
        this._mountId = serverMount.id;
        this._mountPrevPosition = {
          wx: serverMount.position.wx,
          wy: serverMount.position.wy,
        };
      }
      this.mountOffsetX = serverPlayer.localOffsetX ?? 0;
      this.mountOffsetY = serverPlayer.localOffsetY ?? 0;

      // Sync jump state from server — jumpZ is used as visual lift while riding
      if (serverPlayer.jumpZ !== undefined) {
        this.predicted.jumpZ = serverPlayer.jumpZ;
      } else {
        delete this.predicted.jumpZ;
      }
      delete this.predicted.jumpVZ;

      const oldMountX = this.predictedMount.position.wx;
      const oldMountY = this.predictedMount.position.wy;

      // Snap mount to server's authoritative position
      this.predictedMount.position.wx = serverMount.position.wx;
      this.predictedMount.position.wy = serverMount.position.wy;
      this.predictedMount.collider = serverMount.collider;
      this.predictedMount.sprite = serverMount.sprite ? { ...serverMount.sprite } : null;
      if (serverMount.wanderAI) {
        this.predictedMount.wanderAI = { ...serverMount.wanderAI };
      }

      // Snap player to server position
      const oldX = this.predicted.position.wx;
      const oldY = this.predicted.position.wy;
      this.predicted.position.wx = serverPlayer.position.wx;
      this.predicted.position.wy = serverPlayer.position.wy;

      // Trim acknowledged inputs
      this.trimInputBuffer(lastProcessedInputSeq);

      // Replay unacknowledged inputs on mount
      for (const input of this.inputBuffer) {
        this.applyInput(input.movement, input.dt, world, props, entities);
      }

      // Snap check for mount teleport
      const mdx = this.predictedMount.position.wx - oldMountX;
      const mdy = this.predictedMount.position.wy - oldMountY;
      if (mdx * mdx + mdy * mdy > SNAP_THRESHOLD * SNAP_THRESHOLD) {
        this._mountPrevPosition = {
          wx: this.predictedMount.position.wx,
          wy: this.predictedMount.position.wy,
        };
      }

      // Snap check for player teleport
      const dx = this.predicted.position.wx - oldX;
      const dy = this.predicted.position.wy - oldY;
      if (dx * dx + dy * dy > SNAP_THRESHOLD * SNAP_THRESHOLD) {
        this._prevPosition = {
          wx: this.predicted.position.wx,
          wy: this.predicted.position.wy,
        };
      }
    } else {
      // ── Not riding: standard reconciliation ──
      this.predictedMount = null;
      this._mountId = null;

      const oldX = this.predicted.position.wx;
      const oldY = this.predicted.position.wy;

      // Snap to server's authoritative position and jump state
      this.predicted.position.wx = serverPlayer.position.wx;
      this.predicted.position.wy = serverPlayer.position.wy;
      if (serverPlayer.jumpZ !== undefined) {
        this.predicted.jumpZ = serverPlayer.jumpZ;
      } else {
        delete this.predicted.jumpZ;
      }
      if (serverPlayer.jumpVZ !== undefined) {
        this.predicted.jumpVZ = serverPlayer.jumpVZ;
      } else {
        delete this.predicted.jumpVZ;
      }

      // Trim acknowledged inputs
      this.trimInputBuffer(lastProcessedInputSeq);

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
    }

    // Copy server-authoritative state that we don't predict
    this.predicted.id = serverPlayer.id;
    this.predicted.collider = serverPlayer.collider;
    this.predicted.sprite = serverPlayer.sprite;
    if (serverPlayer.parentId !== undefined) {
      this.predicted.parentId = serverPlayer.parentId;
    } else {
      delete this.predicted.parentId;
    }
    if (serverPlayer.localOffsetX !== undefined) {
      this.predicted.localOffsetX = serverPlayer.localOffsetX;
    } else {
      delete this.predicted.localOffsetX;
    }
    if (serverPlayer.localOffsetY !== undefined) {
      this.predicted.localOffsetY = serverPlayer.localOffsetY;
    } else {
      delete this.predicted.localOffsetY;
    }
    if (serverPlayer.flashHidden !== undefined)
      this.predicted.flashHidden = serverPlayer.flashHidden;
    if (serverPlayer.sortOffsetY !== undefined)
      this.predicted.sortOffsetY = serverPlayer.sortOffsetY;
    if (serverPlayer.noShadow !== undefined) {
      this.predicted.noShadow = serverPlayer.noShadow;
    } else {
      delete this.predicted.noShadow;
    }
    if (serverPlayer.deathTimer !== undefined) this.predicted.deathTimer = serverPlayer.deathTimer;
  }

  /** Get the predicted player entity (or null before first server state). */
  get player(): Entity | null {
    return this.predicted;
  }

  /** Get the predicted mount entity (or null when not riding). */
  get mount(): Entity | null {
    return this.predictedMount;
  }

  /** Get the mount entity ID (or null when not riding). */
  get mountId(): number | null {
    return this._mountId;
  }

  /** Get previous predicted position for render interpolation. */
  get prevPosition(): PositionComponent {
    return this._prevPosition;
  }

  /** Get previous mount position for render interpolation. */
  get mountPrevPosition(): PositionComponent {
    return this._mountPrevPosition;
  }

  // ---- Private helpers ----

  private trimInputBuffer(lastProcessedInputSeq: number): void {
    const firstUnackedIdx = this.inputBuffer.findIndex((i) => i.seq > lastProcessedInputSeq);
    if (firstUnackedIdx === -1) {
      this.inputBuffer = [];
    } else if (firstUnackedIdx > 0) {
      this.inputBuffer = this.inputBuffer.slice(firstUnackedIdx);
    }
  }

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

    if (this.predictedMount) {
      // ── Riding: apply input to mount, derive player position ──
      this.applyMountInput(this.predictedMount, movement);

      if (this.predictedMount.velocity) {
        const getCollision = (tx: number, ty: number) => world.getCollisionIfLoaded(tx, ty);
        const speedMult = this.predictedMount.collider
          ? getSpeedMultiplier(this.predictedMount.position, getCollision)
          : 1.0;
        const dx = this.predictedMount.velocity.vx * dt * speedMult;
        const dy = this.predictedMount.velocity.vy * dt * speedMult;

        if (this.predictedMount.collider && !this.noclip) {
          const blockMask = CollisionFlag.Solid | CollisionFlag.Water;
          this.resolveMountCollision(
            this.predictedMount,
            dx,
            dy,
            getCollision,
            blockMask,
            props,
            entities,
            world,
          );
        } else {
          this.predictedMount.position.wx += dx;
          this.predictedMount.position.wy += dy;
        }
      }

      // Derive player position from mount + offset
      this.predicted.position.wx = this.predictedMount.position.wx + this.mountOffsetX;
      this.predicted.position.wy = this.predictedMount.position.wy + this.mountOffsetY;
    } else {
      // ── Normal: apply input to player directly ──
      updatePlayerFromInput(this.predicted, movement, dt);

      // Jump initiation
      if (movement.jump && !(this.predicted.jumpZ ?? 0)) {
        this.predicted.jumpZ = 0.01;
        this.predicted.jumpVZ = JUMP_VELOCITY;
      }

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
          this.resolvePlayerCollision(dx, dy, getCollision, blockMask, props, entities, world);
        } else {
          this.predicted.position.wx += dx;
          this.predicted.position.wy += dy;
        }
      }

      // Jump physics (gravity)
      if (
        this.predicted.jumpZ !== undefined &&
        this.predicted.jumpZ > 0 &&
        this.predicted.jumpVZ !== undefined
      ) {
        this.predicted.jumpVZ -= JUMP_GRAVITY * dt;
        this.predicted.jumpZ += this.predicted.jumpVZ * dt;
        if (this.predicted.jumpZ <= 0) {
          delete this.predicted.jumpZ;
          delete this.predicted.jumpVZ;
        }
      }
    }
  }

  /** Apply movement input to a mount entity (mirrors server's applyMountInput). */
  private applyMountInput(
    mount: Entity,
    input: { dx: number; dy: number; sprinting: boolean },
  ): void {
    if (!mount.velocity) return;
    const baseSpeed = mount.wanderAI?.rideSpeed ?? PLAYER_SPEED;
    const speed = input.sprinting ? baseSpeed * PLAYER_SPRINT_MULTIPLIER : baseSpeed;
    mount.velocity.vx = input.dx * speed;
    mount.velocity.vy = input.dy * speed;

    const moving = input.dx !== 0 || input.dy !== 0;
    if (mount.sprite) {
      mount.sprite.moving = moving;
      if (moving) {
        if (mount.wanderAI?.directional === false) {
          // Non-directional sprites (e.g., cow): only flip horizontally, keep frameRow=0
          if (input.dx !== 0) {
            mount.sprite.flipX = input.dx < 0;
          }
        } else {
          if (Math.abs(input.dx) >= Math.abs(input.dy)) {
            mount.sprite.direction = input.dx > 0 ? Direction.Right : Direction.Left;
          } else {
            mount.sprite.direction = input.dy > 0 ? Direction.Down : Direction.Up;
          }
          mount.sprite.frameRow = mount.sprite.direction;
        }
      }
    }

    // Sync rider direction to match mount facing
    if (this.predicted?.sprite && mount.sprite) {
      this.predicted.sprite.direction =
        mount.wanderAI?.directional === false
          ? mount.sprite.flipX
            ? Direction.Left
            : Direction.Right
          : mount.sprite.direction;
      this.predicted.sprite.frameRow = this.predicted.sprite.direction;
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
      wanderAI: serverPlayer.wanderAI ? { ...serverPlayer.wanderAI } : null,
    };
    if (serverPlayer.sortOffsetY !== undefined) clone.sortOffsetY = serverPlayer.sortOffsetY;
    if (serverPlayer.jumpZ !== undefined) clone.jumpZ = serverPlayer.jumpZ;
    if (serverPlayer.jumpVZ !== undefined) clone.jumpVZ = serverPlayer.jumpVZ;
    if (serverPlayer.parentId !== undefined) clone.parentId = serverPlayer.parentId;
    if (serverPlayer.localOffsetX !== undefined) clone.localOffsetX = serverPlayer.localOffsetX;
    if (serverPlayer.localOffsetY !== undefined) clone.localOffsetY = serverPlayer.localOffsetY;
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
    world: World,
  ): void {
    const entity = this.predicted;
    if (!entity) return;
    if (!entity.collider) {
      entity.position.wx += dx;
      entity.position.wy += dy;
      return;
    }

    const playerId = entity.id;
    const getHeight = (tx: number, ty: number) => world.getHeightAt(tx, ty);
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
      const feetTx = Math.floor(entity.position.wx / TILE_SIZE);
      const feetTy = Math.floor(entity.position.wy / TILE_SIZE);
      const currentElev = getHeight(feetTx, feetTy);
      if (isElevationBlocked(aabb, currentElev, entity.jumpZ ?? 0, getHeight)) return true;
      const skipSmall = (entity.jumpZ ?? 0) > 0;
      for (const other of entities) {
        if (other.id === playerId || !other.collider?.clientSolid) continue;
        if (skipSmall && (other.sprite?.spriteHeight ?? 0) <= 32) continue;
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

  /**
   * Simplified collision resolution for mount prediction.
   * Same as player collision but uses the mount's collider and excludes both
   * mount and player from entity checks.
   */
  private resolveMountCollision(
    mount: Entity,
    dx: number,
    dy: number,
    getCollision: (tx: number, ty: number) => number,
    blockMask: number,
    props: readonly Prop[],
    entities: readonly Entity[],
    world: World,
  ): void {
    if (!mount.collider) {
      mount.position.wx += dx;
      mount.position.wy += dy;
      return;
    }

    const mountId = mount.id;
    const playerId = this.predicted?.id ?? -1;
    const getHeight = (tx: number, ty: number) => world.getHeightAt(tx, ty);
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
      const feetTx = Math.floor(mount.position.wx / TILE_SIZE);
      const feetTy = Math.floor(mount.position.wy / TILE_SIZE);
      const currentElev = getHeight(feetTx, feetTy);
      if (isElevationBlocked(aabb, currentElev, mount.jumpZ ?? 0, getHeight)) return true;
      for (const other of entities) {
        if (other.id === mountId || other.id === playerId) continue;
        if (!other.collider?.clientSolid) continue;
        if (aabbsOverlap(aabb, getEntityAABB(other.position, other.collider))) return true;
      }
      return false;
    };

    // Try X axis
    const testX = { wx: mount.position.wx + dx, wy: mount.position.wy };
    const xBox = getEntityAABB(testX, mount.collider);
    if (!isBlocked(xBox)) {
      mount.position.wx = testX.wx;
    }

    // Try Y axis (using updated X)
    const testY = { wx: mount.position.wx, wy: mount.position.wy + dy };
    const yBox = getEntityAABB(testY, mount.collider);
    if (!isBlocked(yBox)) {
      mount.position.wy = testY.wy;
    }
  }
}
