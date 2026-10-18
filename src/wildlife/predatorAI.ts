import { required } from "../art/ArtCatalog.js";
import { getEntityAABB } from "../entities/collision.js";
import type { Entity, PositionComponent } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import { setSpriteClip, setSpriteClipElapsed } from "../entities/spriteAnimation.js";
import { directionFromVelocity } from "../entities/wanderAI.js";
import { durableId } from "../persistence/ActorRecords.js";
import type { AiPlanningScheduler } from "../server/AiPlanningScheduler.js";
import { createDeer } from "./Deer.js";
import { startleDeer } from "./deerInteractions.js";
import type { WildlifeEnvironment } from "./mallardAI.js";
import { PREDATOR_PROFILES, predatorType } from "./Predator.js";
import { createRabbit } from "./Rabbit.js";
import { startleRabbit } from "./rabbitInteractions.js";

const distance = (a: PositionComponent, b: PositionComponent) =>
  Math.hypot(a.wx - b.wx, a.wy - b.wy);
const preyAnimal = (e: Entity) =>
  !!(e.deer || e.rabbit) &&
  e.parentId === undefined &&
  !e.wanderAI?.following &&
  e.wanderAI?.state !== "ridden";
const random = (e: Entity) => {
  const ai = required(e.predator);
  ai.randomState = (Math.imul(ai.randomState, 1664525) + 1013904223) >>> 0;
  return ai.randomState / 4294967296;
};
function enter(e: Entity, state: NonNullable<Entity["predator"]>["state"], timer: number) {
  const ai = required(e.predator);
  ai.state = state;
  ai.timer = timer;
  ai.elapsed = 0;
  if (e.velocity) e.velocity.vx = e.velocity.vy = 0;
  delete ai.aim;
  if (["rest", "feed", "scared"].includes(state)) delete ai.targetId;
  restorePredatorPose(e);
}
export function restorePredatorPose(e: Entity): void {
  const ai = e.predator;
  if (!ai || !e.sprite) return;
  const moving = ["patrol", "stalk", "chase", "pounce"].includes(ai.state);
  e.sprite.moving = moving;
  if (e.wanderAI)
    e.wanderAI.state =
      ai.state === "scared"
        ? "scared"
        : ai.state === "chase" || ai.state === "pounce"
          ? "chasing"
          : moving
            ? "walking"
            : "idle";
  setSpriteClip(
    e,
    ai.state === "feed"
      ? 2
      : ai.state === "pounce" || ai.state === "scared"
        ? 3
        : ai.state === "chase"
          ? 4
          : moving
            ? 1
            : 0,
  );
  setSpriteClipElapsed(e, Math.round(ai.elapsed * 1000));
}
export function startlePredator(e: Entity, from: PositionComponent): void {
  if (!e.predator) return;
  enter(e, "scared", 1.6);
  e.predator.alarmFrom = { ...from };
  e.predator.cooldown = Math.max(e.predator.cooldown, 12);
}
function clearPath(
  e: Entity,
  to: PositionComponent,
  env: WildlifeEnvironment,
  planning?: AiPlanningScheduler,
): boolean {
  const steps = Math.max(1, Math.ceil(distance(e.position, to) / 4));
  if (steps > 48 || (planning && !planning.path(e, steps))) return false;
  for (let i = 1; i <= steps; i++) {
    const p = {
      wx: e.position.wx + ((to.wx - e.position.wx) * i) / steps,
      wy: e.position.wy + ((to.wy - e.position.wy) * i) / steps,
    };
    if (
      env.isWater(p) ||
      !env.canOccupy(e, p) ||
      Math.abs((env.surfaceZ?.(p) ?? 0) - (e.wz ?? 0)) > 4
    )
      return false;
  }
  return true;
}
/** All decisions use admitted logical dt and the Realm's bounded planning budget. */
export function updatePredatorAI(
  e: Entity,
  dt: number,
  env: WildlifeEnvironment,
  animals: readonly Entity[],
  players: readonly PositionComponent[],
  planning?: AiPlanningScheduler,
): void {
  const ai = e.predator,
    v = e.velocity;
  if (!ai || !v || !e.sprite) return;
  const profile = required(PREDATOR_PROFILES.find((p) => predatorType(p.species) === e.type));
  ai.timer -= dt;
  ai.elapsed += dt;
  ai.cooldown = Math.max(0, ai.cooldown - dt);
  v.vx = v.vy = 0;
  if (ai.state === "feed" || ai.state === "scared" || (ai.state === "rest" && ai.timer > 0)) {
    if (ai.timer <= 0) {
      delete ai.alarmFrom;
      enter(e, "rest", 1 + random(e) * 2);
    }
    restorePredatorPose(e);
    return;
  }
  const prey = ai.targetId
    ? animals.find((a) => a.persistentId === ai.targetId && preyAnimal(a))
    : undefined;
  if (
    ai.targetId &&
    (!prey ||
      ai.elapsed > 12 ||
      distance(e.position, ai.home) > ai.radius ||
      distance(prey.position, ai.home) > ai.radius ||
      distance(prey.position, e.position) > 180)
  ) {
    ai.cooldown = Math.max(ai.cooldown, 5);
    enter(e, "rest", 2);
    return;
  }
  if (prey) {
    const d = distance(e.position, prey.position);
    if (ai.state === "stalk" && (d < 52 || ai.elapsed > 2)) enter(e, "chase", 0);
    if (ai.state === "chase" && d < 29) enter(e, "pounce", 0);
    if (ai.state === "pounce" && ai.elapsed > 0.65) {
      ai.cooldown = 3;
      enter(e, "rest", 1);
      return;
    }
    if (ai.state !== "stalk") {
      startleDeer(prey, e.position);
      startleRabbit(prey, e.position);
    }
  }
  if (ai.timer <= 0 && (!planning || planning.claim(e, false))) {
    ai.timer = 0.15;
    if (!prey && ai.cooldown <= 0) {
      let nearest: Entity | undefined,
        best = 144;
      // The active population is already spatially bounded; inspect at most 24
      // candidates per admitted turn, rotating to avoid starving later actors.
      const start = Math.floor(random(e) * Math.max(1, animals.length));
      for (let i = 0; i < Math.min(24, animals.length); i++) {
        if (planning && !planning.candidate(e)) break;
        const a = required(animals[(start + i) % animals.length]);
        const d = distance(e.position, a.position);
        if (
          preyAnimal(a) &&
          d < best &&
          distance(a.position, ai.home) < ai.radius &&
          clearPath(e, a.position, env, planning)
        ) {
          nearest = a;
          best = d;
        }
      }
      if (nearest) {
        ai.targetId = durableId(nearest);
        enter(e, "stalk", 0);
      }
    }
    const target = prey?.position;
    if (target) {
      if (clearPath(e, target, env, planning)) ai.aim = { ...target };
      else {
        ai.cooldown = 3;
        enter(e, "rest", 1);
      }
    } else if (!ai.targetId && (!ai.aim || ai.elapsed > 4 || distance(e.position, ai.aim) < 3)) {
      const angle = random(e) * Math.PI * 2;
      const point = {
        wx: ai.home.wx + Math.cos(angle) * 48,
        wy: ai.home.wy + Math.sin(angle) * 48,
      };
      if (
        (!planning || planning.candidate(e)) &&
        !players.some((p) => distance(p, point) < 24) &&
        clearPath(e, point, env, planning)
      ) {
        enter(e, "patrol", 0.3);
        ai.aim = point;
      } else enter(e, "rest", 1);
    }
  }
  if (ai.aim) {
    const dx = ai.aim.wx - e.position.wx,
      dy = ai.aim.wy - e.position.wy,
      d = Math.hypot(dx, dy);
    const speed = Math.min(
      ai.state === "chase" || ai.state === "pounce" ? profile.chaseSpeed : profile.speed,
      d / dt,
    );
    if (d > 0.1) {
      v.vx = (dx / d) * speed;
      v.vy = (dy / d) * speed;
      e.sprite.direction = directionFromVelocity(dx, dy);
      e.sprite.frameRow = e.sprite.direction;
    }
  }
  restorePredatorPose(e);
}

