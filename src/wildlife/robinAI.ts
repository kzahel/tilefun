import type { Entity, PositionComponent } from "../entities/Entity.js";
import type { WildlifeEnvironment } from "./mallardAI.js";
import type { RobinPerch } from "./Robin.js";
import { restoreRobinPose, robinMotionZ, settleRobin, startleRobin } from "./robinInteractions.js";

const distance = (a: PositionComponent, b: PositionComponent) =>
  Math.hypot(a.wx - b.wx, a.wy - b.wy);
export function updateRobinAI(
  bird: Entity,
  dt: number,
  environment: WildlifeEnvironment,
  animals: readonly Entity[],
  players: readonly PositionComponent[],
): void {
  const ai = bird.robin,
    velocity = bird.velocity;
  if (!ai || !velocity || !bird.sprite) return;
  const random = () => {
    ai.randomState = (Math.imul(ai.randomState, 1664525) + 1013904223) >>> 0;
    return ai.randomState / 4294967296;
  };
  if (ai.motion) return;
  const perches = environment.perches?.(ai.home, ai.radius) ?? [];
  const perched = perches.some(
    (p) => distance(p, bird.position) < 2 && Math.abs(p.z - (bird.wz ?? 0)) < 1,
  );
  const nearby = players.find((p) => distance(p, bird.position) < (perched ? 12 : 26));
  if (nearby && ai.state !== "recover") startleRobin(bird, nearby);
  velocity.vx = velocity.vy = 0;
  ai.timer -= dt;
  if (ai.timer > 0) return;
  const escaping = ai.state === "startle";
  const rest = () => {
    ai.state = perched ? "perch" : "rest";
    ai.timer = 1.8 + random() * 3.2;
    if (bird.wanderAI) bird.wanderAI.state = "idle";
    restoreRobinPose(bird);
  };
  if (ai.state === "recover" || ai.state === "action") {
    rest();
    return;
  }
  if (!escaping) {
    ai.activity++;
    if (ai.activity % 3 === 0) {
      ai.state = "action";
      ai.timer = 0.72;
      restoreRobinPose(bird);
      return;
    }
  }
  const flying = escaping || perched || ai.activity % 2 === 0;
  const from = ai.alarmFrom ?? bird.position;
  let target: RobinPerch | undefined,
    best = -Infinity;
  const candidates: RobinPerch[] = flying && !perched ? [...perches] : [];
  for (let i = 0; i < 24; i++) {
    const away =
      distance(from, bird.position) < 1
        ? random() * Math.PI * 2
        : Math.atan2(bird.position.wy - from.wy, bird.position.wx - from.wx);
    const angle = escaping ? away + (random() - 0.5) * Math.PI : random() * Math.PI * 2;
    const length = flying ? 40 + random() * 40 : 12 + random() * 12;
    const p = {
      wx: bird.position.wx + Math.cos(angle) * length,
      wy: bird.position.wy + Math.sin(angle) * length,
    };
    candidates.push({ ...p, z: environment.surfaceZ?.(p) ?? 0 });
  }
  for (const p of candidates) {
    const length = distance(p, bird.position),
      gain = distance(p, from) - distance(bird.position, from);
    if (
      length < 10 ||
      distance(p, ai.home) > ai.radius - 8 ||
      environment.isWater(p) ||
      players.some((player) => distance(p, player) < 22) ||
      animals.some(
        (a) =>
          a !== bird &&
          a.collider?.solid &&
          distance(p, a.position) < 12 &&
          Math.abs((a.wz ?? 0) - p.z) < 10,
      ) ||
      (escaping && gain < 10)
    )
      continue;
    let clear = true;
    const steps = Math.ceil(length / 3);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps,
        point = {
          wx: bird.position.wx + (p.wx - bird.position.wx) * t,
          wy: bird.position.wy + (p.wy - bird.position.wy) * t,
        };
      const z = robinMotionZ(flying ? "flight" : "hop", bird.wz ?? 0, p.z, t);
      if (
        environment.isWater(point) ||
        !environment.canOccupy({ ...bird, wz: z }, point) ||
        (!flying && Math.abs((environment.surfaceZ?.(point) ?? 0) - (bird.wz ?? 0)) > 4)
      ) {
        clear = false;
        break;
      }
    }
    if (!clear || !environment.canOccupy({ ...bird, wz: p.z }, p)) continue;
    const score = escaping ? gain + (p.z > 4 ? 12 : 0) : p.z > 4 ? 2 + random() : random();
    if (score > best) {
      best = score;
      target = p;
    }
  }
  if (!target) {
    if (escaping) settleRobin(bird, bird.wz ?? 0);
    else rest();
    return;
  }
  ai.target = target;
  ai.state = flying ? "flight" : "hop";
  ai.motion = {
    elapsed: 0,
    duration: flying ? 1.6 : 0.96,
    startZ: bird.wz ?? 0,
    endZ: target.z,
    escaping,
  };
  if (bird.wanderAI) bird.wanderAI.state = escaping ? "scared" : "walking";
  restoreRobinPose(bird);
}
