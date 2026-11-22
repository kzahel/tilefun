import type { Entity, PositionComponent } from "../entities/Entity.js";
import { updatePlayerSpriteFromInput } from "../entities/Player.js";
import type { Prop } from "../entities/Prop.js";
import { tickSpriteAnimation } from "../entities/spriteAnimation.js";
import { getGravityScale } from "../physics/Gravity.js";
import { physicsBodyMotion } from "../physics/PhysicsBodies.js";
import { PHYSICS_DT } from "../physics/PhysicsDefaults.js";
import { type PhysicsGeometry, PhysicsScene } from "../physics/PhysicsScene.js";
import type { MotionIntent } from "../physics/PhysicsState.js";
import { MAX_PREDICTION_BODIES, type PhysicsState } from "../physics/PhysicsState.js";
import {
  CONTROL_HOLD_TICKS,
  playerMotionIntent,
  vehicleMotionIntent,
} from "../physics/PlayerControls.js";
import type { CameraPresentationTime } from "../rendering/CameraFollow.js";
import type { Movement } from "../shared/Movement.js";
import { isDrivable } from "../traffic/VehicleSeats.js";
import type { World } from "../world/World.js";
import { CarrierPresentation } from "./CarrierPresentation.js";
import { NearbyPredictionPresentation } from "./NearbyPredictionPresentation.js";
import { predictionGeometry } from "./PredictionGeometry.js";
import { PredictionHistory } from "./PredictionHistory.js";
import {
  activePresentationIds,
  expandCoherentMembers,
  movingSupportIds,
  samplePredictedPose,
} from "./PredictionPresentation.js";
import {
  type PredictionReplay as Replay,
  type ReplayRequest as Request,
  replayInputOffset,
  replayTarget,
  type StoredInput,
} from "./PredictionReplay.js";
import {
  capturePredictionBodies,
  clonePredictionEntity as clone,
  predictionDistance as distance,
  replayPose,
} from "./PredictionSnapshots.js";
import { PredictionWork } from "./PredictionWork.js";
import {
  CoSeats,
  hasMovement,
  normalizedMovement,
  type SeatMovements,
  seatBodies,
} from "./SeatInputs.js";
import { VehicleRotationCorrection } from "./VehicleRotationCorrection.js";

const MAX_HISTORY = 120;
const REPLAY_STEPS_PER_UPDATE = 8;
const REPLAY_MS_PER_UPDATE = 2; // Injected clock: simulated time slices by step count alone.

export type { StoredInput } from "./PredictionReplay.js";
export interface ReconcileTiming {
  serverTick?: number;
  physics?: PhysicsState;
  /** The stream's seat list (seat → entity id), from which co-seats' bodies resolve (226). */
  seats?: ReadonlyMap<number, number>;
}
export interface PredictionRecoveryDiagnostics {
  status: "waiting" | "ready" | "replaying" | "history-gap" | "overflow" | "stale";
  retainedInputs: number;
  retainedSeconds: number;
  discardedThroughSeq: number | undefined;
  replayStepsThisTick: number;
  replayAck: number | undefined;
}
export interface ReconcileDiagnostics {
  ackSeq: number;
  physicsTick: number;
  epoch: number;
  bodies: number;
  omitted: number;
  replayCount: number;
  replayMs: number;
  /** Agreement at the same past tick; absent if that tick was not retained. */
  pastTickError: number | undefined;
  /** Correction at the last committed physics tick, excluding subsequently queued movement. */
  resimPosErr: number;
  /** Input tick of the committed pose; absent if its physics tick cannot be compared. */
  comparisonInputTick: number | undefined;
  comparisonPhysicsTick: number | undefined;
  status: PredictionRecoveryDiagnostics["status"];
  /** Co-seat body corrections at the committed tick (226). */
  seatCorrections?: ReadonlyMap<number, number>;
}

/** One bounded private copy of the ordinary fixed-step kernel. Inputs address
 * local ticks; an acknowledged snapshot anchors that clock to an authority tick.
 * Replay never integrates once per packet or mutates replica entities.
 */
