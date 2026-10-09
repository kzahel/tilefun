import type { Entity, PositionComponent } from "../entities/Entity.js";
import { directionFromVelocity } from "../entities/wanderAI.js";
import { restoreFrogPose, settleFrog, startleFrog } from "./frogInteractions.js";
import type { WildlifeEnvironment } from "./mallardAI.js";

const distance = (a: PositionComponent, b: PositionComponent) =>
  Math.hypot(a.wx - b.wx, a.wy - b.wy);
/** Short hops, kick/glide swims and quiet bank rests; all decisions are durable. */
export function updateFrogAI(
  frog: Entity,
  dt: number,
  environment: WildlifeEnvironment,
  animals: readonly Entity[],
  players: readonly PositionComponent[],
): void {
  const ai = frog.frog,
    velocity = frog.velocity,
    sprite = frog.sprite;
  if (!ai || !velocity || !sprite) return;
  const random = () => {
    ai.randomState = (Math.imul(ai.randomState, 1664525) + 1013904223) >>> 0;
    return ai.randomState / 4294967296;
  };
  const stop = () => {
    velocity.vx = velocity.vy = 0;
    sprite.moving = false;
  };
  const rest = () => {
    ai.state = "rest";
    ai.timer = 1.8 + random() * 3.2;
    ai.stuck = 0;
    stop();
    if (frog.wanderAI) frog.wanderAI.state = "idle";
    restoreFrogPose(frog);
  };
  // Airborne motion is integrated by physics, even between slower AI decisions.
  if (ai.state === "hop") return;
  const nearby = players.find((p) => distance(p, frog.position) < 20);
  if (nearby && ai.state !== "recover") startleFrog(frog, nearby);
  const chooseMove = (escaping: boolean) => {
    const water = environment.isWater(frog.position);
    const preferWater = escaping || !water;
    let candidate: PositionComponent | undefined;
    const from = ai.alarmFrom ?? frog.position;
    const away =
      distance(from, frog.position) < 1
        ? random() * Math.PI * 2
        : Math.atan2(frog.position.wy - from.wy, frog.position.wx - from.wx);
    for (let i = 0; i < 24; i++) {
      const angle = escaping
        ? away + (random() - 0.5) * (i < 12 ? 1.5 : Math.PI * 2)
        : random() * Math.PI * 2;
      const length = (escaping ? 26 : 18) + random() * (water ? 26 : 16);
      const point = {
        wx: frog.position.wx + Math.cos(angle) * length,
        wy: frog.position.wy + Math.sin(angle) * length,
      };
      if (
        distance(point, ai.home) > ai.radius ||
        players.some((p) => distance(point, p) < 16) ||
        animals.some((a) => a !== frog && a.collider?.solid && distance(point, a.position) < 12)
      )
        continue;
      let clear = true;
      for (let step = 1; step <= Math.ceil(length / 4); step++) {
        const f = step / Math.ceil(length / 4);
        const p = {
          wx: frog.position.wx + (point.wx - frog.position.wx) * f,
          wy: frog.position.wy + (point.wy - frog.position.wy) * f,
        };
        if (
          !environment.canOccupy(frog, p) ||
          Math.abs((environment.surfaceZ?.(p) ?? 0) - (frog.wz ?? 0)) > 4
        ) {
          clear = false;
          break;
        }
      }
      if (!clear) continue;
      candidate ??= point;
      if (environment.isWater(point) === preferWater) {
        candidate = point;
        break;
      }
    }
    if (!candidate) {
      if (escaping) settleFrog(frog, environment.surfaceZ?.(frog.position) ?? 0, water);
      else rest();
      return;
    }
    ai.target = candidate;
    ai.last = { ...frog.position };
    ai.stuck = 0;
    sprite.direction = directionFromVelocity(
      candidate.wx - frog.position.wx,
      candidate.wy - frog.position.wy,
    );
    sprite.frameRow = sprite.direction;
    if (water) {
      ai.state = "swim";
      ai.timer = 5;
    } else {
      ai.state = "hop";
      ai.hop = { elapsed: 0, startZ: frog.wz ?? 0, endZ: environment.surfaceZ?.(candidate) ?? 0 };
      stop();
    }
    if (frog.wanderAI) frog.wanderAI.state = escaping ? "scared" : "walking";
    restoreFrogPose(frog);
  };
  ai.timer -= dt;
  if (ai.state === "startle") {
    stop();
    if (ai.timer <= 0) chooseMove(true);
    return;
  }
  if (ai.state === "swim") {
    if (distance(frog.position, ai.last) < 0.1) ai.stuck += dt;
    else ai.stuck = 0;
    ai.last = { ...frog.position };
    if (distance(frog.position, ai.target) < 3 || ai.timer <= 0 || ai.stuck > 0.8) {
      if (ai.alarmFrom)
        settleFrog(
          frog,
          environment.surfaceZ?.(frog.position) ?? 0,
          environment.isWater(frog.position),
        );
      else rest();
      return;
    }
    // Leave the water by a real hop, rather than swimming over dry land.
    if (!environment.isWater(frog.position)) {
      ai.state = "hop";
      ai.hop = { elapsed: 0, startZ: frog.wz ?? 0, endZ: environment.surfaceZ?.(ai.target) ?? 0 };
      stop();
      restoreFrogPose(frog);
      return;
    }
    const dx = ai.target.wx - frog.position.wx,
      dy = ai.target.wy - frog.position.wy;
    const length = Math.max(1, Math.hypot(dx, dy));
    const next = {
      wx: frog.position.wx + (dx / length) * 4,
      wy: frog.position.wy + (dy / length) * 4,
    };
    if (!environment.canOccupy(frog, next)) {
      settleFrog(frog, environment.surfaceZ?.(frog.position) ?? 0, true);
      return;
    }
    velocity.vx = (dx / length) * (ai.alarmFrom ? 24 : 15);
    velocity.vy = (dy / length) * (ai.alarmFrom ? 24 : 15);
    sprite.moving = true;
    frog.noShadow = true;
    return;
  }
  stop();
  frog.noShadow = environment.isWater(frog.position);
  if (ai.timer > 0) return;
  if (ai.state === "recover" || ai.state === "blink") {
    rest();
    return;
  }
  ai.activity++;
  if (ai.activity % 3 === 0) {
    ai.state = "blink";
    ai.timer = 0.84;
    restoreFrogPose(frog);
  } else chooseMove(false);
}
