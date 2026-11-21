import type { Entity } from "../entities/Entity.js";
import { gap } from "../shared/gap.js";
import {
  CHICKEN_FEEDER,
  EMPTY_BASKET,
  type FarmBasket,
  FENCE_STAKES,
  GARDEN_BED,
  WOODLOT_TREE,
} from "./FarmActors.js";

export const FARM_REACH = 32;
export const FARM_LABELS = {
  plant: "Plant corn",
  water: "Water corn",
  harvest: "Harvest corn",
  feed: "Feed chickens",
  chop: "Chop tree",
  replant: "Plant tree",
  fence: "Build fence",
} as const;

export type FarmAction = keyof typeof FARM_LABELS;
export type FarmRequest = { type: "farm-action"; action: FarmAction; entityId: number };
export type FarmChoice = { request: FarmRequest | null; label: string };

export function farmAction(target: Entity): FarmAction | undefined {
  const clip = target.sprite?.clip ?? 0;
  switch (target.type) {
    case GARDEN_BED:
      return clip === 0 ? "plant" : clip === 1 ? "water" : clip === 3 ? "harvest" : undefined;
    case CHICKEN_FEEDER:
      return "feed";
    case WOODLOT_TREE:
      return clip < 3 ? "chop" : clip === 4 ? "replant" : undefined;
    case FENCE_STAKES:
      return "fence";
    default:
      return undefined;
  }
}

export function canReachFarmTarget(player: Entity, target: Entity, reach = FARM_REACH): boolean {
  return (
    player.parentId === undefined &&
    Math.abs((player.wz ?? 0) - (target.wz ?? 0)) <= 7 &&
    gap(player.position, target.position) <= reach
  );
}

/** Prop/vehicle priorities are handled by place controls. Choose just one farm target. */
export function farmChoice(
  player: Entity,
  entities: readonly Entity[],
  basket: FarmBasket = EMPTY_BASKET,
): FarmChoice | undefined {
  let best: FarmChoice | undefined;
  let distance = FARM_REACH;
  for (const target of entities) {
    const action = farmAction(target);
    if (!action || !canReachFarmTarget(player, target)) continue;
    const missing =
      action === "feed" && !basket.corn
        ? "Harvest corn to feed chickens"
        : action === "fence" && !basket.wood
          ? "Chop a tree for fence wood"
          : "";
    // A useful neighboring garden action should beat an unavailable material hint.
    const nextDistance = gap(player.position, target.position);
    if (
      best &&
      (missing
        ? !!best.request || nextDistance >= distance
        : !!best.request && nextDistance >= distance)
    )
      continue;
    distance = nextDistance;
    best = {
      request: missing ? null : { type: "farm-action", action, entityId: target.id },
      label: missing || FARM_LABELS[action],
    };
  }
  return best;
}

export function farmBasketLabel(basket: FarmBasket | undefined): string {
  return basket ? `🌽 ${basket.corn}   🪵 ${basket.wood}` : "";
}
