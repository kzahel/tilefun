import type { Entity, PositionComponent } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import type { Movement } from "../input/ActionManager.js";
import type { MovementPhysicsParams } from "../physics/PlayerMovement.js";
import {
  getMovementPhysicsParams,
  getServerPhysicsMult,
  MAX_INPUT_STEP_SECONDS,
  splitInputStepDurations,
  stepMountFromInput,
  stepPlayerFromInput,
} from "../physics/PlayerMovement.js";
import { createMovementContext, createSurfaceSampler } from "../physics/SimulationEnvironment.js";
import type { CameraPresentationTime } from "../rendering/CameraFollow.js";
import { type RoofOffset, roofOffset, roofPosition } from "../traffic/MovingSupport.js";
import { roofSupport } from "../traffic/RoofSupport.js";
import type { World } from "../world/World.js";

import { PredictionCollisionTimeline } from "./PredictionCollisionTimeline.js";

/** If predicted and server positions diverge by more than this, snap immediately. */
const SNAP_THRESHOLD = 32;

/** Ring buffer capacity for stored inputs (replay-based reconciliation). */
const INPUT_BUFFER_SIZE = 128;

export interface StoredInput {
  seq: number;
  movement: Movement;
  dt: number;
  physics: MovementPhysicsParams;
  jumpStateBefore?: { jumpConsumed: boolean; lastJumpHeld: boolean };
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
  supportId: number | null;
  resimSupportPosErr: number | null;
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
  private presentationInputSeconds = 0;
  private presentationInputDt = 0;
  private presentationEpoch: object = {};

  /** Local input clock excludes simulation time discarded by the catch-up cap. */
  presentationClock(alpha: number): CameraPresentationTime | null {
    if (this.support) return null;
    return {
      time: this.presentationInputSeconds - this.presentationInputDt * (1 - alpha),
      domain: this.presentationEpoch,
    };
  }
  constructor(
    private readonly physics = getMovementPhysicsParams,
    private readonly physicsMult = getServerPhysicsMult,
    private readonly clock = () => performance.now() / 1000,
  ) {}

  /** The predicted player entity. */
  private predicted: Entity | null = null;

  private readonly collisionTimeline = new PredictionCollisionTimeline();
  private predictionTime: number | undefined;
  private reconciledAt = 0;
  private collisionStepSeconds = 0;
  private presentationError = { wx: 0, wy: 0, at: 0 };
  private prevPresentationError = { wx: 0, wy: 0 };
  private clearPresentationError(): void {
    this.presentationError = { wx: 0, wy: 0, at: this.clock() };
    this.prevPresentationError = { wx: 0, wy: 0 };
  }
  private displayedError() {
    const decay = Math.exp(-Math.max(0, this.clock() - this.presentationError.at) / 0.06);
    return { wx: this.presentationError.wx * decay, wy: this.presentationError.wy * decay };
  }
  // Source timestamps accompany physics endpoints. Only passive XY samples
  // the remote clock; locally controlled steering retains its input interpolation.
  private poseSourceSeconds: number | undefined;
  private prevPoseSourceSeconds: number | undefined;
  private sourceFrameSeconds: number | undefined;
  private support: Entity | null = null;
  private supportOffset: RoofOffset | null = null;
  private prevSupportOffset: RoofOffset | null = null;
  private supportDisplayShift: PositionComponent | null = null;
  private flightDisplayShift: { wx: number; wy: number; landedAt?: number } | null = null;

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
    this.presentationInputSeconds = this.presentationInputDt = 0;
    this.presentationEpoch = {};
    this.supportDisplayShift = this.flightDisplayShift = null;
    this.poseSourceSeconds = this.prevPoseSourceSeconds = this.sourceFrameSeconds = undefined;
    this.clearPresentationError();
    this.predicted = this.clonePlayer(serverPlayer);
    this.support = null;
    this.supportOffset = this.prevSupportOffset = null;
    this.collisionTimeline.clear();
    this.predictionTime = undefined;
    this._prevPosition = {
      wx: this.predicted.position.wx,
      wy: this.predicted.position.wy,
    };
    this._prevJumpZ = this.predicted.jumpZ ?? 0;
    this._prevWz = this.predicted.wz ?? 0;
    this.inputBuffer = [];
    this.jumpConsumed = ((serverPlayer.jumpInputState ?? 0) & 1) !== 0;
    this.lastJumpHeld = ((serverPlayer.jumpInputState ?? 0) & 2) !== 0;
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
    this.inputBuffer.push({
      seq,
      movement,
      dt,
      physics: this.physics(),
      jumpStateBefore: { jumpConsumed: this.jumpConsumed, lastJumpHeld: this.lastJumpHeld },
    });
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