export class PlayerPredictor {
  private scene: PhysicsScene | undefined;
  private readonly work = new PredictionWork();
  private initialization: Promise<void> | undefined;
  private generation = 0;
  private predicted: Entity | null = null;
  private predictedMount: Entity | null = null;
  private bodies = new Map<number, Entity>();
  private published = new Map<number, Entity>();
  private publishedPhysicsTick: number | undefined;
  private motorIntents = new Map<number, MotionIntent>();
  private inputHistory: StoredInput[] = [];
  private inputTick = 0;
  private appliedInputTick = 0;
  private animationInputTick = 0;
  private retiredEpochs = new Set<number>();
  private ackInputTick = 0;
  /** The acknowledged device layout survives physics resets. */
  private acknowledgedSharedScreen = false;
  private latestSeq = 0;
  private discardedThroughSeq: number | undefined;
  private receivedAck = -1;
  private receivedServerTick = -1;
  private epoch: number | undefined;
  private queued: Request | undefined;
  private replay: Replay | undefined;
  private status: PredictionRecoveryDiagnostics["status"] = "waiting";
  private lastReplaySteps = 0;
  private readonly stateHistory = new PredictionHistory(MAX_HISTORY);
  private geometry: PhysicsGeometry | undefined;
  private geometryWorld: World | undefined;
  private geometryProps: readonly Prop[] | undefined;
  private propsRevision = 0;
  private riderLift = 0;
  private clockEpoch: object = {};
  private activeUntil = -Infinity;
  private correction = { wx: 0, wy: 0, wz: 0, vx: 0, vy: 0, jumpVZ: 0 };
  private displayError = { x: 0, y: 0, z: 0, at: 0 };
  private correctionAnchor: number | undefined;
  private correctionMembers = new Set<number>();
  private readonly nearbyPresentation = new NearbyPredictionPresentation();
  private readonly lastPresentation = new Map<number, Entity>();
  private readonly carriers = new CarrierPresentation();
  private readonly vehicleRotation = new VehicleRotationCorrection();
  private diagnostics: ReconcileDiagnostics | null = null;
  /** The co-seats of the latest stored input and their own display corrections (226). */
  private readonly coSeats: CoSeats;

