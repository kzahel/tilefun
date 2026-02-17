import { DEFAULT_PHYSICAL_HEIGHT } from "../config/constants.js";
import { aabbOverlapsPropWalls, aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import type { Entity, PositionComponent } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import type { Movement } from "../input/ActionManager.js";
import { zRangesOverlap } from "../physics/AABB3D.js";
import type { MovementContext } from "../physics/MovementContext.js";
import {
  getMovementPhysicsParams,
  getServerPhysicsMult,
  stepMountFromInput,
  stepPlayerFromInput,
} from "../physics/PlayerMovement.js";
import type { MovementPhysicsParams } from "../physics/PlayerMovement.js";
import type { World } from "../world/World.js";

/** If predicted and server positions diverge by more than this, snap immediately. */
const SNAP_THRESHOLD = 32;

/** Ring buffer capacity for stored inputs (replay-based reconciliation). */
const INPUT_BUFFER_SIZE = 128;

export interface StoredInput {
  seq: number;
  movement: Movement;
  dt: number;
  physics: MovementPhysicsParams;
}

export type ReconcileCauseTag =
  | "dt_mismatch"
  | "replay_backlog"
  | "grounded_flip"
  | "quantization_like"
  | "param_mismatch"
  | "jump_state"
  | "velocity_drift";

export interface ReconcileStateSnapshot {
  wx: number;
  wy: number;
  wz: number;
  vx: number;
  vy: number;
  jumpVZ: number;
  grounded: boolean;
}

export interface ReconcileDiagnostics {
  mode: "player" | "mount";
  ackSeq: number;
  serverTick: number | undefined;
  expectedInputDt: number | undefined;
  replayCount: number;
  replayFirstSeq: number | undefined;
  replayLastSeq: number | undefined;
  replayDtMin: number;
  replayDtMax: number;
  replayDtAvg: number;
  replayDtSpread: number;
  replayPhysicsRevisions: readonly number[];
  currentPhysicsRevision: number;
  correctionPosErr: number;
  correctionVelErr: number;
  resimPosErr: number;
  resimVelErr: number;
  causeTags: readonly ReconcileCauseTag[];
  predictedBefore: ReconcileStateSnapshot;
  authoritative: ReconcileStateSnapshot;
  predictedAfter: ReconcileStateSnapshot;
}

interface ReconcileReplayStats {
  count: number;
  firstSeq: number | undefined;
  lastSeq: number | undefined;
  dtMin: number;
  dtMax: number;
  dtAvg: number;
  dtSpread: number;
  revisions: readonly number[];
  currentRevision: number;
  hasMixedRevisions: boolean;
  hasRevisionMismatch: boolean;
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

  /** Whether the current jump press has been consumed (Quake's oldbuttons). */
  private jumpConsumed = false;

  /** Whether jump was held on the most recent input (for landing-frame check). */
  private lastJumpHeld = false;

  /** Ring buffer of recent inputs for replay-based reconciliation. */
  private inputBuffer: StoredInput[] = [];

  /** Last reconciliation correction (predicted - server, before replay). */
  private _lastCorrection = { wx: 0, wy: 0, wz: 0, vx: 0, vy: 0, jumpVZ: 0 };

  /** Last detailed reconciliation sample for diagnostics. */
  private _lastReconcileDiagnostics: ReconcileDiagnostics | null = null;

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
    this.jumpConsumed = false;
    this.lastJumpHeld = false;
    this._lastReconcileDiagnostics = null;

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
    this.inputBuffer.push({ seq, movement, dt, physics: getMovementPhysicsParams() });
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

    this.applyInput(movement, dt, world, props, entities, getMovementPhysicsParams());
  }

  /**
   * Reconcile predicted position against authoritative server state using
   * input replay. Called when a new FrameMessage is applied.
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
    diagnostics?: { expectedInputDt?: number; serverTick?: number },
  ): void {
    if (!this.predicted) {
      const serverMount =
        serverPlayer.parentId !== undefined
          ? entities.find((e) => e.id === serverPlayer.parentId)
          : undefined;
      this.reset(serverPlayer, serverMount);
      return;
    }

    const predictedBefore = this.snapshotEntity(this.predicted);
    const authoritative = this.snapshotEntity(serverPlayer);
    this._lastCorrection = {
      wx: predictedBefore.wx - authoritative.wx,
      wy: predictedBefore.wy - authoritative.wy,
      wz: predictedBefore.wz - authoritative.wz,
      vx: predictedBefore.vx - authoritative.vx,
      vy: predictedBefore.vy - authoritative.vy,
      jumpVZ: predictedBefore.jumpVZ - authoritative.jumpVZ,
    };
    let replayStats: ReconcileReplayStats = {
      count: 0,
      firstSeq: undefined,
      lastSeq: undefined,
      dtMin: 0,
      dtMax: 0,
      dtAvg: 0,
      dtSpread: 0,
      revisions: [],
      currentRevision: getMovementPhysicsParams().revision,
      hasMixedRevisions: false,
      hasRevisionMismatch: false,
    };

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

      // Snap mount to server's authoritative position and Z state
      this.predictedMount.position.wx = serverMount.position.wx;
      this.predictedMount.position.wy = serverMount.position.wy;
      this.predictedMount.collider = serverMount.collider;
      this.predictedMount.sprite = serverMount.sprite ? { ...serverMount.sprite } : null;
      if (serverMount.wanderAI) {
        this.predictedMount.wanderAI = { ...serverMount.wanderAI };
      }
      if (serverMount.wz !== undefined) {
        this.predictedMount.wz = serverMount.wz;
      } else {
        delete this.predictedMount.wz;
      }
      if (serverMount.groundZ !== undefined) {
        this.predictedMount.groundZ = serverMount.groundZ;
      } else {
        delete this.predictedMount.groundZ;
      }

      // Snap player to server position
      const oldX = this.predicted.position.wx;
      const oldY = this.predicted.position.wy;
      this.predicted.position.wx = serverPlayer.position.wx;
      this.predicted.position.wy = serverPlayer.position.wy;

      // Trim acknowledged inputs
      this.trimInputBuffer(lastProcessedInputSeq);
      replayStats = this.collectReplayStats();

      // Replay unacknowledged inputs on mount
      for (const input of this.inputBuffer) {
        this.applyInput(input.movement, input.dt, world, props, entities, input.physics);
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

      // Snap to server's authoritative position, velocity, and jump state.
      // Velocity must be snapped because the friction/acceleration model is
      // path-dependent — replaying inputs from the wrong starting velocity
      // produces different results than the server.
      this.predicted.position.wx = serverPlayer.position.wx;
      this.predicted.position.wy = serverPlayer.position.wy;
      if (serverPlayer.velocity) {
        if (!this.predicted.velocity) {
          this.predicted.velocity = { vx: serverPlayer.velocity.vx, vy: serverPlayer.velocity.vy };
        } else {
          this.predicted.velocity.vx = serverPlayer.velocity.vx;
          this.predicted.velocity.vy = serverPlayer.velocity.vy;
        }
      }
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
      replayStats = this.collectReplayStats();

      // Replay unacknowledged inputs on top of server position
      for (const input of this.inputBuffer) {
        this.applyInput(input.movement, input.dt, world, props, entities, input.physics);
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
    // Sprite: copy structural fields (sheet, dimensions) from server, but
    // preserve predicted animation state (moving, direction, frameRow,
    // frameDuration). The server's sprite may have stale animation if a
    // no-input tick or timing jitter set moving=false between acked inputs.
    const predMoving = this.predicted.sprite?.moving;
    const predDirection = this.predicted.sprite?.direction;
    const predFrameRow = this.predicted.sprite?.frameRow;
    const predFrameDuration = this.predicted.sprite?.frameDuration;
    this.predicted.sprite = serverPlayer.sprite ? { ...serverPlayer.sprite } : null;
    if (this.predicted.sprite && predMoving !== undefined) {
      this.predicted.sprite.moving = predMoving;
      this.predicted.sprite.direction = predDirection ?? this.predicted.sprite.direction;
      this.predicted.sprite.frameRow = predFrameRow ?? this.predicted.sprite.frameRow;
      if (predFrameDuration !== undefined) this.predicted.sprite.frameDuration = predFrameDuration;
    }
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

    const predictedAfter = this.snapshotEntity(this.predicted);
    const correctionPosErr = Math.hypot(
      this._lastCorrection.wx,
      this._lastCorrection.wy,
      this._lastCorrection.wz,
    );
    const correctionVelErr = Math.hypot(this._lastCorrection.vx, this._lastCorrection.vy);
    const resimPosErr = Math.hypot(
      predictedAfter.wx - predictedBefore.wx,
      predictedAfter.wy - predictedBefore.wy,
      predictedAfter.wz - predictedBefore.wz,
    );
    const resimVelErr = Math.hypot(
      predictedAfter.vx - predictedBefore.vx,
      predictedAfter.vy - predictedBefore.vy,
    );
    this._lastReconcileDiagnostics = {
      mode: serverMount ? "mount" : "player",
      ackSeq: lastProcessedInputSeq,
      serverTick: diagnostics?.serverTick,
      expectedInputDt: diagnostics?.expectedInputDt,
      replayCount: replayStats.count,
      replayFirstSeq: replayStats.firstSeq,
      replayLastSeq: replayStats.lastSeq,
      replayDtMin: replayStats.dtMin,
      replayDtMax: replayStats.dtMax,
      replayDtAvg: replayStats.dtAvg,
      replayDtSpread: replayStats.dtSpread,
      replayPhysicsRevisions: replayStats.revisions,
      currentPhysicsRevision: replayStats.currentRevision,
      correctionPosErr,
      correctionVelErr,
      resimPosErr,
      resimVelErr,
      causeTags: this.inferReconcileCauseTags(
        predictedBefore,
        authoritative,
        replayStats,
        correctionPosErr,
        correctionVelErr,
        this._lastCorrection.jumpVZ,
        diagnostics?.expectedInputDt,
      ),
      predictedBefore,
      authoritative,
      predictedAfter,
    };
  }

  /** Clear predicted state (e.g. when switching worlds). */
  clearPredicted(): void {
    this.predicted = null;
    this.predictedMount = null;
    this.inputBuffer = [];
    this._lastReconcileDiagnostics = null;
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

  /** Get the last reconciliation correction (predicted minus server, before replay). */
  get lastCorrection() {
    return this._lastCorrection;
  }

  /** Get the last detailed reconciliation sample (or null before first reconcile). */
  get lastReconcileDiagnostics(): ReconcileDiagnostics | null {
    return this._lastReconcileDiagnostics;
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

  private snapshotEntity(entity: Entity): ReconcileStateSnapshot {
    return {
      wx: entity.position.wx,
      wy: entity.position.wy,
      wz: entity.wz ?? 0,
      vx: entity.velocity?.vx ?? 0,
      vy: entity.velocity?.vy ?? 0,
      jumpVZ: entity.jumpVZ ?? 0,
      grounded: entity.jumpVZ === undefined,
    };
  }

  private collectReplayStats(): ReconcileReplayStats {
    const currentRevision = getMovementPhysicsParams().revision;
    const count = this.inputBuffer.length;
    if (count === 0) {
      return {
        count: 0,
        firstSeq: undefined,
        lastSeq: undefined,
        dtMin: 0,
        dtMax: 0,
        dtAvg: 0,
        dtSpread: 0,
        revisions: [],
        currentRevision,
        hasMixedRevisions: false,
        hasRevisionMismatch: false,
      };
    }

    let dtMin = Number.POSITIVE_INFINITY;
    let dtMax = 0;
    let dtSum = 0;
    const revisions = new Set<number>();
    const firstSeq = this.inputBuffer[0]?.seq;
    const lastSeq = this.inputBuffer[count - 1]?.seq;
    for (const input of this.inputBuffer) {
      if (input.dt < dtMin) dtMin = input.dt;
      if (input.dt > dtMax) dtMax = input.dt;
      dtSum += input.dt;
      revisions.add(input.physics.revision);
    }
    const revisionList = Array.from(revisions.values()).sort((a, b) => a - b);
    return {
      count,
      firstSeq,
      lastSeq,
      dtMin,
      dtMax,
      dtAvg: dtSum / count,
      dtSpread: dtMax - dtMin,
      revisions: revisionList,
      currentRevision,
      hasMixedRevisions: revisionList.length > 1,
      hasRevisionMismatch: revisionList.some((rev) => rev !== currentRevision),
    };
  }

  private inferReconcileCauseTags(
    predictedBefore: ReconcileStateSnapshot,
    authoritative: ReconcileStateSnapshot,
    replay: ReconcileReplayStats,
    correctionPosErr: number,
    correctionVelErr: number,
    correctionJumpVZ: number,
    expectedInputDt?: number,
  ): ReconcileCauseTag[] {
    const tags: ReconcileCauseTag[] = [];

    if (expectedInputDt !== undefined && replay.count > 0) {
      const dtDelta = Math.abs(replay.dtAvg - expectedInputDt);
      const dtTolerance = Math.max(0.00025, expectedInputDt * 0.02);
      if (dtDelta > dtTolerance || replay.dtSpread > dtTolerance) {
        tags.push("dt_mismatch");
      }
    }

    if (replay.count > 0 && correctionPosErr > 0.25 && correctionVelErr > 8) {
      tags.push("replay_backlog");
    }

    if (predictedBefore.grounded !== authoritative.grounded) {
      tags.push("grounded_flip");
    }

    if (replay.hasMixedRevisions || replay.hasRevisionMismatch) {
      tags.push("param_mismatch");
    }

    if (Math.abs(correctionJumpVZ) > 0.2) {
      tags.push("jump_state");
    }

    if (correctionVelErr > 12 && correctionPosErr > 0.25) {
      tags.push("velocity_drift");
    }

    if (correctionPosErr > 0 && correctionPosErr < 0.2 && correctionVelErr < 0.15) {
      tags.push("quantization_like");
    }

    return tags;
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
    physics: MovementPhysicsParams,
  ): void {
    if (!this.predicted) return;

    if (this.predictedMount) {
      // ── Riding: apply input to mount, derive player position ──
      const getHeight = (tx: number, ty: number) => world.getHeightAt(tx, ty);
      const mountExclude = new Set([this.predictedMount.id, this.predicted.id]);
      const mountCtx = this.buildMovementContext(
        world,
        props,
        entities,
        mountExclude,
        this.predictedMount,
      );
      stepMountFromInput(
        this.predictedMount,
        movement,
        dt,
        mountCtx,
        getHeight,
        () => ({ props, entities }),
        this.predicted,
        getServerPhysicsMult(),
      );

      // Derive player position from mount + offset
      this.predicted.position.wx = this.predictedMount.position.wx + this.mountOffsetX;
      this.predicted.position.wy = this.predictedMount.position.wy + this.mountOffsetY;
      // Derive player wz from mount surface + ride offset
      if (this.predictedMount.wz !== undefined && this.predicted.jumpZ !== undefined) {
        this.predicted.wz = this.predictedMount.wz + this.predicted.jumpZ;
      }
    } else {
      // ── Normal: apply friction + acceleration from input ──
      const playerExclude = new Set([this.predicted.id]);
      const playerCtx = this.buildMovementContext(
        world,
        props,
        entities,
        playerExclude,
        this.predicted,
      );
      const getHeight = (tx: number, ty: number) => world.getHeightAt(tx, ty);
      const nextState = stepPlayerFromInput(
        this.predicted,
        movement,
        dt,
        playerCtx,
        getHeight,
        () => ({ props, entities }),
        {
          jumpConsumed: this.jumpConsumed,
          lastJumpHeld: this.lastJumpHeld,
        },
        physics,
        getServerPhysicsMult(),
      );
      this.jumpConsumed = nextState.jumpConsumed;
      this.lastJumpHeld = nextState.lastJumpHeld;
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
      getTerrainAt: (tx, ty) => world.getBlendBaseAt(tx, ty),
      getRoadAt: (tx, ty) => world.getRoadAt(tx, ty),
    };
  }
}
