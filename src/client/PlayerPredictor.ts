import {
  DEFAULT_PHYSICAL_HEIGHT,
  JUMP_BUFFER_TIME,
  STEP_UP_THRESHOLD,
} from "../config/constants.js";
import { aabbOverlapsPropWalls, aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import type { Entity, PositionComponent } from "../entities/Entity.js";
import { updatePlayerFromInput } from "../entities/Player.js";
import type { Prop } from "../entities/Prop.js";
import type { Movement } from "../input/ActionManager.js";
import { zRangesOverlap } from "../physics/AABB3D.js";
import type { MovementContext } from "../physics/MovementContext.js";
import {
  applyMountInput,
  cutJumpVelocity,
  initiateJump,
  moveAndCollide,
  tickJumpGravity,
} from "../physics/PlayerMovement.js";
import {
  getSurfaceZ,
  getWalkableEntitySurfaceZ,
  getWalkablePropSurfaceZ,
} from "../physics/surfaceHeight.js";
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

  /** Previous predicted jumpZ for render interpolation. */
  private _prevJumpZ = 0;

  /** Previous predicted wz for render interpolation. */
  private _prevWz = 0;

  /** Previous jump input state for edge detection. */
  private prevJumpInput = false;

  /** Time remaining on buffered jump input (seconds). */
  private jumpBufferTimer = 0;

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
    this._prevJumpZ = this.predicted.jumpZ ?? 0;
    this._prevWz = this.predicted.wz ?? 0;
    this.inputBuffer = [];
    this.prevJumpInput = false;
    this.jumpBufferTimer = 0;

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

    // Save previous state for render interpolation
    this._prevPosition = {
      wx: this.predicted.position.wx,
      wy: this.predicted.position.wy,
    };
    this._prevJumpZ = this.predicted.jumpZ ?? 0;
    this._prevWz = this.predicted.wz ?? 0;
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

      // Sync wz and jump state from server — jumpZ is visual lift while riding
      if (serverPlayer.wz !== undefined) {
        this.predicted.wz = serverPlayer.wz;
      } else {
        delete this.predicted.wz;
      }
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
      if (serverPlayer.wz !== undefined) {
        this.predicted.wz = serverPlayer.wz;
      } else {
        delete this.predicted.wz;
      }
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

  /** Get previous predicted jumpZ for render interpolation. */
  get prevJumpZ(): number {
    return this._prevJumpZ;
  }

  /** Get previous predicted wz for render interpolation. */
  get prevWz(): number {
    return this._prevWz;
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
      applyMountInput(this.predictedMount, movement, this.predicted);

      const mountExclude = new Set([this.predictedMount.id, this.predicted.id]);
      const mountCtx = this.buildMovementContext(
        world,
        props,
        entities,
        mountExclude,
        this.predictedMount,
      );
      moveAndCollide(this.predictedMount, dt, mountCtx);

      // Derive player position from mount + offset
      this.predicted.position.wx = this.predictedMount.position.wx + this.mountOffsetX;
      this.predicted.position.wy = this.predictedMount.position.wy + this.mountOffsetY;
    } else {
      // ── Normal: apply input to player directly ──
      updatePlayerFromInput(this.predicted, movement, dt);

      const jumpRising = movement.jump && !this.prevJumpInput;
      const jumpFalling = !movement.jump && this.prevJumpInput;
      if (jumpRising) {
        if (this.predicted.jumpVZ === undefined) {
          initiateJump(this.predicted);
        } else {
          this.jumpBufferTimer = JUMP_BUFFER_TIME;
        }
      } else if (jumpFalling) {
        cutJumpVelocity(this.predicted);
      }
      this.prevJumpInput = movement.jump;

      const playerExclude = new Set([this.predicted.id]);
      const playerCtx = this.buildMovementContext(
        world,
        props,
        entities,
        playerExclude,
        this.predicted,
      );
      moveAndCollide(this.predicted, dt, playerCtx);

      // Ground tracking after XY movement (terrain + walkable prop/entity surfaces)
      const getHeight = (tx: number, ty: number) => world.getHeightAt(tx, ty);
      let groundZ = getSurfaceZ(this.predicted.position.wx, this.predicted.position.wy, getHeight);
      if (this.predicted.collider) {
        const footprint = getEntityAABB(this.predicted.position, this.predicted.collider);
        const propZ = getWalkablePropSurfaceZ(footprint, this.predicted.wz ?? 0, props);
        if (propZ !== undefined && propZ > groundZ) groundZ = propZ;
        const entZ = getWalkableEntitySurfaceZ(
          footprint,
          this.predicted.id,
          this.predicted.wz ?? 0,
          entities,
        );
        if (entZ !== undefined && entZ > groundZ) groundZ = entZ;
      }
      this.predicted.groundZ = groundZ;
      if (this.predicted.wz === undefined) {
        this.predicted.wz = groundZ;
      } else if (this.predicted.jumpVZ === undefined && this.predicted.wz > groundZ) {
        if (this.predicted.wz - groundZ <= STEP_UP_THRESHOLD) {
          // Small step down — snap to ground instead of falling
          this.predicted.wz = groundZ;
        } else {
          // Cliff edge — start falling
          this.predicted.jumpVZ = 0;
          this.predicted.jumpZ = this.predicted.wz - groundZ;
        }
      } else if (this.predicted.jumpVZ === undefined) {
        // Snap to ground
        this.predicted.wz = groundZ;
      }

      const landed = tickJumpGravity(this.predicted, dt, getHeight, props, entities);
      if (landed && this.jumpBufferTimer > 0) {
        initiateJump(this.predicted);
        this.jumpBufferTimer = 0;
      }
      if (this.jumpBufferTimer > 0) {
        this.jumpBufferTimer -= dt;
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
      wanderAI: serverPlayer.wanderAI ? { ...serverPlayer.wanderAI } : null,
    };
    if (serverPlayer.sortOffsetY !== undefined) clone.sortOffsetY = serverPlayer.sortOffsetY;
    if (serverPlayer.jumpZ !== undefined) clone.jumpZ = serverPlayer.jumpZ;
    if (serverPlayer.jumpVZ !== undefined) clone.jumpVZ = serverPlayer.jumpVZ;
    if (serverPlayer.wz !== undefined) clone.wz = serverPlayer.wz;
    if (serverPlayer.parentId !== undefined) clone.parentId = serverPlayer.parentId;
    if (serverPlayer.localOffsetX !== undefined) clone.localOffsetX = serverPlayer.localOffsetX;
    if (serverPlayer.localOffsetY !== undefined) clone.localOffsetY = serverPlayer.localOffsetY;
    return clone;
  }

  /**
   * Build a MovementContext for client-side prediction.
   * Uses `clientSolid` for entity blocking (vs server's `solid`).
   * Captures the moving entity by reference so jumpZ-dependent checks stay current.
   */
  private buildMovementContext(
    world: World,
    props: readonly Prop[],
    entities: readonly Entity[],
    excludeIds: ReadonlySet<number>,
    movingEntity: Entity,
  ): MovementContext {
    return {
      getCollision: (tx, ty) => world.getCollisionIfLoaded(tx, ty),
      getHeight: (tx, ty) => world.getHeightAt(tx, ty),
      isEntityBlocked: (aabb) => {
        const selfWz = movingEntity.wz ?? 0;
        const selfHeight = movingEntity.collider?.physicalHeight ?? DEFAULT_PHYSICAL_HEIGHT;
        for (const other of entities) {
          if (excludeIds.has(other.id) || !other.collider?.clientSolid) continue;
          // 3D entity-entity filtering: skip if Z ranges don't overlap
          const otherWz = other.wz ?? 0;
          const otherHeight = other.collider.physicalHeight ?? DEFAULT_PHYSICAL_HEIGHT;
          if (!zRangesOverlap(selfWz, selfHeight, otherWz, otherHeight)) continue;
          if (aabbsOverlap(aabb, getEntityAABB(other.position, other.collider))) return true;
        }
        return false;
      },
      isPropBlocked: (aabb, entityWz, entityHeight) => {
        for (const prop of props) {
          if (aabbOverlapsPropWalls(aabb, prop.position, prop, entityWz, entityHeight)) return true;
        }
        return false;
      },
      noclip: this.noclip,
    };
  }
}
