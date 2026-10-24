import type { AABB } from "../entities/collision.js";

/** Upright rigid body. XY orientation is independent of its enclosing query box. */
export interface OrientedBox {
  x: number;
  y: number;
  angle: number;
  halfLength: number;
  halfWidth: number;
  low: number;
  high: number;
}
const EPSILON = 1e-7;
const axes = (a: OrientedBox, b: OrientedBox): [number, number][] => [
  [Math.cos(a.angle), Math.sin(a.angle)],
  [-Math.sin(a.angle), Math.cos(a.angle)],
  [Math.cos(b.angle), Math.sin(b.angle)],
  [-Math.sin(b.angle), Math.cos(b.angle)],
];
function radius(a: OrientedBox, x: number, y: number): number {
  const c = Math.cos(a.angle),
    s = Math.sin(a.angle);
  return a.halfLength * Math.abs(x * c + y * s) + a.halfWidth * Math.abs(-x * s + y * c);
}
export function boxBounds(a: OrientedBox): AABB {
  const x = radius(a, 1, 0),
    y = radius(a, 0, 1);
  return { left: a.x - x, right: a.x + x, top: a.y - y, bottom: a.y + y };
}
export function axisBox(bounds: AABB, low: number, high: number): OrientedBox {
  return {
    x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2,
    angle: 0,
    halfLength: (bounds.right - bounds.left) / 2,
    halfWidth: (bounds.bottom - bounds.top) / 2,
    low,
    high,
  };
}
/** Signed minimum separating-axis translation; zero means touching. */
export function boxDepth(a: OrientedBox, b: OrientedBox, horizontalOnly = false): number {
  let depth = horizontalOnly ? Infinity : Math.min(a.high - b.low, b.high - a.low);
  for (const [x, y] of axes(a, b))
    depth = Math.min(
      depth,
      radius(a, x, y) + radius(b, x, y) - Math.abs((a.x - b.x) * x + (a.y - b.y) * y),
    );
  return depth;
}
/** Smallest forward translation of b that separates it from a. */
export function separationAlong(a: OrientedBox, b: OrientedBox, dx: number, dy: number): number {
  let amount = Infinity;
  for (const [x, y] of axes(a, b)) {
    const speed = dx * x + dy * y;
    if (Math.abs(speed) < EPSILON) continue;
    const offset = (b.x - a.x) * x + (b.y - a.y) * y;
    amount = Math.min(
      amount,
      (radius(a, x, y) + radius(b, x, y) - Math.sign(speed) * offset + 0.001) / Math.abs(speed),
    );
  }
  return amount;
}

/** Constant-yaw swept SAT, including vertical motion. Thin obstacles cannot be skipped. */
function translatingContact(a: OrientedBox, end: OrientedBox, b: OrientedBox): boolean {
  let enter = 0,
    leave = 1;
  const interval = (start: number, finish: number) => {
    if (start <= EPSILON && finish <= EPSILON) return false;
    if (start <= EPSILON) enter = Math.max(enter, (EPSILON - start) / (finish - start));
    else if (finish <= EPSILON) leave = Math.min(leave, (start - EPSILON) / (start - finish));
    return enter < leave;
  };
  for (const [x, y] of axes(a, b)) {
    const r = radius(a, x, y) + radius(b, x, y);
    const start = (a.x - b.x) * x + (a.y - b.y) * y;
    const finish = (end.x - b.x) * x + (end.y - b.y) * y;
    if (!interval(r - start, r - finish) || !interval(r + start, r + finish)) return false;
  }
  return interval(a.high - b.low, end.high - b.low) && interval(b.high - a.low, b.high - end.low);
}

/** Shared rigid motion for driven cars. Rolling follows the arc between nose poses;
 * other bodies translate. Conservative interval bounds cover rotation between poses,
 * rather than relying on point samples that can miss a thin wall. */