  constructor(
    private readonly gravity = getGravityScale,
    private readonly clock = () => performance.now() / 1000,
  ) {
    this.coSeats = new CoSeats(clock);
    void this.ready;
  }
  get ready(): Promise<void> {
    if (this.scene) return Promise.resolve();
    if (this.initialization) return this.initialization;
    const generation = this.generation;
    this.initialization = PhysicsScene.create().then((scene) => {
      if (generation !== this.generation) {
        scene.dispose();
        return;
      }
      this.scene = scene;
      this.initialization = undefined;
    });
    return this.initialization;
  }
  reset(player: Entity, mount?: Entity): void {
    this.work.record("resets");
    this.scene?.clear();
    void this.ready;
    this.predicted = clone(player);
    this.predicted.prevPosition = { ...player.position };
    this.predicted.prevWz = player.wz ?? 0;
    this.predictedMount = mount && player.parentId === mount.id ? clone(mount) : null;
    this.riderLift = (player.wz ?? 0) - (mount?.wz ?? 0);
    this.bodies.clear();
    this.published.clear();
    this.publishedPhysicsTick = undefined;
    this.motorIntents.clear();
    this.inputHistory = [];
    this.coSeats.clear();
    this.inputTick =
      this.appliedInputTick =
      this.animationInputTick =
      this.ackInputTick =
      this.latestSeq =
        0;
    this.receivedAck = this.receivedServerTick = -1;
    this.epoch = undefined;
    this.discardedThroughSeq = undefined;
    this.queued = this.replay = undefined;
    this.status = "waiting";
    this.stateHistory.clear();
    this.clockEpoch = {};
    this.displayError = { x: 0, y: 0, z: 0, at: this.clock() };
    this.correctionAnchor = undefined;
    this.correctionMembers.clear();
    this.lastPresentation.clear();
    this.carriers.clear();
    this.vehicleRotation.clear();
    this.nearbyPresentation.clear();
    this.activeUntil = -Infinity;
    this.diagnostics = null;
  }
  clearPredicted(): void {
    this.work.record("clears");
    this.generation++;
    this.scene?.dispose();
    this.scene = undefined;
    this.initialization = undefined;
    this.predicted = this.predictedMount = null;
    this.bodies.clear();
    this.published.clear();
    this.publishedPhysicsTick = undefined;
    this.motorIntents.clear();
    this.inputHistory = [];
    this.coSeats.clear();
    this.queued = this.replay = undefined;
    this.geometry = this.geometryWorld = this.geometryProps = undefined;
    this.stateHistory.clear();
    this.retiredEpochs.clear();
    this.correctionAnchor = undefined;
    this.correctionMembers.clear();
    this.lastPresentation.clear();
    this.carriers.clear();
    this.vehicleRotation.clear();
    this.nearbyPresentation.clear();
    this.status = "waiting";
  }
  /** `seats` carries every co-seat's movement, idle or not, under the same sequence (226). */
  storeInput(
    seq: number,
    movement: Movement,
    _dt: number,
    seats?: SeatMovements,
    sharedScreen?: boolean,
  ): void {
    if (!this.predicted || seq <= Math.max(this.latestSeq, this.receivedAck)) return;
    this.work.record("inputs");
    this.latestSeq = seq;
    this.inputTick++;
    const co = this.coSeats.store(seats);
    this.inputHistory.push({
      seq,
      tick: this.inputTick,
      movement: normalizedMovement(movement),
      ...(co ? { seats: co } : {}),
      ...(sharedScreen ? { sharedScreen } : {}),
    });
    const submitted = this.inputHistory[this.inputHistory.length - 1];
    if (this.replay && this.replay.targetInputTick === undefined && submitted)
      this.replay.inputs.push(submitted);
    if (hasMovement(movement) || [...(co?.values() ?? [])].some(hasMovement))
      this.activeUntil = this.clock() + 0.3;
    while (this.inputHistory.length > MAX_HISTORY) {
      const discarded = this.inputHistory.shift();
      if (discarded) this.discardedThroughSeq = discarded.seq;
    }
    if (this.discardedThroughSeq !== undefined && this.receivedAck < this.discardedThroughSeq) {
      this.replay = undefined;
      this.status = "history-gap";
    }
  }
  reconcile(
    player: Entity,
    ack: number,
    world: World,
    props: readonly Prop[],
    entities: ReadonlyMap<number, Entity>,
    _mountId?: number,
    timing?: ReconcileTiming,
  ): void {
    const state = timing?.physics;
    if (!state || !this.predicted || this.retiredEpochs.has(state.epoch)) return;
    if (
      this.epoch === state.epoch &&
      (ack < this.receivedAck ||
        (timing?.serverTick !== undefined && timing.serverTick < this.receivedServerTick))
    )
      return;
    this.work.record("reconciliations");
    if (this.epoch !== undefined && this.epoch !== state.epoch) {
      this.retiredEpochs.add(this.epoch);
      if (this.retiredEpochs.size > 8) {
        const oldest = this.retiredEpochs.values().next().value;
        if (oldest !== undefined) this.retiredEpochs.delete(oldest);
      }
      this.reset(player, entities.get(player.parentId ?? -1));
    }
    this.epoch = state.epoch;
    this.receivedAck = ack;
    this.receivedServerTick = timing?.serverTick ?? this.receivedServerTick + 1;
    const acknowledged = [...this.inputHistory].reverse().find((input) => input.seq <= ack);
    if (acknowledged) {
      this.ackInputTick = acknowledged.tick;
      this.acknowledgedSharedScreen = acknowledged.sharedScreen === true;
    }
    this.inputHistory = this.inputHistory.filter((input) => input.seq > ack);
    const request: Request = {
      player: clone(player),
      ack,
      state,
      bodies: capturePredictionBodies(state.bodies, entities),
      world,
      props,
      seatBodies: seatBodies(timing?.seats, entities),
      sharedScreen: this.acknowledgedSharedScreen,
    };
    // Retain the parent's replicated seat metadata even though it has no body.
    this.riderLift = (player.wz ?? 0) - (entities.get(player.parentId ?? -1)?.wz ?? 0);
    this.queued = request;
    const lastReplayInput = this.replay?.inputs[this.replay.inputs.length - 1];
    if (lastReplayInput && ack >= lastReplayInput.seq) this.replay = undefined;
    if (!this.replay && this.scene) this.startReplay();
  }
  private bindGeometry(world: World, props: readonly Prop[]) {
    if (world === this.geometryWorld && props === this.geometryProps && this.geometry) return;
    this.geometryWorld = world;
    this.geometryProps = props;
    this.propsRevision++;
    this.geometry = predictionGeometry(world, props, this.propsRevision);
  }
  private startReplay() {
    const request = this.queued,
      scene = this.scene;
    if (!request || !scene || !this.predicted) return;
    this.queued = undefined;
    const { state } = request;
    const anchorId = request.player.parentId ?? request.player.id;
    const missing =
      state.bodies.length !== request.bodies.size || !state.bodies.some((b) => b.id === anchorId);
    if (
      state.omitted ||
      state.bodies.length > MAX_PREDICTION_BODIES ||
      missing ||
      (this.discardedThroughSeq !== undefined && request.ack < this.discardedThroughSeq)
    ) {
      this.predicted = clone(request.player);
      this.predictedMount = request.bodies.get(request.player.parentId ?? -1) ?? null;
      this.published.clear();
      this.publishedPhysicsTick = undefined;
      this.correctionAnchor = undefined;
      this.correctionMembers.clear();
      this.vehicleRotation.clear();
      this.status = state.omitted ? "overflow" : missing ? "waiting" : "history-gap";
      this.diagnostics = {
        ackSeq: request.ack,
        physicsTick: state.tick,
        epoch: state.epoch,
        bodies: state.bodies.length,
        omitted: state.omitted,
        replayCount: 0,
        replayMs: 0,
        pastTickError: undefined,
        resimPosErr: 0,
        comparisonInputTick: undefined,
        comparisonPhysicsTick: undefined,
        status: this.status,
      };
      return;
    }
    const before = clone(this.predicted),
      beforePhysicsTick = this.publishedPhysicsTick ?? state.tick,
      overdue = this.inputHistory.some((input) => input.tick <= this.appliedInputTick);
    const pastError = this.stateHistory.distance(state.tick, request.player);
    this.bindGeometry(request.world, request.props);
    this.bodies = request.bodies;
    const kinds = new Map(state.bodies.map((b) => [b.id, b.kind]));
    scene.synchronize([...this.bodies.values()], kinds);
    scene.restore(state);
    this.work.record("restores");
    this.work.record("restoredBodies", state.bodies.length);
    this.motorIntents = new Map(
      state.bodies.map((body) => [
        body.id,
        {
          vx: body.desiredVx,
          vy: body.desiredVy,
          jump: body.jumpHeld,
          ...(body.controlUntil === undefined ? {} : { controlUntil: body.controlUntil }),
          ...(body.excavatorHeld && { excavatorAction: body.excavatorHeld }),
          ...(body.altitude === undefined ? {} : { altitude: body.altitude }),
          ...(body.desiredHeading === undefined ? {} : { heading: body.desiredHeading }),
          ...(body.desiredDriveSpeed === undefined ? {} : { driveSpeed: body.desiredDriveSpeed }),
          ...(body.desiredSteering === undefined ? {} : { steering: body.desiredSteering }),
        },
      ]),
    );
    this.replay = {
      request,
      // Keep the committed physics horizon advancing once per local input tick.
      // A repeated/jumping packet acknowledgement must not add/remove a world tick.
      // Authority covering an unpublished suffix is an explicit recovery fence.
      physicsInputOffset: replayInputOffset(
        this.inputTick,
        this.appliedInputTick,
        this.ackInputTick,
        beforePhysicsTick,
        state.tick,
        overdue,
      ),
      inputIndex: 0,
      sharedScreen: request.sharedScreen,
      jumpHeld: state.bodies.find((body) => body.id === anchorId)?.jumpHeld ?? false,
      steps: 0,
      ms: 0,
      before,
      beforeInputTick: this.appliedInputTick,
      beforePhysicsTick,
      pastError,
      inputs: [...this.inputHistory],
      seats: this.coSeats.replay(request.seatBodies, state.bodies),
    };
    this.status = "replaying";
    if (scene.physicsTick === beforePhysicsTick) this.captureReplayComparison(this.replay);
    if (scene.physicsTick >= replayTarget(this.replay, this.inputTick)) this.drainReplay();
  }
  private replayStep(job: Replay) {
    const scene = this.scene;
    if (!scene || !this.geometry) return;
    const inputTick = scene.physicsTick + 1 - job.physicsInputOffset;
    let movement = job.heldMovement,
      jumpPressed = false;
    for (;;) {
      const input = job.inputs[job.inputIndex];
      if (!input || input.tick > inputTick) break;
      movement = input.movement;
      jumpPressed ||= movement.jumpPressed === true || (movement.jump && !job.jumpHeld);
      job.jumpHeld = movement.jump;
      job.seats.consume(input.seats);
      job.sharedScreen = input.sharedScreen === true;
      job.inputIndex++;
    }
    if (movement) {
      // Coalesce overdue axes, retaining jump edges just like authority admission.
      job.heldMovement = { ...movement, jumpPressed: false };
      this.step(
        { ...movement, jumpPressed },
        job.request.player,
        job.seats.take(),
        job.sharedScreen,
      );
    } else {
      // No new local command is due: continue the snapshot's held motor targets.
      const { player, seatBodies } = job.request;
      const group = job.sharedScreen
        ? [player.parentId ?? player.id, ...seatBodies.values()]
        : undefined;
      this.work.step(scene, this.motorIntents, this.geometry, this.gravity(), true, group);
    }
  }
  private captureReplayComparison(job: Replay) {
    // These are JS readback poses, not another world capture or simulation step.
    // Freeze them once at the physics tick represented by the committed display.
    job.comparison = {
      player: this.samplePlayer(job.request.player),
      bodies: new Map([...this.bodies].map(([id, entity]) => [id, replayPose(entity)])),
    };
  }
  private advanceReplay(job: Replay, scene: PhysicsScene): boolean {
    const start = this.clock() * 1000;
    let steps = 0;
    while (
      scene.physicsTick < replayTarget(job, this.inputTick) &&
      steps < REPLAY_STEPS_PER_UPDATE &&
      (steps === 0 || this.clock() * 1000 - start < REPLAY_MS_PER_UPDATE)
    ) {
      this.replayStep(job);
      if (scene.physicsTick === job.beforePhysicsTick) this.captureReplayComparison(job);
      job.steps++;
      steps++;
    }
    this.lastReplaySteps += steps;
    job.ms += this.clock() * 1000 - start;
    if (scene.physicsTick < replayTarget(job, this.inputTick)) {
      // A one-step slice must reduce a finite job, even when one new command
      // arrives per update. Never publish the private scene before this prefix
      // is complete; subsequent input remains available for the next replay.
      job.targetInputTick ??= this.inputTick;
      return false;
    }
    return true;
  }
  private reconcileVehicleRotation(
    job: Replay,
    scene: PhysicsScene,
    before: ReadonlyMap<number, Entity>,
  ): void {
    const matched =
      job.targetInputTick === undefined && scene.physicsTick <= job.beforePhysicsTick + 1
        ? job.comparison?.bodies
        : undefined;
    this.vehicleRotation.reconcile(
      this.drivenPresentationIds(job.request.player),
      before,
      this.published,
      matched,
      this.lastPresentation,
      this.clock(),
    );
  }
  private drainReplay() {
    const job = this.replay,
      scene = this.scene;
    if (!job || !scene || !this.geometry || !this.advanceReplay(job, scene)) return;
    this.replay = undefined;
    this.status = "ready";
    this.appliedInputTick = job.targetInputTick ?? this.inputTick;
    const beforeBodies = this.published,
      beforeMembers = this.correctionMembers,
      oldError = this.error();
    this.publish(job.request.player);
    this.carriers.reconcile(this.published, beforeBodies, job.comparison?.bodies, this.clock());
    this.reconcileVehicleRotation(job, scene, beforeBodies);
    const seatCorrections = this.coSeats.settle(
      beforeBodies,
      job.comparison?.bodies,
      this.correctionMembers,
    );
    const after = this.predicted;
    if (!after) return;
    const compared = job.comparison?.player;
    this.correction = compared
      ? {
          wx: job.before.position.wx - compared.position.wx,
          wy: job.before.position.wy - compared.position.wy,
          wz: (job.before.wz ?? 0) - (compared.wz ?? 0),
          vx: (job.before.velocity?.vx ?? 0) - (compared.velocity?.vx ?? 0),
          vy: (job.before.velocity?.vy ?? 0) - (compared.velocity?.vy ?? 0),
          jumpVZ: (job.before.jumpVZ ?? 0) - (compared.jumpVZ ?? 0),
        }
      : { wx: 0, wy: 0, wz: 0, vx: 0, vy: 0, jumpVZ: 0 };
    // Rebase the shared display transform around the contact anchor, not always
    // the player. Otherwise an unmoving NPC inherits unrelated player error.
    const anchor = this.correctionAnchor ?? after.id,
      anchorBefore = beforeBodies.get(anchor),
      joining = !beforeMembers.has(anchor),
      retained = joining ? { x: 0, y: 0, z: 0 } : oldError;
    const currentAnchor = this.published.get(anchor),
      comparedAnchor = job.comparison?.bodies.get(anchor),
      anchorAfter =
        comparedAnchor ?? (joining && currentAnchor ? replayPose(currentAnchor) : undefined),
      usePrevious = joining && !comparedAnchor;
    // A new anchor's whole interpolation interval must begin at its old pose;
    // preserving only the end would pull it backward at fractional renders.
    const offset = {
      x:
        (anchorBefore && anchorAfter
          ? anchorBefore.position.wx - (usePrevious ? anchorAfter.prevX : anchorAfter.x)
          : 0) + retained.x,
      y:
        (anchorBefore && anchorAfter
          ? anchorBefore.position.wy - (usePrevious ? anchorAfter.prevY : anchorAfter.y)
          : 0) + retained.y,
      z:
        (anchorBefore && anchorAfter
          ? (anchorBefore.wz ?? 0) - (usePrevious ? anchorAfter.prevZ : anchorAfter.z)
          : 0) + retained.z,
    };
    // A prescribed carrier cannot be pushed by player prediction. Preserve the
    // rider's own residual through landing instead of transferring it to that
    // carrier or dropping it when contact ownership changes.
    if (compared && this.hasPrescribedContact(after, anchor)) {
      offset.x = job.before.position.wx - compared.position.wx + oldError.x;
      offset.y = job.before.position.wy - compared.position.wy + oldError.y;
      offset.z = (job.before.wz ?? 0) - (compared.wz ?? 0) + oldError.z;
    }
    this.displayError = {
      ...(Math.hypot(offset.x, offset.y, offset.z) < 32 ? offset : { x: 0, y: 0, z: 0 }),
      at: this.clock(),
    };
    this.diagnostics = {
      ackSeq: job.request.ack,
      physicsTick: job.request.state.tick,
      epoch: job.request.state.epoch,
      bodies: this.bodies.size,
      omitted: 0,
      replayCount: job.steps,
      replayMs: job.ms,
      pastTickError: job.pastError,
      resimPosErr: compared ? distance(job.before, compared) : 0,
      comparisonInputTick: compared ? job.beforeInputTick : undefined,
      comparisonPhysicsTick: compared ? job.beforePhysicsTick : undefined,
      status: this.status,
      seatCorrections,
    };
  }
  private step(movement: Movement, player: Entity, seats?: SeatMovements, sharedScreen?: boolean) {
    const scene = this.scene;
    if (!scene || !this.geometry) return;
    const controlled = this.bodies.get(player.parentId ?? player.id);
    if (!controlled) return;
    // Co-seats first so the primary seat's intent wins if a body collides.
    this.coSeats.intents(seats, this.bodies, this.motorIntents, scene.physicsTick);
    const intent = controlled.type.startsWith("vehicle-v1:")
      ? vehicleMotionIntent(controlled, movement)
      : playerMotionIntent(movement);
    this.motorIntents.set(controlled.id, {
      ...intent,
      controlUntil: scene.physicsTick + CONTROL_HOLD_TICKS,
    });
    const group =
      sharedScreen && seats ? [controlled.id, ...this.coSeats.bodyIds(seats.keys())] : undefined;
    this.work.step(scene, this.motorIntents, this.geometry, this.gravity(), !!this.replay, group);
    updatePlayerSpriteFromInput(this.bodies.get(player.id) ?? player, movement);
  }
  private samplePlayer(authority: Entity): Entity {
    const player = clone(this.bodies.get(authority.id) ?? authority);
    const parent = this.bodies.get(authority.parentId ?? -1);
    if (parent) {
      player.position = {
        wx: parent.position.wx + (authority.localOffsetX ?? 0),
        wy: parent.position.wy + (authority.localOffsetY ?? 0),
      };
      player.wz = (parent.wz ?? 0) + this.riderLift;
    }
    return player;
  }
  private publish(authority: Entity) {
    const previous = this.predicted;
    const body = this.bodies.get(authority.id);
    const parent = this.bodies.get(authority.parentId ?? -1);
    this.predicted = this.samplePlayer(authority);
    if (
      previous?.sprite &&
      this.predicted.sprite &&
      previous.sprite.sheetKey === this.predicted.sprite.sheetKey &&
      previous.sprite.clipElapsedMs === undefined &&
      this.predicted.sprite.clipElapsedMs === undefined
    ) {
      this.predicted.sprite.frameCol = previous.sprite.frameCol;
      this.predicted.sprite.animTimer = previous.sprite.animTimer;
    }
    this.predicted.prevPosition = parent
      ? {
          wx: (parent.prevPosition ?? parent.position).wx + (authority.localOffsetX ?? 0),
          wy: (parent.prevPosition ?? parent.position).wy + (authority.localOffsetY ?? 0),
        }
      : { ...(body?.prevPosition ?? this.predicted.position) };
    this.predicted.prevWz = parent
      ? (parent.prevWz ?? parent.wz ?? 0) + this.riderLift
      : (body?.prevWz ?? this.predicted.wz ?? 0);
    this.predicted.prevJumpZ = body?.prevJumpZ ?? this.predicted.jumpZ ?? 0;
    this.predictedMount = parent ? clone(parent) : null;
    this.published = new Map([...this.bodies].map(([id, e]) => [id, clone(e)]));
    this.publishedPhysicsTick = this.scene?.physicsTick;
    const root = this.predicted.parentId ?? this.predicted.id,
      touching = this.touchingIds(),
      incoming = [...touching].find(
        (id) => id !== root && id !== this.predicted?.id && !this.correctionMembers.has(id),
      );
    // A newly touched actor was drawn without the player's correction. Anchor
    // the merged group there instead of pulling that actor toward the player.
    if (incoming !== undefined) {
      this.correctionAnchor = incoming;
      if (!this.hasPrescribedMotion(incoming))
        this.displayError = { x: 0, y: 0, z: 0, at: this.clock() };
    } else if (
      this.correctionAnchor === undefined ||
      !touching.has(this.correctionAnchor) ||
      !this.published.has(this.correctionAnchor)
    ) {
      this.correctionAnchor =
        [...touching].find((id) => id !== root && id !== this.predicted?.id) ?? root;
    }
    this.correctionMembers = touching;
    if (this.scene) this.stateHistory.remember(this.scene.physicsTick, this.predicted);
  }
  update(
    _dt: number,
    movement: Movement,
    world: World,
    props: readonly Prop[],
    _entities: readonly Entity[],
  ): void {
    if (!this.predicted) return;
    this.lastReplaySteps = 0;
    this.bindGeometry(world, props);
    if (!this.replay && this.queued && this.scene) {
      this.startReplay();
    }
    if (this.replay) this.drainReplay();
    else if (this.status === "ready" && this.appliedInputTick < this.inputTick) {
      // A completed prefix can leave newer commands behind. Consume them in
      // order rather than skipping to the latest axes and losing a jump edge.
      const submitted = this.inputHistory.find((input) => input.tick > this.appliedInputTick);
      this.appliedInputTick = submitted?.tick ?? this.inputTick;
      this.step(
        submitted?.movement ?? movement,
        this.predicted,
        submitted?.seats,
        submitted?.sharedScreen,
      );
      this.publish(this.predicted);
    }
    if (this.animationInputTick < this.inputTick) {
      this.animationInputTick = this.inputTick;
      if (this.predicted?.sprite?.clipElapsedMs === undefined && this.predicted)
        tickSpriteAnimation(this.predicted, PHYSICS_DT);
    }
  }

