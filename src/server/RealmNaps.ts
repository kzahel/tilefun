import type { Entity, PositionComponent } from "../entities/Entity.js";
import { spriteHolds } from "../entities/spriteAnimation.js";
import { PHYSICS_DT } from "../physics/PhysicsDefaults.js";
import type { PhysicsScene } from "../physics/PhysicsScene.js";
import { wildlifeKind } from "../wildlife/WildlifeKinds.js";
import { WILDLIFE_SPECIES } from "../wildlife/WildlifeSpecies.js";
import type { AiPlanningScheduler } from "./AiPlanningScheduler.js";

/** Longest nap in ticks: every napping actor is simulated in full at least once in
 * LONGEST_NAP + 1 ticks. An edit the realm was not told about (`wake`) is admitted to
 * physics and replication after at most this long. */
export const LONGEST_NAP = 8;
/** Pixels. No actor naps with a player this close, so reactions to players stay immediate. */
const NEAR = 64;

interface NapTick {
  tick: number;
  dt: number;
  players: readonly Entity[];
  scene: PhysicsScene | undefined;
  planning: AiPlanningScheduler;
  activity: Activity;
}
/** An actor's demanded activity tier: 2 decides every tick. */
type Activity = (entity: Entity) => number | undefined;

/**
 * Split this tick's admitted actors into those simulated and those napping (see
 * `entities/naps.ts`). An actor naps while its brain only waits on clocks, its body
 * rests on static ground, its picture is still and no player is near. It wakes when a
 * clock is due, when disturbed, and on its own regular tick regardless; the tick it
 * wakes it is simulated in full, and its clocks first catch up tick by tick.
 */
export function partitionNaps(
  all: ReadonlyMap<Entity, number>,
  tick: number,
  players: readonly Entity[],
  scene: PhysicsScene | undefined,
  planning: AiPlanningScheduler,
  activity: Activity,
) {
  // The planner first offers this tick's starts, waking the actors it offers them to.
  planning.grant(tick);
  const now: NapTick = { tick, dt: PHYSICS_DT, players, scene, planning, activity };
  const active: Entity[] = [],
    awake: Entity[] = [],
    napping: Entity[] = [];
  let positions: PositionComponent[] | undefined;
  for (const entity of all.keys()) {
    active.push(entity);
    const last = entity.simTick ?? -1,
      continuing = last === now.tick - 1;
    entity.simTick = now.tick;
    // A decision clock restarts when its actor returns to simulation.
    if (!continuing) entity.tickAccumulator = 0;
    if (entity.napFrom !== undefined) {
      if (
        continuing &&
        (entity.napUntil ?? -1) >= now.tick &&
        !near(entity, now.players) &&
        now.activity(entity) === 2
      ) {
        napping.push(entity);
        continue;
      }
      const skipped = last + 1 - entity.napFrom;
      entity.napFrom = entity.napUntil = undefined;
      positions ??= now.players.map((player) => player.position);
      if (skipped > 0) catchUp(entity, skipped, now, positions);
    } else if (continuing) {
      const ticks = napLength(entity, now);
      if (ticks > 0) {
        entity.napFrom = now.tick;
        entity.napUntil = now.tick + ticks - 1;
        napping.push(entity);
        continue;
      }
    }
    awake.push(entity);
  }
  return { active, awake, napping };
}

function near(entity: Entity, players: readonly Entity[]) {
  for (const player of players) {
    const dx = player.position.wx - entity.position.wx,
      dy = player.position.wy - entity.position.wy;
    if (dx * dx + dy * dy < NEAR * NEAR) return true;
  }
  return false;
}

function napLength(entity: Entity, now: NapTick) {
  const kind = wildlifeKind(entity);
  const waits = kind && WILDLIFE_SPECIES[kind].waits;
  if (
    !waits ||
    entity.parentId !== undefined ||
    entity.deathTimer !== undefined ||
    near(entity, now.players) ||
    !spriteHolds(entity)
  )
    return 0;
  // Each actor's regular waking tick depends on its id, so a crowd that settles
  // together does not also wake together.
  const limit = LONGEST_NAP - ((now.tick + entity.id) % (LONGEST_NAP + 1));
  const ticks = limit > 0 ? waits(entity, now.dt, limit, now.planning) : 0;
  // Skipped clocks are replayed one tick at a time, which is what an actor deciding
  // every tick would have done; one deciding every fourth tick stays awake.
  return ticks > 0 && now.activity(entity) === 2 && now.scene?.restful(entity) ? ticks : 0;
}

function catchUp(
  entity: Entity,
  skipped: number,
  now: NapTick,
  players: readonly PositionComponent[],
) {
  now.planning.advance(entity, now.dt, players, skipped);
  const kind = wildlifeKind(entity);
  if (kind) WILDLIFE_SPECIES[kind].idles?.(entity, now.dt, skipped);
}

/**
 * This tick's decision time per simulated actor: every tick in a player's nearest
 * chunks (activity 2), otherwise the time accumulated since the actor's last decision
 * once that reaches `period`.
 */
export function decisionDts(
  awake: readonly Entity[],
  dt: number,
  period: number,
  activity: Activity,
): Map<Entity, number> {
  const decisions = new Map<Entity, number>();
  for (const entity of awake) {
    if (activity(entity) === 2 || entity.type === "player") {
      decisions.set(entity, dt);
      entity.tickAccumulator = 0;
    } else {
      const accumulated = (entity.tickAccumulator ?? 0) + dt;
      if (accumulated >= period) {
        decisions.set(entity, accumulated);
        entity.tickAccumulator = 0;
      } else entity.tickAccumulator = accumulated;
    }
  }
  return decisions;
}
