import { CHUNK_SIZE_PX } from "../config/constants.js";
import type { AABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import type { Prop } from "../entities/Prop.js";
import { PropManager } from "../entities/PropManager.js";

export interface DrivingQueries {
  props(bounds: AABB): readonly Prop[];
  bodies?(bounds: AABB): readonly Entity[];
}

/** Live authority index or immutable replica snapshot, never sampled body history. */
export function createDrivingQueries(
  manager: PropManager,
  entities?: EntityManager,
): DrivingQueries {
  let revision = -1;
  let excavations: Prop[] = [];
  return {
    props(bounds) {
      if (revision !== manager.revision) {
        // Ground tracking has a global excavation-presence branch, including its
        // inclusive feet-edge policy. Preserve that branch even for distant cuts.
        excavations = manager.props.filter((p) =>
          (p.walls ?? (p.collider ? [p.collider] : [])).some((c) => c.surface?.excavation),
        );
        revision = manager.revision;
      }
      const result = manager.getPropsInChunkRange(
        Math.floor(bounds.left / CHUNK_SIZE_PX),
        Math.floor(bounds.top / CHUNK_SIZE_PX),
        Math.floor(bounds.right / CHUNK_SIZE_PX),
        Math.floor(bounds.bottom / CHUNK_SIZE_PX),
      );
      for (const p of excavations) if (!result.includes(p)) result.push(p);
      return result;
    },
    ...(entities
      ? {
          bodies: (bounds: AABB) =>
            entities.spatialHash.queryRange(
              Math.floor(bounds.left / CHUNK_SIZE_PX),
              Math.floor(bounds.top / CHUNK_SIZE_PX),
              Math.floor(bounds.right / CHUNK_SIZE_PX),
              Math.floor(bounds.bottom / CHUNK_SIZE_PX),
            ),
        }
      : {}),
  };
}

// Only snapshots published by the replica opt in. Mutable/direct callers retain
// full-list behavior; old replay requests hold the index of their own snapshot.
const snapshots = new WeakMap<readonly Prop[], { query?: DrivingQueries }>();
export function registerDrivingProps(props: readonly Prop[]): void {
  snapshots.set(props, {});
}
export function drivingQueries(props: readonly Prop[]): DrivingQueries | undefined {
  const snapshot = snapshots.get(props);
  if (!snapshot) return;
  if (!snapshot.query) {
    // Build only when this immutable snapshot is actually used for driving.
    const manager = new PropManager();
    for (const prop of props) {
      manager.setNextId(prop.id);
      manager.add(prop);
    }
    snapshot.query = createDrivingQueries(manager);
  }
  return snapshot.query;
}
export function retainDrivingQueries(source: readonly Prop[], copy: readonly Prop[]): void {
  const snapshot = snapshots.get(source);
  if (snapshot) snapshots.set(copy, snapshot);
}
