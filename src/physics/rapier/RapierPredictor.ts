import {
  INPUT_BUFFER_SIZE,
  INPUT_HISTORY_SECONDS,
  REPLAY_TIME_BUDGET_SECONDS,
} from "../../client/PredictionLimits.js";
import { INPUT_BACKLOG_STEP_BUDGET } from "../PlayerMovement.js";
import {
  PHYSICS_DT,
  type PhysicsInput,
  type PhysicsMotorState,
  RapierWorld,
} from "./RapierWorld.js";

export interface RapierAuthorityState {
  ack: number;
  motor: PhysicsMotorState;
  poses: Float32Array;
}
interface Command {
  seq: number;
  input: PhysicsInput;
  sentAt: number;
}
export interface RapierPredictionDiagnostics {
  status: "waiting" | "ready" | "replaying" | "history-gap";
  pending: number;
  ack: number;
  ackAgeMs: number;
  correctionMetres: number;
  relativeCorrectionMetres: number;
  maxCorrectionMetres: number;
  replayMs: number;
  replaySteps: number;
  collisionCount: number;
  staleFrames: number;
  completedReplayMs: number;
  reconciles: number;
  omittedBodies: number;
}

/** Shared fixed-step command replay with nearby collision residency. All steps
 * use RapierWorld; this class owns history/commit policy, never contact rules. */
export class RapierPredictor {
  private live: RapierWorld | undefined;
  private scratch: RapierWorld | undefined;
  private history: Command[] = [];
  private queued: RapierAuthorityState | undefined;
  private job:
    | { state: RapierAuthorityState; commands: Command[]; cursor: number; cpuMs: number }
    | undefined;
  private lostThrough = -1;
  private receivedTick = -1;
  private receivedEpoch = -1;
  private receivedAck = -1;
  readonly diagnostics: RapierPredictionDiagnostics = {
    status: "waiting",
    pending: 0,
    ack: 0,
    ackAgeMs: 0,
    correctionMetres: 0,
    relativeCorrectionMetres: 0,
    maxCorrectionMetres: 0,
    replayMs: 0,
    replaySteps: 0,
    collisionCount: 0,
    staleFrames: 0,
    completedReplayMs: 0,
    reconciles: 0,
    omittedBodies: 0,
  };

  constructor(readonly sections: number) {}
  get motor() {
    return this.live?.motor();
  }
  get poses() {
    return this.live?.poses();
  }
  get platformY() {
    return this.live?.platform.translation().y;
  }

  receive(state: RapierAuthorityState, now: number): void {
    if (
      state.motor.epoch < this.receivedEpoch ||
      (state.motor.epoch === this.receivedEpoch &&
        (state.motor.tick <= this.receivedTick || state.ack < this.receivedAck))
    ) {
      this.diagnostics.staleFrames++;
      return;
    }
    const reset = state.motor.epoch !== this.receivedEpoch;
    this.receivedEpoch = state.motor.epoch;
    this.receivedTick = state.motor.tick;
    this.receivedAck = state.ack;
    const acknowledged = this.history.find((command) => command.seq === state.ack);
    if (acknowledged) this.diagnostics.ackAgeMs = now - acknowledged.sentAt;
    this.history = this.history.filter((command) => command.seq > state.ack);
    this.diagnostics.ack = state.ack;
    if (reset) {
      this.job = undefined;
      this.history = [];
      this.lostThrough = -1;
      this.queued = undefined;
      this.live = this.restore(this.live, state);
      this.diagnostics.status = "ready";
    } else this.queued = state;
    this.diagnostics.pending = this.history.length;
    this.diagnostics.collisionCount = this.live?.world.colliders.len() ?? 0;
  }

  submit(seq: number, input: PhysicsInput, now: number): void {
    if (!this.live) return;
    const command = { seq, input: { ...input }, sentAt: now };
    this.history.push(command);
    this.job?.commands.push(command);
    const limit = Math.min(INPUT_BUFFER_SIZE, Math.floor(INPUT_HISTORY_SECONDS / PHYSICS_DT));
    while (this.history.length > limit) {
      this.lostThrough = this.history.shift()?.seq ?? this.lostThrough;
      this.job = undefined;
    }
    if (this.lostThrough > this.receivedAck) this.diagnostics.status = "history-gap";
    this.live.step(input);
    const motor = this.live.motor();
    if (!this.live.contains(motor))
      this.live = this.restore(this.live, {
        ack: this.receivedAck,
        motor,
        poses: this.live.poses(),
      });
    this.diagnostics.pending = this.history.length;
    this.diagnostics.collisionCount = this.live.world.colliders.len();
  }

  private restore(world: RapierWorld | undefined, state: RapierAuthorityState): RapierWorld {
    if (!world?.contains(state.motor)) {
      world?.dispose();
      world = new RapierWorld(this.sections, 0, true, state.motor);
    }
    world.restore(state.motor, state.poses);
    return world;
  }

  /** Budgeted scratch replay; display continues from live prediction until the
   * entire retained command suffix has been replayed and can be swapped atomically. */
  drain(
    stepBudget = INPUT_BACKLOG_STEP_BUDGET,
    timeBudgetMs = REPLAY_TIME_BUDGET_SECONDS * 1000,
  ): void {
    const began = performance.now();
    let steps = 0;
    if (this.lostThrough > this.receivedAck) return;
    if (!this.job && this.queued) {
      const state = this.queued;
      this.queued = undefined;
      this.scratch = this.restore(this.scratch, state);
      this.job = {
        state,
        commands: this.history.filter((command) => command.seq > state.ack),
        cursor: 0,
        cpuMs: 0,
      };
    }
    const job = this.job,
      scratch = this.scratch;
    if (job && scratch) {
      while (
        job.cursor < job.commands.length &&
        steps < stepBudget &&
        performance.now() - began < timeBudgetMs
      ) {
        const command = job.commands[job.cursor++];
        if (!command) break;
        scratch.step(command.input);
        steps++;
      }
      if (job.cursor === job.commands.length) {
        this.diagnostics.completedReplayMs = job.cpuMs + performance.now() - began;
        this.diagnostics.reconciles++;
        const before = this.live?.motor(),
          after = scratch.motor();
        if (before) {
          const correction = Math.hypot(before.x - after.x, before.y - after.y, before.z - after.z);
          this.diagnostics.correctionMetres = correction;
          this.diagnostics.maxCorrectionMetres = Math.max(
            this.diagnostics.maxCorrectionMetres,
            correction,
          );
          this.diagnostics.relativeCorrectionMetres =
            before.supportY !== null && after.supportY !== null
              ? Math.hypot(
                  before.x - after.x,
                  before.y - before.supportY - (after.y - after.supportY),
                  before.z - after.z,
                )
              : correction;
        }
        this.scratch = this.live;
        this.live = scratch;
        this.job = undefined;
        this.diagnostics.status = "ready";
      } else {
        job.cpuMs += performance.now() - began;
        this.diagnostics.status = "replaying";
      }
    }
    this.diagnostics.replayMs = performance.now() - began;
    this.diagnostics.replaySteps = steps;
    this.diagnostics.collisionCount = this.live?.world.colliders.len() ?? 0;
    this.diagnostics.omittedBodies = this.live?.omittedProxies ?? 0;
  }

  dispose(): void {
    this.live?.dispose();
    this.scratch?.dispose();
    this.live = this.scratch = undefined;
    this.history = [];
    this.job = this.queued = undefined;
  }
}
