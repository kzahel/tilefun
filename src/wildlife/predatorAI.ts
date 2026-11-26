import { CLASSIC_COW_INTERACTION_FOOTPRINT } from "../entities/Cow.js";
import { getEntityAABB } from "../entities/collision.js";
import type { Entity, PositionComponent } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import { lcgNext } from "../shared/Determinism.js";
import { gap } from "../shared/gap.js";
import { required } from "../shared/required.js";
import { restorePredatorPose } from "./PredatorMotion.js";
import {
  clearPredatorFlight,
  clearPredatorPath,
  dragonReturnLanding,
  griffinPerchApproach,
  nearestPredatorPerch,
} from "./PredatorPaths.js";

export { predatorHabitatAllows } from "./PredatorHabitat.js";
export { clearPredatorFlight } from "./PredatorPaths.js";

import { directionFromVelocity } from "../entities/wanderAI.js";
import { durableId } from "../persistence/ActorRecords.js";
import type { AiPlanningScheduler } from "../server/AiPlanningScheduler.js";
import { DEER_TYPE } from "./Deer.js";
import { startleDeer } from "./deerInteractions.js";
import { faunaProfile } from "./Fauna.js";
import { FAUNA_TORSO_FITS } from "./FaunaColliders.js";
import { canEat, creatureSpecies } from "./FoodWeb.js";
import { startleFauna } from "./faunaInteractions.js";
import { startleFrog } from "./frogInteractions.js";
import { startleMallard } from "./mallardInteractions.js";
import { PREDATOR_TORSO_FITS, predatorProfile } from "./Predator.js";
import { startleRabbit } from "./rabbitInteractions.js";
import { startleRobin } from "./robinInteractions.js";
import type { WildlifeEnvironment } from "./WildlifeEnvironment.js";
import { scheduleWildlifeRespawn } from "./WildlifeRespawns.js";

const random = (e: Entity) => {
  const ai = required(e.predator);
  ai.randomState = lcgNext(ai.randomState);
  return ai.randomState / 4294967296;
};
const POST_MEAL_NAP = new Set(["rex", "wolf"]);
function enter(e: Entity, state: NonNullable<Entity["predator"]>["state"], timer: number) {
  e.motionIntent ??= { vx: 0, vy: 0 };
  const ai = required(e.predator);
  ai.state = state;
  ai.timer = timer;
  ai.elapsed = 0;
  if (e.motionIntent) e.motionIntent.vx = e.motionIntent.vy = 0;
  if (["rest", "feed", "scared", "patrol", "sleep", "guard", "ambush", "perch"].includes(state))
    delete ai.aim;
  if (["rest", "feed", "scared", "evade", "sleep", "guard", "ambush", "perch"].includes(state)) {
    delete ai.targetId;
    delete ai.huntElapsed;
  }
  restorePredatorPose(e);
}
/** Cancel a smaller predator's own hunt before it escapes a larger hunter. */
export function alarmPrey(prey: Entity, from: PositionComponent): void {
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
function physicalBounds(e: Entity) {
  return e.collider ? getEntityAABB(e.position, e.collider) : undefined;
}

/** Hunting reach uses the authored horizontal footprint independently of back support. */
function huntBounds(e: Entity) {
  if (!e.collider) return;
  if (e.type === "cow") return getEntityAABB(e.position, CLASSIC_COW_INTERACTION_FOOTPRINT);
  const predator = predatorProfile(e.type);
  const fauna = faunaProfile(e.type);
  let body: readonly [width: number, height: number, support?: number] | undefined;
  if (predator && PREDATOR_TORSO_FITS[predator.species]) body = predator.body;
  else if (fauna && FAUNA_TORSO_FITS[fauna.species]) body = fauna.body;
  // The dedicated woodland deer has no fauna profile.
  else if (e.type === DEER_TYPE) body = [20, 10];
  if (!body) return physicalBounds(e);
  const [width, height] = body;
  return getEntityAABB(e.position, { offsetX: 0, offsetY: 0, width, height });
}

function bodyGap(a: Entity, b: Entity, bounds = huntBounds): number {
  const x = bounds(a),
    y = bounds(b);
  if (!x || !y) return Infinity;
  return Math.hypot(
    Math.max(x.left - y.right, y.left - x.right, 0),
    Math.max(x.top - y.bottom, y.top - x.bottom, 0),
  );
}

function withinHuntReach(hunter: Entity, prey: Entity, reach: number): boolean {
  // Fitted bodies can touch outside the original hunting footprints.
  return bodyGap(hunter, prey) <= reach || bodyGap(hunter, prey, physicalBounds) === 0;
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
    bodyGap(hunter, prey, physicalBounds) === 0
  );
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
    duration: Math.max(0.8, gap(e.position, to) / speed),
    from: { ...e.position },
    to: { ...to },
    startZ: e.wz ?? 0,
    endZ,
    lift: 28,
    attack,
  };
  enter(e, "flight", 0);
}
function movePredatorToward(e: Entity, target: PositionComponent, speedLimit: number, dt: number) {
  const dx = target.wx - e.position.wx;
  const dy = target.wy - e.position.wy;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0.1) return;
  const speed = Math.min(speedLimit, distance / dt);
  const intent = required(e.motionIntent);
  intent.vx = (dx / distance) * speed;
  intent.vy = (dy / distance) * speed;
  const sprite = required(e.sprite);
  sprite.frameRow = sprite.direction = directionFromVelocity(dx, dy);
  required(e.predator).facing = sprite.direction;
}

