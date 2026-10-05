/** Pure presentation math. Times are seconds; no clocks or simulation entities. */
export interface MotionSample {
  time: number;
  x: number;
  y: number;
  z: number;
  jumpZ: number;
}
export const PRESENTATION_DELAY = 0.05;
export const MAX_PRESENTATION_EXTRAPOLATION = 0.1;
export const MAX_MOTION_SAMPLES = 32;

/** Bounded immutable history; a large relocation starts a new motion segment. */
export function recordMotionSample(
  history: readonly MotionSample[],
  sample: MotionSample,
): MotionSample[] {
  const last = history.at(-1);
  if (
    !last ||
    sample.time < last.time ||
    Math.hypot(sample.x - last.x, sample.y - last.y, sample.z - last.z) > 256
  )
    return [sample];
  if (sample.time === last.time) return [...history.slice(0, -1), sample];
  return [...history.slice(-(MAX_MOTION_SAMPLES - 1)), sample];
}

/** Interpolate in history, then extrapolate its last segment for at most 100ms.
 * Missing history holds the first/only pose. Extrapolation never runs forever.
 */
export function sampleMotion(
  history: readonly MotionSample[],
  time: number,
): MotionSample | undefined {
  const first = history[0],
    last = history.at(-1);
  if (!first || !last) return undefined;
  if (history.length === 1 || time <= first.time) return { ...first, time };
  let a = history[history.length - 2],
    b = last;
  for (let i = 1; i < history.length; i++) {
    const next = history[i];
    if (next && next.time >= time) {
      a = history[i - 1];
      b = next;
      break;
    }
  }
  if (!a || b.time <= a.time) return { ...b, time };
  const t = Math.min(time, last.time + MAX_PRESENTATION_EXTRAPOLATION);
  const f = (t - a.time) / (b.time - a.time);
  return {
    time,
    x: a.x + (b.x - a.x) * f,
    y: a.y + (b.y - a.y) * f,
    z: a.z + (b.z - a.z) * f,
    jumpZ: a.jumpZ + (b.jumpZ - a.jumpZ) * f,
  };
}

export interface PresentationClock {
  localOrigin: number;
  sourceOrigin: number;
  time: number;
}
/** Late arrivals don't reset the clock. Once history is exhausted, hold time;
 * newly delivered data resumes it. Explicit pause/reset establishes a new epoch.
 */
export function advancePresentationClock(
  state: PresentationClock,
  now: number,
  latest: number,
  rate = 1,
): PresentationClock {
  const wanted =
    state.sourceOrigin + Math.max(0, now - state.localOrigin) * rate - PRESENTATION_DELAY;
  const time = Math.max(state.time, Math.min(wanted, latest + MAX_PRESENTATION_EXTRAPOLATION));
  return { ...state, time };
}
