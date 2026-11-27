import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import {
  AXE,
  CORN,
  EMPTY_INVENTORY,
  heldItem,
  type Inventory,
  itemCount,
  WOOD,
} from "../inventory/Inventory.js";
import { gap } from "../shared/gap.js";
import {
  EGG_POSE,
  EGG_STATUS,
  FARM_EGG,
  FENCE_STAKES,
  GARDEN_BED,
  WOODLOT_TREE,
} from "./FarmActors.js";
import { DOMESTIC_HEN } from "./FarmFowl.js";
import { FARM_GATE, isFarmGate } from "./FarmGate.js";
import type { PostalAction } from "./PostalInteraction.js";

const FARM_REACH = 32;
export const FEED_REACH = 96;
export const FARM_LABELS = {
  plant: "Plant corn",
  water: "Water corn",
  harvest: "Harvest corn",
  "break-egg": "Break egg",
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
  | { action: GateAction | PostalAction; propId: number }
);
/** `use`: the verb belongs to the item in hand, so prompts name the use button
 * (Interact still performs it; a tap on the prompt sends the request directly). */
export type FarmChoice = {
  request: FarmRequest | null;
  label: string;
  status?: string;
  use?: true;
};

export function farmAction(target: Entity): FarmAction | undefined {
  const clip = target.sprite?.clip ?? 0;
  switch (target.type) {
    case GARDEN_BED:
      return clip === 0 ? "plant" : clip === 1 ? "water" : clip === 3 ? "harvest" : undefined;
    case DOMESTIC_HEN:
      return "feed";
    case FARM_EGG:
      return clip === EGG_POSE.broken ? undefined : "break-egg";
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
    const choice = describeFarmChoice(target, action, inventory);
    const nextDistance =
      gap(player.position, target.position) + (action === "feed" ? FARM_REACH : 0);
    if (
      best &&
      ((!!best.request && !choice.request) ||
        (!!best.request === !!choice.request && nextDistance >= distance))
    )
      continue;
    distance = nextDistance;
    best = choice;
  }
  return best;
}

function describeFarmChoice(target: Entity, action: FarmAction, inventory: Inventory): FarmChoice {
  if (action === "feed" && heldItem(inventory) !== CORN)
    return {
      request: null,
      label: itemCount(inventory, CORN)
        ? "Hold corn to feed chickens"
        : "Harvest corn to feed chickens",
    };
  if (action === "chop" && heldItem(inventory) !== AXE)
    return { request: null, label: "Hold the 🪓 axe to chop this tree" };
  if (action === "fence" && !itemCount(inventory, WOOD))
    return { request: null, label: "Bring a wood bundle to these fence stakes" };
  const status =
    action === "break-egg" ? EGG_STATUS[target.sprite?.clip ?? EGG_POSE.plain] : undefined;
  return {
    request: { type: "farm-action", action, entityId: target.id },
    label: FARM_LABELS[action],
    ...(status && { status }),
    ...((action === "chop" || action === "feed") && { use: true as const }),
  };
}