/** Called after collision resolution. A meal creates exactly one new durable
 * identity; no generic removal hook respawns manually deleted animals. */
export function resolvePredatorCatches(
  manager: EntityManager,
  active: readonly Entity[],
  env: WildlifeEnvironment,
  players: readonly PositionComponent[],
): void {
  for (const hunter of active) {
    const ai = hunter.predator;
    if (ai?.state !== "pounce" || ai.elapsed < 0.12 || !hunter.collider) continue;
    const prey = active.find(
      (e) => e.persistentId === ai.targetId && manager.byId.has(e.id) && preyAnimal(e),
    );
    if (
      !prey?.collider ||
      Math.abs((hunter.wz ?? 0) - (prey.wz ?? 0)) > 4 ||
      (prey.rabbit?.state === "hop" && (prey.wz ?? 0) > (env.surfaceZ?.(prey.position) ?? 0) + 1)
    )
      continue;
    const a = getEntityAABB(hunter.position, hunter.collider),
      b = getEntityAABB(prey.position, prey.collider);
    if (
      Math.hypot(
        Math.max(a.left - b.right, b.left - a.right, 0),
        Math.max(a.top - b.bottom, b.top - a.bottom, 0),
      ) > 3 ||
      !clearPath(hunter, prey.position, env)
    )
      continue;
    const habitat = prey.deer ?? prey.rabbit;
    if (!habitat) continue;
    let replacement: Entity | undefined;
    for (let i = 0; i < 24; i++) {
      const angle = random(hunter) * Math.PI * 2,
        r = 48 + random(hunter) * Math.max(0, habitat.radius - 64);
      const point = {
        wx: habitat.home.wx + Math.cos(angle) * r,
        wy: habitat.home.wy + Math.sin(angle) * r,
      };
      const candidate = prey.deer
        ? createDeer(point.wx, point.wy)
        : createRabbit(point.wx, point.wy);
      candidate.wz = env.surfaceZ?.(point) ?? 0;
      const footprint = getEntityAABB(point, required(candidate.collider));
      const ground = [
        point,
        { wx: footprint.left, wy: footprint.top },
        { wx: footprint.right, wy: footprint.top },
        { wx: footprint.left, wy: footprint.bottom },
        { wx: footprint.right, wy: footprint.bottom },
      ];

      if (
        distance(point, hunter.position) < 56 ||
        players.some((p) => distance(point, p) < 24) ||
        manager.entities.some(
          (e) => e !== prey && e.collider?.solid !== false && distance(point, e.position) < 28,
        ) ||
        ground.some(
          (p) => env.isWater(p) || Math.abs((env.surfaceZ?.(p) ?? 0) - required(candidate.wz)) > 2,
        ) ||
        !env.canOccupy(candidate, point)
      )
        continue;
      const fresh = candidate.deer ?? candidate.rabbit;
      if (!fresh) continue;
      fresh.home = { ...habitat.home };
      fresh.shelter = { ...habitat.shelter };
      fresh.radius = habitat.radius;
      fresh.randomState = (random(hunter) * 4294967296) >>> 0;
      if (candidate.deer && prey.deer?.herdId) candidate.deer.herdId = prey.deer.herdId;
      durableId(candidate);
      replacement = candidate;
      break;
    }
    if (!replacement) continue;
    // These synchronous mutations enter the same RealmRecords flush transaction.
    manager.spawn(replacement);
    manager.remove(prey.id);
    ai.meals++;
    ai.cooldown = 35 + random(hunter) * 20;
    enter(hunter, "feed", 3.84);
  }
}