  private error() {
    const decay = Math.exp(-Math.max(0, this.clock() - this.displayError.at) / 0.06);
    return {
      x: this.displayError.x * decay,
      y: this.displayError.y * decay,
      z: this.displayError.z * decay,
    };
  }
  private get active() {
    const player = this.predicted;
    const anchor = player && (player.parentId ?? player.id);
    return (
      this.clock() < this.activeUntil ||
      (!!player &&
        (player.jumpVZ !== undefined ||
          Math.hypot(player.velocity?.vx ?? 0, player.velocity?.vy ?? 0) > 2 ||
          this.scene?.bodyState(anchor ?? -1)?.supportId !== undefined)) ||
      this.coSeats.moving(this.published, this.scene)
    );
  }
  /** A local seat stays on its car's timeline even in idle. Nearby bodies
   * still need active play or solved contact to join predicted presentation. */
  private drivenPresentationIds(player: Entity): number[] {
    const ids = this.coSeats.bodyIds().filter((id) => {
      const body = this.published.get(id);
      return body && isDrivable(body);
    });
    if (this.predictedMount && isDrivable(this.predictedMount))
      ids.push(this.predictedMount.id, player.id);
    return ids;
  }
  private touchingIds(): Set<number> {
    const player = this.predicted;
    const touching = new Set<number>(player ? [player.parentId ?? player.id, player.id] : []);
    expandCoherentMembers(touching, this.published, this.scene);
    return touching;
  }
  presentationClock(presentationSeconds: number): CameraPresentationTime | null {
    const player = this.predicted;
    if (!this.scene || !player) return null;
    if (
      !this.active &&
      !(this.status === "ready" && this.drivenPresentationIds(player).length) &&
      !(this.status === "replaying" && this.lastPresentation.size)
    )
      return null;
    // Reconciliation may rebase the simulation tick in either direction. The
    // camera follows the displayed pose on the monotonic render clock instead.
    return { time: presentationSeconds, domain: this.clockEpoch };
  }
  private hasPrescribedMotion(id: number | undefined): boolean {
    const body = id === undefined ? undefined : this.published.get(id);
    return !!body && physicsBodyMotion(body) === "prescribed";
  }

