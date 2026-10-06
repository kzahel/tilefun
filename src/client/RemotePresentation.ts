import type { Entity } from "../entities/Entity.js";
import {
  advancePresentationClock,
  type MotionSample,
  PRESENTATION_DELAY,
  type PresentationClock,
  recordMotionSample,
  sampleMotion,
} from "../rendering/PresentationTimeline.js";

/** Replica-owned presentation history. Never changes committed physics poses. */
export class RemotePresentation {
  private history = new Map<number, MotionSample[]>();
  private clock: PresentationClock | null = null;
  private latest: number | null = null;
  private wasPaused = false;
  private rate = 1;

  setRate(rate: number, now: number) {
    if (!Number.isFinite(rate) || rate < 0 || rate === this.rate) return;
    if (this.clock && this.latest !== null) {
      const state = advancePresentationClock(this.clock, now, this.latest, this.rate);
      this.clock = {
        localOrigin: now,
        sourceOrigin: state.time + PRESENTATION_DELAY,
        time: state.time,
      };
    }
    this.rate = rate;
  }

  record(entities: readonly Entity[], time: number, receivedAt: number) {
    if (this.latest !== null && time < this.latest) this.clear();
    this.latest = time;
    this.clock ??= { localOrigin: receivedAt, sourceOrigin: time, time: time - PRESENTATION_DELAY };
    const ids = new Set(entities.map((e) => e.id));
    for (const id of this.history.keys()) if (!ids.has(id)) this.history.delete(id);
    for (const e of entities)
      this.history.set(
        e.id,
        recordMotionSample(this.history.get(e.id) ?? [], {
          time,
          x: e.position.wx,
          y: e.position.wy,
          z: e.wz ?? 0,
          jumpZ: e.jumpZ ?? 0,
        }),
      );
  }

  sample(entities: readonly Entity[], now: number, paused = false): Entity[] {
    // Loading renders are not source-clock samples. The first authority record
    // establishes the epoch, however long asset/world preparation has taken.
    if (this.latest === null) return [...entities];
    if (paused || this.wasPaused || !this.clock) {
      // Resume from the frozen current pose, with no hidden-wall-time debt.
      this.clock = {
        localOrigin: now,
        sourceOrigin: this.latest + PRESENTATION_DELAY,
        time: this.latest,
      };
    } else this.clock = advancePresentationClock(this.clock, now, this.latest, this.rate);
    this.wasPaused = paused;
    const time = paused ? this.latest : this.clock.time;
    return entities.map((e) => {
      const pose = sampleMotion(this.history.get(e.id) ?? [], time);
      if (!pose) return e;
      const position = { wx: pose.x, wy: pose.y };
      return {
        ...e,
        position,
        prevPosition: position,
        ...(e.wz === undefined ? {} : { wz: pose.z, prevWz: pose.z }),
        ...(e.jumpZ === undefined ? {} : { jumpZ: pose.jumpZ, prevJumpZ: pose.jumpZ }),
      };
    });
  }

  resetClock() {
    this.clock = null;
  }
  clear() {
    this.history.clear();
    this.clock = null;
    this.latest = null;
    this.wasPaused = false;
  }
}
