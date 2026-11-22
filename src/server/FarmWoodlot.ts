import type { Entity } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import { FALL_MS, FARM_FACTORIES, LOG_BUNDLE } from "../farming/FarmActors.js";
import { required } from "../shared/required.js";

/** Three axe strokes fell a woodlot tree and drop one log bundle at the player's feet. */
export function chopTree(
  manager: EntityManager,
  player: Entity,
  tree: Entity,
  axe: boolean,
  now: number,
): void {
  if (!axe) throw new Error("Hold the axe to chop.");
  if ((tree.farm?.effectUntil ?? 0) > now) throw new Error("Wait for the tree to settle.");
  const chops = (tree.farm?.chops ?? 0) + 1;
  if (chops === 3) {
    const bundle = required(FARM_FACTORIES[LOG_BUNDLE])(player.position.wx, player.position.wy);
    if (player.wz !== undefined) bundle.wz = player.wz;
    bundle.farm = { effectUntil: now + FALL_MS };
    manager.spawn(bundle);
  }
  tree.farm = { chops, effectUntil: now + (chops === 3 ? FALL_MS : 350) };
}