  private hasPrescribedContact(player: Entity, anchor: number): boolean {
    const support = this.scene?.bodyState(player.parentId ?? player.id)?.supportId;
    return this.hasPrescribedMotion(support) || this.hasPrescribedMotion(anchor);
  }

  /** Nearby bodies approach predicted time; solved contacts share one pose transform. */
  presentEntities(alpha: number, buffered: readonly Entity[], presentationTime?: number): Entity[] {
    const player = this.predicted,
      scene = this.scene;
    const now = this.clock();
    const renderTime = presentationTime ?? now;
    // The scene is scratch during sliced replay. Hold committed display poses;
    // departing actors ease with the buffer while unrelated actors advance.
    if (this.status === "replaying")
      return this.nearbyPresentation.present(
        this.carriers.release(buffered, this.lastPresentation, this.published, alpha, now),
        this.lastPresentation,
        now,
        undefined,
        this.carriers.owns,
      );
    if (!player || !scene || this.status !== "ready") {
      this.lastPresentation.clear();
      this.nearbyPresentation.clear();
      this.carriers.clear();
      return [...buffered];
    }
    const local = new Set([player.id, player.parentId ?? player.id, ...this.coSeats.bodyIds()]);
    const component = this.active
      ? activePresentationIds(player, this.published, local)
      : new Set(this.drivenPresentationIds(player));
    if (component.size) expandCoherentMembers(component, this.published, scene);
    const releasing = this.carriers.release(buffered, component, this.published, alpha, now);
    const supports = movingSupportIds(local, this.published, scene);
    this.lastPresentation.clear();
    const touching = this.correctionMembers;
    const error = this.error();
    // A correction must not lift an entire contact stack off its solved floor.
    const floorSupported =
      component.size > 0 &&
      [...touching].some((id) => {
        const state = scene.bodyState(id);
        return state?.grounded && state.supportId === undefined;
      });
    const contactOffset = { ...error, z: floorSupported ? 0 : error.z };
    for (const entity of releasing) {
      if (!component.has(entity.id)) continue;
      const predicted = entity.id === player.id ? player : this.published.get(entity.id);
      if (!predicted) continue;
      const corrected = touching.has(entity.id);
      const carrierOffset = this.carriers.offset(predicted, now);
      const seatOffset = corrected ? undefined : this.coSeats.offset(entity.id, scene);
      const offset = carrierOffset ?? seatOffset ?? (corrected ? contactOffset : undefined);
      this.carriers.track(predicted, offset, supports.has(entity.id));
      const pose = samplePredictedPose(
        predicted,
        alpha,
        entity.id === player.id ? predicted.sprite : entity.sprite,
        offset,
      );
      this.lastPresentation.set(entity.id, this.vehicleRotation.apply(pose, renderTime));
    }
    const presented = this.nearbyPresentation.present(
      releasing,
      this.lastPresentation,
      now,
      {
        bodies: this.published,
        alpha,
        local,
        inContact: (id) => touching.has(id) || !!scene.contactIds(id)?.size,
      },
      this.carriers.owns,
    );
    return this.coSeats.presentRiders(presented, buffered, this.lastPresentation);
  }
  get player() {
    return this.predicted;
  }
  get presentationPlayer(): Entity | null {
    const player = this.predicted;
    if (!player) return null;
    const error = this.error(),
      previous = error;
    return {
      ...player,
      position: { wx: player.position.wx + error.x, wy: player.position.wy + error.y },
      prevPosition: {
        wx: (player.prevPosition ?? player.position).wx + previous.x,
        wy: (player.prevPosition ?? player.position).wy + previous.y,
      },
      wz: (player.wz ?? 0) + error.z,
      prevWz: (player.prevWz ?? player.wz ?? 0) + previous.z,
    };
  }
  get mount() {
    return this.predictedMount;
  }
  get mountId() {
    return this.predictedMount?.id ?? null;
  }
  get prevPosition(): PositionComponent {
    return this.predicted?.prevPosition ?? { wx: 0, wy: 0 };
  }
  get prevWz() {
    return this.predicted?.prevWz ?? 0;
  }
  get prevJumpZ() {
    return this.predicted?.prevJumpZ ?? 0;
  }
  get mountPrevHeading() {
    return this.predictedMount?.prevVehicleHeading;
  }
  get mountPrevPosition() {
    return this.predictedMount?.prevPosition ?? { wx: 0, wy: 0 };
  }
  get lastCorrection() {
    return this.correction;
  }
  /** Committed predicted body pose and its physics tick (multi-seat diagnostics). */
  publishedBody(id: number): { tick: number | undefined; body: Entity | undefined } {
    return { tick: this.publishedPhysicsTick, body: this.published.get(id) };
  }
  /** Start/reset an explicit work window, or stop and snapshot it (the default). */
  sampleWork(start = false) {
    return this.work.sample(start);
  }
  get lastReconcileDiagnostics() {
    return this.diagnostics;
  }
  get recoveryDiagnostics(): PredictionRecoveryDiagnostics {
    return {
      status: this.status,
      retainedInputs: this.inputHistory.length,
      retainedSeconds: this.inputHistory.length * PHYSICS_DT,
      discardedThroughSeq: this.discardedThroughSeq,
      replayStepsThisTick: this.lastReplaySteps,
      replayAck: this.replay?.request.ack,
    };
  }
}
