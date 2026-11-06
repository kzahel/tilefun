import { getEntityAABB } from "../entities/collision.js";
import type { Entity, PositionComponent } from "../entities/Entity.js";
import { updatePlayerSpriteFromInput } from "../entities/Player.js";
import type { Prop } from "../entities/Prop.js";
import { tickSpriteAnimation } from "../entities/spriteAnimation.js";
import { interpolateRotation } from "../physics/BodyRotation.js";
import { getGravityScale } from "../physics/Gravity.js";
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
import { interpolateHeading } from "../rendering/PresentationTimeline.js";
import type { Movement } from "../shared/Movement.js";
import type { World } from "../world/World.js";

const MAX_HISTORY = 120;
const REPLAY_STEPS_PER_UPDATE = 8;
const REPLAY_MS_PER_UPDATE = 2; // Injected clock: simulated time slices by step count alone.
export interface StoredInput {
  seq: number;
  tick: number;
  movement: Movement;
}
export interface ReconcileTiming {
  serverTick?: number;
  physics?: PhysicsState;
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
}
interface Request {
  player: Entity;
  ack: number;
  state: PhysicsState;
  entities: readonly Entity[];
  world: World;
  props: readonly Prop[];
}
interface Replay {
  request: Request;
  physicsInputOffset: number;
  inputIndex: number;
  jumpHeld: boolean;
  heldMovement?: Movement;
  steps: number;
  ms: number;
  before: Entity;
  beforeInputTick: number;
  beforePhysicsTick: number;
  comparison?: { player: Entity; bodies: Map<number, ReplayPose> };
  pastError: number | undefined;
  inputs: StoredInput[];
}
interface ReplayPose {
  x: number;
  y: number;
  z: number;
  prevX: number;
  prevY: number;
  prevZ: number;
}
function replayPose(entity: Entity): ReplayPose {
  return {
    x: entity.position.wx,
    y: entity.position.wy,
    z: entity.wz ?? 0,
    prevX: entity.prevPosition?.wx ?? entity.position.wx,
    prevY: entity.prevPosition?.wy ?? entity.position.wy,
    prevZ: entity.prevWz ?? entity.wz ?? 0,
  };
}
function clone(entity: Entity): Entity {
  return {
    ...entity,
    position: { ...entity.position },
    velocity: entity.velocity && { ...entity.velocity },
    collider: entity.collider && { ...entity.collider },
    sprite: entity.sprite && { ...entity.sprite },
    wanderAI: entity.wanderAI && { ...entity.wanderAI },
    ...(entity.tags ? { tags: new Set(entity.tags) } : {}),
  };
}
function distance(a: Entity, b: Entity) {
  return Math.hypot(
    a.position.wx - b.position.wx,
    a.position.wy - b.position.wy,
    (a.wz ?? 0) - (b.wz ?? 0),
  );
}

/** One bounded private copy of the ordinary fixed-step kernel. Inputs address
 * local ticks; an acknowledged snapshot anchors that clock to an authority tick.
 * Replay never integrates once per packet or mutates replica entities.
 */
export class PlayerPredictor {
  private scene: PhysicsScene | undefined;
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
  private latestSeq = 0;
  private discardedThroughSeq: number | undefined;
  private receivedAck = -1;
  private receivedServerTick = -1;
  private epoch: number | undefined;
  private queued: Request | undefined;
  private replay: Replay | undefined;
  private status: PredictionRecoveryDiagnostics["status"] = "waiting";
  private lastReplaySteps = 0;
  private stateHistory = new Map<number, Entity>();
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
  private readonly lastPresentation = new Map<number, Entity>();
  private readonly groupErrors = new Map<number, { x: number; y: number; z: number; at: number }>();
  private readonly releasedGroups = new Map<
    number,
    { x: number; y: number; z: number; at: number; duration: number }
  >();
  private diagnostics: ReconcileDiagnostics | null = null;

