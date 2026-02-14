import { CHUNK_SIZE_PX } from "../config/constants.js";
import { aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import { EntityHandle } from "../server/EntityHandle.js";
import type { OverlapService, Unsubscribe } from "../server/WorldAPI.js";

type OverlapCallback = (self: EntityHandle, other: EntityHandle) => void;

/**
 * AABB overlap detection service. Runs once per tick (post-simulation).
 *
 * For each watched tag, finds all entities with that tag and checks their
 * AABB overlap against nearby entities (via spatial hash) that have a collider.
 * Fires enter/exit callbacks when overlap state changes between ticks.
 */
export class OverlapServiceImpl implements OverlapService {
  private readonly em: EntityManager;
  private enterListeners = new Map<string, Set<OverlapCallback>>();
  private exitListeners = new Map<string, Set<OverlapCallback>>();
  /** Previous frame overlap state: tag → Set of "selfId,otherId" pair keys. */
  private previousOverlaps = new Map<string, Set<string>>();

  constructor(entityManager: EntityManager) {
    this.em = entityManager;
  }

  onOverlap(tag: string, cb: OverlapCallback): Unsubscribe {
    let set = this.enterListeners.get(tag);
    if (!set) {
      set = new Set();
      this.enterListeners.set(tag, set);
    }
    set.add(cb);
    return () => {
      set.delete(cb);
      if (set.size === 0) {
        this.enterListeners.delete(tag);
        this.previousOverlaps.delete(tag);
      }
    };
  }

  onOverlapEnd(tag: string, cb: OverlapCallback): Unsubscribe {
    let set = this.exitListeners.get(tag);
    if (!set) {
      set = new Set();
      this.exitListeners.set(tag, set);
    }
    set.add(cb);
    return () => {
      set.delete(cb);
      if (set.size === 0) {
        this.exitListeners.delete(tag);
      }
    };
  }

  /** Run overlap detection. Call once per tick after physics. */
  tick(): void {
    // Collect all watched tags (union of enter + exit listener keys)
    const watchedTags = new Set<string>();
    for (const tag of this.enterListeners.keys()) watchedTags.add(tag);
    for (const tag of this.exitListeners.keys()) watchedTags.add(tag);
    if (watchedTags.size === 0) return;

    const entities = this.em.entities;

    for (const tag of watchedTags) {
      const currentPairs = new Set<string>();
      const previousPairs = this.previousOverlaps.get(tag) ?? new Set();

      // Find all entities with this tag that have colliders
      const tagged: (Entity & { collider: NonNullable<Entity["collider"]> })[] = [];
      for (const e of entities) {
        if (e.collider && e.tags?.has(tag)) {
          tagged.push(e as Entity & { collider: NonNullable<Entity["collider"]> });
        }
      }

      // Check each tagged entity against nearby entities (via spatial hash)
      const spatialHash = this.em.spatialHash;
      for (const self of tagged) {
        const selfAABB = getEntityAABB(self.position, self.collider);
        // Query entities in same + adjacent chunks
        const minCx = Math.floor(selfAABB.left / CHUNK_SIZE_PX);
        const maxCx = Math.floor(selfAABB.right / CHUNK_SIZE_PX);
        const minCy = Math.floor(selfAABB.top / CHUNK_SIZE_PX);
        const maxCy = Math.floor(selfAABB.bottom / CHUNK_SIZE_PX);
        const nearby = spatialHash.queryRange(minCx - 1, minCy - 1, maxCx + 1, maxCy + 1);
        for (const other of nearby) {
          if (other === self || !other.collider) continue;
          const otherAABB = getEntityAABB(other.position, other.collider);
          if (aabbsOverlap(selfAABB, otherAABB)) {
            currentPairs.add(`${self.id},${other.id}`);
          }
        }
      }

      // Fire enter callbacks for new overlaps
      const enterCbs = this.enterListeners.get(tag);
      if (enterCbs) {
        for (const pairKey of currentPairs) {
          if (!previousPairs.has(pairKey)) {
            const [selfId, otherId] = pairKey.split(",").map(Number);
            const selfEntity = entities.find((e) => e.id === selfId);
            const otherEntity = entities.find((e) => e.id === otherId);
            if (selfEntity && otherEntity) {
              const selfHandle = new EntityHandle(selfEntity, this.em);
              const otherHandle = new EntityHandle(otherEntity, this.em);
              for (const cb of enterCbs) {
                try {
                  cb(selfHandle, otherHandle);
                } catch (err) {
                  console.error("[OverlapService] Error in onOverlap handler:", err);
                }
              }
            }
          }
        }
      }

      // Fire exit callbacks for ended overlaps
      const exitCbs = this.exitListeners.get(tag);
      if (exitCbs) {
        for (const pairKey of previousPairs) {
          if (!currentPairs.has(pairKey)) {
            const [selfId, otherId] = pairKey.split(",").map(Number);
            const selfEntity = entities.find((e) => e.id === selfId);
            const otherEntity = entities.find((e) => e.id === otherId);
            if (selfEntity && otherEntity) {
              const selfHandle = new EntityHandle(selfEntity, this.em);
              const otherHandle = new EntityHandle(otherEntity, this.em);
              for (const cb of exitCbs) {
                try {
                  cb(selfHandle, otherHandle);
                } catch (err) {
                  console.error("[OverlapService] Error in onOverlapEnd handler:", err);
                }
              }
            }
          }
        }
      }

      this.previousOverlaps.set(tag, currentPairs);
    }
  }

  /** Remove all listeners and state. Called on world reload. */
  clear(): void {
    this.enterListeners.clear();
    this.exitListeners.clear();
    this.previousOverlaps.clear();
  }
}