function returnToPredatorPerch(
  e: Entity,
  griffin: boolean,
  perch: NonNullable<ReturnType<typeof nearestPredatorPerch>>,
  env: WildlifeEnvironment,
  planning?: AiPlanningScheduler,
): void {
  const ai = required(e.predator);
  const approach = griffin && griffinPerchApproach(e, perch, env, planning);
  if (approach) {
    if (ai.state !== "patrol") enter(e, "patrol", 0.3);
    ai.aim = approach;
  } else if (gap(e.position, perch) < 5 && Math.abs((e.wz ?? 0) - perch.z) < 3)
    enter(e, "perch", 2);
  else if (clearPredatorFlight(e, perch, perch.z, env, planning))
    launchPredatorFlight(e, perch, perch.z, false);
  else enter(e, "rest", 2);
}

function finishPredatorPause(e: Entity, kind: string | undefined): void {
  const ai = required(e.predator);
  if (ai.timer > 0) return;
  delete ai.alarmFrom;
  if (ai.state === "feed" && POST_MEAL_NAP.has(kind ?? "")) enter(e, "sleep", 2.5);
  else enter(e, "rest", 1 + random(e) * 2);
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
  e.motionIntent ??= { vx: 0, vy: 0 };
  const ai = e.predator,
    v = e.motionIntent;
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
    const visitor = players.find((p) => gap(p, ai.home) < 64);
    if (visitor) {
      ai.warningCooldown = 10;
      enter(e, "display", 1.28);
      ai.displaySerial = (ai.displaySerial ?? 0) + 1;
      e.sprite.direction = directionFromVelocity(
        visitor.wx - e.position.wx,
        visitor.wy - e.position.wy,
      );
      e.sprite.frameRow = e.sprite.direction;
      ai.facing = e.sprite.direction;
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
      (!ai.aim || gap(e.position, ai.aim) < 4) &&
      (!planning || planning.claim(e, true))
    ) {
      const dx = e.position.wx - ai.alarmFrom.wx,
        dy = e.position.wy - ai.alarmFrom.wy,
        d = Math.hypot(dx, dy) || 1;
      const point = { wx: e.position.wx + (dx / d) * 72, wy: e.position.wy + (dy / d) * 72 };
      if (clearPredatorPath(e, point, env, planning)) ai.aim = point;
    }
    if (ai.aim) movePredatorToward(e, ai.aim, profile.chaseSpeed, dt);
    restorePredatorPose(e);
    return;
  }
  if (
    ai.state === "feed" ||
    ai.state === "scared" ||
    ai.state === "sleep" ||
    (ai.state === "rest" && ai.timer > 0)
  ) {
    finishPredatorPause(e, fierce?.kind);
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
      gap(e.position, ai.home) > ai.radius ||
      gap(prey.position, ai.home) > ai.radius ||
      gap(prey.position, e.position) > (fierce?.sense ?? 180) + 32)
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
        (gap(e.position, prey.position) > 24 ||
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
    const d = gap(e.position, prey.position);
    if (ai.state === "stalk" && (d < 52 || ai.elapsed > 2)) enter(e, "chase", 0);
    if (
      ai.state === "chase" &&
      withinHuntReach(e, prey, 4) &&
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
      // Search the actual sensing neighborhood, not the wider loaded population.
      // Loose food and distant actors must not hide nearby prey in the quota.
      const radius = (fierce?.sense ?? 160) + 32;
      const candidates =
        env.huntCandidates?.(e, radius) ??
        animals.filter((a) => !a.workItem && gap(a.position, e.position) <= radius);
      const start = Math.floor(random(e) * Math.max(1, candidates.length));
      for (let i = 0; i < Math.min(24, candidates.length); i++) {
        if (planning && !planning.candidate(e)) break;
        const a = required(candidates[(start + i) % candidates.length]);
        const d = gap(e.position, a.position);
        const ally = a.predator;
        if (
          fierce?.kind === "wolf" &&
          a !== e &&
          a.type === e.type &&
          ally?.targetId &&
          (ai.packId ? ally.packId === ai.packId : !ally.packId && gap(ai.home, ally.home) < 96)
        ) {
          const shared = animals.find((animal) => animal.persistentId === ally.targetId);
          if (
            shared &&
            canEat(e, shared) &&
            gap(e.position, shared.position) < (fierce?.sense ?? 160) &&
            gap(shared.position, ai.home) < ai.radius &&
            clearPredatorPath(e, shared.position, env, planning)
          )
            packTarget = shared;
        }
        if (
          canEat(e, a) &&
          d < best &&
          gap(a.position, ai.home) < ai.radius &&
          (fierce?.kind === "griffin" || fierce?.kind === "raptor"
            ? clearPredatorFlight(e, a.position, env.surfaceZ?.(a.position) ?? 0, env, planning)
            : clearPredatorPath(e, a.position, env, planning))
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
          ai.facing = e.sprite.direction;
          alarmPrey(nearest, e.position);
          for (let i = 0; i < Math.min(48, candidates.length); i++) {
            if (planning && !planning.candidate(e)) break;
            const animal = required(candidates[(start + i) % candidates.length]);
            if (canEat(e, animal) && gap(e.position, animal.position) < fierce.displayRadius)
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
    const perch =
      target || ai.targetId
        ? undefined
        : nearestPredatorPerch(fierce?.kind, ai.home, ai.radius, env);
    if (target) {
      if (clearPredatorPath(e, target, env, planning)) ai.aim = { ...target };
      else {
        ai.cooldown = 3;
        enter(e, "rest", 1);
      }
    } else if (!ai.targetId && perch) {
      returnToPredatorPerch(e, fierce?.kind === "griffin", perch, env, planning);
    } else if (!ai.targetId && fierce?.kind === "raptor" && ai.cooldown > 0) {
      enter(e, "sleep", 2.5);
    } else if (!ai.targetId && (fierce?.kind === "dragon" || fierce?.kind === "spider")) {
      const landing = fierce.kind === "dragon" && dragonReturnLanding(e, ai.home, env, planning);
      if (landing) launchPredatorFlight(e, landing.point, landing.z, false);
      else if (gap(e.position, ai.home) > 5 && clearPredatorPath(e, ai.home, env, planning)) {
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
    } else if (!ai.targetId && (!ai.aim || ai.elapsed > 4 || gap(e.position, ai.aim) < 3)) {
      const angle = random(e) * Math.PI * 2;
      const point = {
        wx: ai.home.wx + Math.cos(angle) * 48,
        wy: ai.home.wy + Math.sin(angle) * 48,
      };
      if (
        (!planning || planning.candidate(e)) &&
        !players.some((p) => gap(p, point) < 24) &&
        clearPredatorPath(e, point, env, planning)
      ) {
        enter(e, "patrol", 0.3);
        ai.aim = point;
      } else enter(e, fierce && ai.cooldown > 0 ? "sleep" : "rest", fierce ? 2.5 : 1);
    }
  }
  if (ai.aim) {
    const speed =
      ai.state === "chase" || ai.state === "pounce" ? profile.chaseSpeed : profile.speed;
    movePredatorToward(e, ai.aim, speed, dt);
  }
  restorePredatorPose(e);
}

/** Shared physical meal transaction for native predators and fauna fox pounces. */
export function consumeWildlifePrey(
  manager: EntityManager,
  hunter: Entity,
  prey: Entity,
  env: WildlifeEnvironment,
  randomValue: () => number,
): boolean {
  if (
    !manager.byId.has(hunter.id) ||
    !manager.byId.has(prey.id) ||
    !canEat(hunter, prey) ||
    !hunter.collider ||
    !prey.collider ||
    (Math.abs((hunter.wz ?? 0) - (prey.wz ?? 0)) > 4 && !raptorOnPrey(hunter, prey)) ||
    (prey.jumpZ ?? 0) > 1 ||
    (prey.rabbit?.state === "hop" && (prey.wz ?? 0) > (env.surfaceZ?.(prey.position) ?? 0) + 1)
  )
    return false;
  const approach = raptorOnPrey(hunter, prey) ? { ...hunter, wz: prey.wz ?? 0 } : hunter;
  if (!withinHuntReach(hunter, prey, 3) || !clearPredatorPath(approach, prey.position, env))
    return false;
  const naturalSpawnId = prey.naturalSpawnId ?? prey.proceduralId;
  if (
    naturalSpawnId &&
    creatureSpecies(prey) !== "person" &&
    !scheduleWildlifeRespawn(manager, prey, randomValue)
  )
    return false;
  manager.remove(prey.id);
  return true;
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
    if (!prey || !consumeWildlifePrey(manager, hunter, prey, env, () => random(hunter))) continue;
    ai.meals++;
    ai.cooldown = 35 + random(hunter) * 20;
    enter(hunter, "feed", 3.84);
  }
}
