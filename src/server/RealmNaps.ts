import type { Entity, PositionComponent } from "../entities/Entity.js";
import { PHYSICS_DT } from "../physics/PhysicsDefaults.js";
import type { PhysicsScene } from "../physics/PhysicsScene.js";
import { wildlifeKind } from "../wildlife/WildlifeKinds.js";
import { WILDLIFE_SPECIES } from "../wildlife/WildlifeSpecies.js";
import type { AiPlanningScheduler } from "./AiPlanningScheduler.js";

/** Longest nap in ticks before an actor's conditions are looked at again. A nap that
 * ran its length goes straight on while they still hold; an edit the realm was not
 * told about (`wake`) is seen by physics and replication after at most this long. */
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
 * `entities/naps.ts`). An actor naps while its species only waits on clocks (a rest,
 * the standing parts of a hop), its body rests on static ground and no player is
 * near. It wakes when a clock is due or it is disturbed; the tick it wakes it is
 * simulated in full, and its clocks first catch up tick by tick.
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
    // A nap that ran its length may go straight on, since the simulated tick in
    // between would have changed nothing either. One ended from outside (`wake`, a
    // player near, a new tier) is followed by a simulated tick.
    let rested = continuing,
      extended = false;
    if (entity.napFrom !== undefined) {
      const until = entity.napUntil ?? -1;
      rested &&= until >= 0 && !near(entity, now.players) && now.activity(entity) === 2;
      if (rested && until >= now.tick) {
        napping.push(entity);
        continue;
      }
      const skipped = last + 1 - entity.napFrom;
      entity.napFrom = entity.napUntil = undefined;
      positions ??= now.players.map((player) => player.position);
      if (skipped > 0) catchUp(entity, skipped, now, positions);
      extended = rested;
    }
    const ticks = rested ? napLength(entity, now) : 0;
    if (ticks > 0) {
      entity.napFrom = now.tick;
      entity.napUntil = now.tick + ticks - 1;
      if (extended && positions) {
        // Replay this tick as well: the actor is compared for replication now, like
        // one starting a nap, and so shows its clocks as of this tick.
        catchUp(entity, 1, now, positions);
        entity.napFrom++;
        delete entity.comparedTick;
      }
      napping.push(entity);
      continue;
    }
    awake.push(entity);
  }
  return { active, awake, napping };
}

/** What ending a nap outside the tick's split needs of its realm. */
interface NapRealm {
  readonly aiPlanning: AiPlanningScheduler;
  readonly sessions: ReadonlyMap<string, { readonly player: Entity }>;
}

/** An actor that is shown but was not simulated this tick (a pause, a publication
 * outside a tick, an actor that left admission): replay the clocks its nap skipped,
 * up to its last simulated tick, so its picture is current. */
export function endNap(entity: Entity, realm: NapRealm) {
  if (entity.napFrom === undefined) return;
  const skipped = (entity.simTick ?? -1) + 1 - entity.napFrom;
  entity.napFrom = entity.napUntil = undefined;
  delete entity.comparedTick;
  if (skipped <= 0) return;
  const players = [...realm.sessions.values()].map((session) => session.player.position);
  catchUp(entity, skipped, { dt: PHYSICS_DT, planning: realm.aiPlanning }, players);
}
/** A publication outside a tick (a clock stop, a manual step): no nap may lag it. */
export function endNaps(realm: NapRealm & { entityManager: { entities: readonly Entity[] } }) {
  for (const entity of realm.entityManager.entities) endNap(entity, realm);
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
    near(entity, now.players)
  )
    return 0;
  // The tick an actor's conditions are looked at again depends on its id, so a crowd
  // that settles together is not also looked at together.
  const limit = LONGEST_NAP - ((now.tick + entity.id) % LONGEST_NAP);
  const ticks = waits(entity, now.dt, limit, now.planning);
  // Skipped clocks are replayed one tick at a time, which is what an actor deciding
  // every tick would have done; one deciding every fourth tick stays awake.
  return ticks > 0 && now.activity(entity) === 2 && now.scene?.restful(entity) ? ticks : 0;
}

function catchUp(
  entity: Entity,
  skipped: number,
  now: Pick<NapTick, "dt" | "planning">,
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
