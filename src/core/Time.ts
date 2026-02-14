/**
 * Central time manager. Tracks simulation elapsed time and render
 * interpolation alpha. Future home for timeScale (pause/slow-mo).
 */
export class Time {
  /** Total simulation time elapsed (seconds). Updated each fixed tick. */
  elapsed = 0;
  /** Render interpolation alpha [0, 1). Fraction between two fixed updates. */
  alpha = 0;
}