    this.presentationInputSeconds += dt;
    this.presentationInputDt = dt;

    // Autonomous roof motion follows the latest committed pose once, independently
    // of how many player commands are generated/replayed against that snapshot.
    if (this.support && this.supportOffset) {
      const current = entities.find((e) => e.id === this.support?.id);
      if (current) {
        this.support = current;
        this.predicted.position = roofPosition(this.supportOffset, current);
        this.predicted.wz = this.predicted.groundZ =
          (current.wz ?? 0) + (current.collider?.physicalHeight ?? 0);
      } else this.clearSupport();
    }
    this.captureSupport(entities);
    this.prevSupportOffset = this.supportOffset && { ...this.supportOffset };
    if (this.support) this.poseSourceSeconds = this.sourceFrameSeconds;
    this.prevPoseSourceSeconds = this.poseSourceSeconds;
    this.prevPresentationError = this.displayedError();
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

    // Replay establishes a collision horizon; wall time advances it between
    // arrivals. Commands generated together share that horizon, rather than
    // inventing an extra NPC tick for each catch-up command.
    const collisionTime = this.predictionTime;
    if (collisionTime !== undefined)
      this.predictionTime =
        collisionTime + Math.max(0, this.clock() - this.reconciledAt - this.collisionStepSeconds);
    this.applyInput(movement, dt, world, props, entities, this.physics());
    this.predictionTime = collisionTime;
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
    diagnostics?: { expectedInputDt?: number; serverTick?: number; simulationTime?: number },
  ): void {
    if (diagnostics?.simulationTime !== undefined) {
      this.collisionTimeline.record(diagnostics.simulationTime, entities);
      this.predictionTime = diagnostics.simulationTime;
      this.reconciledAt = this.clock();
      this.collisionStepSeconds = diagnostics.expectedInputDt ?? 0;
    }
    if (!this.predicted) {
      const serverMount =
        serverPlayer.parentId !== undefined
          ? entities.find((e) => e.id === serverPlayer.parentId)
          : undefined;
      this.reset(serverPlayer, serverMount);
      return;
    }

    const oldSupportId = this.support?.id;
    const oldOffset = this.supportOffset && { ...this.supportOffset };
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
      currentRevision: this.physics().revision,
      hasMixedRevisions: false,
      hasRevisionMismatch: false,
    };

    // Detect mount from server state
    const serverMount =
      mountEntityId !== undefined ? (entities.find((e) => e.id === mountEntityId) ?? null) : null;

    if (serverMount) {
      this.clearSupport();
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
      delete this.predicted.airMomentumX;
      delete this.predicted.airMomentumY;
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
        this.prevPoseSourceSeconds = this.poseSourceSeconds;
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

      this.poseSourceSeconds = this.sourceFrameSeconds = diagnostics?.simulationTime;
      this.prevPoseSourceSeconds ??= this.poseSourceSeconds;
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

      for (const key of ["airMomentumX", "airMomentumY"] as const) {
        const value = serverPlayer[key];
        if (value === undefined) delete this.predicted[key];
        else this.predicted[key] = value;
      }
      this.captureSupport(entities);
      if (this.support?.id !== oldSupportId)
        this.prevSupportOffset = this.supportOffset && { ...this.supportOffset };

      // Trim acknowledged inputs
      this.trimInputBuffer(lastProcessedInputSeq);
      replayStats = this.collectReplayStats();

      // Jump latches belong to the acknowledged state too, not to the latest
      // predicted command. Otherwise replay can suppress an unacknowledged jump.
      const latch = serverPlayer.jumpInputState;
      const before = this.inputBuffer[0]?.jumpStateBefore;
      if (latch !== undefined) {
        this.jumpConsumed = (latch & 1) !== 0;
        this.lastJumpHeld = (latch & 2) !== 0;
      } else if (before) {
        // Direct/reference callers without replicated latch state.
        this.jumpConsumed = before.jumpConsumed;
        this.lastJumpHeld = before.lastJumpHeld;
      }
      // Replay unacknowledged inputs on top of server position
      for (const input of this.inputBuffer) {
        this.applyInput(input.movement, input.dt, world, props, entities, input.physics);
      }

      // If position changed drastically (teleport/knockback), also snap
      // the previous position so render interpolation doesn't create a slide
      const dx = this.predicted.position.wx - oldX;
      const dy = this.predicted.position.wy - oldY;
      if (dx * dx + dy * dy > SNAP_THRESHOLD * SNAP_THRESHOLD) {
        this.prevPoseSourceSeconds = this.poseSourceSeconds;
        this._prevPosition = {
          wx: this.predicted.position.wx,
          wy: this.predicted.position.wy,
        };
      }
    }

    // Copy server-authoritative state that we don't predict
    this.predicted.id = serverPlayer.id;
    if (serverPlayer.playerModel !== undefined)
      this.predicted.playerModel = serverPlayer.playerModel;
    else delete this.predicted.playerModel;
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
    // Small residual contact corrections are display-only. Physics still uses
    // the authoritative replay result; supports have their own exact pose binding.
    if (resimPosErr > SNAP_THRESHOLD || serverMount || this.noclip) this.flightDisplayShift = null;
    if (
      this.support ||
      oldSupportId !== undefined ||
      serverMount ||
      resimPosErr > 8 ||
      Math.abs(predictedAfter.wz - predictedBefore.wz) > 0.1
    ) {
      this.clearPresentationError();
    } else if (resimPosErr > 0.00025) {
      const error = this.displayedError();
      const wx = error.wx + predictedBefore.wx - predictedAfter.wx;
      const wy = error.wy + predictedBefore.wy - predictedAfter.wy;
      if (Math.hypot(wx, wy) > 8) this.clearPresentationError();
      else this.presentationError = { wx, wy, at: this.clock() };
    }
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
      supportId: this.support?.id ?? null,
      resimSupportPosErr:
        this.support && this.supportOffset && oldOffset && this.support.id === oldSupportId
          ? Math.hypot(
              roofPosition(this.supportOffset, this.support).wx -
                roofPosition(oldOffset, this.support).wx,
              roofPosition(this.supportOffset, this.support).wy -
                roofPosition(oldOffset, this.support).wy,
            )
          : null,
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
    this.clearPresentationError();
    this.clearSupport();
    this.collisionTimeline.clear();
    this.predictionTime = undefined;
    this.predictedMount = null;
    this.inputBuffer = [];
    this._lastReconcileDiagnostics = null;
  }

  /** Get the predicted player entity (or null before first server state). */
  get player(): Entity | null {
    return this.predicted;
  }

  /** Render-only pose: carrier and passenger use the same interpolation endpoints. */
  get presentationPlayer(): Entity | null {
    const player = this.predicted;
    if (!player) return null;
    const support = this.support,
      offset = this.supportOffset;
    if (!support || !offset) {
      const error = this.displayedError();
      return {
        ...player,
        position: { wx: player.position.wx + error.wx, wy: player.position.wy + error.wy },
        prevPosition: {
          wx: this._prevPosition.wx + this.prevPresentationError.wx,
          wy: this._prevPosition.wy + this.prevPresentationError.wy,
        },
        prevWz: this._prevWz,
        prevJumpZ: this._prevJumpZ,
      };
    }
    const previous = { ...support, position: support.prevPosition ?? support.position };
    const height = support.collider?.physicalHeight ?? 0;
    return {
      ...player,
      position: roofPosition(offset, support),
      prevPosition: roofPosition(this.prevSupportOffset ?? offset, previous),
      wz: (support.wz ?? 0) + height,
      prevWz: (support.prevWz ?? support.wz ?? 0) + height,
      prevJumpZ: this._prevJumpZ,
    };
  }

  /** Collapse local interpolation onto one render pose. Carrier contribution is
   * sampled on the remote display timeline; voluntary roof walking stays local.
   */
  samplePresentationPlayer(
    alpha: number,
    displayedEntities: readonly Entity[],
    sourceSeconds?: number,
  ): Entity | null {
    const player = this.presentationPlayer;
    if (!player) return null;
    let position: PositionComponent;
    const support = displayedEntities.find((e) => e.id === this.support?.id);
    const offset = this.supportOffset,
      previousOffset = this.prevSupportOffset ?? offset;
    if (support && offset && previousOffset) {
      position = roofPosition(
        {
          x: previousOffset.x + (offset.x - previousOffset.x) * alpha,
          y: previousOffset.y + (offset.y - previousOffset.y) * alpha,
        },
        support,
      );
      const raw = roofPosition(
        {
          x: previousOffset.x + (offset.x - previousOffset.x) * alpha,
          y: previousOffset.y + (offset.y - previousOffset.y) * alpha,
        },
        this.support ?? support,
      );
      this.supportDisplayShift = { wx: position.wx - raw.wx, wy: position.wy - raw.wy };
      this.flightDisplayShift = null;
    } else {
      const prev = player.prevPosition ?? player.position;
      position = {
        wx: prev.wx + (player.position.wx - prev.wx) * alpha,
        wy: prev.wy + (player.position.wy - prev.wy) * alpha,
      };
    }
    if (
      player.jumpVZ !== undefined &&
      player.airMomentumX === undefined &&
      player.airMomentumY === undefined
    )
      this.flightDisplayShift = null;
    if (
      !support &&
      player.jumpVZ !== undefined &&
      (player.airMomentumX !== undefined || player.airMomentumY !== undefined) &&
      sourceSeconds !== undefined &&
      this.poseSourceSeconds !== undefined &&
      this.prevPoseSourceSeconds !== undefined
    ) {
      const physicsTime =
        this.prevPoseSourceSeconds + (this.poseSourceSeconds - this.prevPoseSourceSeconds) * alpha;
      this.flightDisplayShift ??= { wx: 0, wy: 0 };
      // Preserve a clipped axis's existing translation rather than popping to
      // its committed wall pose. Landing retains the established release policy.
      if (player.airMomentumX)
        this.flightDisplayShift.wx = player.airMomentumX * (sourceSeconds - physicsTime);
      if (player.airMomentumY)
        this.flightDisplayShift.wy = player.airMomentumY * (sourceSeconds - physicsTime);
    }
    if (!support && this.flightDisplayShift) {
      const shift = this.flightDisplayShift;
      if (player.jumpVZ === undefined) shift.landedAt ??= this.clock();
      const decay =
        shift.landedAt === undefined
          ? 1
          : Math.exp(-Math.max(0, this.clock() - shift.landedAt) / 0.06);
      position.wx += shift.wx * decay;
      position.wy += shift.wy * decay;
    }
    const wz = support
      ? (support.wz ?? 0) + (support.collider?.physicalHeight ?? 0)
      : (player.prevWz ?? player.wz ?? 0) +
        ((player.wz ?? 0) - (player.prevWz ?? player.wz ?? 0)) * alpha;
    const jumpZ =
      (player.prevJumpZ ?? player.jumpZ ?? 0) +
      ((player.jumpZ ?? 0) - (player.prevJumpZ ?? player.jumpZ ?? 0)) * alpha;
    return { ...player, position, prevPosition: position, wz, prevWz: wz, jumpZ, prevJumpZ: jumpZ };
  }

  private clearSupport(): void {
    this.supportDisplayShift = null;
    this.support = null;
    this.supportOffset = this.prevSupportOffset = null;
  }
  private captureSupport(entities: readonly Entity[], landed = false): void {
    if (!this.predicted || this.noclip || this.predictedMount) {
      this.flightDisplayShift = null;
      this.clearSupport();
      return;
    }
    const surface = roofSupport(this.predicted, entities);
    const support = surface && entities.find((e) => e.id === surface.id);
    if (!support) {
      if (this.support) {
        if (
          this.predicted.jumpVZ !== undefined &&
          this.predicted.airMomentumX !== undefined &&
          this.supportDisplayShift
        )
          this.flightDisplayShift = { ...this.supportDisplayShift };
        this.clearPresentationError();
      }
      this.clearSupport();
      return;
    }
    const changed = support.id !== this.support?.id;
    if (landed && this.poseSourceSeconds !== undefined && this.sourceFrameSeconds !== undefined) {
      // Flight predicts a future world pose. Once supported, bind walking back
      // to the newest committed roof using the offset against its future pose.
      const ahead = Math.max(0, this.poseSourceSeconds - this.sourceFrameSeconds);
      this.predicted.position.wx -= (support.velocity?.vx ?? 0) * ahead;
      this.predicted.position.wy -= (support.velocity?.vy ?? 0) * ahead;
      this.poseSourceSeconds = this.sourceFrameSeconds;
    }
    this.support = support;
    this.supportOffset = roofOffset(this.predicted.position, support);
    if (changed) {
      this.clearPresentationError();
      this.prevSupportOffset = { ...this.supportOffset };
    }
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
    const currentRevision = this.physics().revision;
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
    const stepDts = splitInputStepDurations(dt, MAX_INPUT_STEP_SECONDS);
    if (stepDts.length === 0) return;
    const queryEntities = (_aabb: {
      left: number;
      top: number;
      right: number;
      bottom: number;
    }): readonly Entity[] =>
      this.predictionTime === undefined
        ? entities
        : this.collisionTimeline.poses(this.predictionTime, entities, this.predicted?.id ?? -1);
    const queryProps = (_aabb: {
      left: number;
      top: number;
      right: number;
      bottom: number;
    }): readonly Prop[] => props;
    const sampleSurfaces = createSurfaceSampler({ queryEntities, queryProps });
    const getCollision = (tx: number, ty: number) => world.getCollisionIfLoaded(tx, ty);
    const getHeight = (tx: number, ty: number) => world.getHeightAt(tx, ty);
    const getTerrainAt = (tx: number, ty: number) => world.getBlendBaseAt(tx, ty);
    const getRoadAt = (tx: number, ty: number) => world.getRoadAt(tx, ty);

    let landed = false;
    if (this.predictedMount) {
      // ── Riding: apply input to mount, derive player position ──
      const mountExclude = new Set([this.predictedMount.id, this.predicted.id]);
      const mountCtx = createMovementContext({
        getCollision,
        getHeight,
        getTerrainAt,
        getRoadAt,
        queryEntities,
        queryProps,
        movingEntity: this.predictedMount,
        excludeIds: mountExclude,
        noclip: this.noclip,
        deferRoofCarry: true,
      });
      for (const stepDt of stepDts) {
        stepMountFromInput(
          this.predictedMount,
          movement,
          stepDt,
          mountCtx,
          getHeight,
          sampleSurfaces,
          this.predicted,
          this.physicsMult(),
        );
        if (this.predictionTime !== undefined) this.predictionTime += stepDt;
      }

      // Derive player position from mount + offset
      this.predicted.position.wx = this.predictedMount.position.wx + this.mountOffsetX;
      this.predicted.position.wy = this.predictedMount.position.wy + this.mountOffsetY;
      // Derive player wz from mount surface + ride offset
      if (this.predictedMount.wz !== undefined && this.predicted.jumpZ !== undefined) {
        this.predicted.wz = this.predictedMount.wz + this.predicted.jumpZ;
      }
    } else {
      // ── Normal: apply friction + acceleration from input ──
      if (this.support) this.poseSourceSeconds = this.sourceFrameSeconds;
      const playerExclude = new Set([this.predicted.id]);
      const playerCtx = createMovementContext({
        getCollision,
        getHeight,
        getTerrainAt,
        getRoadAt,
        queryEntities,
        queryProps,
        movingEntity: this.predicted,
        excludeIds: playerExclude,
        noclip: this.noclip,
        deferRoofCarry: true,
      });
      let nextState = {
        jumpConsumed: this.jumpConsumed,
        lastJumpHeld: this.lastJumpHeld,
      };
      const heldInput =
        movement.jumpPressed === undefined ? movement : { ...movement, jumpPressed: false };
      for (let i = 0; i < stepDts.length; i++) {
        const stepResult = stepPlayerFromInput(
          this.predicted,
          i === 0 ? movement : heldInput,
          stepDts[i]!,
          playerCtx,
          getHeight,
          sampleSurfaces,
          nextState,
          physics,
          this.physicsMult(),
        );
        nextState = stepResult.jumpState;
        landed ||= stepResult.outcome.landed;
        if (this.poseSourceSeconds !== undefined) this.poseSourceSeconds += stepDts[i] ?? 0;
        if (this.predictionTime !== undefined) this.predictionTime += stepDts[i] ?? 0;
      }
      this.jumpConsumed = nextState.jumpConsumed;
      this.lastJumpHeld = nextState.lastJumpHeld;
    }
    this.captureSupport(entities, landed);
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
    if (serverPlayer.playerModel !== undefined) clone.playerModel = serverPlayer.playerModel;
    if (serverPlayer.sortOffsetY !== undefined) clone.sortOffsetY = serverPlayer.sortOffsetY;
    if (serverPlayer.jumpZ !== undefined) clone.jumpZ = serverPlayer.jumpZ;
    if (serverPlayer.jumpVZ !== undefined) clone.jumpVZ = serverPlayer.jumpVZ;
    if (serverPlayer.airMomentumX !== undefined) clone.airMomentumX = serverPlayer.airMomentumX;
    if (serverPlayer.airMomentumY !== undefined) clone.airMomentumY = serverPlayer.airMomentumY;
    if (serverPlayer.wz !== undefined) clone.wz = serverPlayer.wz;
    if (serverPlayer.parentId !== undefined) clone.parentId = serverPlayer.parentId;
    if (serverPlayer.localOffsetX !== undefined) clone.localOffsetX = serverPlayer.localOffsetX;
    if (serverPlayer.localOffsetY !== undefined) clone.localOffsetY = serverPlayer.localOffsetY;
    return clone;
  }
}
