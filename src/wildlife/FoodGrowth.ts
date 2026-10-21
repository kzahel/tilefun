import type { Entity, PositionComponent } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import { restoreWorkItemPose, sourceType } from "./ForageResources.js";
import type { WildlifeEnvironment } from "./mallardAI.js";
import { canopyLeafPoint, sameTree } from "./TreeClimbing.js";

const gap = (a: PositionComponent, b: PositionComponent) => Math.hypot(a.wx - b.wx, a.wy - b.wy);
/** No offline catch-up or loose-item spawning. Only admitted, ready sources grow. */
export function tickFoodSources(
  manager: EntityManager,
  admitted: ReadonlyMap<Entity, number>,
  env: WildlifeEnvironment,
  ready: (p: PositionComponent, radius: number) => boolean = () => true,
) {
  for (const [e, dt] of admitted) {
    const item = e.workItem,
      growth = item?.growth;
    if (!growth || !item || !manager.byId.has(e.id) || !ready(e.position, 96)) continue;
    if (item.pollination) {
      item.pollination.remaining = Math.max(0, item.pollination.remaining - dt);
      restoreWorkItemPose(e);
    }
    if (
      e.type === sourceType("fruit-tree") ||
      e.type === sourceType("nut-tree") ||
      e.type === sourceType("canopy-leaves")
    ) {
      const trees = env.climbTrees?.(e.position, 64) ?? [];
      if (growth.tree) {
        const supportedTree = growth.tree;
        if (!trees.some((t) => sameTree(t, supportedTree))) {
          manager.remove(e.id);
          continue;
        }
      } else {
        const tree = trees
          .filter((t) => gap(t, e.position) < 64)
          .sort((a, b) => gap(a, e.position) - gap(b, e.position))[0];
        if (!tree) continue;
        growth.tree = { ...tree };
        const canopy = e.type !== sourceType("nut-tree");
        e.position =
          e.type === sourceType("canopy-leaves")
            ? canopyLeafPoint(tree)
            : canopy
              ? { wx: tree.wx, wy: tree.wy }
              : { wx: tree.gripX, wy: tree.gripY };
        e.wz = canopy ? tree.z : tree.ground;
      }
    }
    if (item.units >= growth.capacity) {
      growth.remaining = growth.interval;
      continue;
    }
    growth.remaining -= dt;
    while (growth.remaining <= 0 && item.units < growth.capacity) {
      item.units++;
      growth.remaining += growth.interval;
    }
    if (item.units >= growth.capacity) growth.remaining = growth.interval;
    restoreWorkItemPose(e);
  }
}
