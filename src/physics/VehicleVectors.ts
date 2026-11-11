import type RAPIER from "@dimforge/rapier3d-compat";

interface WheelImpulse {
  point: RAPIER.Vector;
  impulse: RAPIER.Vector;
  support?: RAPIER.RigidBody | undefined;
}
export class WheelImpulses {
  readonly values: WheelImpulse[] = [];
  private readonly slots: WheelImpulse[] = [];
  reset() {
    this.values.length = 0;
    for (const slot of this.slots) slot.support = undefined;
  }
  push(point: RAPIER.Vector, impulse: RAPIER.Vector, support: RAPIER.RigidBody | undefined) {
    let slot = this.slots[this.values.length];
    if (!slot) {
      slot = { point, impulse };
      this.slots.push(slot);
    }
    slot.point = point;
    slot.impulse = impulse;
    slot.support = support;
    this.values.push(slot);
  }
}

/** Chassis-local scratch, borrowed until that chassis prepares its next step.
 * Distinct slots preserve values while the other wheels/chassis are prepared. */
export class VehicleVectors {
  private readonly values: RAPIER.Vector[] = [];
  private used = 0;
  reset() {
    this.used = 0;
  }
  private next(x: number, y: number, z: number) {
    let out = this.values[this.used];
    if (!out) {
      out = { x, y, z };
      this.values.push(out);
    } else {
      out.x = x;
      out.y = y;
      out.z = z;
    }
    this.used++;
    return out;
  }
  add(a: RAPIER.Vector, b: RAPIER.Vector) {
    return this.next(a.x + b.x, a.y + b.y, a.z + b.z);
  }
  mul(a: RAPIER.Vector, n: number) {
    return this.next(a.x * n, a.y * n, a.z * n);
  }
  cross(a: RAPIER.Vector, b: RAPIER.Vector) {
    return this.next(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  }
  rotate(q: RAPIER.Rotation, v: RAPIER.Vector) {
    const tx = (q.y * v.z - q.z * v.y) * 2,
      ty = (q.z * v.x - q.x * v.z) * 2,
      tz = (q.x * v.y - q.y * v.x) * 2;
    // Keep the original cross/mul/add grouping, including its floating-point order.
    return this.next(
      v.x + (tx * q.w + (q.y * tz - q.z * ty)),
      v.y + (ty * q.w + (q.z * tx - q.x * tz)),
      v.z + (tz * q.w + (q.x * ty - q.y * tx)),
    );
  }
}
