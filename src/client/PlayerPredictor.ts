import { getEntityAABB } from "../entities/collision.js";
import type { Entity, PositionComponent } from "../entities/Entity.js";
import { updatePlayerSpriteFromInput } from "../entities/Player.js";
import type { Prop } from "../entities/Prop.js";
import { tickSpriteAnimation } from "../entities/spriteAnimation.js";
import type { Movement } from "../input/ActionManager.js";
import { getGravityScale } from "../physics/Gravity.js";
import { PHYSICS_DT } from "../physics/PhysicsDefaults.js";
import { type MotionIntent, type PhysicsGeometry, PhysicsScene } from "../physics/PhysicsScene.js";
import { MAX_PREDICTION_BODIES, type PhysicsState } from "../physics/PhysicsState.js";
import {
  CONTROL_HOLD_TICKS,
  playerMotionIntent,
  vehicleMotionIntent,
} from "../physics/PlayerControls.js";
import type { CameraPresentationTime } from "../rendering/CameraFollow.js";
import { interpolateHeading } from "../rendering/PresentationTimeline.js";
import type { World } from "../world/World.js";

const MAX_HISTORY = 120;
const REPLAY_STEPS_PER_UPDATE = 8;
const REPLAY_MS_PER_UPDATE = 2;
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
  /** Current-pose correction after restoring and replaying, not past-tick error. */
  resimPosErr: number;
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
  nextInputTick: number;
  steps: number;
  ms: number;
  before: Entity;
  pastError: number | undefined;
  inputs: StoredInput[];
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
    this.motorIntents.clear();
    this.inputHistory = [];
    this.queued = this.replay = undefined;
    this.geometry = this.geometryWorld = this.geometryProps = undefined;
    this.stateHistory.clear();
    this.retiredEpochs.clear();
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
        status: this.status,
      };
      return;
    }
    const before = clone(this.predicted),
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
        },
      ]),
    );
    this.replay = {
      request,
      nextInputTick: this.ackInputTick + 1,
      steps: 0,
      ms: 0,
      before,
      pastError,
      inputs: [...this.inputHistory],
    };
    this.status = "replaying";
    if (this.replay.nextInputTick > this.inputTick) this.drainReplay();
  }
  private drainReplay() {
    const job = this.replay,
      scene = this.scene;
    if (!job || !scene || !this.geometry) return;
    const start = performance.now();
    let steps = 0;
    while (
      job.nextInputTick <= this.inputTick &&
      steps < REPLAY_STEPS_PER_UPDATE &&
      (steps === 0 || performance.now() - start < REPLAY_MS_PER_UPDATE)
    ) {
      const sample = job.inputs.find((input) => input.tick === job.nextInputTick);
      if (!sample) {
        this.status = "history-gap";
        this.replay = undefined;
        return;
      }
      this.step(sample.movement, job.request.player);
      job.nextInputTick++;
      job.steps++;
      steps++;
    }
    this.lastReplaySteps += steps;
    job.ms += performance.now() - start;
    if (job.nextInputTick <= this.inputTick) return;
    this.replay = undefined;
    this.status = "ready";
    this.appliedInputTick = this.inputTick;
    this.publish(job.request.player);
    const after = this.predicted;
    if (!after) return;
    this.correction = {
      wx: job.before.position.wx - after.position.wx,
      wy: job.before.position.wy - after.position.wy,
      wz: (job.before.wz ?? 0) - (after.wz ?? 0),
      vx: (job.before.velocity?.vx ?? 0) - (after.velocity?.vx ?? 0),
      vy: (job.before.velocity?.vy ?? 0) - (after.velocity?.vy ?? 0),
      jumpVZ: (job.before.jumpVZ ?? 0) - (after.jumpVZ ?? 0),
    };
    const oldError = this.error();
    const offset = {
      x: this.correction.wx + oldError.x,
      y: this.correction.wy + oldError.y,
      z: this.correction.wz + oldError.z,
    };
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
      resimPosErr: distance(job.before, after),
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
  private publish(authority: Entity) {
    const previous = this.predicted;
    const body = this.bodies.get(authority.id);
    const parent = this.bodies.get(authority.parentId ?? -1);
    this.predicted = body ? clone(body) : clone(authority);
    if (parent) {
      this.predicted.position = {
        wx: parent.position.wx + (authority.localOffsetX ?? 0),
        wy: parent.position.wy + (authority.localOffsetY ?? 0),
      };
      this.predicted.wz = (parent.wz ?? 0) + this.riderLift;
    }
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
  presentationClock(alpha: number): CameraPresentationTime | null {
    if (!this.active || !this.scene) return null;
    return { time: (this.scene.physicsTick - 1 + alpha) * PHYSICS_DT, domain: this.clockEpoch };
  }
  /** One rigid display correction and one tick for the local contact component. */
  presentEntities(alpha: number, buffered: readonly Entity[]): Entity[] {
    const player = this.predicted,
      scene = this.scene;
    if (!player || !scene || this.status !== "ready" || !this.active) return [...buffered];
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
    for (const id of component)
      for (const neighbor of scene.contactIds(id) ?? []) component.add(neighbor);
    const error = this.error();
    return buffered.map((entity) => {
      if (!component.has(entity.id)) return entity;
      const predicted = entity.id === player.id ? player : this.published.get(entity.id);
      if (!predicted) return entity;
      const prev = predicted.prevPosition ?? predicted.position;
      const position = {
        wx: prev.wx + (predicted.position.wx - prev.wx) * alpha + error.x,
        wy: prev.wy + (predicted.position.wy - prev.wy) * alpha + error.y,
      };
      const z =
        (predicted.prevWz ?? predicted.wz ?? 0) * (1 - alpha) +
        (predicted.wz ?? 0) * alpha +
        error.z;
      return {
        ...predicted,
        sprite: entity.id === player.id ? predicted.sprite : entity.sprite,
        position,
        prevPosition: position,
        wz: z,
        prevWz: z,
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
