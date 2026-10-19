import { required } from "../art/ArtCatalog.js";
import { getEntityAABB } from "../entities/collision.js";
import type { Entity, PositionComponent } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import { predatorFlightZ, restorePredatorPose } from "./PredatorMotion.js";

export { restorePredatorPose } from "./PredatorMotion.js";

import { directionFromVelocity } from "../entities/wanderAI.js";
import { durableId } from "../persistence/ActorRecords.js";
import type { AiPlanningScheduler } from "../server/AiPlanningScheduler.js";
import { startleDeer } from "./deerInteractions.js";
import { canEat, creatureSpecies } from "./FoodWeb.js";
import { startleFauna } from "./faunaInteractions.js";
import { startleFrog } from "./frogInteractions.js";
import type { WildlifeEnvironment } from "./mallardAI.js";
import { startleMallard } from "./mallardInteractions.js";
import { predatorProfile } from "./Predator.js";
import { startleRabbit } from "./rabbitInteractions.js";
import { startleRobin } from "./robinInteractions.js";
import { scheduleWildlifeRespawn } from "./WildlifeRespawns.js";

const distance = (a: PositionComponent, b: PositionComponent) =>
  Math.hypot(a.wx - b.wx, a.wy - b.wy);
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
  if (["rest", "feed", "scared", "patrol", "sleep", "guard", "ambush", "perch"].includes(state))
    delete ai.aim;
  if (["rest", "feed", "scared", "evade", "sleep", "guard", "ambush", "perch"].includes(state)) {
    delete ai.targetId;
    delete ai.huntElapsed;
  }
  restorePredatorPose(e);
}
/** Cancel a smaller predator's own hunt before it escapes a larger hunter. */
function alarmPrey(prey: Entity, from: PositionComponent): void {
  if (prey.predator) {
    if (prey.predator.alarmFrom) return;
    enter(prey, "evade", 2.5);
    prey.predator.alarmFrom = { ...from };
    prey.predator.cooldown = Math.max(prey.predator.cooldown, 12);
  } else if (prey.deer) startleDeer(prey, from);
  else if (prey.rabbit) startleRabbit(prey, from);
  else if (prey.fauna) startleFauna(prey, from);
  else if (prey.robin) startleRobin(prey, from);
  else if (prey.frog) startleFrog(prey, from);
  else if (prey.mallard) startleMallard(prey, from);
  else if (prey.wanderAI) {
    prey.wanderAI.state = "scared";
    prey.wanderAI.scaredTimer = 2;
    // People run from predators, but ball-hit panic (3x walking speed) would
    // make them faster than lions, tigers and bears throughout every pursuit.
    if (creatureSpecies(prey) === "person") prey.wanderAI.scaredSpeed = prey.wanderAI.speed * 1.5;
    const dx = prey.position.wx - from.wx,
      dy = prey.position.wy - from.wy,
      d = Math.hypot(dx, dy) || 1;
    prey.wanderAI.dirX = dx / d;
    prey.wanderAI.dirY = dy / d;
    prey.wanderAI.timer = 0.3;
  }
}
export function startlePredator(e: Entity, from: PositionComponent): void {
  if (!e.predator) return;
  enter(e, "scared", 1.6);
  e.predator.alarmFrom = { ...from };
  e.predator.cooldown = Math.max(e.predator.cooldown, 12);
}
function bodyGap(a: Entity, b: Entity): number {
  if (!a.collider || !b.collider) return Infinity;
  const x = getEntityAABB(a.position, a.collider),
    y = getEntityAABB(b.position, b.collider);
  return Math.hypot(
    Math.max(x.left - y.right, y.left - x.right, 0),
    Math.max(x.top - y.bottom, y.top - x.bottom, 0),
  );
}
/** Detect actual support contact after a raptor lands on prey. The meal resolver
 * separately retains airborne-prey protection before allowing a catch. */
