import type { Entity } from "../entities/Entity.js";
import type { BodyRotation } from "../physics/BodyRotation.js";
import {
  advancePresentationClock,
  type MotionSample,
  PRESENTATION_DELAY,
  type PresentationClock,
  recordMotionSample,
  sampleMotion,
} from "../rendering/PresentationTimeline.js";

const sameRotation = (a: BodyRotation, b: BodyRotation | undefined) =>
  !!b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];

/** The sampled pose is exactly the entity's committed pose and its previous
 * pose: the presented copy would equal the entity field for field, so the
 * entity itself is presented. Most of a resting crowd takes this path, which
 * saves copying every field of every entity on each frame. */
function atRest(e: Entity, pose: MotionSample): boolean {
  const prev = e.prevPosition;
  return (
    pose.x === e.position.wx &&
    pose.y === e.position.wy &&
    !!prev &&
    prev.wx === pose.x &&
    prev.wy === pose.y &&
    (e.wz === undefined || (pose.z === e.wz && e.prevWz === e.wz)) &&
    (e.jumpZ === undefined || (pose.jumpZ === e.jumpZ && e.prevJumpZ === e.jumpZ)) &&
    (e.vehicleHeading === undefined ||
      (pose.vehicleHeading ?? e.vehicleHeading) === e.vehicleHeading) &&
    (!pose.bodyRotation ||
      (sameRotation(pose.bodyRotation, e.bodyRotation) &&
        sameRotation(pose.bodyRotation, e.prevBodyRotation)))
  );
}

/** Replica-owned presentation history. Never changes committed physics poses. */
export class RemotePresentation {
  private history = new Map<number, MotionSample[]>();
  private clock: PresentationClock | null = null;
  private latest: number | null = null;
  private first: number | null = null;
  /** Effective source time of borrowed poses; initial history holds its first sample. */
  get sampledTime(): number | undefined {
    return this.clock && this.first !== null ? Math.max(this.first, this.clock.time) : undefined;
  }
  private wasPaused = false;

  record(entities: readonly Entity[], time: number, receivedAt: number) {
    if (this.latest !== null && time < this.latest) this.clear();
    this.first ??= time;
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
          ...(e.vehicleHeading === undefined ? {} : { vehicleHeading: e.vehicleHeading }),
          ...(e.bodyRotation ? { bodyRotation: e.bodyRotation } : {}),
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
    } else this.clock = advancePresentationClock(this.clock, now, this.latest);
    this.wasPaused = paused;
    const time = paused ? this.latest : this.clock.time;
    return entities.map((e) => {
      const pose = sampleMotion(this.history.get(e.id) ?? [], time);
      if (!pose || atRest(e, pose)) return e;
      const position = { wx: pose.x, wy: pose.y };
      return {
        ...e,
        ...(e.vehicleHeading === undefined
          ? {}
          : { vehicleHeading: pose.vehicleHeading ?? e.vehicleHeading }),
        ...(pose.bodyRotation
          ? { bodyRotation: pose.bodyRotation, prevBodyRotation: pose.bodyRotation }
          : {}),
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
    this.latest = this.first = null;
    this.wasPaused = false;
  }
}
