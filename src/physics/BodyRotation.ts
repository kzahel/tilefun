/** Game coordinates are X/Y ground and Z up. Rapier uses X/Z ground and Y up. */
export type BodyRotation = readonly [number, number, number, number];
export type AngularVelocity = readonly [number, number, number];
export const yawRotation = (heading: number): BodyRotation => [
  0,
  0,
  Math.sin(heading / 2),
  Math.cos(heading / 2),
];
export const rapierRotation = (q: BodyRotation) => ({ x: -q[0], y: -q[2], z: -q[1], w: q[3] });
export const worldRotation = (q: { x: number; y: number; z: number; w: number }): BodyRotation => [
  -q.x,
  -q.z,
  -q.y,
  q.w,
];
export function rotationsEqual(a?: BodyRotation, b?: BodyRotation): boolean {
  return a === b || (!!a && !!b && a.every((n, i) => n === b[i]));
}
export function rotateBodyVector(q: BodyRotation, x: number, y: number, z: number) {
  const tx = 2 * (q[1] * z - q[2] * y),
    ty = 2 * (q[2] * x - q[0] * z),
    tz = 2 * (q[0] * y - q[1] * x);
  return {
    x: x + q[3] * tx + q[1] * tz - q[2] * ty,
    y: y + q[3] * ty + q[2] * tx - q[0] * tz,
    z: z + q[3] * tz + q[0] * ty - q[1] * tx,
  };
}
/** Shortest spherical arc; never interpolate quaternion components independently. */
export function interpolateRotation(a: BodyRotation, b: BodyRotation, t: number): BodyRotation {
  let dot = a.reduce((sum, n, i) => sum + n * (b[i] ?? 0), 0);
  const sign = dot < 0 ? -1 : 1;
  dot = Math.min(1, Math.abs(dot));
  const theta = Math.acos(dot),
    sine = Math.sin(theta);
  const u = sine > 0.001 ? Math.sin((1 - t) * theta) / sine : 1 - t,
    v = (sine > 0.001 ? Math.sin(t * theta) / sine : t) * sign;
  const q = a.map((n, i) => u * n + v * (b[i] ?? 0));
  const length = Math.hypot(...q);
  return [(q[0] ?? 0) / length, (q[1] ?? 0) / length, (q[2] ?? 0) / length, (q[3] ?? 1) / length];
}
