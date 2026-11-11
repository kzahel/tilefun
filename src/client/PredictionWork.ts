import type { PhysicsGeometry, PhysicsScene } from "../physics/PhysicsScene.js";
import type { MotionIntent } from "../physics/PhysicsState.js";

const empty = () => ({
  inputs: 0,
  reconciliations: 0,
  restores: 0,
  restoredBodies: 0,
  forwardSteps: 0,
  replaySteps: 0,
  worldSteps: 0,
  bodyReads: 0,
  motorUpdates: 0,
  wheelQueries: 0,
  geometryBuilds: 0,
  resets: 0,
  clears: 0,
});
export type PredictionWorkCounts = ReturnType<typeof empty>;

/** Opt-in work accounting, independent of scene tick/epoch resets. No clocks or
 * per-step records; incomplete/cancelled replay counts when its work executes. */
export class PredictionWork {
  private enabled = false;
  private counts = empty();

  /** true starts a fresh window; false stops it and returns an independent copy. */
  sample(start = false): PredictionWorkCounts {
    this.enabled = start;
    if (start) this.counts = empty();
    return { ...this.counts };
  }

  record(key: keyof PredictionWorkCounts, count = 1) {
    if (this.enabled) this.counts[key] += count;
  }

  step(
    scene: PhysicsScene,
    intents: ReadonlyMap<number, MotionIntent>,
    geometry: PhysicsGeometry,
    gravity: number,
    replay: boolean,
  ) {
    if (!this.enabled) {
      scene.step(intents, geometry, gravity);
      return;
    }
    const m = scene.metrics,
      steps = m.worldSteps,
      reads = m.bodyReads,
      motors = m.motorUpdates,
      wheels = m.wheelQueries,
      builds = m.geometryBuilds;
    scene.step(intents, geometry, gravity);
    this.counts[replay ? "replaySteps" : "forwardSteps"]++;
    this.counts.worldSteps += m.worldSteps - steps;
    this.counts.bodyReads += m.bodyReads - reads;
    this.counts.motorUpdates += m.motorUpdates - motors;
    this.counts.wheelQueries += m.wheelQueries - wheels;
    this.counts.geometryBuilds += m.geometryBuilds - builds;
  }
}
