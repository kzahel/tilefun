import type { Entity, PositionComponent } from "../entities/Entity.js";
import type { AiPlanningScheduler } from "../server/AiPlanningScheduler.js";
import {
  DEER_FLEE_SPEED,
  DEER_WALK_SPEED,
  restoreDeerPose,
  settleDeer,
  startleDeer,
} from "./deerInteractions.js";
import type { WildlifeEnvironment } from "./mallardAI.js";

const distance = (a: PositionComponent, b: PositionComponent) =>
  Math.hypot(a.wx - b.wx, a.wy - b.wy);
export function updateDeerAI(
  deer: Entity,
  dt: number,
  environment: WildlifeEnvironment,
  animals: readonly Entity[],
  players: readonly PositionComponent[],
  planning?: AiPlanningScheduler,
): void {
  const ai = deer.deer,
    velocity = deer.velocity;
  if (!ai || !velocity || !deer.sprite) return;
  const nearby = players.find((p) => distance(p, deer.position) < 38);
  // Urgent sensing stays live even between planning slots. Avoid building a herd
  // (and calculating every member's distance) on every idle/moving tick.
  const herdAlarm = ai.herdId
    ? animals.find(
        (a) =>
          a !== deer &&
          a.deer?.herdId === ai.herdId &&
          a.deer?.alarmFrom &&
          distance(a.position, deer.position) < 128,
      )?.deer?.alarmFrom
    : undefined;
  if (ai.state !== "recover" && (nearby || herdAlarm))
    startleDeer(deer, nearby ?? herdAlarm ?? deer.position);
  if (ai.motion) return;
  velocity.vx = velocity.vy = 0;
  ai.timer -= dt;
  if (ai.timer > 0) return;
  const random = () => {
    ai.randomState = (Math.imul(ai.randomState, 1664525) + 1013904223) >>> 0;
    return ai.randomState / 4294967296;
  };
  const rest = () => {
    ai.state = "rest";
    ai.timer = 2 + random() * 4;
    if (deer.wanderAI) deer.wanderAI.state = "idle";
    restoreDeerPose(deer);
  };
  if (ai.state === "action" || ai.state === "recover") {
    rest();
    return;
  }
  const escaping = ai.state === "startle";
  if (planning && !planning.claim(deer, escaping)) return;
  if (!escaping && ++ai.activity % 3 === 0) {
    ai.state = "action";
    ai.timer = 0.8;
    restoreDeerPose(deer);
    return;
  }
  const from = ai.alarmFrom ?? deer.position;
  // Ambient cohesion is sensed only when a goal is actually due and admitted.
  const herd = ai.herdId
    ? animals.filter(
        (a) =>
          a !== deer && a.deer?.herdId === ai.herdId && distance(a.position, deer.position) < 128,
      )
    : [];
  let target: PositionComponent | undefined,
    best = -Infinity;
  for (let i = 0; i < 24; i++) {
    if (planning && !planning.candidate(deer)) break;
    const away =
      distance(from, deer.position) < 1
        ? random() * Math.PI * 2
        : Math.atan2(deer.position.wy - from.wy, deer.position.wx - from.wx);
    const angle = escaping ? away + (random() - 0.5) * Math.PI : random() * Math.PI * 2;
    const length = escaping ? 48 + random() * 32 : 24 + random() * 20;
    const point = {
      wx: deer.position.wx + Math.cos(angle) * length,
      wy: deer.position.wy + Math.sin(angle) * length,
    };
    const gain = distance(point, from) - distance(deer.position, from);
    if (
      distance(point, ai.home) > ai.radius - 12 ||
      players.some((p) => distance(point, p) < 34) ||
      animals.some((a) => a !== deer && a.collider?.solid && distance(point, a.position) < 24) ||
      (escaping && gain < 12)
    )
      continue;
    let clear = true;
    const steps = Math.ceil(length / 4);
    if (planning && !planning.path(deer, steps)) continue;
    for (let j = 1; j <= steps; j++) {
      const p = {
        wx: deer.position.wx + ((point.wx - deer.position.wx) * j) / steps,
        wy: deer.position.wy + ((point.wy - deer.position.wy) * j) / steps,
      };
      if (
        environment.isWater(p) ||
        !environment.canOccupy(deer, p) ||
        Math.abs((environment.surfaceZ?.(p) ?? 0) - (deer.wz ?? 0)) > 4
      ) {
        clear = false;
        break;
      }
    }
    if (!clear) continue;
    const cohesion = herd.length
      ? herd.reduce((sum, a) => sum + distance(point, a.position), 0) / herd.length
      : distance(point, ai.home);
    const score = escaping
      ? gain - distance(point, ai.shelter) * 0.15
      : random() * 12 - cohesion * 0.12;
    if (score > best) {
      best = score;
      target = point;
    }
  }
  if (!target) {
    if (escaping) settleDeer(deer);
    else rest();
    return;
  }
  ai.target = target;
  ai.state = escaping ? "flee" : "travel";
  ai.motion = {
    elapsed: 0,
    duration:
      distance(target, deer.position) / (escaping ? DEER_FLEE_SPEED : DEER_WALK_SPEED) + 0.15,
    escaping,
  };
  if (deer.wanderAI) deer.wanderAI.state = escaping ? "scared" : "walking";
  restoreDeerPose(deer);
}
