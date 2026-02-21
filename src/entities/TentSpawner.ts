import type { EntityManager } from "./EntityManager.js";
import { createGhostAngry, createGhostFriendly } from "./Ghost.js";
import type { PropManager } from "./PropManager.js";

/** Minimum seconds between spawn attempts per tent. */
const SPAWN_MIN = 8.0;
/** Maximum seconds between spawn attempts per tent. */
const SPAWN_MAX = 14.0;
/** Maximum ghosts spawned from tents alive at once (per color). */
const MAX_TENT_GHOSTS = 3;

const TENT_TYPES = ["prop-tent-blue", "prop-tent-green"] as const;

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
  /** Per-tent timers keyed by prop ID. */
  private tentTimers = new Map<number, number>();
  /** IDs of ghosts we've spawned (for cap tracking). */
  private trackedIds = new Set<number>();

  /** Rebuild tracked set (call after world load). */
  reset(): void {
    this.tentTimers.clear();
    this.trackedIds.clear();
  }

  update(dt: number, propManager: PropManager, entityManager: EntityManager): void {
    // Prune tracked ghosts that no longer exist
    for (const id of this.trackedIds) {
      if (!entityManager.entities.find((e) => e.id === id)) {
        this.trackedIds.delete(id);
      }
    }

    if (this.trackedIds.size >= MAX_TENT_GHOSTS) return;

    // Find all tents and tick their timers
    for (const prop of propManager.props) {
      if (prop.type !== "prop-tent-blue" && prop.type !== "prop-tent-green") continue;

      let timer = this.tentTimers.get(prop.id);
      if (timer === undefined) {
        timer = randomInterval();
        this.tentTimers.set(prop.id, timer);
      }

      timer -= dt;
      if (timer <= 0) {
        this.tentTimers.set(prop.id, randomInterval());

        if (this.trackedIds.size >= MAX_TENT_GHOSTS) continue;

        // Spawn ghost slightly below tent center (at the "opening")
        const createGhost = prop.type === "prop-tent-blue" ? createGhostFriendly : createGhostAngry;
        const ghost = entityManager.spawn(createGhost(prop.position.wx, prop.position.wy + 16));
        this.trackedIds.add(ghost.id);
      } else {
        this.tentTimers.set(prop.id, timer);
      }
    }

    // Clean up timers for tents that no longer exist
    const tentIds = new Set(
      propManager.props
        .filter((p): p is typeof p & { type: (typeof TENT_TYPES)[number] } =>
          TENT_TYPES.includes(p.type as (typeof TENT_TYPES)[number]),
        )
        .map((p) => p.id),
    );
    for (const id of this.tentTimers.keys()) {
      if (!tentIds.has(id)) {
        this.tentTimers.delete(id);
      }
    }
  }
}
