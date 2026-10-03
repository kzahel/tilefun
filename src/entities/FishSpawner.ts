import { CHUNK_SIZE_PX, TILE_SIZE } from "../config/constants.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import type { World } from "../world/World.js";
import type { EntityManager } from "./EntityManager.js";
import { createFish1, createFish2, createFish3 } from "./Fish.js";

/** Seconds between spawn attempts. */
const SPAWN_INTERVAL = 3.0;
/** Maximum fish alive in the world at once. */
const MAX_FISH = 12;

const FISH_TYPES = ["fish1", "fish2", "fish3"] as const;
const FISH_FACTORIES = [createFish1, createFish2, createFish3] as const;

export class FishSpawner {
  private spawnTimer = 0;
  private trackedIds = new Set<number>();

  /** Rebuild tracked set from existing entities (call after world load). */
  reset(entityManager: EntityManager): void {
    this.trackedIds.clear();
    this.spawnTimer = 0;
    for (const e of entityManager.entities) {
      if (FISH_TYPES.includes(e.type as (typeof FISH_TYPES)[number])) {
        this.trackedIds.add(e.id);
      }
    }
  }

  update(dt: number, visibleRange: ChunkRange, entityManager: EntityManager, world: World): void {
    this.despawnOffscreen(visibleRange, entityManager, !world.chunks.managed);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = SPAWN_INTERVAL;
      this.trySpawn(visibleRange, entityManager, world);
    }
  }

  private trySpawn(visible: ChunkRange, entityManager: EntityManager, world: World): void {
    let count = 0;
    for (const e of entityManager.entities) {
      if (FISH_TYPES.includes(e.type as (typeof FISH_TYPES)[number])) count++;
    }
    if (count >= MAX_FISH) return;

    // Fish spawn on-screen (visible chunks only)
    const candidates: { cx: number; cy: number }[] = [];
    for (let cy = visible.minCy; cy <= visible.maxCy; cy++) {
      for (let cx = visible.minCx; cx <= visible.maxCx; cx++) {
        candidates.push({ cx, cy });
      }
    }
    if (world.chunks.managed) {
      for (let i = candidates.length - 1; i >= 0; i--) {
        const candidate = candidates[i];
        if (candidate && !world.chunks.get(candidate.cx, candidate.cy)) candidates.splice(i, 1);
      }
    }
    if (candidates.length === 0) return;

    const choice = candidates[Math.floor(Math.random() * candidates.length)];
    if (!choice) return;
    const wx = choice.cx * CHUNK_SIZE_PX + 8 + Math.random() * (CHUNK_SIZE_PX - 16);
    const wy = choice.cy * CHUNK_SIZE_PX + 8 + Math.random() * (CHUNK_SIZE_PX - 16);

    // Only spawn on water tiles
    const tx = Math.floor(wx / TILE_SIZE);
    const ty = Math.floor(wy / TILE_SIZE);
    if (!(world.getCollisionIfLoaded(tx, ty) & CollisionFlag.Water)) return;

    const factory = FISH_FACTORIES[Math.floor(Math.random() * FISH_FACTORIES.length)];
    if (!factory) return;
    const fish = entityManager.spawn(factory(wx, wy));
    this.trackedIds.add(fish.id);
  }

  private despawnOffscreen(
    visible: ChunkRange,
    entityManager: EntityManager,
    allowDespawn: boolean,
  ): void {
    const toRemove: number[] = [];
    for (const id of this.trackedIds) {
      const entity = entityManager.byId.get(id);
      if (!entity) {
        toRemove.push(id);
        continue;
      }
      const cx = Math.floor(entity.position.wx / CHUNK_SIZE_PX);
      const cy = Math.floor(entity.position.wy / CHUNK_SIZE_PX);
      if (
        allowDespawn &&
        (cx < visible.minCx || cx > visible.maxCx || cy < visible.minCy || cy > visible.maxCy)
      ) {
        entityManager.remove(id);
        toRemove.push(id);
      }
    }
    for (const id of toRemove) {
      this.trackedIds.delete(id);
    }
  }
}
