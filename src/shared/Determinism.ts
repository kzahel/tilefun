// Deterministic integer helpers shared by simulation, generation and review code.
// World generation, wildlife, replays and review identities depend on these exact
// outputs: never change a constant, salt, coercion or iteration order here.

/** Advances a Numerical Recipes LCG state; returns an unsigned 32-bit state. */
export function lcgNext(state: number): number {
  return (Math.imul(state, 1664525) + 1013904223) >>> 0;
}

/**
 * Unsigned 32-bit seed for a world position: floored coordinates mixed with the
 * classic spatial-hash primes (plain float multiply, not `Math.imul`) and an
 * optional per-species salt.
 */
export function positionSeed(wx: number, wy: number, salt = 0): number {
  return ((Math.floor(wx) * 73856093) ^ (Math.floor(wy) * 19349663) ^ salt) >>> 0;
}

/**
 * 32-bit FNV-1a over a string's code points, mixing each code point's first
 * UTF-16 unit (astral characters contribute only their high surrogate).
 */
export function fnv1a32(text: string): number {
  let hash = 2166136261;
  for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return hash;
}
