import type { AnimationClip } from "../entities/EntityDefs.js";

/**
 * Standard authored wildlife bank: a still idle frame, a 32-frame travel gait,
 * an 8-frame action and a flee that replays the gait at double speed.
 */
export function standardClips(gait: string, gaitMs: number): readonly AnimationClip[] {
  return [
    { name: "idle", start: 0, count: 1, frameDuration: 100, loop: true },
    { name: gait, start: 1, count: 32, frameDuration: gaitMs, loop: true },
    { name: "action", start: 33, count: 8, frameDuration: 100, loop: false },
    { name: "flee", start: 1, count: 32, frameDuration: gaitMs / 2, loop: true },
  ];
}