function raptorOnPrey(hunter: Entity, prey: Entity): boolean {
  const top = (prey.wz ?? 0) + (prey.collider?.physicalHeight ?? 0);
  return (
    predatorProfile(hunter.type)?.fierce?.kind === "raptor" &&
    !hunter.predator?.flight &&
    (hunter.jumpZ ?? 0) <= 1 &&
    Math.abs((hunter.wz ?? 0) - top) < 0.1 &&
    Math.abs((hunter.groundZ ?? -Infinity) - top) < 0.1 &&
    bodyGap(hunter, prey) === 0
  );
}
/** Every footprint tile must remain deep water for ocean hunters. Land policy stays dry. */
export function predatorHabitatAllows(
  e: Entity,
  point: PositionComponent,
  env: WildlifeEnvironment,
): boolean {
  if (predatorProfile(e.type)?.expansion?.habitat !== "deep") return !env.isWater(point);
  if (!e.collider) return false;
  const a = getEntityAABB(point, e.collider),
    water = env.isDeepWater ?? env.isWater;
  for (let ty = Math.floor(a.top / 16); ty <= Math.floor((a.bottom - 0.001) / 16); ty++)
    for (let tx = Math.floor(a.left / 16); tx <= Math.floor((a.right - 0.001) / 16); tx++)
      if (!water({ wx: tx * 16 + 8, wy: ty * 16 + 8 })) return false;
  return true;
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
      !predatorHabitatAllows(e, p, env) ||
      !env.canOccupy(e, p) ||
      Math.abs((env.surfaceZ?.(p) ?? 0) - (e.wz ?? 0)) > 4
    )
      return false;
  }
  return true;
}
/** Finite, loaded, dry corridor. Height-aware occupancy retains ordinary prop collision. */
export function clearPredatorFlight(
  e: Entity,
  to: PositionComponent,
  endZ: number,
  env: WildlifeEnvironment,
  planning?: AiPlanningScheduler,
): boolean {
  const steps = Math.max(1, Math.ceil(distance(e.position, to) / 4));
  if (steps > 48 || (planning && !planning.path(e, steps))) return false;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps,
      p = {
        wx: e.position.wx + (to.wx - e.position.wx) * t,
        wy: e.position.wy + (to.wy - e.position.wy) * t,
      };
    const probe = { collider: e.collider, wz: predatorFlightZ(e.wz ?? 0, endZ, t, 28) };
    if (env.isWater(p) || !env.canOccupy(probe, p)) return false;
  }
  return true;
}
function launchPredatorFlight(
  e: Entity,
  to: PositionComponent,
  endZ: number,
  attack: boolean,
): void {
  const ai = required(e.predator),
    speed = required(predatorProfile(e.type)).chaseSpeed;
  ai.flight = {
    elapsed: 0,
    duration: Math.max(0.8, distance(e.position, to) / speed),
    from: { ...e.position },
    to: { ...to },
    startZ: e.wz ?? 0,
    endZ,
    lift: 28,
    attack,
  };
  enter(e, "flight", 0);
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
  const profile = required(predatorProfile(e.type)),
    fierce = profile.fierce;
  if (fierce && ["dragon", "griffin", "spider"].includes(fierce.kind) && !ai.denPlaced)
    env.ensurePredatorDen?.(e);
  if (ai.flight) {
    restorePredatorPose(e);
    return;
  }
  ai.timer -= dt;
  ai.elapsed += dt;
  ai.cooldown = Math.max(0, ai.cooldown - dt);
  ai.warningCooldown = Math.max(0, (ai.warningCooldown ?? 0) - dt);
  v.vx = v.vy = 0;
  if (
    fierce?.kind === "dragon" &&
    !ai.targetId &&
    ["sleep", "guard"].includes(ai.state) &&
    !ai.warningCooldown
  ) {
    const visitor = players.find((p) => distance(p, ai.home) < 64);
    if (visitor) {
      ai.warningCooldown = 10;
      enter(e, "display", 1.28);
      ai.displaySerial = (ai.displaySerial ?? 0) + 1;
      e.sprite.direction = directionFromVelocity(
        visitor.wx - e.position.wx,
        visitor.wy - e.position.wy,
      );
      e.sprite.frameRow = e.sprite.direction;
      restorePredatorPose(e);
      return;
    }
  }
  if (ai.targetId) ai.huntElapsed = (ai.huntElapsed ?? 0) + dt;
  if (ai.state === "evade") {
    if (ai.timer <= 0) {
      delete ai.alarmFrom;
      enter(e, "rest", 2);
      return;
    }
    if (
      ai.alarmFrom &&
      (!ai.aim || distance(e.position, ai.aim) < 4) &&
      (!planning || planning.claim(e, true))
    ) {
      const dx = e.position.wx - ai.alarmFrom.wx,
        dy = e.position.wy - ai.alarmFrom.wy,
        d = Math.hypot(dx, dy) || 1;
      const point = { wx: e.position.wx + (dx / d) * 72, wy: e.position.wy + (dy / d) * 72 };
      if (clearPath(e, point, env, planning)) ai.aim = point;
    }
    if (ai.aim) {
      const dx = ai.aim.wx - e.position.wx,
        dy = ai.aim.wy - e.position.wy,
        d = Math.hypot(dx, dy);
      const speed = Math.min(profile.chaseSpeed, d / dt);
      if (d > 0.1) {
        v.vx = (dx / d) * speed;
        v.vy = (dy / d) * speed;
        e.sprite.direction = directionFromVelocity(dx, dy);
        e.sprite.frameRow = e.sprite.direction;
      }
    }
    restorePredatorPose(e);
    return;
  }
  if (
    ai.state === "feed" ||
    ai.state === "scared" ||
    ai.state === "sleep" ||
    (ai.state === "rest" && ai.timer > 0)
  ) {
    if (ai.timer <= 0) {
      delete ai.alarmFrom;
      enter(e, "rest", 1 + random(e) * 2);
    }
    restorePredatorPose(e);
    return;
  }
  const prey = ai.targetId
    ? animals.find((a) => a.persistentId === ai.targetId && canEat(e, a))
    : undefined;
  if (
    ai.targetId &&
    (!prey ||
      (ai.huntElapsed ?? ai.elapsed) > 14 ||
      (ai.state === "chase" && ai.elapsed > (fierce?.chargeSeconds ?? 12)) ||
      distance(e.position, ai.home) > ai.radius ||
      distance(prey.position, ai.home) > ai.radius ||
      distance(prey.position, e.position) > (fierce?.sense ?? 180) + 32)
  ) {
    ai.cooldown = Math.max(ai.cooldown, fierce ? 12 : 5);
    enter(e, "rest", 2);
    return;
  }
  if (ai.state === "display" || ai.state === "windup") {
    if (ai.timer <= 0 && prey) {
      const launching = ai.state === "windup";
      enter(
        e,
        ai.state === "display" ? "windup" : "chase",
        ai.state === "display" ? (fierce?.windup ?? 0.3) : 0,
      );
      if (
        launching &&
        (fierce?.kind === "griffin" || fierce?.kind === "raptor") &&
        (distance(e.position, prey.position) > 24 ||
          Math.abs((e.wz ?? 0) - (env.surfaceZ?.(prey.position) ?? 0)) > 4) &&
        clearPredatorFlight(e, prey.position, env.surfaceZ?.(prey.position) ?? 0, env, planning)
      ) {
        launchPredatorFlight(e, prey.position, env.surfaceZ?.(prey.position) ?? 0, true);
        return;
      }
      ai.aim = { ...prey.position };
    } else if (ai.timer <= 0 && !prey) {
      enter(e, fierce?.kind === "dragon" ? "guard" : "rest", 2);
    }
    restorePredatorPose(e);
    return;
  }
  if (prey) {
    if (ai.state !== "stalk") alarmPrey(prey, e.position);
    const d = distance(e.position, prey.position);
    if (ai.state === "stalk" && (d < 52 || ai.elapsed > 2)) enter(e, "chase", 0);
    if (
      ai.state === "chase" &&
      bodyGap(e, prey) <= 4 &&
      (raptorOnPrey(e, prey) || !prey.rabbit || !["startle", "hop"].includes(prey.rabbit.state))
    )
      enter(e, "pounce", 0);
    if (ai.state === "pounce" && ai.elapsed > 0.9) {
      ai.cooldown = 3;
      enter(e, "rest", 1);
      return;
    }
    if (ai.state === "pounce" && raptorOnPrey(e, prey)) {
      restorePredatorPose(e);
      return;
    }
  }
  if (ai.timer <= 0 && (!planning || planning.claim(e, false))) {
    ai.timer = 0.15;
    if (!prey && ai.cooldown <= 0) {
      let nearest: Entity | undefined,
        best = fierce?.sense ?? 144;
      let packTarget: Entity | undefined;
      // The active population is already spatially bounded; inspect at most 24
      // candidates per admitted turn, rotating to avoid starving later actors.
      const start = Math.floor(random(e) * Math.max(1, animals.length));
      for (let i = 0; i < Math.min(24, animals.length); i++) {
        if (planning && !planning.candidate(e)) break;
        const a = required(animals[(start + i) % animals.length]);
        const d = distance(e.position, a.position);
        const ally = a.predator;
        if (
          fierce?.kind === "wolf" &&
          a !== e &&
          a.type === e.type &&
          ally?.targetId &&
          (ai.packId
            ? ally.packId === ai.packId
            : !ally.packId && distance(ai.home, ally.home) < 96)
        ) {
          const shared = animals.find((animal) => animal.persistentId === ally.targetId);
          if (
            shared &&
            canEat(e, shared) &&
            distance(e.position, shared.position) < (fierce?.sense ?? 160) &&
            distance(shared.position, ai.home) < ai.radius &&
            clearPath(e, shared.position, env, planning)
          )
            packTarget = shared;
        }
        if (
          canEat(e, a) &&
          d < best &&
          distance(a.position, ai.home) < ai.radius &&
          (fierce?.kind === "griffin" || fierce?.kind === "raptor"
            ? clearPredatorFlight(e, a.position, env.surfaceZ?.(a.position) ?? 0, env, planning)
            : clearPath(e, a.position, env, planning))
        ) {
          nearest = a;
          best = d;
        }
      }
      nearest = packTarget ?? nearest;
      if (nearest) {
        ai.targetId = durableId(nearest);
        ai.huntElapsed = 0;
        enter(
          e,
          packTarget ? "chase" : fierce ? "display" : "stalk",
          fierce && !packTarget ? 1.28 : 0,
        );
        ai.aim = { ...nearest.position };
        if (fierce && !packTarget) {
          ai.displaySerial = (ai.displaySerial ?? 0) + 1;
          e.sprite.direction = directionFromVelocity(
            nearest.position.wx - e.position.wx,
            nearest.position.wy - e.position.wy,
          );
          e.sprite.frameRow = e.sprite.direction;
          alarmPrey(nearest, e.position);
          for (let i = 0; i < Math.min(48, animals.length); i++) {
            if (planning && !planning.candidate(e)) break;
            const animal = required(animals[(start + i) % animals.length]);
            if (canEat(e, animal) && distance(e.position, animal.position) < fierce.displayRadius)
              alarmPrey(animal, e.position);
          }
          restorePredatorPose(e);
          return;
        }
      }
    }
    let target = prey?.position;
    if (target && fierce?.kind === "wolf" && ai.packRole && prey && bodyGap(e, prey) > 24) {
      const dx = target.wx - e.position.wx,
        dy = target.wy - e.position.wy;
      const d = Math.hypot(dx, dy) || 1,
        side = ai.packRole % 2 ? 1 : -1;
      target = { wx: target.wx - (dy / d) * 12 * side, wy: target.wy + (dx / d) * 12 * side };
    }
    if (target) {
      if (clearPath(e, target, env, planning)) ai.aim = { ...target };
      else {
        ai.cooldown = 3;
        enter(e, "rest", 1);
      }
    } else if (!ai.targetId && (fierce?.kind === "griffin" || fierce?.kind === "raptor")) {
      const perches = env.predatorPerches?.(ai.home, ai.radius) ?? [];
      const perch = perches
        .filter((p) => distance(p, ai.home) < ai.radius)
        .sort((a, b) => distance(a, ai.home) - distance(b, ai.home))[0];
      if (perch && distance(e.position, perch) < 5 && Math.abs((e.wz ?? 0) - perch.z) < 3)
        enter(e, "perch", 2);
      else if (perch && clearPredatorFlight(e, perch, perch.z, env, planning))
        launchPredatorFlight(e, perch, perch.z, false);
      else enter(e, "rest", 2);
    } else if (!ai.targetId && (fierce?.kind === "dragon" || fierce?.kind === "spider")) {
      if (distance(e.position, ai.home) > 5 && clearPath(e, ai.home, env, planning)) {
        if (ai.state !== "patrol") enter(e, "patrol", 0.3);
        ai.aim = { ...ai.home };
      } else {
        ai.activity = (ai.activity ?? 0) + 1;
        enter(
          e,
          fierce.kind === "spider" ? "ambush" : ai.activity % 3 === 0 ? "sleep" : "guard",
          fierce.kind === "spider" ? 2 : ai.activity % 3 === 0 ? 5 : 2,
        );
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
      } else enter(e, fierce && ai.cooldown > 0 ? "sleep" : "rest", fierce ? 2.5 : 1);
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

/** Called after collision resolution. Only world-origin animals receive a new
 * durable replacement; NPC people, placed prey and ordinary deletions stay gone. */
export function resolvePredatorCatches(
  manager: EntityManager,
  active: readonly Entity[],
  env: WildlifeEnvironment,
  _players: readonly PositionComponent[],
): void {
  for (const hunter of active) {
    const ai = hunter.predator;
    if (
      ai?.state !== "pounce" ||
      ai.elapsed < 0.48 ||
      !hunter.collider ||
      !manager.byId.has(hunter.id)
    )
      continue;
    const prey = active.find(
      (e) => e.persistentId === ai.targetId && manager.byId.has(e.id) && canEat(hunter, e),
    );
    if (
      !prey?.collider ||
      (Math.abs((hunter.wz ?? 0) - (prey.wz ?? 0)) > 4 && !raptorOnPrey(hunter, prey)) ||
      (prey.jumpZ ?? 0) > 1 ||
      (prey.rabbit?.state === "hop" && (prey.wz ?? 0) > (env.surfaceZ?.(prey.position) ?? 0) + 1)
    )
      continue;
    const approach = raptorOnPrey(hunter, prey) ? { ...hunter, wz: prey.wz ?? 0 } : hunter;
    if (bodyGap(hunter, prey) > 3 || !clearPath(approach, prey.position, env)) continue;
    const naturalSpawnId = prey.naturalSpawnId ?? prey.proceduralId;
    if (
      naturalSpawnId &&
      creatureSpecies(prey) !== "person" &&
      !scheduleWildlifeRespawn(manager, prey, () => random(hunter))
    )
      continue;
    manager.remove(prey.id);
    ai.meals++;
    ai.cooldown = 35 + random(hunter) * 20;
    enter(hunter, "feed", 3.84);
  }
}
