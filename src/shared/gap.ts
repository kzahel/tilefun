/** Euclidean distance between two world positions. */
export const gap = (a: { wx: number; wy: number }, b: { wx: number; wy: number }) =>
  Math.hypot(a.wx - b.wx, a.wy - b.wy);
