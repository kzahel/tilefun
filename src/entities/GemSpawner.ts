import { CHUNK_SIZE_PX, TILE_SIZE } from "../config/constants.js";
import type { Camera } from "../rendering/Camera.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import type { World } from "../world/World.js";
import type { Entity } from "./Entity.js";
import type { EntityManager } from "./EntityManager.js";
import { createGem } from "./Gem.js";

/** Seconds between spawn attempts. */
const SPAWN_INTERVAL = 2.0;
/** Maximum gems alive in the world at once. */
const MAX_GEMS = 8;
/** Minimum Chebyshev chunk distance from player to spawn. */
const SPAWN_RADIUS_MIN = 2;
/** Maximum Chebyshev chunk distance from player to spawn. */
const SPAWN_RADIUS_MAX = 4;
/** Gems beyond this chunk distance from the player are despawned. */
const DESPAWN_DISTANCE = 6;

function chunkKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

export class GemSpawner {
  private spawnTimer = 0;
  /** Maps chunk key → gem entity id. */
  private chunkGemMap = new Map<string, number>();

  /** Rebuild chunk map from existing gem entities (call after world load). */
  reset(entityManager: EntityManager): void {
    this.chunkGemMap.clear();
    this.spawnTimer = 0;
    for (const e of entityManager.entities) {
      if (e.type !== "gem") continue;
      const cx = Math.floor(e.position.wx / CHUNK_SIZE_PX);
      const cy = Math.floor(e.position.wy / CHUNK_SIZE_PX);
      this.chunkGemMap.set(chunkKey(cx, cy), e.id);
    }
  }

  update(
    dt: number,
    player: Entity,
    camera: Camera,
    entityManager: EntityManager,
    world: World,
  ): void {
    this.despawnFar(player, entityManager);

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = SPAWN_INTERVAL;
      this.trySpawn(player, camera, entityManager, world);
    }
  }

  private trySpawn(
    player: Entity,
    camera: Camera,
    entityManager: EntityManager,
    world: World,
  ): void {
    // Count current gems
    let gemCount = 0;
    for (const e of entityManager.entities) {
      if (e.type === "gem") gemCount++;
    }
    if (gemCount >= MAX_GEMS) return;

    const playerCx = Math.floor(player.position.wx / CHUNK_SIZE_PX);
    const playerCy = Math.floor(player.position.wy / CHUNK_SIZE_PX);
    const visible = camera.getVisibleChunkRange();

    // Collect candidate chunks: within spawn radius, off-screen, no existing gem
    const candidates: { cx: number; cy: number }[] = [];
    for (let cy = playerCy - SPAWN_RADIUS_MAX; cy <= playerCy + SPAWN_RADIUS_MAX; cy++) {
      for (let cx = playerCx - SPAWN_RADIUS_MAX; cx <= playerCx + SPAWN_RADIUS_MAX; cx++) {
        const dist = Math.max(Math.abs(cx - playerCx), Math.abs(cy - playerCy));
        if (dist < SPAWN_RADIUS_MIN || dist > SPAWN_RADIUS_MAX) continue;
        // Must be off-screen
        if (
          cx >= visible.minCx &&
          cx <= visible.maxCx &&
          cy >= visible.minCy &&
          cy <= visible.maxCy
        )
          continue;
        // Must not already have a gem
        if (this.chunkGemMap.has(chunkKey(cx, cy))) continue;
        candidates.push({ cx, cy });
      }
    }

    if (candidates.length === 0) return;

    const choice = candidates[Math.floor(Math.random() * candidates.length)];
    if (!choice) return;
    // Random position within the chunk (offset by half tile to avoid chunk edges)
    const wx = choice.cx * CHUNK_SIZE_PX + 8 + Math.random() * (CHUNK_SIZE_PX - 16);
    const wy = choice.cy * CHUNK_SIZE_PX + 8 + Math.random() * (CHUNK_SIZE_PX - 16);

    // Don't spawn on water
    const tx = Math.floor(wx / TILE_SIZE);
    const ty = Math.floor(wy / TILE_SIZE);
    if (world.getCollisionIfLoaded(tx, ty) & CollisionFlag.Water) return;

    const gem = entityManager.spawn(createGem(wx, wy));
    this.chunkGemMap.set(chunkKey(choice.cx, choice.cy), gem.id);
  }

  private despawnFar(player: Entity, entityManager: EntityManager): void {
    const playerCx = Math.floor(player.position.wx / CHUNK_SIZE_PX);
    const playerCy = Math.floor(player.position.wy / CHUNK_SIZE_PX);

    const toRemove: string[] = [];
    for (const [key, gemId] of this.chunkGemMap) {
      // Check if gem still exists (may have been collected)
      const gem = entityManager.entities.find((e) => e.id === gemId);
      if (!gem) {
        toRemove.push(key);
        continue;
      }
      const gemCx = Math.floor(gem.position.wx / CHUNK_SIZE_PX);
      const gemCy = Math.floor(gem.position.wy / CHUNK_SIZE_PX);
      const dist = Math.max(Math.abs(gemCx - playerCx), Math.abs(gemCy - playerCy));
      if (dist > DESPAWN_DISTANCE) {
        entityManager.remove(gemId);
        toRemove.push(key);
      }
    }
    for (const key of toRemove) {
      this.chunkGemMap.delete(key);
    }
  }
}
