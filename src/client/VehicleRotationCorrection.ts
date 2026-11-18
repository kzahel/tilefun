import type { Entity } from "../entities/Entity.js";
import {
  type BodyRotation,
  interpolateRotation,
  multiplyRotations,
  rotateBodyVector,
} from "../physics/BodyRotation.js";
import type { ReplayPose } from "./PredictionSnapshots.js";

const IDENTITY: BodyRotation = [0, 0, 0, 1];
const MIN_HALF_SINE = 0.00001;
const MAX_HALF_SINE = Math.sin(Math.PI / 8);
type Correction = { delta: BodyRotation; at: number } | { anchor: BodyRotation };

function rotationDelta(from: BodyRotation, to: BodyRotation): BodyRotation {
  const [x, y, z, w] = from;
  return multiplyRotations(to, [-x, -y, -z, w]);
}

function correctable(delta: BodyRotation): boolean {
  const sine = Math.hypot(delta[0], delta[1], delta[2]);
  // Ignore floating-point noise and let large orientation resets take effect immediately.
  return sine > MIN_HALF_SINE && sine < MAX_HALF_SINE;
}

/** Local drivers carry angular display error across replay, just as translation
 * is carried separately from the solved pose. All transforms are in world space. */
export class VehicleRotationCorrection {
  private readonly errors = new Map<number, Correction>();

  clear(): void {
    this.errors.clear();
  }

  reconcile(
    ids: readonly number[],
    before: ReadonlyMap<number, Entity>,
    after: ReadonlyMap<number, Entity>,
    matched: ReadonlyMap<number, ReplayPose> | undefined,
    drawn: ReadonlyMap<number, Entity>,
    now: number,
  ): void {
    for (const id of this.errors.keys()) if (!ids.includes(id)) this.errors.delete(id);
    for (const id of ids) {
      const previous = before.get(id);
      const body = after.get(id);
      const comparison =
        matched?.get(id) ??
        (body && {
          x: body.position.wx,
          y: body.position.wy,
          z: body.wz ?? 0,
        });
      const old = this.errors.get(id);
      this.errors.delete(id);
      if (!previous?.bodyRotation || !body?.bodyRotation || !comparison) continue;
      const travel = Math.hypot(
        previous.position.wx - comparison.x,
        previous.position.wy - comparison.y,
        (previous.wz ?? 0) - comparison.z,
      );
      if (travel >= 32) continue;
      const replayed = matched?.get(id)?.rotation;
      if (!replayed || (old && "anchor" in old)) {
        // If authority passed the comparison tick or replay held the last frame,
        // seed the correction against the first fractional sample actually drawn.
        const anchor = drawn.get(id)?.bodyRotation;
        if (anchor) this.errors.set(id, { anchor });
        continue;
      }
      const retained = old && "delta" in old ? this.decay(old, now) : IDENTITY;
      const delta = rotationDelta(replayed, multiplyRotations(retained, previous.bodyRotation));
      if (correctable(delta)) this.errors.set(id, { delta, at: now });
    }
  }

  private decay(error: { delta: BodyRotation; at: number }, now: number): BodyRotation {
    return interpolateRotation(
      IDENTITY,
      error.delta,
      Math.exp(-Math.max(0, now - error.at) / 0.06),
    );
  }

  /** Apply only to the borrowed presentation pose, after fixed-tick interpolation. */
  apply(pose: Entity, now: number): Entity {
    const error = this.errors.get(pose.id);
    if (!error || !pose.bodyRotation) return pose;
    const delta =
      "anchor" in error ? rotationDelta(pose.bodyRotation, error.anchor) : this.decay(error, now);
    if (!correctable(delta)) {
      this.errors.delete(pose.id);
      return pose;
    }
    if ("anchor" in error) this.errors.set(pose.id, { delta, at: now });
    const rotation = multiplyRotations(delta, pose.bodyRotation);
    pose.bodyRotation = pose.prevBodyRotation = rotation;
    if (pose.vehicleHeading !== undefined) {
      const nose = rotateBodyVector(rotation, 1, 0, 0);
      if (Math.hypot(nose.x, nose.y) > 0.001)
        pose.vehicleHeading = pose.prevVehicleHeading = Math.atan2(nose.y, nose.x);
    }
    return pose;
  }
}
