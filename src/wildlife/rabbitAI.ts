import type { Entity, PositionComponent } from "../entities/Entity.js";
import type { WildlifeEnvironment } from "./mallardAI.js";
import { restoreRabbitPose, settleRabbit, startleRabbit } from "./rabbitInteractions.js";

const distance = (a: PositionComponent, b: PositionComponent) =>
  Math.hypot(a.wx - b.wx, a.wy - b.wy);
/** Bounded dry-ground hops, quiet action cycles and short escapes toward open cover. */
export function updateRabbitAI(
  rabbit: Entity,
  dt: number,
  environment: WildlifeEnvironment,
  animals: readonly Entity[],
  players: readonly PositionComponent[],
): void {
  const ai = rabbit.rabbit,
    velocity = rabbit.velocity;
  if (!ai || !velocity || !rabbit.sprite) return;
  const random = () => {
    ai.randomState = (Math.imul(ai.randomState, 1664525) + 1013904223) >>> 0;
    return ai.randomState / 4294967296;
  };
  const rest = () => {
    ai.state = "rest";
    ai.timer = 1.8 + random() * 3.2;
    velocity.vx = velocity.vy = 0;
    if (rabbit.wanderAI) rabbit.wanderAI.state = "idle";
    restoreRabbitPose(rabbit);
  };
  // Physics owns the native hop phase between slower authority AI decisions.
  if (ai.state === "hop") return;
  const nearby = players.find((p) => distance(p, rabbit.position) < 26);
  if (nearby && ai.state !== "recover") startleRabbit(rabbit, nearby);
  const chooseHop = (escaping: boolean) => {
    const from = ai.alarmFrom ?? rabbit.position;
    const away =
      distance(from, rabbit.position) < 1
        ? random() * Math.PI * 2
        : Math.atan2(rabbit.position.wy - from.wy, rabbit.position.wx - from.wx);
    let candidate: PositionComponent | undefined,
      best = -Infinity;
    for (let i = 0; i < 24; i++) {
      const angle = escaping
        ? away + (random() - 0.5) * (i < 16 ? 2 : Math.PI * 2)
        : random() * Math.PI * 2;
      const length = (escaping ? 30 : 18) + random() * (escaping ? 18 : 12);
      const point = {
        wx: rabbit.position.wx + Math.cos(angle) * length,
        wy: rabbit.position.wy + Math.sin(angle) * length,
      };
      if (
        distance(point, ai.home) > ai.radius ||
        players.some((p) => distance(point, p) < 22) ||
        animals.some((a) => a !== rabbit && a.collider?.solid && distance(point, a.position) < 14)
      )
        continue;
      let clear = true;
      const steps = Math.ceil(length / 4);
      for (let step = 1; step <= steps; step++) {
        const f = step / steps;
        const p = {
          wx: rabbit.position.wx + (point.wx - rabbit.position.wx) * f,
          wy: rabbit.position.wy + (point.wy - rabbit.position.wy) * f,
        };
        if (
          environment.isWater(p) ||
          !environment.canOccupy(rabbit, p) ||
          Math.abs((environment.surfaceZ?.(p) ?? 0) - (rabbit.wz ?? 0)) > 4
        ) {
          clear = false;
          break;
        }
      }
      if (!clear) continue;
      // Escape must gain distance from the threat; cover preference cannot reverse it.
      const gain = distance(point, from) - distance(rabbit.position, from);
      if (escaping && gain < 8) continue;
      const score = escaping ? gain - distance(point, ai.shelter) * 0.4 : random();
      if (score > best) {
        best = score;
        candidate = point;
      }
    }
    if (!candidate) {
      if (escaping) settleRabbit(rabbit, environment.surfaceZ?.(rabbit.position) ?? 0);
      else rest();
      return;
    }
    ai.target = candidate;
    ai.state = "hop";
    ai.hop = {
      elapsed: 0,
      startZ: rabbit.wz ?? 0,
      endZ: environment.surfaceZ?.(candidate) ?? 0,
      escaping,
    };
    velocity.vx = velocity.vy = 0;
    if (rabbit.wanderAI) rabbit.wanderAI.state = escaping ? "scared" : "walking";
    restoreRabbitPose(rabbit);
  };
  ai.timer -= dt;
  if (ai.state === "startle") {
    if (ai.timer <= 0) chooseHop(true);
    return;
  }
  velocity.vx = velocity.vy = 0;
  if (ai.timer > 0) return;
  if (ai.state === "recover" || ai.state === "action") {
    rest();
    return;
  }
  ai.activity++;
  if (ai.activity % 3 === 0) {
    ai.state = "action";
    ai.timer = 0.75;
    restoreRabbitPose(rabbit);
  } else chooseHop(false);
}
