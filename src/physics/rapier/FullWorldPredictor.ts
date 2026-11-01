import { INPUT_HISTORY_SECONDS } from "../../client/PredictionLimits.js";
import { POSE_STRIDE } from "./PhysicsProtocol.js";
import { NEUTRAL, type PhysicsSeat } from "./PhysicsScenarios.js";
import { type FullPhysicsState, type PhysicsInput, RapierWorld } from "./RapierWorld.js";

export interface PairSnapshot {
  state: FullPhysicsState;
  inputs: [PhysicsInput, PhysicsInput];
  ack: [number, number];
}
const HISTORY = INPUT_HISTORY_SECONDS * 60;
export const MAX_FULL_REPLAY_STEPS = 32;
export function poseDistance(a: Float32Array, b: Float32Array): number {
  let distance = 0;
  const others = new Map<number, number>();
  for (let i = 0; i < b.length; i += POSE_STRIDE) others.set(b[i] ?? 0, i);
  for (let i = 0; i < a.length; i += POSE_STRIDE) {
    const j = others.get(a[i] ?? 0);
    if (j === undefined) return Infinity;
    distance = Math.max(
      distance,
      Math.hypot(
        (a[i + 1] ?? 0) - (b[j + 1] ?? 0),
        (a[i + 2] ?? 0) - (b[j + 2] ?? 0),
        (a[i + 3] ?? 0) - (b[j + 3] ?? 0),
      ),
    );
  }
  return a.length === b.length ? distance : Infinity;
}
/** Complete small-world reference: all bodies remain dynamic during replay.
 * Histories compare matching ticks; future remote inputs remain unknown. */
export class FullWorldPredictor {
  readonly world = new RapierWorld(2, 0);
  private inputs = new Map<number, PhysicsInput>();
  private poses = new Map<number, Float32Array>();
  private latest: PairSnapshot | undefined;
  private remote: PhysicsInput = NEUTRAL;
  diagnostics = {
    correction: 0,
    maxCorrection: 0,
    replayMs: 0,
    replaySteps: 0,
    reconciles: 0,
    recoveries: 0,
    snapshotBytes: 0,
    comparedTick: 0,
    pending: 0,
  };
  constructor(readonly seat: PhysicsSeat) {}
  get tick() {
    return this.world.motor().tick;
  }
  get ready() {
    return !!this.latest;
  }
  advance(tick: number, input: PhysicsInput) {
    if (!this.latest || tick !== this.tick + 1)
      throw Error("Prediction requires consecutive ticks");
    this.inputs.set(tick, { ...input });
    const pair: [PhysicsInput, PhysicsInput] =
      this.seat === 0 ? [input, this.remote] : [this.remote, input];
    this.world.step(...pair);
    this.poses.set(tick, this.world.poses());
    for (const key of this.inputs.keys()) if (key < tick - HISTORY) this.inputs.delete(key);
    for (const key of this.poses.keys()) if (key < tick - HISTORY) this.poses.delete(key);
    this.diagnostics.pending = Math.max(0, tick - this.latest.ack[this.seat]);
  }
  receive(snapshot: PairSnapshot) {
    const tick = snapshot.state.motors[0]?.tick ?? 0;
    if (this.latest && tick <= (this.latest.state.motors[0]?.tick ?? 0)) return;
    const began = performance.now();
    const target = Math.max(tick, this.tick);
    const saved = this.poses.get(tick);
    this.world.restoreFull(snapshot.state);
    if (saved) {
      const error = poseDistance(saved, this.world.poses());
      this.diagnostics.correction = error;
      this.diagnostics.maxCorrection = Math.max(this.diagnostics.maxCorrection, error);
      this.diagnostics.comparedTick = tick;
    }
    this.latest = snapshot;
    this.remote = snapshot.inputs[this.seat === 0 ? 1 : 0];
    // A long gap cannot monopolize rendering. Explicitly recover to authority;
    // the normal interactive lead is much smaller than this bound.
    const gap = target - tick;
    if (gap > MAX_FULL_REPLAY_STEPS || (gap > 0 && !this.inputs.has(tick + 1))) {
      this.inputs.clear();
      this.poses.clear();
      this.diagnostics.recoveries++;
    } else {
      this.poses.set(tick, this.world.poses());
      for (let step = tick + 1; step <= target; step++) {
        const input = this.inputs.get(step) ?? snapshot.inputs[this.seat];
        this.world.step(
          ...(this.seat === 0 ? ([input, this.remote] as const) : ([this.remote, input] as const)),
        );
        this.poses.set(step, this.world.poses());
      }
    }
    for (const key of this.inputs.keys()) if (key <= tick) this.inputs.delete(key);
    this.diagnostics.replaySteps = this.tick - tick;
    this.diagnostics.replayMs = performance.now() - began;
    this.diagnostics.snapshotBytes = snapshot.state.bytes.byteLength;
    this.diagnostics.reconciles++;
    this.diagnostics.pending = Math.max(0, this.tick - snapshot.ack[this.seat]);
  }
  dispose() {
    this.world.dispose();
    this.inputs.clear();
    this.poses.clear();
  }
}
