import { type AABB, getEntityAABB } from "../entities/collision.js";
import type { Prop } from "../entities/Prop.js";
import { PHYSICS_DT } from "./PhysicsDefaults.js";
import type { MotionIntent } from "./PhysicsState.js";
import type { CollisionGeometrySource } from "./rapier/CollisionGeometry.js";

/** Vertical climbing speed, px/s. Slower than walking so the rungs read. */
export const CLIMB_SPEED = 48;
/** Height above the top rung at which a climber steps north onto the exit. */
const STEP_CLEARANCE = 0.5;
const CENTRE_SPEED = 32;

export interface Ladder {
  bounds: AABB;
  bottom: number;
  top: number;
}

export function propLadders(props: Iterable<Prop>): Ladder[] {
  const ladders: Ladder[] = [];
  for (const p of props)
    for (const c of p.walls ?? (p.collider ? [p.collider] : []))
      if (c.ladder && c.zHeight !== undefined)
        ladders.push({
          bounds: getEntityAABB(p.position, c),
          bottom: c.zBase ?? 0,
          top: (c.zBase ?? 0) + c.zHeight,
        });
  return ladders;
}

/**
 * Stateless ladder locomotion, evaluated inside the shared physics step so the
 * authority and client prediction agree. A body engages a ladder when its
 * footprint centre lies in the ladder column within reach of its height range.
 * North (up) climbs, south (down) descends, no vertical input holds on, and
 * sideways input lets go. At the top, north steps onto the walkable exit.
 * Climbing reuses the scene's prescribed-altitude motor; the previous target
 * (replicated as `altitude`) is the base so holding on does not creep downward.
 */
export function ladderIntent(
  intent: MotionIntent,
  body: { z: number; grounded: boolean; altitude?: number | undefined },
  footprint: AABB,
  ladders: readonly Ladder[],
): MotionIntent {
  const cx = (footprint.left + footprint.right) / 2,
    cy = (footprint.top + footprint.bottom) / 2;
  const ladder = ladders.find(
    (l) =>
      cx >= l.bounds.left &&
      cx <= l.bounds.right &&
      cy >= l.bounds.top &&
      cy <= l.bounds.bottom &&
      body.z >= l.bottom - 1 &&
      body.z <= l.top + 1,
  );
  // Part of the body over the exit: ordinary walking on the deck above.
  if (!ladder || footprint.top < ladder.bounds.top) return intent;
  const up = intent.vy < 0,
    down = intent.vy > 0;
  if (Math.abs(intent.vx) > Math.abs(intent.vy)) return intent;
  if (body.grounded && body.z <= ladder.bottom + STEP_CLEARANCE && !up) return intent;
  const centre = (ladder.bounds.left + ladder.bounds.right) / 2;
  const vx = Math.max(-CENTRE_SPEED, Math.min(CENTRE_SPEED, (centre - cx) * 8));
  const top = ladder.top + STEP_CLEARANCE;
  if (up && body.z >= ladder.top - 0.25) return { vx, vy: intent.vy, altitude: top };
  const base =
    body.altitude !== undefined && Math.abs(body.altitude - body.z) < 2 ? body.altitude : body.z;
  const rate = up ? CLIMB_SPEED : down ? -CLIMB_SPEED : 0;
  return {
    vx,
    vy: 0,
    altitude: Math.max(ladder.bottom, Math.min(top, base + rate * PHYSICS_DT)),
  };
}

/** Shared-step entry: ladders are passable prop columns from the same geometry source. */
export function playerClimbIntent(
  input: MotionIntent,
  body: { x: number; y: number; z: number; grounded: boolean; altitude?: number | undefined },
  collider: { offsetX: number; offsetY: number; width: number; height: number } | null | undefined,
  geometry: Pick<CollisionGeometrySource, "queryProps">,
): MotionIntent {
  if (!collider) return input;
  const footprint = getEntityAABB({ wx: body.x, wy: body.y }, collider);
  const ladders = propLadders(geometry.queryProps(footprint));
  return ladders.length ? ladderIntent(input, body, footprint, ladders) : input;
}
