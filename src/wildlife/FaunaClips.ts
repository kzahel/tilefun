import type { AnimationClip } from "../entities/EntityDefs.js";

/**
 * Standard authored wildlife bank: a still idle frame, a 32-frame travel gait,
 * an action (8 frames at 100 ms unless the species authored more) and a flee
 * that replays the gait at double speed.
 */
export function standardClips(
  gait: string,
  gaitMs: number,
  actionFrames = 8,
  actionMs = 100,
): readonly AnimationClip[] {
  return [
    { name: "idle", start: 0, count: 1, frameDuration: 100, loop: true },
    { name: gait, start: 1, count: 32, frameDuration: gaitMs, loop: true },
    { name: "action", start: 33, count: actionFrames, frameDuration: actionMs, loop: false },
    { name: "flee", start: 1, count: 32, frameDuration: gaitMs / 2, loop: true },
  ];
}

/** Amphibious bank: walk and swim gaits, an 8-frame action and both flee gaits. */
export function amphibiousClips(gaitMs: number): readonly AnimationClip[] {
  return [
    { name: "idle", start: 0, count: 1, frameDuration: 100, loop: true },
    { name: "walk", start: 1, count: 32, frameDuration: gaitMs, loop: true },
    { name: "swim", start: 33, count: 32, frameDuration: gaitMs, loop: true },
    { name: "action", start: 65, count: 8, frameDuration: 100, loop: false },
    { name: "flee", start: 1, count: 32, frameDuration: gaitMs / 2, loop: true },
    { name: "flee-swim", start: 33, count: 32, frameDuration: gaitMs / 2, loop: true },
  ];
}
