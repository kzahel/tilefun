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
