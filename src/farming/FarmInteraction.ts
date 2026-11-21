import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import {
  CORN,
  EMPTY_INVENTORY,
  heldItem,
  type Inventory,
  itemCount,
  WOOD,
} from "../inventory/Inventory.js";
import { gap } from "../shared/gap.js";
import { faunaType } from "../wildlife/Fauna.js";
import { FENCE_STAKES, GARDEN_BED, WOODLOT_TREE } from "./FarmActors.js";
import { FARM_GATE, isFarmGate } from "./FarmGate.js";

const FARM_REACH = 32;
export const FEED_REACH = 96;
export const DOMESTIC_HEN = faunaType("chicken");
export const FARM_LABELS = {
  plant: "Plant corn",
  water: "Water corn",
  harvest: "Harvest corn",
  feed: "Scatter corn",
  chop: "Chop tree",
  replant: "Plant tree",
  fence: "Build fence",
  "open-gate": "Open gate",
  "close-gate": "Close gate",
} as const;

export type GateAction = "open-gate" | "close-gate";
export type FarmAction = Exclude<keyof typeof FARM_LABELS, GateAction>;
export type FarmRequest = { type: "farm-action" } & (
  | { action: FarmAction; entityId: number }
  | { action: GateAction; propId: number }
);
export type FarmChoice = { request: FarmRequest | null; label: string };

export function farmAction(target: Entity): FarmAction | undefined {
  const clip = target.sprite?.clip ?? 0;
  switch (target.type) {
    case GARDEN_BED:
      return clip === 0 ? "plant" : clip === 1 ? "water" : clip === 3 ? "harvest" : undefined;
    case DOMESTIC_HEN:
      return "feed";
    case WOODLOT_TREE:
      return clip < 3 ? "chop" : clip === 4 ? "replant" : undefined;
    case FENCE_STAKES:
      return "fence";
    default:
      return undefined;
  }
}

type FarmTarget = Pick<Entity, "position"> & { wz?: number | undefined };

export function canReachFarmTarget(
  player: Entity,
  target: FarmTarget,
  reach = FARM_REACH,
): boolean {
  return (
    player.parentId === undefined &&
    Math.abs((player.wz ?? 0) - (target.wz ?? 0)) <= 7 &&
    gap(player.position, target.position) <= reach
  );
}

export function farmGateChoice(player: Entity, props: readonly Prop[]): FarmChoice | undefined {
  let nearest: Prop | undefined;
  let distance = FARM_REACH;
  for (const gate of props) {
    if (!isFarmGate(gate.type) || !canReachFarmTarget(player, gate, distance)) continue;
    nearest = gate;
    distance = gap(player.position, gate.position);
  }
  if (!nearest) return undefined;
  const action = nearest.type === FARM_GATE ? "open-gate" : "close-gate";
  return {
    request: { type: "farm-action", action, propId: nearest.id },
    label: FARM_LABELS[action],
  };
}

/** Nearby tools and plants take precedence over scattering at longer range. */
export function farmChoice(
  player: Entity,
  entities: readonly Entity[],
  inventory: Inventory = EMPTY_INVENTORY,
): FarmChoice | undefined {
  let best: FarmChoice | undefined;
  let distance = Infinity;
  for (const target of entities) {
    const action = farmAction(target);
    if (!action || !canReachFarmTarget(player, target, action === "feed" ? FEED_REACH : FARM_REACH))
      continue;
    const missing =
      action === "feed" && heldItem(inventory) !== CORN
        ? itemCount(inventory, CORN)
          ? "Hold corn to feed chickens"
          : "Harvest corn to feed chickens"
        : action === "fence" && !itemCount(inventory, WOOD)
          ? "Chop a tree for fence wood"
          : "";
    const nextDistance =
      gap(player.position, target.position) + (action === "feed" ? FARM_REACH : 0);
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