export function boxMotion(start: OrientedBox, end: OrientedBox, rolling = false) {
  const angle = Math.atan2(Math.sin(end.angle - start.angle), Math.cos(end.angle - start.angle));
  const dx = end.x - start.x,
    dy = end.y - start.y;
  const chord = Math.hypot(dx, dy);
  const arc = rolling && Math.abs(angle) > 1e-6;
  const pathRadius = arc ? chord / (2 * Math.sin(Math.abs(angle) / 2)) : 0;
  const travel = arc ? pathRadius * Math.abs(angle) : chord;
  const cornerRadius = Math.hypot(start.halfLength, start.halfWidth);
  const speedBound = Math.max(
    travel + cornerRadius * Math.abs(angle),
    Math.abs(end.low - start.low),
    Math.abs(end.high - start.high),
  );
  const at = (t: number): OrientedBox => {
    let x = start.x + dx * t,
      y = start.y + dy * t;
    if (arc) {
      // Rotate the initial radius about the circular path center. Stable even
      // while backing; the signed angle already encodes the reverse turn.
      const cot = 1 / Math.tan(angle / 2);
      const rx = -dx / 2 + (dy * cot) / 2,
        ry = -dy / 2 - (dx * cot) / 2;
      const s = Math.sin(angle * t),
        cm1 = -2 * Math.sin((angle * t) / 2) ** 2;
      x = start.x + rx * cm1 - ry * s;
      y = start.y + rx * s + ry * cm1;
    }
    return {
      ...start,
      x,
      y,
      angle: start.angle + angle * t,
      low: start.low + (end.low - start.low) * t,
      high: start.high + (end.high - start.high) * t,
    };
  };
  const a = boxBounds(start),
    b = boxBounds(end);
  const padding = (cornerRadius + pathRadius) * (1 - Math.cos(Math.abs(angle) / 2));
  const bounds = {
    left: Math.min(a.left, b.left) - padding,
    right: Math.max(a.right, b.right) + padding,
    top: Math.min(a.top, b.top) - padding,
    bottom: Math.max(a.bottom, b.bottom) + padding,
  };
  return {
    bounds,
    poseAt: at,
    contact(target: OrientedBox, recover = false): boolean {
      const escaping = recover && boxDepth(start, target) > EPSILON;
      const initial = boxDepth(start, target, true);
      if (Math.abs(angle) < 1e-8) {
        if (escaping) {
          const separatingAxes = axes(start, target);
          const outward = separatingAxes.some(([x, y]) => {
            const offset = (start.x - target.x) * x + (start.y - target.y) * y;
            const movement = dx * x + dy * y;
            return (
              offset * movement > EPSILON ||
              (Math.abs(start.x - target.x) < EPSILON &&
                Math.abs(start.y - target.y) < EPSILON &&
                Math.abs(movement) > EPSILON)
            );
          });
          // Permit rolling toward an exit while parallel to the nearest face.
          // One nearest face must prove penetration never grows over this step.
          if (
            outward &&
            separatingAxes.some(([x, y]) => {
              const offset = (start.x - target.x) * x + (start.y - target.y) * y;
              const depth = radius(start, x, y) + radius(target, x, y) - Math.abs(offset);
              return depth <= initial + EPSILON && offset * (dx * x + dy * y) >= -EPSILON;
            })
          )
            return false;
        }
        return translatingContact(start, end, target);
      }
      const threshold = escaping && boxDepth(end, target, true) < initial - EPSILON ? initial : 0;
      let budget = 256;
      const blocked = (low: number, high: number): boolean => {
        const middle = (low + high) / 2;
        const depth = boxDepth(at(middle), target, threshold > 0);
        const reach = (speedBound * (high - low)) / 2;
        if (depth + reach <= threshold + EPSILON) return false;
        if (depth > threshold + EPSILON) return true;
        // Bound work and block unresolved intervals rather than admitting an
        // unproven path; the spatial stopping tolerance is sub-micron.
        if (--budget <= 0 || reach < EPSILON) return true;
        return blocked(low, middle) || blocked(middle, high);
      };
      return blocked(0, 1);
    },
  };
}