  constructor(
    private readonly gravity = getGravityScale,
    private readonly clock = () => performance.now() / 1000,
  ) {
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
    this.releasedGroups.clear();
    this.groupErrors.clear();
    this.activeUntil = -Infinity;
    this.diagnostics = null;
  }
  clearPredicted(): void {
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
    this.queued = this.replay = undefined;
    this.geometry = this.geometryWorld = this.geometryProps = undefined;
    this.stateHistory.clear();
    this.retiredEpochs.clear();
    this.correctionAnchor = undefined;
    this.correctionMembers.clear();
    this.lastPresentation.clear();
    this.releasedGroups.clear();
    this.groupErrors.clear();
    this.status = "waiting";
  }
  storeInput(seq: number, movement: Movement, _dt: number): void {
    if (!this.predicted || seq <= Math.max(this.latestSeq, this.receivedAck)) return;
    this.latestSeq = seq;
    this.inputTick++;
    const length = movement.relativeDriving ? 1 : Math.max(1, Math.hypot(movement.dx, movement.dy));
    this.inputHistory.push({
      seq,
      tick: this.inputTick,
      movement: { ...movement, dx: movement.dx / length, dy: movement.dy / length },
    });
    const submitted = this.inputHistory[this.inputHistory.length - 1];
    if (this.replay && submitted) this.replay.inputs.push(submitted);
    if (movement.dx || movement.dy || movement.jump || movement.jumpPressed)
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
    entities: readonly Entity[],
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
    if (this.epoch !== undefined && this.epoch !== state.epoch) {
      this.retiredEpochs.add(this.epoch);
      if (this.retiredEpochs.size > 8) {
        const oldest = this.retiredEpochs.values().next().value;
        if (oldest !== undefined) this.retiredEpochs.delete(oldest);
      }
      this.reset(
        player,
        entities.find((e) => e.id === player.parentId),
      );
    }
    this.epoch = state.epoch;
    this.receivedAck = ack;
    this.receivedServerTick = timing?.serverTick ?? this.receivedServerTick + 1;
    const acknowledged = [...this.inputHistory].reverse().find((input) => input.seq <= ack);
    if (acknowledged) this.ackInputTick = acknowledged.tick;
    this.inputHistory = this.inputHistory.filter((input) => input.seq > ack);
    const request: Request = {
      player: clone(player),
      ack,
      state,
      entities: state.bodies
        .map((body) => entities.find((e) => e.id === body.id))
        .filter((e): e is Entity => !!e)
        .map(clone),
      world,
      props,
    };
    // Retain the parent's replicated seat metadata even though it has no body.
    this.riderLift = (player.wz ?? 0) - (entities.find((e) => e.id === player.parentId)?.wz ?? 0);
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
    this.geometry = {
      getCollision: (x, y) => world.getCollisionIfLoaded(x, y),
      getHeight: (x, y) => world.getHeightAt(x, y),
      queryProps: (bounds) =>
        props.filter((prop) => {
          // The common compiler clips exact wall/surface shapes. This is only a
          // conservative broad filter and includes long authored bridge sections.
          const c = prop.collider;
          if (!c || prop.walls?.length) return true;
          const x = prop.position.wx + c.offsetX,
            y = prop.position.wy + c.offsetY;
          return (
            x + c.width / 2 >= bounds.left &&
            x - c.width / 2 <= bounds.right &&
            y + c.height / 2 >= bounds.top &&
            y - c.height / 2 <= bounds.bottom
          );
        }),
      geometryVersion: (cx, cy) => {
        const chunk = world.getChunkIfLoaded(cx, cy);
        return {
          identity: chunk,
          revision: `${chunk?.revision}:${chunk?.visualRevision}:${chunk?.physicsRevision}:${this.propsRevision}`,
        };
      },
    };
  }
  private startReplay() {
    const request = this.queued,
      scene = this.scene;
    if (!request || !scene || !this.predicted) return;
    this.queued = undefined;
    const { state } = request;
    const anchorId = request.player.parentId ?? request.player.id;
    const missing =
      state.bodies.length !== request.entities.length ||
      !state.bodies.some((b) => b.id === anchorId);
    if (
      state.omitted ||
      state.bodies.length > MAX_PREDICTION_BODIES ||
      missing ||
      (this.discardedThroughSeq !== undefined && request.ack < this.discardedThroughSeq)
    ) {
      this.predicted = clone(request.player);
      this.predictedMount = request.entities.find((e) => e.id === request.player.parentId) ?? null;
      this.published.clear();
      this.publishedPhysicsTick = undefined;
      this.correctionAnchor = undefined;
      this.correctionMembers.clear();
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
      overdue = this.inputHistory.some((input) => input.tick <= this.appliedInputTick),
      past = this.stateHistory.get(state.tick);
    const pastError = past ? distance(past, request.player) : undefined;
    this.bindGeometry(request.world, request.props);
    this.bodies = new Map(request.entities.map((e) => [e.id, e]));
    const kinds = new Map(state.bodies.map((b) => [b.id, b.kind]));
    scene.synchronize([...this.bodies.values()], kinds);
    scene.restore(state);
    this.motorIntents = new Map(
      state.bodies.map((body) => [
        body.id,
        {
          vx: body.desiredVx,
          vy: body.desiredVy,
          jump: body.jumpHeld,
          ...(body.controlUntil === undefined ? {} : { controlUntil: body.controlUntil }),
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
      physicsInputOffset:
        this.ackInputTick > this.appliedInputTick
          ? state.tick - this.ackInputTick
          : Math.max(beforePhysicsTick, state.tick + Number(overdue)) - this.appliedInputTick,
      inputIndex: 0,
      jumpHeld: state.bodies.find((body) => body.id === anchorId)?.jumpHeld ?? false,
      steps: 0,
      ms: 0,
      before,
      beforeInputTick: this.appliedInputTick,
      beforePhysicsTick,
      pastError,
      inputs: [...this.inputHistory],
    };
    this.status = "replaying";
    if (scene.physicsTick === beforePhysicsTick) this.captureReplayComparison(this.replay);
    if (scene.physicsTick >= this.replayTarget(this.replay)) this.drainReplay();
  }
  private replayTarget(job: Replay): number {
    return Math.max(job.request.state.tick, this.inputTick + job.physicsInputOffset);
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
      job.inputIndex++;
    }
    if (movement) {
      // Coalesce overdue axes, retaining jump edges just like authority admission.
      job.heldMovement = { ...movement, jumpPressed: false };
      this.step({ ...movement, jumpPressed }, job.request.player);
    } else {
      // No new local command is due: continue the snapshot's held motor targets.
      scene.step(this.motorIntents, this.geometry, this.gravity());
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
  private drainReplay() {
    const job = this.replay,
      scene = this.scene;
    if (!job || !scene || !this.geometry) return;
    const start = this.clock() * 1000;
    let steps = 0;
    while (
      scene.physicsTick < this.replayTarget(job) &&
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
    if (scene.physicsTick < this.replayTarget(job)) return;
    this.replay = undefined;
    this.status = "ready";
    this.appliedInputTick = this.inputTick;
    const beforeBodies = this.published,
      beforeMembers = this.correctionMembers,
      oldError = this.error();
    this.publish(job.request.player);
    this.reconcileGroupErrors(beforeBodies, job.comparison?.bodies);
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
    if (this.published.get(anchor)?.physicsGroupId !== undefined && compared) {
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
    };
  }
  private step(movement: Movement, player: Entity) {
    const scene = this.scene;
    if (!scene || !this.geometry) return;
    const controlled = this.bodies.get(player.parentId ?? player.id);
    if (!controlled) return;
    const intent = controlled.type.startsWith("vehicle-v1:")
      ? vehicleMotionIntent(controlled, movement)
      : playerMotionIntent(movement);
    this.motorIntents.set(controlled.id, {
      ...intent,
      controlUntil: scene.physicsTick + CONTROL_HOLD_TICKS,
    });
    scene.step(this.motorIntents, this.geometry, this.gravity());
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
      if (this.published.get(incoming)?.physicsGroupId === undefined)
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
    if (this.scene) {
      this.stateHistory.set(this.scene.physicsTick, clone(this.predicted));
      while (this.stateHistory.size > MAX_HISTORY) {
        const first = this.stateHistory.keys().next().value;
        if (first !== undefined) this.stateHistory.delete(first);
      }
    }
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
      this.appliedInputTick = this.inputTick;
      const submitted = this.inputHistory[this.inputHistory.length - 1];
      this.step(submitted?.movement ?? movement, this.predicted);
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
          this.scene?.bodyState(anchor ?? -1)?.supportId !== undefined))
    );
  }
  private touchingIds(): Set<number> {
    const player = this.predicted;
    const touching = new Set<number>(player ? [player.parentId ?? player.id, player.id] : []);
    this.expandCoherentMembers(touching);
    return touching;
  }
  /** A prescribed group shares both predicted time and correction. Proximity alone
   * still cannot transfer a player's correction to unrelated parked bodies. */
  private expandCoherentMembers(members: Set<number>) {
    const groups = new Map<number, number[]>();
    for (const e of this.published.values()) {
      if (e.physicsGroupId === undefined) continue;
      const ids = groups.get(e.physicsGroupId) ?? [];
      ids.push(e.id);
      groups.set(e.physicsGroupId, ids);
    }
    for (const id of members) {
      for (const neighbor of this.scene?.contactIds(id) ?? []) members.add(neighbor);
      const group = this.published.get(id)?.physicsGroupId;
      if (group !== undefined) for (const member of groups.get(group) ?? []) members.add(member);
    }
  }
  presentationClock(presentationSeconds: number): CameraPresentationTime | null {
    if (!this.active || !this.scene) return null;
    // Reconciliation may rebase the simulation tick in either direction. The
    // camera follows the displayed pose on the monotonic render clock instead.
    return { time: presentationSeconds, domain: this.clockEpoch };
  }
  private groupError(id: number) {
    const error = this.groupErrors.get(id);
    const decay = error ? Math.exp(-Math.max(0, this.clock() - error.at) / 0.06) : 0;
    return { x: (error?.x ?? 0) * decay, y: (error?.y ?? 0) * decay, z: (error?.z ?? 0) * decay };
  }
  /** Prescribed bodies have their own matching-tick correction, independent of
   * rider input/contact errors. Every member shares the same group transform. */
  private reconcileGroupErrors(
    before: ReadonlyMap<number, Entity>,
    compared?: ReadonlyMap<number, ReplayPose>,
  ) {
    const groups = new Map<number, Entity>();
    for (const e of this.published.values())
      if (e.physicsGroupId !== undefined)
        groups.set(e.physicsGroupId, this.published.get(e.physicsGroupId) ?? e);
    for (const id of this.groupErrors.keys()) if (!groups.has(id)) this.groupErrors.delete(id);
    for (const [id, anchor] of groups) {
      const previous = before.get(anchor.id),
        matching = compared?.get(anchor.id),
        retained = this.groupError(id);
      if (!previous || !matching) {
        this.groupErrors.delete(id);
        continue;
      }
      const error = {
        x: previous.position.wx - matching.x + retained.x,
        y: previous.position.wy - matching.y + retained.y,
        z: (previous.wz ?? 0) - matching.z + retained.z,
      };
      this.groupErrors.set(id, {
        ...(Math.hypot(error.x, error.y, error.z) < 32 ? error : { x: 0, y: 0, z: 0 }),
        at: this.clock(),
      });
    }
  }
  /** A departing prescribed group eases from predicted time back to the remote
   * buffer as one translation. Sampling its current predicted interval first
   * avoids losing a tick of real travel at the handoff. No physics pose changes. */
  private releasePresentationGroups(
    buffered: readonly Entity[],
    selected: { has(id: number): boolean },
    alpha: number,
  ): readonly Entity[] {
    let needed = this.releasedGroups.size > 0;
    for (const e of this.lastPresentation.values()) needed ||= e.physicsGroupId !== undefined;
    if (!needed) return buffered;
    const now = this.clock(),
      present = new Set<number>();
    let released: Entity[] | undefined;
    for (const [index, e] of buffered.entries()) {
      const group = e.physicsGroupId;
      if (group === undefined) continue;
      present.add(group);
      if (selected.has(e.id)) {
        this.releasedGroups.delete(group);
        continue;
      }
      let shift = this.releasedGroups.get(group);
      const previous = this.lastPresentation.get(e.id),
        predicted = this.published.get(e.id);
      if (!shift && previous && predicted) {
        const p = predicted.prevPosition ?? predicted.position,
          c = this.groupError(group),
          vx = (predicted.position.wx - p.wx) / PHYSICS_DT,
          vy = (predicted.position.wy - p.wy) / PHYSICS_DT,
          x = p.wx + vx * PHYSICS_DT * alpha + c.x - e.position.wx,
          y = p.wy + vy * PHYSICS_DT * alpha + c.y - e.position.wy,
          z = (predicted.prevWz ?? predicted.wz ?? 0) * (1 - alpha) + (predicted.wz ?? 0) * alpha,
          dz = z + c.z - (e.wz ?? 0);
        // A moving group's buffer trails by its travel over Worker/buffer delays (within
        // the 2s input history); only the remainder is a relocation. The explained
        // lead dissolves at no more than half the group's speed.
        const lead = Math.min(2, Math.max(0, (x * vx + y * vy) / (vx * vx + vy * vy || 1)));
        shift = { x, y, z: dz, at: now, duration: 0.2 + 3 * lead };
        if (Math.hypot(x - vx * lead, y - vy * lead, dz) < 32)
          this.releasedGroups.set(group, shift);
        else shift = undefined; // An explicit relocation must remain a relocation.
      }
      if (!shift) continue;
      const t = Math.min(1, Math.max(0, (now - shift.at) / shift.duration)),
        factor = 1 - t * t * (3 - 2 * t);
      if (!factor) {
        this.releasedGroups.delete(group);
        continue;
      }
      const position = {
          wx: e.position.wx + shift.x * factor,
          wy: e.position.wy + shift.y * factor,
        },
        z = (e.wz ?? 0) + shift.z * factor;
      released ??= [...buffered];
      released[index] = { ...e, position, prevPosition: position, wz: z, prevWz: z };
    }
    for (const id of this.releasedGroups.keys())
      if (!present.has(id)) this.releasedGroups.delete(id);
    return released ?? buffered;
  }
  /** Nearby bodies share predicted time; only actual contacts share correction. */
  presentEntities(alpha: number, buffered: readonly Entity[]): Entity[] {
    const player = this.predicted,
      scene = this.scene;
    // The scene is scratch state while replay is sliced across updates. Retain
    // the last committed contact presentation, never switch to older replicas
    // or expose partially replayed contacts. Unrelated actors remain buffered;
    // groups released to the buffer keep easing instead of jumping back.
    if (this.status === "replaying" && this.lastPresentation.size)
      return this.releasePresentationGroups(buffered, this.lastPresentation, alpha).map(
        (entity) => this.lastPresentation.get(entity.id) ?? entity,
      );
    if (!player || !scene || this.status !== "ready" || !this.active) {
      const released = this.releasePresentationGroups(buffered, new Set(), alpha);
      this.lastPresentation.clear();
      return [...released];
    }
    const root = player.parentId ?? player.id,
      component = new Set<number>([root, player.id]);
    const anchor = this.published.get(root) ?? player;
    if (anchor.collider) {
      const a = getEntityAABB(anchor.position, anchor.collider);
      for (const entity of this.published.values()) {
        if (!entity.collider) continue;
        const b = getEntityAABB(entity.position, entity.collider);
        const dx = Math.max(a.left - b.right, b.left - a.right, 0),
          dy = Math.max(a.top - b.bottom, b.top - a.bottom, 0);
        if (Math.hypot(dx, dy) <= 24) component.add(entity.id);
      }
    }
    this.expandCoherentMembers(component);
    const releasing = this.releasePresentationGroups(buffered, component, alpha);
    this.lastPresentation.clear();
    const touching = this.correctionMembers;
    const error = this.error();
    // A correction must not lift an entire contact stack off its solved floor.
    let floorSupported = false;
    for (const id of touching) {
      const state = scene.bodyState(id);
      if (state?.grounded && state.supportId === undefined) {
        floorSupported = true;
        break;
      }
    }
    return releasing.map((entity) => {
      if (!component.has(entity.id)) return entity;
      const predicted = entity.id === player.id ? player : this.published.get(entity.id);
      if (!predicted) return entity;
      // Proximity selects a coherent simulation tick, not a physical connection.
      // Transferring the player's correction here moves parked cars before touch.
      const corrected = touching.has(entity.id);
      const groupOffset =
        predicted.physicsGroupId === undefined
          ? undefined
          : this.groupError(predicted.physicsGroupId);
      const displayOffset = groupOffset ?? (corrected ? error : { x: 0, y: 0, z: 0 });
      const prev = predicted.prevPosition ?? predicted.position;
      const position = {
        wx: prev.wx + (predicted.position.wx - prev.wx) * alpha + displayOffset.x,
        wy: prev.wy + (predicted.position.wy - prev.wy) * alpha + displayOffset.y,
      };
      const z =
        (predicted.prevWz ?? predicted.wz ?? 0) * (1 - alpha) +
        (predicted.wz ?? 0) * alpha +
        (groupOffset ? groupOffset.z : corrected && !floorSupported ? error.z : 0);
      const presented = {
        ...predicted,
        sprite: entity.id === player.id ? predicted.sprite : entity.sprite,
        position,
        prevPosition: position,
        wz: z,
        prevWz: z,
        ...(predicted.bodyRotation
          ? (() => {
              const bodyRotation = interpolateRotation(
                predicted.prevBodyRotation ?? predicted.bodyRotation,
                predicted.bodyRotation,
                alpha,
              );
              return { bodyRotation, prevBodyRotation: bodyRotation };
            })()
          : {}),
        ...(predicted.vehicleHeading === undefined
          ? {}
          : {
              vehicleHeading: interpolateHeading(
                predicted.prevVehicleHeading ?? predicted.vehicleHeading,
                predicted.vehicleHeading,
                alpha,
              ),
            }),
      };
      this.lastPresentation.set(entity.id, presented);
      return presented;
    });
  }
  samplePresentationPlayer(
    alpha: number,
    displayed: readonly Entity[],
    _sourceSeconds?: number,
  ): Entity | null {
    return (
      this.presentEntities(alpha, displayed).find((e) => e.id === this.predicted?.id) ??
      this.presentationPlayer
    );
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
