import { ELEVATION_PX, TILE_SIZE } from "../config/constants.js";
import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import type { World } from "../world/World.js";
import type { Camera } from "./Camera.js";
import { collectGrassBladeItems } from "./GrassBladeRenderer.js";
import type { ParticleItem, SceneItem, SpriteItem } from "./SceneItem.js";
import type { TileRenderer } from "./TileRenderer.js";

/**
 * Interpolation factor for Z_SORT_FACTOR:
 * 1px of Z counts the same as 1px of Y depth — enough to draw entities
 * above the prop they're standing on, without being so aggressive that
 * ground-level entities in front incorrectly sort behind elevated ones.
 */
const Z_SORT_FACTOR = 1;

/** Interpolate between previous and current position. */
function lerpPos(
  pos: { wx: number; wy: number },
  prev: { wx: number; wy: number } | undefined,
  alpha: number,
): { wx: number; wy: number } {
  if (prev) {
    return {
      wx: prev.wx + (pos.wx - prev.wx) * alpha,
      wy: prev.wy + (pos.wy - prev.wy) * alpha,
    };
  }
  return pos;
}

/**
 * Collect, cull, interpolate, and Y-sort all visible scene items.
 * Returns a renderer-agnostic SceneItem[] in draw order.
 *
 * This is the "scene graph" step — it computes what needs to be drawn
 * and where in world-space, without any Canvas2D-specific code.
 */
export function collectScene(
  entities: readonly Entity[],
  props: readonly Prop[],
  world: World,
  camera: Camera,
  visible: ChunkRange,
  alpha: number,
  tileRenderer: TileRenderer,
  particles: ParticleItem[],
  hasGrass: boolean,
): SceneItem[] {
  const items: SceneItem[] = [];

  // Viewport bounds in world coordinates for culling
  const vpTL = camera.screenToWorld(0, 0);
  const vpBR = camera.screenToWorld(camera.viewportWidth, camera.viewportHeight);
  // Small margin for rendering effects not captured by sprite bounds
  const M = 16;

  // --- Entities ---
  for (const e of entities) {
    if (!e.sprite) continue;
    const effectiveWy = e.position.wy - (e.wz ?? 0);
    const halfW = e.sprite.spriteWidth / 2;
    if (
      e.position.wx + halfW < vpTL.wx - M ||
      e.position.wx - halfW > vpBR.wx + M ||
      effectiveWy < vpTL.wy - M ||
      effectiveWy - e.sprite.spriteHeight > vpBR.wy + M
    )
      continue;

    const pos = lerpPos(e.position, e.prevPosition, alpha);

    // Compute Z offset in world pixels
    let zOffset: number;
    if (e.wz !== undefined) {
      const prevWz = e.prevWz ?? e.wz;
      zOffset = prevWz + (e.wz - prevWz) * alpha;
    } else {
      const tx = Math.floor(pos.wx / TILE_SIZE);
      const ty = Math.floor(pos.wy / TILE_SIZE);
      const elevOffset = world.getHeightAt(tx, ty) * ELEVATION_PX;
      const curJumpZ = e.jumpZ ?? 0;
      const lerpedJumpZ =
        e.prevJumpZ !== undefined ? e.prevJumpZ + (curJumpZ - e.prevJumpZ) * alpha : curJumpZ;
      zOffset = elevOffset + lerpedJumpZ;
    }

    // Shadow parameters
    const hasShadow = !e.flashHidden && !e.noShadow;
    const col = e.collider;
    const shadowWidth = col ? col.width : e.sprite.spriteWidth * 0.6;
    const shadowFeetWy = pos.wy + (col ? col.offsetY : (e.sortOffsetY ?? 0));
    const shadowTx = Math.floor(pos.wx / TILE_SIZE);
    const shadowTy = Math.floor(pos.wy / TILE_SIZE);
    const shadowTerrainZ = world.getHeightAt(shadowTx, shadowTy) * ELEVATION_PX;

    // Sort key
    const sortKey = pos.wy + (e.sortOffsetY ?? 0) + (e.wz ?? 0) * Z_SORT_FACTOR;

    items.push({
      kind: "sprite",
      sortKey,
      wx: pos.wx,
      wy: pos.wy,
      zOffset,
      sheetKey: e.sprite.sheetKey,
      frameCol: e.sprite.frameCol,
      frameRow: e.sprite.frameRow,
      spriteWidth: e.sprite.spriteWidth,
      spriteHeight: e.sprite.spriteHeight,
      flipX: e.sprite.flipX ?? false,
      drawOffsetY: e.sprite.drawOffsetY ?? 0,
      hasShadow,
      shadowFeetWy,
      shadowWidth,
      shadowTerrainZ,
      flashHidden: e.flashHidden ?? false,
    } satisfies SpriteItem);
  }

  // --- Props ---
  for (const p of props) {
    const sw = p.sprite.spriteWidth;
    const sh = p.sprite.spriteHeight;
    const halfW = sw / 2;
    if (
      p.position.wx + halfW < vpTL.wx - M ||
      p.position.wx - halfW > vpBR.wx + M ||
      p.position.wy < vpTL.wy - M ||
      p.position.wy - sh > vpBR.wy + M
    )
      continue;

    // Props have no interpolation, no Z, no shadows
    const tx = Math.floor(p.position.wx / TILE_SIZE);
    const ty = Math.floor(p.position.wy / TILE_SIZE);
    const elevOffset = world.getHeightAt(tx, ty) * ELEVATION_PX;

    items.push({
      kind: "sprite",
      sortKey: p.position.wy,
      wx: p.position.wx,
      wy: p.position.wy,
      zOffset: elevOffset,
      sheetKey: p.sprite.sheetKey,
      frameCol: p.sprite.frameCol,
      frameRow: p.sprite.frameRow,
      spriteWidth: sw,
      spriteHeight: sh,
      flipX: false,
      drawOffsetY: 0,
      hasShadow: false,
      shadowFeetWy: 0,
      shadowWidth: 0,
      shadowTerrainZ: 0,
      flashHidden: false,
    } satisfies SpriteItem);
  }

  // --- Grass blades ---
  if (hasGrass) {
    const viewport = {
      minWx: vpTL.wx,
      minWy: vpTL.wy,
      maxWx: vpBR.wx,
      maxWy: vpBR.wy,
    };
    const nowSec = performance.now() / 1000;
    const grassItems = collectGrassBladeItems(world, entities, visible, viewport, nowSec);
    for (const g of grassItems) {
      items.push(g);
    }
  }

  // --- Elevation tiles ---
  const elevItems = tileRenderer.collectElevationItems(world, visible);
  for (const elev of elevItems) {
    items.push(elev);
  }

  // --- Particles ---
  for (const p of particles) {
    items.push(p);
  }

  // Sort by pre-computed sort key for correct depth ordering
  items.sort((a, b) => a.sortKey - b.sortKey);

  return items;
}
