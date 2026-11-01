import { Quaternion, Vector3 } from "three";
import type { FullWorldCorrection } from "./FullWorldPredictor.js";
import { POSE_STRIDE } from "./PhysicsProtocol.js";
import type { PhysicsSeat } from "./PhysicsScenarios.js";
import type { PhysicsInput } from "./RapierWorld.js";

export const CORRECTION_DECAY_SECONDS = 0.12;
export const MAX_CORRECTION_SPEED = 4.5;
export type RemotePresentation = "buffered" | "predicted";
interface Offset {
  x: number;
  y: number;
  z: number;
  rotation: Quaternion;
}
interface Group {
  key: string;
  ids: number[];
  anchor: number;
  buffered: boolean;
  offset: Offset;
}
const row = (poses: Float32Array, id: number) =>
  poses.findIndex((value, i) => i % POSE_STRIDE === 0 && value === id);
const rotation = (poses: Float32Array, i: number) =>
  new Quaternion(poses[i + 4], poses[i + 5], poses[i + 6], poses[i + 7]).normalize();
const position = (poses: Float32Array, i: number) =>
  new Vector3(poses[i + 1], poses[i + 2], poses[i + 3]);
const identity = (): Offset => ({ x: 0, y: 0, z: 0, rotation: new Quaternion() });

/** Display-only contact components: a group shares one timeline and rigid
 * correction transform. Idle clients can observe one coherent buffered scene;
 * recent local input predicts its interaction component immediately. */
