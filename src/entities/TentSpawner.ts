import type { EntityManager } from "./EntityManager.js";
import { createGhostAngry, createGhostFriendly } from "./Ghost.js";
import type { Prop } from "./Prop.js";
import type { PropManager } from "./PropManager.js";

/** Minimum seconds between spawn attempts per tent. */
const SPAWN_MIN = 8.0;
/** Maximum seconds between spawn attempts per tent. */
const SPAWN_MAX = 14.0;
/** Maximum ghosts spawned from tents alive at once (per color). */
const MAX_TENT_GHOSTS = 3;

function randomInterval(): number {
  return SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN);
}

/**
 * Spawns ghosts from tent props on a randomized timer.
 * Blue tents spawn friendly ghosts; green tents spawn angry ghosts.
 * Each tent independently rolls a spawn timer; ghosts appear at the
 * tent's position so they look like they emerge from the tent opening.
 */
export class TentSpawner {
  /** IDs of ghosts we've spawned (for cap tracking). */
  private trackedIds = new Set<number>();

  /** Rebuild tracked set (call after world load). */
  reset(): void {
    this.trackedIds.clear();
  }

  update(
    dt: number,
    propManager: PropManager,
    entityManager: EntityManager,
    active: readonly Prop[] = propManager.props,
  ): void {
    // Prune tracked ghosts that no longer exist
    for (const id of this.trackedIds) {
      if (!entityManager.byId.has(id)) {
        this.trackedIds.delete(id);
      }
    }

    if (this.trackedIds.size >= MAX_TENT_GHOSTS) return;

    // Find all tents and tick their timers
    for (const prop of active) {
      if (prop.type !== "prop-tent-blue" && prop.type !== "prop-tent-green") continue;

      let timer = prop.spawnTimer;
      if (timer === undefined) {
        timer = randomInterval();
        prop.spawnTimer = timer;
      }

      timer -= dt;
      if (timer <= 0) {
        prop.spawnTimer = randomInterval();

        if (this.trackedIds.size >= MAX_TENT_GHOSTS) continue;

        // Spawn ghost slightly below tent center (at the "opening")
        const createGhost = prop.type === "prop-tent-blue" ? createGhostFriendly : createGhostAngry;
        const ghost = entityManager.spawn(createGhost(prop.position.wx, prop.position.wy + 16));
        this.trackedIds.add(ghost.id);
      } else {
        prop.spawnTimer = timer;
      }
    }
  }
}
