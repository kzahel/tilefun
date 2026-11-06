import type { Entity, PositionComponent } from "../entities/Entity.js";
import { setSpriteClip } from "../entities/spriteAnimation.js";
import { directionFromVelocity } from "../entities/wanderAI.js";
import type { AiPlanningScheduler } from "../server/AiPlanningScheduler.js";
import { lcgNext } from "../shared/Determinism.js";
import { gap } from "../shared/gap.js";
import { settleMallard } from "./mallardInteractions.js";
import type { WildlifeEnvironment } from "./WildlifeEnvironment.js";

/** Bounded local steering. Per-animal RNG and semantic decisions survive residency/restart. */
export function updateMallardAI(
  duck: Entity,
  dt: number,
  environment: WildlifeEnvironment,
  flock: readonly Entity[],
  players: readonly PositionComponent[],
  planning?: AiPlanningScheduler,
): void {
  duck.motionIntent ??= { vx: 0, vy: 0 };
  const ai = duck.mallard,
    sprite = duck.sprite,
    velocity = duck.motionIntent;
  if (!ai || !sprite || !velocity) return;
  const random = () => {
    ai.randomState = lcgNext(ai.randomState);
    return ai.randomState / 4294967296;
  };
  const stop = () => {
    velocity.vx = velocity.vy = 0;
    sprite.moving = false;
    if (duck.wanderAI) duck.wanderAI.state = "idle";
  };
  const rest = () => {
    ai.state = "rest";
    ai.timer = 2 + random() * 4;
    ai.stuck = 0;
    stop();
  };
  const clearPath = (point: PositionComponent) => {
    const steps = Math.ceil(gap(duck.position, point) / 8);
    if (planning && !planning.path(duck, steps)) return false;
    for (let i = 1; i <= steps; i++)
      if (
        !environment.canOccupy(duck, {
          wx: duck.position.wx + ((point.wx - duck.position.wx) * i) / steps,
          wy: duck.position.wy + ((point.wy - duck.position.wy) * i) / steps,
        })
      )
        return false;
    return true;
  };
  if (ai.state === "flight") {
    // The physics loop advances the arc even between lower-frequency decisions.
    if (duck.wanderAI) duck.wanderAI.state = "scared";
    setSpriteClip(duck, 5);
    return;
  }
  if (ai.state === "startle" || ai.state === "recover") {
    ai.timer -= dt;
    if (duck.motionIntent) duck.motionIntent.vx = duck.motionIntent.vy = 0;
    sprite.moving = false;
    if (duck.wanderAI) duck.wanderAI.state = "scared";
    setSpriteClip(duck, ai.state === "startle" ? 4 : 0);
    if (ai.timer > 0) return;
    if (ai.state === "recover") {
      rest();
      return;
    }
    if (planning && !planning.claim(duck, true)) return;
    const from = ai.alarmFrom ?? duck.position;
    let angle = Math.atan2(duck.position.wy - from.wy, duck.position.wx - from.wx);
    if (gap(duck.position, from) < 1) angle = random() * Math.PI * 2;
    for (let i = 0; i < 24; i++) {
      if (planning && !planning.candidate(duck)) break;
      const heading = angle + (random() - 0.5) * (i < 12 ? 1.4 : Math.PI * 2);
      const length = 48 + random() * 48;
      const point = {
        wx: duck.position.wx + Math.cos(heading) * length,
        wy: duck.position.wy + Math.sin(heading) * length,
      };
      if (
        gap(point, ai.home) > ai.radius ||
        !clearPath(point) ||
        players.some((p) => gap(point, p) < 24) ||
        flock.some((e) => e !== duck && e.collider?.solid !== false && gap(point, e.position) < 16)
      )
        continue;
      ai.target = point;
      ai.flight = {
        elapsed: 0,
        duration: length / 60,
        startZ: duck.wz ?? 0,
        endZ: environment.surfaceZ?.(point) ?? duck.wz ?? 0,
      };
      ai.state = "flight";
      sprite.direction = directionFromVelocity(
        point.wx - duck.position.wx,
        point.wy - duck.position.wy,
      );
      sprite.frameRow = sprite.direction;
      sprite.moving = true;
      setSpriteClip(duck, 5);
      return;
    }
    // A crowded or enclosed bank still gives a quack and settling pause.
    settleMallard(
      duck,
      environment.surfaceZ?.(duck.position) ?? duck.wz ?? 0,
      environment.isWater(duck.position),
    );
    return;
  }
  const chooseTarget = (away?: PositionComponent) => {
    // Alternate water/bank visits when both are reachable, without requiring water
    // for an editor-created duck on dry ground.
    const preferWater = !environment.isWater(duck.position);
    let fallback: PositionComponent | undefined;
    for (let i = 0; i < 16; i++) {
      if (planning && !planning.candidate(duck)) break;
      const angle = away
        ? Math.atan2(duck.position.wy - away.wy, duck.position.wx - away.wx) +
          (random() - 0.5) * 1.2
        : random() * Math.PI * 2;
      const radius = away ? 40 + random() * 35 : 30 + random() * ai.radius * 0.65;
      const origin = away ? duck.position : ai.home;
      const point = {
        wx: origin.wx + Math.cos(angle) * radius,
        wy: origin.wy + Math.sin(angle) * radius,
      };
      if (gap(point, ai.home) > ai.radius || !clearPath(point)) continue;
      fallback ??= point;
      if (away || environment.isWater(point) === preferWater) {
        fallback = point;
        break;
      }
    }
    if (!fallback) {
      rest();
      return;
    }
    ai.target = fallback;
    ai.state = "travel";
    ai.timer = 16;
    ai.stuck = 0;
  };
  const nearPlayer = players.find((p) => gap(duck.position, p) < 24);
  ai.timer -= dt;
  if (ai.state === "travel") {
    if (gap(duck.position, ai.last) < 0.15) ai.stuck += dt;
    else ai.stuck = 0;
    ai.last = { ...duck.position };
    if (gap(duck.position, ai.target) < 4 || ai.timer <= 0 || ai.stuck > 1) rest();
  }
  if (ai.timer <= 0) {
    if (ai.state === "rest") {
      if (planning && !planning.claim(duck, !!nearPlayer)) {
        stop();
        // Terrain edits/teleports remain visible while an ambient goal is queued.
        duck.noShadow = environment.isWater(duck.position);
        setSpriteClip(duck, 0);
        return;
      }
      // Alternate travel with occasional display cycles; RNG varies rests/targets.
      if (nearPlayer) chooseTarget(nearPlayer);
      else if (++ai.activity % 4 === 0) {
        ai.state = "quack";
        ai.timer = 0.96;
      } else if (ai.activity % 4 === 2) {
        ai.state = "flap";
        ai.timer = 1.28;
      } else chooseTarget();
    } else rest();
  }
  if (
    nearPlayer &&
    ai.state !== "travel" &&
    ai.timer > 0 &&
    (!planning || planning.claim(duck, true))
  )
    chooseTarget(nearPlayer);
  if (ai.state === "travel") {
    let dx = ai.target.wx - duck.position.wx,
      dy = ai.target.wy - duck.position.wy;
    const len = Math.hypot(dx, dy);
    dx /= Math.max(1, len);
    dy /= Math.max(1, len);
    // Small local separation keeps a flock loose. Terrain/props remain authoritative.
    for (const other of flock) {
      if (other === duck || !other.mallard) continue;
      const d = gap(duck.position, other.position);
      if (d > 0 && d < 20) {
        dx += ((duck.position.wx - other.position.wx) / d) * (1 - d / 20) * 0.8;
        dy += ((duck.position.wy - other.position.wy) / d) * (1 - d / 20) * 0.8;
      }
    }
    const norm = Math.max(0.01, Math.hypot(dx, dy));
    dx /= norm;
    dy /= norm;
    const next = { wx: duck.position.wx + dx * 8, wy: duck.position.wy + dy * 8 };
    if (gap(next, ai.home) > ai.radius || !environment.canOccupy(duck, next)) {
      rest();
    } else {
      const water = environment.isWater(duck.position),
        speed = water ? 11 : 13;
      velocity.vx = dx * speed;
      velocity.vy = dy * speed;
      sprite.moving = true;
      sprite.direction = directionFromVelocity(dx, dy);
      sprite.frameRow = sprite.direction;
      setSpriteClip(duck, water ? 2 : 1);
      if (duck.wanderAI) duck.wanderAI.state = "walking";
      duck.noShadow = water;
      return;
    }
  }
  stop();
  duck.noShadow = environment.isWater(duck.position);
  setSpriteClip(duck, ai.state === "quack" ? 4 : ai.state === "flap" ? 3 : 0);
}