export class PairPresentation {
  remoteMode: RemotePresentation = "buffered";
  smooth = true;
  private groups: Group[] = [];
  private history: { tick: number; poses: Float32Array }[] = [];
  private lastOutput: Float32Array | undefined;
  private lastRaw: Float32Array | undefined;
  private lastOwnActivityTick = -Infinity;
  diagnostics = {
    remoteSource: "buffered",
    ownSource: "buffered",
    cubeSource: "buffered",
    remoteDisplayTick: 0,
    cubeDisplayTick: 0,
    maxOffset: 0,
    remoteOffset: 0,
    remoteStep: 0,
    maxRemoteStep: 0,
    historyFrames: 0,
    correctionReleaseSpeed: 0,
    maxCorrectionReleaseSpeed: 0,
    predictedGroups: 0,
    bufferedGroups: 0,
    groupChanges: 0,
  };
  constructor(
    readonly seat: PhysicsSeat,
    readonly bufferTicks: number,
  ) {}
  private get ownId() {
    return this.seat === 0 ? 0 : -1;
  }
  private get remoteId() {
    return this.seat === 0 ? -1 : 0;
  }
  noteInput(tick: number, input: PhysicsInput) {
    if (input.x || input.z || input.jump) this.lastOwnActivityTick = tick;
  }
  acceptAuthority(tick: number, poses: Float32Array) {
    if (tick <= (this.history.at(-1)?.tick ?? -1)) return;
    this.history.push({ tick, poses: poses.slice() });
    while (this.history.length > 48) this.history.shift();
    this.diagnostics.historyFrames = this.history.length;
  }
  advance(seconds: number) {
    const elapsed = Math.max(0, seconds);
    if (!this.smooth) for (const group of this.groups) group.offset = identity();
    let largest = 0;
    for (const { offset } of this.groups)
      largest = Math.max(largest, Math.hypot(offset.x, offset.y, offset.z));
    const decay = Math.max(
      Math.exp(-elapsed / CORRECTION_DECAY_SECONDS),
      largest > 0 ? 1 - (MAX_CORRECTION_SPEED * elapsed) / largest : 0,
    );
    this.diagnostics.correctionReleaseSpeed = elapsed > 0 ? (largest * (1 - decay)) / elapsed : 0;
    this.diagnostics.maxCorrectionReleaseSpeed = Math.max(
      this.diagnostics.maxCorrectionReleaseSpeed,
      this.diagnostics.correctionReleaseSpeed,
    );
    for (const { offset } of this.groups) {
      offset.x *= decay;
      offset.y *= decay;
      offset.z *= decay;
      offset.rotation.slerp(new Quaternion(), 1 - decay);
    }
  }
  private preserve(offset: Offset, anchor: number, before: Float32Array, after: Float32Array) {
    const a = row(before, anchor),
      b = row(after, anchor);
    if (a < 0 || b < 0 || !this.smooth) return;
    offset.x += (before[a + 1] ?? 0) - (after[b + 1] ?? 0);
    offset.y += (before[a + 2] ?? 0) - (after[b + 2] ?? 0);
    offset.z += (before[a + 3] ?? 0) - (after[b + 3] ?? 0);
    offset.rotation.multiply(rotation(before, a)).multiply(rotation(after, b).invert()).normalize();
    if (Math.hypot(offset.x, offset.y, offset.z) > 4) Object.assign(offset, identity());
  }
  correct(correction: FullWorldCorrection) {
    if (correction.reset) {
      this.clear();
      return;
    }
    for (const group of this.groups) {
      if (!this.smooth) group.offset = identity();
      else if (!group.buffered)
        this.preserve(group.offset, group.anchor, correction.before, correction.after);
    }
    // Keep the cached preceding physical pose on the corrected branch, so a
    // local source/group handoff can preserve fresh input motion separately.
    if (this.lastRaw)
      for (let i = 0; i < this.lastRaw.length; i += POSE_STRIDE) {
        const id = this.lastRaw[i] ?? 0,
          a = row(correction.before, id),
          b = row(correction.after, id);
        if (a < 0 || b < 0) continue;
        for (let k = 1; k <= 3; k++)
          this.lastRaw[i + k] =
            (this.lastRaw[i + k] ?? 0) +
            (correction.after[b + k] ?? 0) -
            (correction.before[a + k] ?? 0);
      }
  }
  clear() {
    this.groups = [];
    this.history = [];
    this.lastOutput = undefined;
    this.lastRaw = undefined;
    // Clock/history fences discard old activity too; ordinary authority frames do not.
    this.lastOwnActivityTick = -Infinity;
    this.diagnostics.maxOffset = 0;
    this.diagnostics.remoteOffset = 0;
    this.diagnostics.remoteStep = 0;
    this.diagnostics.historyFrames = 0;
    this.diagnostics.correctionReleaseSpeed = 0;
  }
  private bufferedScene(tick: number) {
    const first = this.history[0];
    if (!first) return undefined;
    let a = first,
      b = first;
    for (const frame of this.history) {
      b = frame;
      if (frame.tick >= tick) break;
      a = frame;
    }
    const t = Math.max(0, Math.min(1, (tick - a.tick) / Math.max(1, b.tick - a.tick)));
    const output = b.poses.slice();
    for (let i = 0; i < output.length; i += POSE_STRIDE) {
      const j = row(a.poses, output[i] ?? 0);
      if (j < 0) continue;
      for (let k = 1; k <= 3; k++)
        output[i + k] = (a.poses[j + k] ?? 0) * (1 - t) + (b.poses[i + k] ?? 0) * t;
      rotation(a.poses, j)
        .slerp(rotation(b.poses, i), t)
        .toArray(output, i + 4);
    }
    return output;
  }
  /** Conservative bounded-fixture contact graph, unioned across both timelines.
   * Hysteresis keeps a recently connected component together while it separates. */
  private components(raw: Float32Array, buffered: Float32Array | undefined) {
    const ids = Array.from(
      { length: raw.length / POSE_STRIDE },
      (_, i) => raw[i * POSE_STRIDE] ?? 0,
    );
    const sets = ids.map((id) => new Set([id]));
    const radius = (id: number) => (id === 1 ? 2.13 : id >= 2 ? 0.57 : 0.28);
    const height = (id: number) => (id === 1 ? 0.1 : id >= 2 ? 0.4 : 0.63);
    const touches = (poses: Float32Array, a: number, b: number, margin: number) => {
      const i = row(poses, a),
        j = row(poses, b);
      return (
        i >= 0 &&
        j >= 0 &&
        Math.abs((poses[i + 2] ?? 0) - (poses[j + 2] ?? 0)) <= height(a) + height(b) + 0.5 &&
        Math.hypot(
          (poses[i + 1] ?? 0) - (poses[j + 1] ?? 0),
          (poses[i + 3] ?? 0) - (poses[j + 3] ?? 0),
        ) <=
          radius(a) + radius(b) + margin
      );
    };
    for (const a of ids)
      for (const b of ids) {
        const prior = this.groups.some((group) => group.ids.includes(a) && group.ids.includes(b));
        const margin = prior ? 1.25 : 0.85;
        if (!touches(raw, a, b, margin) && !(buffered && touches(buffered, a, b, margin))) continue;
        const ai = sets.findIndex((set) => set.has(a)),
          bi = sets.findIndex((set) => set.has(b));
        if (ai === bi || ai < 0 || bi < 0) continue;
        const merged = new Set([...(sets[ai] ?? []), ...(sets[bi] ?? [])]);
        sets[ai] = merged;
        sets.splice(bi, 1);
      }
    return sets.map((set) => [...set].sort((a, b) => a - b));
  }
  sample(
    raw: Float32Array,
    coordinatorTick: number,
    predictedTick = coordinatorTick,
    localAirborne = false,
  ) {
    const targetTick = Math.max(0, coordinatorTick - this.bufferTicks);
    const buffered = this.bufferedScene(targetTick);
    // Stay interactive through the input/confirmation/display tail. Releasing a
    // button must not switch back to a past frame that still contains movement.
    if (localAirborne) this.lastOwnActivityTick = Math.max(this.lastOwnActivityTick, predictedTick);
    const localActive = predictedTick - this.lastOwnActivityTick <= this.bufferTicks * 2 + 4;
    const base = raw.slice();
    const groups = this.components(raw, buffered).map((ids): Group => {
      const key = ids.join(",");
      const anchor = ids.includes(this.ownId)
        ? this.ownId
        : ids.includes(this.remoteId)
          ? this.remoteId
          : (ids[0] ?? 0);
      const useBuffer =
        this.remoteMode === "buffered" &&
        buffered !== undefined &&
        !(localActive && ids.includes(this.ownId));
      if (useBuffer && buffered)
        for (const id of ids) {
          const i = row(base, id),
            j = row(buffered, id);
          if (i >= 0 && j >= 0) base.set(buffered.subarray(j, j + POSE_STRIDE), i);
        }
      const prior = this.groups.find(
        (group) => group.key === key && group.buffered === useBuffer && group.anchor === anchor,
      );
      if (prior) return { ...prior, offset: this.smooth ? prior.offset : identity() };
      const group = { key, ids, anchor, buffered: useBuffer, offset: identity() };
      if (this.lastOutput) {
        this.preserve(group.offset, anchor, this.lastOutput, base);
        if (this.smooth && localActive && anchor === this.ownId && this.lastRaw) {
          const a = row(raw, anchor),
            b = row(this.lastRaw, anchor);
          if (a >= 0 && b >= 0) {
            const motion = position(raw, a).sub(position(this.lastRaw, b));
            group.offset.x += motion.x;
            group.offset.y += motion.y;
            group.offset.z += motion.z;
          }
        }
        this.diagnostics.groupChanges++;
      }
      return group;
    });
    this.groups = groups;
    const output = base.slice();
    this.diagnostics.maxOffset = 0;
    this.diagnostics.remoteOffset = 0;
    this.diagnostics.cubeSource = "absent";
    this.diagnostics.cubeDisplayTick = -1;
    for (const group of groups) {
      const anchorIndex = row(base, group.anchor),
        origin = position(base, anchorIndex);
      const offset = group.offset;
      for (const id of group.ids) {
        const i = row(base, id);
        const p = position(base, i)
          .sub(origin)
          .applyQuaternion(offset.rotation)
          .add(origin)
          .add(new Vector3(offset.x, offset.y, offset.z));
        output.set([p.x, p.y, p.z], i + 1);
        offset.rotation
          .clone()
          .multiply(rotation(base, i))
          .toArray(output, i + 4);
        const source = group.buffered ? "buffered" : "predicted",
          tick = group.buffered ? targetTick : predictedTick;
        if (id === this.ownId) this.diagnostics.ownSource = source;
        if (id === this.remoteId) {
          this.diagnostics.remoteSource = source;
          this.diagnostics.remoteDisplayTick = tick;
          this.diagnostics.remoteOffset = Math.hypot(offset.x, offset.y, offset.z);
        }
        if (id === 2) {
          this.diagnostics.cubeSource = source;
          this.diagnostics.cubeDisplayTick = tick;
        }
      }
      this.diagnostics.maxOffset = Math.max(
        this.diagnostics.maxOffset,
        Math.hypot(offset.x, offset.y, offset.z),
      );
    }
    this.diagnostics.bufferedGroups = groups.filter((group) => group.buffered).length;
    this.diagnostics.predictedGroups = groups.length - this.diagnostics.bufferedGroups;
    const i = row(output, this.remoteId),
      j = this.lastOutput ? row(this.lastOutput, this.remoteId) : -1;
    this.diagnostics.remoteStep =
      this.lastOutput && i >= 0 && j >= 0
        ? position(output, i).distanceTo(position(this.lastOutput, j))
        : 0;
    this.diagnostics.maxRemoteStep = Math.max(
      this.diagnostics.maxRemoteStep,
      this.diagnostics.remoteStep,
    );
    this.lastOutput = output.slice();
    this.lastRaw = raw.slice();
    return output;
  }
}
