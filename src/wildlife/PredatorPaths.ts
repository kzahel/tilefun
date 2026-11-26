import type { Entity, PositionComponent } from "../entities/Entity.js";
import type { AiPlanningScheduler } from "../server/AiPlanningScheduler.js";
import { gap } from "../shared/gap.js";
import { predatorHabitatAllows } from "./PredatorHabitat.js";
import { predatorFlightZ } from "./PredatorMotion.js";
import type { WildlifeEnvironment } from "./WildlifeEnvironment.js";

export function clearPredatorPath(
  e: Entity,
  to: PositionComponent,
  env: WildlifeEnvironment,
  planning?: AiPlanningScheduler,
): boolean {
  const steps = Math.max(1, Math.ceil(gap(e.position, to) / 4));
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
  const steps = Math.max(1, Math.ceil(gap(e.position, to) / 4));
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
export function nearestPredatorPerch(
  kind: string | undefined,
  home: PositionComponent,
  radius: number,
  env: WildlifeEnvironment,
) {
  if (kind !== "griffin" && kind !== "raptor") return undefined;
  return env
    .predatorPerches?.(home, radius)
    ?.filter((perch) => gap(perch, home) < radius)
    .sort((a, b) => gap(a, home) - gap(b, home))[0];
}

/** A resting griffin takes a short run-up before returning to its perch. */
export function griffinPerchApproach(
  hunter: Entity,
  perch: PositionComponent,
  env: WildlifeEnvironment,
  planning?: AiPlanningScheduler,
): PositionComponent | undefined {
  const ai = hunter.predator;
  if (!ai?.cooldown || (hunter.wz ?? 0) > 4) return undefined;
  if (ai.state === "patrol" && ai.elapsed >= 1) return undefined;
  const distance = gap(hunter.position, perch);
  if (distance <= 54) return undefined;
  const ratio = 14 / distance;
  const point = {
    wx: hunter.position.wx + (perch.wx - hunter.position.wx) * ratio,
    wy: hunter.position.wy + (perch.wy - hunter.position.wy) * ratio,
  };
  return clearPredatorPath(hunter, point, env, planning) ? point : undefined;
}

/** A dragon lands short of its hoard and walks the last stretch. */
export function dragonReturnLanding(
  hunter: Entity,
  home: PositionComponent,
  env: WildlifeEnvironment,
  planning?: AiPlanningScheduler,
) {
  const distance = gap(hunter.position, home);
  if (!hunter.predator?.cooldown || distance < 64) return undefined;
  const ratio = 32 / distance;
  const point = {
    wx: home.wx + (hunter.position.wx - home.wx) * ratio,
    wy: home.wy + (hunter.position.wy - home.wy) * ratio,
  };
  const z = env.surfaceZ?.(point) ?? 0;
  if (clearPredatorFlight(hunter, point, z, env, planning)) return { point, z };
  return undefined;
}
