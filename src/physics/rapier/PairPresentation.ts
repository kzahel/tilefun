import { Quaternion } from "three";
import type { FullWorldCorrection } from "./FullWorldPredictor.js";
import { POSE_STRIDE } from "./PhysicsProtocol.js";
import type { PhysicsSeat } from "./PhysicsScenarios.js";

export const CORRECTION_DECAY_SECONDS = 0.12;
export type RemotePresentation = "buffered" | "predicted";
interface Offset {
  x: number;
  y: number;
  z: number;
  rotation: Quaternion;
}
const row = (poses: Float32Array, id: number) =>
  poses.findIndex((value, i) => i % POSE_STRIDE === 0 && value === id);
const rotation = (poses: Float32Array, i: number) =>
  new Quaternion(poses[i + 4], poses[i + 5], poses[i + 6], poses[i + 7]).normalize();

/** Presentation only. Neither displayed positions nor offsets enter physics.
 * One clock drives playback/decay in visual and headless scenarios alike. */
export class PairPresentation {
  remoteMode: RemotePresentation = "buffered";
  smooth = true;
  private offsets = new Map<number, Offset>();
  private history: { tick: number; poses: Float32Array }[] = [];
  private lastBase: Float32Array | undefined;
  private lastOutput: Float32Array | undefined;
  private buffered = false;
  diagnostics = {
    remoteSource: "predicted",
    remoteDisplayTick: 0,
    maxOffset: 0,
    remoteOffset: 0,
    remoteStep: 0,
    maxRemoteStep: 0,
    historyFrames: 0,
  };
  constructor(
    readonly seat: PhysicsSeat,
    readonly bufferTicks: number,
  ) {}
  private get remoteId() {
    return this.seat === 0 ? -1 : 0;
  }
  acceptAuthority(tick: number, poses: Float32Array) {
    if (tick <= (this.history.at(-1)?.tick ?? -1)) return;
    this.history.push({ tick, poses: poses.slice() });
    while (this.history.length > 48) this.history.shift();
    this.diagnostics.historyFrames = this.history.length;
  }
  advance(seconds: number) {
    const decay = Math.exp(-Math.max(0, seconds) / CORRECTION_DECAY_SECONDS);
    if (!this.smooth) this.offsets.clear();
    for (const [id, offset] of this.offsets) {
      offset.x *= decay;
      offset.y *= decay;
      offset.z *= decay;
      offset.rotation.slerp(new Quaternion(), 1 - decay);
      if (
        Math.hypot(offset.x, offset.y, offset.z) < 0.00001 &&
        offset.rotation.angleTo(new Quaternion()) < 0.00001
      )
        this.offsets.delete(id);
    }
  }
  private preserve(id: number, before: Float32Array, after: Float32Array) {
    const a = row(before, id),
      b = row(after, id);
    if (a < 0 || b < 0 || !this.smooth) return;
    const offset = this.offsets.get(id) ?? { x: 0, y: 0, z: 0, rotation: new Quaternion() };
    offset.x += (before[a + 1] ?? 0) - (after[b + 1] ?? 0);
    offset.y += (before[a + 2] ?? 0) - (after[b + 2] ?? 0);
    offset.z += (before[a + 3] ?? 0) - (after[b + 3] ?? 0);
    offset.rotation.multiply(rotation(before, a)).multiply(rotation(after, b).invert()).normalize();
    // Explicit fences reset instead of smoothing an unbounded teleport.
    if (Math.hypot(offset.x, offset.y, offset.z) > 4) this.offsets.delete(id);
    else this.offsets.set(id, offset);
  }
  correct(correction: FullWorldCorrection) {
    if (correction.reset) {
      this.clear();
      return;
    }
    if (!this.smooth) {
      this.offsets.clear();
      return;
    }
    for (let i = 0; i < correction.after.length; i += POSE_STRIDE) {
      const id = correction.after[i] ?? 0;
      if (id !== this.remoteId || !this.buffered)
        this.preserve(id, correction.before, correction.after);
    }
    // The raw correction was already preserved above. A source handoff must
    // start from the corrected base rather than compensating that delta twice.
    if (!this.buffered && this.lastBase) {
      const a = row(this.lastBase, this.remoteId),
        b = row(correction.after, this.remoteId);
      if (a >= 0 && b >= 0) this.lastBase.set(correction.after.subarray(b, b + POSE_STRIDE), a);
    }
  }
  clear() {
    this.offsets.clear();
    this.history = [];
    this.lastBase = undefined;
    this.lastOutput = undefined;
    this.buffered = false;
    this.diagnostics.maxOffset = 0;
    this.diagnostics.remoteOffset = 0;
    this.diagnostics.remoteStep = 0;
    this.diagnostics.historyFrames = 0;
  }
  private bufferedPose(tick: number): Float32Array | undefined {
    const first = this.history[0];
    if (!first) return;
    let a = first,
      b = first;
    for (const frame of this.history) {
      b = frame;
      if (frame.tick >= tick) break;
      a = frame;
    }
    const ai = row(a.poses, this.remoteId),
      bi = row(b.poses, this.remoteId);
    if (ai < 0 || bi < 0) return;
    const t = Math.max(0, Math.min(1, (tick - a.tick) / Math.max(1, b.tick - a.tick)));
    const pose = b.poses.slice(bi, bi + POSE_STRIDE);
    for (let i = 1; i <= 3; i++)
      pose[i] = (a.poses[ai + i] ?? 0) * (1 - t) + (b.poses[bi + i] ?? 0) * t;
    rotation(a.poses, ai).slerp(rotation(b.poses, bi), t).toArray(pose, 4);
    return pose;
  }
  /** Conservative proximity graph through the other capsule, cube or lift.
   * This bounded fixture gate is not a general engine contact-island solver. */
  private interacting(poses: Float32Array, margin: number) {
    const ownId = this.seat === 0 ? 0 : -1;
    const reached = new Set([ownId]);
    const radius = (id: number) => (id === 1 ? 2.13 : id >= 2 ? 0.57 : 0.28);
    const halfHeight = (id: number) => (id === 1 ? 0.1 : id >= 2 ? 0.4 : 0.63);
    for (let pass = 0; pass < poses.length / POSE_STRIDE; pass++)
      for (let a = 0; a < poses.length; a += POSE_STRIDE) {
        const id = poses[a] ?? 0;
        if (!reached.has(id)) continue;
        for (let b = 0; b < poses.length; b += POSE_STRIDE) {
          const other = poses[b] ?? 0;
          if (
            Math.abs((poses[a + 2] ?? 0) - (poses[b + 2] ?? 0)) >
            halfHeight(id) + halfHeight(other) + 0.5
          )
            continue;
          if (
            Math.hypot(
              (poses[a + 1] ?? 0) - (poses[b + 1] ?? 0),
              (poses[a + 3] ?? 0) - (poses[b + 3] ?? 0),
            ) <=
            radius(id) + radius(other) + margin
          )
            reached.add(other);
        }
      }
    return reached.has(this.remoteId);
  }
  sample(
    raw: Float32Array,
    coordinatorTick: number,
    predictedTick = coordinatorTick,
  ): Float32Array {
    if (!this.smooth) this.offsets.clear();
    const base = raw.slice(),
      index = row(base, this.remoteId);
    const targetTick = Math.max(0, coordinatorTick - this.bufferTicks);
    const remote = this.bufferedPose(targetTick);
    const candidate = base.slice();
    if (remote && index >= 0) candidate.set(remote, index);
    const margin = this.buffered ? 0.85 : 1.25;
    const buffered =
      this.remoteMode === "buffered" &&
      remote !== undefined &&
      !this.interacting(raw, margin) &&
      !this.interacting(candidate, margin);
    if (buffered && remote && index >= 0) base.set(remote, index);
    if (buffered !== this.buffered && this.lastBase)
      this.preserve(this.remoteId, this.lastBase, base);
    this.buffered = buffered;
    this.lastBase = base.slice();
    const output = base.slice();
    this.diagnostics.maxOffset = 0;
    this.diagnostics.remoteOffset = 0;
    for (let i = 0; i < output.length; i += POSE_STRIDE) {
      const id = output[i] ?? 0,
        offset = this.offsets.get(id);
      if (!offset) continue;
      output[i + 1] = (output[i + 1] ?? 0) + offset.x;
      output[i + 2] = (output[i + 2] ?? 0) + offset.y;
      output[i + 3] = (output[i + 3] ?? 0) + offset.z;
      offset.rotation
        .clone()
        .multiply(rotation(base, i))
        .toArray(output, i + 4);
      const length = Math.hypot(offset.x, offset.y, offset.z);
      this.diagnostics.maxOffset = Math.max(this.diagnostics.maxOffset, length);
      if (id === this.remoteId) this.diagnostics.remoteOffset = length;
    }
    const previousIndex = this.lastOutput ? row(this.lastOutput, this.remoteId) : -1;
    this.diagnostics.remoteStep =
      this.lastOutput && previousIndex >= 0 && index >= 0
        ? Math.hypot(
            (output[index + 1] ?? 0) - (this.lastOutput[previousIndex + 1] ?? 0),
            (output[index + 2] ?? 0) - (this.lastOutput[previousIndex + 2] ?? 0),
            (output[index + 3] ?? 0) - (this.lastOutput[previousIndex + 3] ?? 0),
          )
        : 0;
    this.diagnostics.maxRemoteStep = Math.max(
      this.diagnostics.maxRemoteStep,
      this.diagnostics.remoteStep,
    );
    this.diagnostics.remoteSource = buffered ? "buffered" : "predicted";
    this.diagnostics.remoteDisplayTick = buffered ? targetTick : predictedTick;
    this.lastOutput = output.slice();
    return output;
  }
}
