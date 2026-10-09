import type { Entity, PositionComponent } from "../entities/Entity.js";
import { faunaProfile } from "./Fauna.js";
import { restoreFaunaPose, settleFauna, startleFauna } from "./faunaInteractions.js";
import type { WildlifeEnvironment } from "./mallardAI.js";

const distance = (a: PositionComponent, b: PositionComponent) =>
  Math.hypot(a.wx - b.wx, a.wy - b.wy);
export function updateFaunaAI(
  animal: Entity,
  dt: number,
  environment: WildlifeEnvironment,
  animals: readonly Entity[],
  players: readonly PositionComponent[],
): void {
  const ai = animal.fauna,
    p = faunaProfile(animal.type),
    velocity = animal.velocity;
  if (!ai || !velocity || !animal.sprite || !p) return;
  const random = () => {
    ai.randomState = (Math.imul(ai.randomState, 1664525) + 1013904223) >>> 0;
    return ai.randomState / 4294967296;
  };
  const herd = ai.groupId
    ? animals.filter(
        (a) =>
          a !== animal &&
          a.fauna?.groupId === ai.groupId &&
          distance(a.position, animal.position) < ai.radius * 1.5,
      )
    : [];
  const nearby = players.find((player) => distance(player, animal.position) < p.alarmDistance);
  const herdAlarm = herd.find((a) => a.fauna?.alarmFrom)?.fauna?.alarmFrom;
  if (ai.state !== "recover" && (nearby || herdAlarm))
    startleFauna(animal, nearby ?? herdAlarm ?? animal.position);
  if (ai.motion) return;
  velocity.vx = velocity.vy = 0;
  ai.timer -= dt;
  if (ai.timer > 0) return;
  const rest = () => {
    ai.state = "rest";
    ai.timer = 2 + random() * 4;
    if (animal.wanderAI) animal.wanderAI.state = "idle";
    restoreFaunaPose(animal);
  };
  if (ai.state === "action" || ai.state === "recover") {
    rest();
    return;
  }
  const escaping = ai.state === "startle";
  if (!escaping && ++ai.activity % 3 === 0) {
    ai.state = "action";
    ai.timer = ((p.clips[2]?.count ?? 1) * (p.clips[2]?.frameDuration ?? 100)) / 1000;
    restoreFaunaPose(animal);
    return;
  }
  const from = ai.alarmFrom ?? animal.position;
  let target: PositionComponent | undefined,
    best = -Infinity;
  for (let i = 0; i < 24; i++) {
    const away =
      distance(from, animal.position) < 1
        ? random() * Math.PI * 2
        : Math.atan2(animal.position.wy - from.wy, animal.position.wx - from.wx);
    const angle = escaping ? away + (random() - 0.5) * Math.PI : random() * Math.PI * 2;
    const length = p.step * (escaping ? 1.5 : 0.75) + random() * p.step * 0.6;
    const point = {
      wx: animal.position.wx + Math.cos(angle) * length,
      wy: animal.position.wy + Math.sin(angle) * length,
    };
    const gain = distance(point, from) - distance(animal.position, from);
    if (
      distance(point, ai.home) > ai.radius - p.body[0] / 2 ||
      players.some((player) => distance(point, player) < p.alarmDistance) ||
      animals.some(
        (a) => a !== animal && a.collider?.solid && distance(point, a.position) < p.body[0] + 6,
      ) ||
      (escaping && gain < p.step / 4)
    )
      continue;
    let clear = true;
    const steps = Math.ceil(length / 4);
    for (let j = 1; j <= steps; j++) {
      const p = {
        wx: animal.position.wx + ((point.wx - animal.position.wx) * j) / steps,
        wy: animal.position.wy + ((point.wy - animal.position.wy) * j) / steps,
      };
      if (
        environment.isWater(p) ||
        !environment.canOccupy(animal, p) ||
        Math.abs((environment.surfaceZ?.(p) ?? 0) - (animal.wz ?? 0)) > 4
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
      : random() * 12 -
        cohesion * p.cohesion -
        (players[0] ? distance(point, players[0]) * p.interest : 0);
    if (score > best) {
      best = score;
      target = point;
    }
  }
  if (!target) {
    if (escaping) settleFauna(animal);
    else rest();
    return;
  }
  ai.target = target;
  ai.state = escaping ? "flee" : "travel";
  ai.motion = {
    elapsed: 0,
    duration: distance(target, animal.position) / (p.speed * (escaping ? 2 : 1)) + 0.15,
    escaping,
  };
  if (animal.wanderAI) animal.wanderAI.state = escaping ? "scared" : "walking";
  restoreFaunaPose(animal);
}
