import type { Entity } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import { EntityHandle } from "../server/EntityHandle.js";
import type { TagService, Unsubscribe } from "../server/WorldAPI.js";

type TagCallback = (entity: EntityHandle) => void;

/**
 * Real TagService implementation. Maintains a reverse index (tag → entity IDs)
 * and fires onTagAdded / onTagRemoved callbacks.
 *
 * Integration points:
 * - EntityHandle.addTag / removeTag notify via EntityManager.tagChangeHook
 * - notifySpawn() called by EntityAPIImpl after spawn to index initial tags
 * - tick() called each frame to detect removed entities and fire onTagRemoved
 */
export class TagServiceImpl implements TagService {
  private readonly em: EntityManager;

  /** Reverse index: tag → set of entity IDs. */
  private tagIndex = new Map<string, Set<number>>();
  /** Shadow copy of each entity's tags for removal detection. */
  private entityTags = new Map<number, Set<string>>();
  /** Entity references for creating handles after removal. */
  private entityRefs = new Map<number, Entity>();

  private addedCbs = new Map<string, Set<TagCallback>>();
  private removedCbs = new Map<string, Set<TagCallback>>();

  constructor(entityManager: EntityManager) {
    this.em = entityManager;

    // Hook into EntityHandle.addTag / removeTag
    this.em.tagChangeHook = {
      onAdd: (entity: Entity, tag: string) => {
        this.indexTag(entity.id, tag);
        this.entityRefs.set(entity.id, entity);
        this.fireAdded(entity, tag);
      },
      onRemove: (entity: Entity, tag: string) => {
        this.unindexTag(entity.id, tag);
        this.fireRemoved(entity, tag);
      },
    };
  }

  addTag(handle: EntityHandle, tag: string): void {
    // Delegate to EntityHandle which calls back through the hook
    handle.addTag(tag);
  }

  removeTag(handle: EntityHandle, tag: string): void {
    // Delegate to EntityHandle which calls back through the hook
    handle.removeTag(tag);
  }

  hasTag(handle: EntityHandle, tag: string): boolean {
    return handle.hasTag(tag);
  }

  getTagged(tag: string): EntityHandle[] {
    const ids = this.tagIndex.get(tag);
    if (!ids || ids.size === 0) return [];
    const result: EntityHandle[] = [];
    for (const id of ids) {
      const entity = this.em.entities.find((e) => e.id === id);
      if (entity) {
        result.push(new EntityHandle(entity, this.em));
      }
    }
    return result;
  }

  onTagAdded(tag: string, cb: TagCallback): Unsubscribe {
    let set = this.addedCbs.get(tag);
    if (!set) {
      set = new Set();
      this.addedCbs.set(tag, set);
    }
    set.add(cb);
    return () => {
      set.delete(cb);
      if (set.size === 0) {
        this.addedCbs.delete(tag);
      }
    };
  }

  onTagRemoved(tag: string, cb: TagCallback): Unsubscribe {
    let set = this.removedCbs.get(tag);
    if (!set) {
      set = new Set();
      this.removedCbs.set(tag, set);
    }
    set.add(cb);
    return () => {
      set.delete(cb);
      if (set.size === 0) {
        this.removedCbs.delete(tag);
      }
    };
  }

  /**
   * Called after an entity is spawned to index its initial tags and fire
   * onTagAdded for each. Initial tags come from entity factories.
   */
  notifySpawn(entity: Entity): void {
    if (!entity.tags || entity.tags.size === 0) return;
    this.entityRefs.set(entity.id, entity);
    const shadowTags = new Set<string>();
    this.entityTags.set(entity.id, shadowTags);
    for (const tag of entity.tags) {
      this.indexTag(entity.id, tag);
      shadowTags.add(tag);
      this.fireAdded(entity, tag);
    }
  }

  /**
   * Detect removed entities and fire onTagRemoved. Call once per tick.
   */
  tick(): void {
    const aliveIds = new Set<number>();
    for (const e of this.em.entities) {
      aliveIds.add(e.id);
    }

    for (const [entityId, tags] of this.entityTags) {
      if (!aliveIds.has(entityId)) {
        const entity = this.entityRefs.get(entityId);
        if (entity) {
          for (const tag of tags) {
            this.unindexTag(entityId, tag);
            this.fireRemoved(entity, tag);
          }
        }
        this.entityTags.delete(entityId);
        this.entityRefs.delete(entityId);
      }
    }
  }

  /** Remove all listeners and state. Called on world reload. */
  clear(): void {
    this.tagIndex.clear();
    this.entityTags.clear();
    this.entityRefs.clear();
    this.addedCbs.clear();
    this.removedCbs.clear();
  }

  // ---- internal helpers ----

  private indexTag(entityId: number, tag: string): void {
    let set = this.tagIndex.get(tag);
    if (!set) {
      set = new Set();
      this.tagIndex.set(tag, set);
    }
    set.add(entityId);

    let shadow = this.entityTags.get(entityId);
    if (!shadow) {
      shadow = new Set();
      this.entityTags.set(entityId, shadow);
    }
    shadow.add(tag);
  }

  private unindexTag(entityId: number, tag: string): void {
    const set = this.tagIndex.get(tag);
    if (set) {
      set.delete(entityId);
      if (set.size === 0) this.tagIndex.delete(tag);
    }

    const shadow = this.entityTags.get(entityId);
    if (shadow) {
      shadow.delete(tag);
      if (shadow.size === 0) {
        this.entityTags.delete(entityId);
        this.entityRefs.delete(entityId);
      }
    }
  }

  private fireAdded(entity: Entity, tag: string): void {
    const cbs = this.addedCbs.get(tag);
    if (!cbs) return;
    const handle = new EntityHandle(entity, this.em);
    for (const cb of cbs) {
      try {
        cb(handle);
      } catch (err) {
        console.error("[TagService] Error in onTagAdded handler:", err);
      }
    }
  }

  private fireRemoved(entity: Entity, tag: string): void {
    const cbs = this.removedCbs.get(tag);
    if (!cbs) return;
    const handle = new EntityHandle(entity, this.em);
    for (const cb of cbs) {
      try {
        cb(handle);
      } catch (err) {
        console.error("[TagService] Error in onTagRemoved handler:", err);
      }
    }
  }
}
