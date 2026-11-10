import { CHUNK_SIZE_PX } from "../config/constants.js";
import { getEntityAABB } from "../entities/collision.js";
import { chunkKey } from "../world/types.js";
import { AT_REST } from "./BodyMotor.js";
import { PHYSICS_DT, PHYSICS_PIXELS_PER_METRE as SCALE } from "./PhysicsDefaults.js";
import type { SceneBody } from "./SceneBody.js";

/** Take a resting body out of the per-tick passes. Wheel queries still test it, so
 * its centre is captured once; it stays exact until the solver wakes the body. */
export function hold(entry: SceneBody) {
  entry.held = true;
  if (!entry.centred) {
    entry.queryCenter = entry.body.translation();
    entry.centred = true;
  }
}

/** The entity still shows the pose and velocity this body last published. */
export function unedited(entry: SceneBody) {
  const entity = entry.entity,
    s = entry.state;
  return (
    entity.position.wx === s.x &&
    entity.position.wy === s.y &&
    (entity.wz ?? 0) === s.z &&
    (entity.velocity?.vx ?? 0) === s.vx &&
    (entity.velocity?.vy ?? 0) === s.vy &&
    entity.jumpVZ === undefined &&
    s.grounded
  );
}

/** Add the collision sections each body can reach this tick to `needed`. */
export function reachedSections(
  bodies: readonly SceneBody[],
  needed: Map<string, { cx: number; cy: number }>,
) {
  let lastLeft = Number.NaN,
    lastRight = 0,
    lastTop = 0,
    lastBottom = 0;
  for (const entry of bodies) {
    const c = entry.entity.collider;
    if (!c) continue;
    const box = getEntityAABB(entry.entity.position, c);
    // A body asleep at its last readback and not edited since has no velocity.
    const v = entry.rested ? AT_REST : entry.body.linvel();
    const margin = 32 + Math.hypot(v.x, v.z) * SCALE * PHYSICS_DT;
    const left = Math.floor((box.left - margin) / CHUNK_SIZE_PX),
      right = Math.floor((box.right + margin) / CHUNK_SIZE_PX),
      top = Math.floor((box.top - margin) / CHUNK_SIZE_PX),
      bottom = Math.floor((box.bottom + margin) / CHUNK_SIZE_PX);
    // Neighbours usually need the same sections as the body before them.
    if (left === lastLeft && right === lastRight && top === lastTop && bottom === lastBottom)
      continue;
    lastLeft = left;
    lastRight = right;
    lastTop = top;
    lastBottom = bottom;
    for (let cy = top; cy <= bottom; cy++)
      for (let cx = left; cx <= right; cx++) needed.set(chunkKey(cx, cy), { cx, cy });
  }
}

export const NOBODY: readonly SceneBody[] = [];
/** Metres (about 0.03 px): a body displaced less by one step on rebuilt ground still rests. */
const STILL = 0.001;

/** Bodies asleep before a step that rebuilds the static geometry, with their poses. */
export function restingBodies(bodies: Iterable<SceneBody>): SceneBody[] {
  const resting: SceneBody[] = [];
  for (const entry of bodies) {
    if (!entry.rested || entry.kind === "fixed") continue;
    if (!entry.centred) entry.queryCenter = entry.body.translation();
    resting.push(entry);
  }
  return resting;
}

/** After that step, put back to sleep each of those bodies the rebuild woke and the
 * new ground still carries: displaced less than STILL and not falling. `fall` is the
 * speed one step of free fall gives (m/s); an unsupported body has it, however weak
 * the gravity, and a supported one has almost none. One that fell or was pushed
 * stays awake. The pose is left as the solver has it (resetting it would wake the
 * body again): within STILL of the cached one, which the next real readback picks up. */
export function resettle(resting: readonly SceneBody[], fall: number) {
  // Without gravity nothing falls, so nothing shows whether a body is still carried.
  if (fall <= 0) return;
  for (const entry of resting) {
    if (entry.body.isSleeping()) continue;
    const p = entry.body.translation(),
      was = entry.queryCenter;
    if (
      Math.abs(p.x - was.x) > STILL ||
      Math.abs(p.y - was.y) > STILL ||
      Math.abs(p.z - was.z) > STILL
    )
      continue;
    const v = entry.body.linvel();
    if (v.y < -fall / 2 || Math.abs(v.x) > STILL || Math.abs(v.z) > STILL) continue;
    entry.body.sleep();
  }
}
