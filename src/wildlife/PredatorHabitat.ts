import { getEntityAABB } from "../entities/collision.js";
import type { Entity, PositionComponent } from "../entities/Entity.js";
import { predatorProfile } from "./Predator.js";
import type { WildlifeEnvironment } from "./WildlifeEnvironment.js";

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
