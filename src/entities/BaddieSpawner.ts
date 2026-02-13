import { CHUNK_SIZE_PX, TILE_SIZE } from "../config/constants.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import type { World } from "../world/World.js";
import type { Entity } from "./Entity.js";
import type { EntityManager } from "./EntityManager.js";
import { createGhostAngry } from "./Ghost.js";

/** Seconds between spawn attempts. */
const SPAWN_INTERVAL = 5.0;
/** Maximum baddies alive in the world at once. */
const MAX_BADDIES = 4;
/** Minimum Chebyshev chunk distance from player to spawn. */
const SPAWN_RADIUS_MIN = 3;
/** Maximum Chebyshev chunk distance from player to spawn. */
const SPAWN_RADIUS_MAX = 5;
/** Baddies beyond this chunk distance from the player are despawned. */
const DESPAWN_DISTANCE = 7;

export class BaddieSpawner {
  private spawnTimer = 0;
  private trackedIds = new Set<number>();

  /** Rebuild tracked set from existing entities (call after world load). */
  reset(entityManager: EntityManager): void {
    this.trackedIds.clear();
    this.spawnTimer = 0;
    for (const e of entityManager.entities) {
      if (e.type === "ghost-angry") {
        this.trackedIds.add(e.id);
      }
    }
  }

  update(
    dt: number,
    player: Entity,
    visibleRange: ChunkRange,
    entityManager: EntityManager,
    world: World,
  ): void {
    this.despawnFar(player, entityManager);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = SPAWN_INTERVAL;
      this.trySpawn(player, visibleRange, entityManager, world);
    }
  }

  private trySpawn(
    player: Entity,
    visible: ChunkRange,
    entityManager: EntityManager,
    world: World,
  ): void {
    let count = 0;
    for (const e of entityManager.entities) {
      if (e.type === "ghost-angry") count++;
    }
    if (count >= MAX_BADDIES) return;

    const playerCx = Math.floor(player.position.wx / CHUNK_SIZE_PX);
    const playerCy = Math.floor(player.position.wy / CHUNK_SIZE_PX);

    const candidates: { cx: number; cy: number }[] = [];
    for (let cy = playerCy - SPAWN_RADIUS_MAX; cy <= playerCy + SPAWN_RADIUS_MAX; cy++) {
      for (let cx = playerCx - SPAWN_RADIUS_MAX; cx <= playerCx + SPAWN_RADIUS_MAX; cx++) {
        const dist = Math.max(Math.abs(cx - playerCx), Math.abs(cy - playerCy));
        if (dist < SPAWN_RADIUS_MIN || dist > SPAWN_RADIUS_MAX) continue;
        if (
          cx >= visible.minCx &&
          cx <= visible.maxCx &&
          cy >= visible.minCy &&
          cy <= visible.maxCy
        )
          continue;
        candidates.push({ cx, cy });
      }
    }
    if (candidates.length === 0) return;

    const choice = candidates[Math.floor(Math.random() * candidates.length)];
    if (!choice) return;
    const wx = choice.cx * CHUNK_SIZE_PX + 8 + Math.random() * (CHUNK_SIZE_PX - 16);
    const wy = choice.cy * CHUNK_SIZE_PX + 8 + Math.random() * (CHUNK_SIZE_PX - 16);

    // Don't spawn on water
    const tx = Math.floor(wx / TILE_SIZE);
    const ty = Math.floor(wy / TILE_SIZE);
    if (world.getCollisionIfLoaded(tx, ty) & CollisionFlag.Water) return;

    const baddie = entityManager.spawn(createGhostAngry(wx, wy));
    this.trackedIds.add(baddie.id);
  }

  private despawnFar(player: Entity, entityManager: EntityManager): void {
    const playerCx = Math.floor(player.position.wx / CHUNK_SIZE_PX);
    const playerCy = Math.floor(player.position.wy / CHUNK_SIZE_PX);

    const toRemove: number[] = [];
    for (const id of this.trackedIds) {
      const entity = entityManager.entities.find((e) => e.id === id);
      if (!entity) {
        toRemove.push(id);
        continue;
      }
      const cx = Math.floor(entity.position.wx / CHUNK_SIZE_PX);
      const cy = Math.floor(entity.position.wy / CHUNK_SIZE_PX);
      const dist = Math.max(Math.abs(cx - playerCx), Math.abs(cy - playerCy));
      if (dist > DESPAWN_DISTANCE) {
        entityManager.remove(id);
        toRemove.push(id);
      }
    }
    for (const id of toRemove) {
      this.trackedIds.delete(id);
    }
  }
}
