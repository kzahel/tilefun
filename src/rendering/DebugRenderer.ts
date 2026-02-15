import { getBaseSelectionMode, getForceConvex } from "../autotile/TerrainId.js";
import {
  CHUNK_SIZE,
  DEFAULT_PHYSICAL_HEIGHT,
  ELEVATION_PX,
  TILE_SIZE,
} from "../config/constants.js";
import { getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import type { World } from "../world/World.js";
import type { Camera } from "./Camera.js";

export interface DebugInfo {
  fps: number;
  entityCount: number;
  chunkCount: number;
  playerWx: number;
  playerWy: number;
  playerTx: number;
  playerTy: number;
  terrainName: string;
  collisionFlags: string;
  speedMultiplier: number;
  playerWz?: number | undefined;
  playerJumpZ?: number | undefined;
}

function drawInfoPanel(ctx: CanvasRenderingContext2D, info: DebugInfo): void {
  const lines = [
    `FPS: ${info.fps}`,
    `Entities: ${info.entityCount}  Chunks: ${info.chunkCount}`,
    `Pos: (${info.playerWx.toFixed(1)}, ${info.playerWy.toFixed(1)}, Z=${(info.playerWz ?? 0).toFixed(1)})  Tile: (${info.playerTx}, ${info.playerTy})`,
    `Terrain: ${info.terrainName}`,
    `Collision: ${info.collisionFlags}  Speed: ${info.speedMultiplier}x`,
    `Base: ${getBaseSelectionMode()} (D to toggle)  Convex: ${getForceConvex() ? "ON" : "off"}`,
  ];
  if (info.playerJumpZ) {
    lines.push(`Jump: Z=${info.playerJumpZ.toFixed(1)}`);
  }
  const lineHeight = 16;
  const panelW = 340;
  const panelH = lines.length * lineHeight + 8;
  // Start below the HTML button bar (top: 8px + ~38px button height + gap)
  const panelY = 50;

  ctx.save();
  ctx.font = "13px monospace";
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(4, panelY, panelW, panelH);
  ctx.fillStyle = "#00ff00";
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i] ?? "", 10, panelY + 14 + i * lineHeight);
  }
  ctx.restore();
}

function drawChunkBorders(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  visible: { minCx: number; minCy: number; maxCx: number; maxCy: number },
): void {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 0, 0.3)";
  ctx.lineWidth = 1;

  const chunkPx = CHUNK_SIZE * TILE_SIZE;

  for (let cy = visible.minCy; cy <= visible.maxCy + 1; cy++) {
    const wy = cy * chunkPx;
    const left = camera.worldToScreen(visible.minCx * chunkPx, wy);
    const right = camera.worldToScreen((visible.maxCx + 1) * chunkPx, wy);
    ctx.beginPath();
    ctx.moveTo(left.sx, left.sy);
    ctx.lineTo(right.sx, right.sy);
    ctx.stroke();
  }

  for (let cx = visible.minCx; cx <= visible.maxCx + 1; cx++) {
    const wx = cx * chunkPx;
    const top = camera.worldToScreen(wx, visible.minCy * chunkPx);
    const bottom = camera.worldToScreen(wx, (visible.maxCy + 1) * chunkPx);
    ctx.beginPath();
    ctx.moveTo(top.sx, top.sy);
    ctx.lineTo(bottom.sx, bottom.sy);
    ctx.stroke();
  }

  ctx.restore();
}

/** Compute screen-space elevation Y-offset for a world position. */
function getElevOffset(pos: { wx: number; wy: number }, camera: Camera, world?: World): number {
  if (!world) return 0;
  const tx = Math.floor(pos.wx / TILE_SIZE);
  const ty = Math.floor(pos.wy / TILE_SIZE);
  return world.getHeightAt(tx, ty) * ELEVATION_PX * camera.scale;
}

/** Draw a vertical height line with a tick mark at the top. Blue, from bottomY upward. */
function drawHeightLine(
  ctx: CanvasRenderingContext2D,
  cx: number,
  bottomY: number,
  heightPx: number,
): void {
  ctx.save();
  ctx.strokeStyle = "rgba(80, 140, 255, 0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, bottomY);
  ctx.lineTo(cx, bottomY - heightPx);
  ctx.stroke();
  // Tick at top
  ctx.beginPath();
  ctx.moveTo(cx - 3, bottomY - heightPx);
  ctx.lineTo(cx + 3, bottomY - heightPx);
  ctx.stroke();
  ctx.restore();
}

function drawCollisionBoxes(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  entities: Entity[],
  props: Prop[],
  world?: World,
): void {
  ctx.save();
  ctx.lineWidth = 1;

  for (const entity of entities) {
    if (!entity.collider) continue;
    const aabb = getEntityAABB(entity.position, entity.collider);
    // Use wz for ground offset (accounts for prop surfaces), fall back to terrain
    const elevOffset =
      entity.wz !== undefined
        ? (entity.wz - (entity.jumpZ ?? 0)) * camera.scale
        : getElevOffset(entity.position, camera, world);
    const jumpZ = entity.jumpZ ?? 0;
    const jumpOffset = jumpZ * camera.scale;
    const w = (aabb.right - aabb.left) * camera.scale;
    const h = (aabb.bottom - aabb.top) * camera.scale;
    const topLeft = camera.worldToScreen(aabb.left, aabb.top);
    const sx = Math.floor(topLeft.sx);
    const groundSy = Math.floor(topLeft.sy - elevOffset);

    const physHeight = entity.collider.physicalHeight ?? DEFAULT_PHYSICAL_HEIGHT;
    const heightPx = physHeight * camera.scale;

    if (jumpZ > 0) {
      // Ground shadow box (dashed, faded)
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = "rgba(255, 0, 0, 0.3)";
      ctx.strokeRect(sx, groundSy, w, h);
      ctx.restore();

      // Elevated box (solid)
      ctx.strokeStyle = "rgba(255, 0, 0, 0.7)";
      const elevSy = Math.floor(groundSy - jumpOffset);
      ctx.strokeRect(sx, elevSy, w, h);

      // Height line from bottom of elevated box
      const cx = Math.floor(sx + w / 2);
      drawHeightLine(ctx, cx, elevSy + h, heightPx);

      // jumpZ label
      ctx.font = "10px monospace";
      ctx.fillStyle = "rgba(255, 100, 100, 0.9)";
      ctx.fillText(`z=${jumpZ.toFixed(1)}`, sx + w + 2, elevSy + h / 2);
    } else {
      // Grounded box
      ctx.strokeStyle = "rgba(255, 0, 0, 0.7)";
      ctx.strokeRect(sx, groundSy, w, h);

      // Height line from bottom of box
      const cx = Math.floor(sx + w / 2);
      drawHeightLine(ctx, cx, groundSy + h, heightPx);
    }
  }

  for (const prop of props) {
    const elevOffset = getElevOffset(prop.position, camera, world);
    if (prop.walls) {
      // Enterable prop: draw overall bounding collider as dashed cyan
      if (prop.collider) {
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = "rgba(0, 200, 255, 0.4)";
        const aabb = getEntityAABB(prop.position, prop.collider);
        const tl = camera.worldToScreen(aabb.left, aabb.top);
        const w = (aabb.right - aabb.left) * camera.scale;
        const h = (aabb.bottom - aabb.top) * camera.scale;
        ctx.strokeRect(Math.floor(tl.sx), Math.floor(tl.sy - elevOffset), w, h);
        ctx.restore();
      }
      // Draw each wall segment in orange, with height lines for Z-aware walls
      for (const wall of prop.walls) {
        const aabb = getEntityAABB(prop.position, wall);
        const tl = camera.worldToScreen(aabb.left, aabb.top);
        const w = (aabb.right - aabb.left) * camera.scale;
        const h = (aabb.bottom - aabb.top) * camera.scale;
        const zBase = wall.zBase ?? 0;
        const baseOffset = zBase * camera.scale;
        const sy = Math.floor(tl.sy - elevOffset - baseOffset);
        ctx.strokeStyle = wall.walkableTop
          ? "rgba(0, 220, 200, 0.8)" // cyan-green for walkable
          : "rgba(255, 160, 0, 0.8)"; // orange for normal walls
        ctx.strokeRect(Math.floor(tl.sx), sy, w, h);
        // Height line if wall has finite zHeight
        if (wall.zHeight !== undefined) {
          const cx = Math.floor(tl.sx + w / 2);
          drawHeightLine(ctx, cx, sy + h, wall.zHeight * camera.scale);
        }
      }
    } else if (prop.collider) {
      const zBase = prop.collider.zBase ?? 0;
      const baseOffset = zBase * camera.scale;
      ctx.strokeStyle = "rgba(0, 200, 255, 0.7)";
      const aabb = getEntityAABB(prop.position, prop.collider);
      const tl = camera.worldToScreen(aabb.left, aabb.top);
      const w = (aabb.right - aabb.left) * camera.scale;
      const h = (aabb.bottom - aabb.top) * camera.scale;
      const sy = Math.floor(tl.sy - elevOffset - baseOffset);
      ctx.strokeRect(Math.floor(tl.sx), sy, w, h);

      // Height line using actual zHeight if available, else spriteHeight proxy
      const cx = Math.floor(tl.sx + w / 2);
      const propHeight = prop.collider.zHeight ?? Math.min(prop.sprite.spriteHeight, 32) * 0.5;
      drawHeightLine(ctx, cx, sy + h, propHeight * camera.scale);
    }
  }

  ctx.restore();
}

export interface DebugRenderFlags {
  showInfoPanel: boolean;
  showChunkBorders: boolean;
  showBboxes: boolean;
  showGrid: boolean;
  showPlayerNames: boolean;
}

/** Draw debug overlay with fine-grained control via flags. */
export function drawDebugOverlay(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  entities: Entity[],
  props: Prop[],
  info: DebugInfo,
  visible: { minCx: number; minCy: number; maxCx: number; maxCy: number },
  flags?: DebugRenderFlags,
  playerNames?: Record<number, string>,
  world?: World,
): void {
  const showAll = !flags; // no flags = show all (legacy debugEnabled path)
  if (showAll || flags?.showInfoPanel) drawInfoPanel(ctx, info);
  if (showAll || flags?.showChunkBorders) drawChunkBorders(ctx, camera, visible);
  if (showAll || flags?.showBboxes) drawCollisionBoxes(ctx, camera, entities, props, world);
  if (flags?.showGrid) drawTileGrid(ctx, camera, visible);
  if (playerNames && (showAll || flags?.showPlayerNames)) {
    drawPlayerNames(ctx, camera, entities, playerNames);
  }
}

function drawPlayerNames(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  entities: Entity[],
  playerNames: Record<number, string>,
): void {
  ctx.save();
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  for (const entity of entities) {
    const name = playerNames[entity.id];
    if (!name) continue;
    const screen = camera.worldToScreen(entity.position.wx, entity.position.wy);
    // Draw above the entity sprite (approx 48px sprite height * scale)
    const labelY = screen.sy - (entity.sprite?.spriteHeight ?? 32) * camera.scale - 4;
    // Shadow for readability
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillText(name, screen.sx + 1, labelY + 1);
    ctx.fillStyle = "#4fc3f7";
    ctx.fillText(name, screen.sx, labelY);
  }
  ctx.restore();
}

function drawTileGrid(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  visible: { minCx: number; minCy: number; maxCx: number; maxCy: number },
): void {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 1;

  const chunkTiles = CHUNK_SIZE;
  const minTx = visible.minCx * chunkTiles;
  const maxTx = (visible.maxCx + 1) * chunkTiles;
  const minTy = visible.minCy * chunkTiles;
  const maxTy = (visible.maxCy + 1) * chunkTiles;

  for (let ty = minTy; ty <= maxTy; ty++) {
    const wy = ty * TILE_SIZE;
    const left = camera.worldToScreen(minTx * TILE_SIZE, wy);
    const right = camera.worldToScreen(maxTx * TILE_SIZE, wy);
    ctx.beginPath();
    ctx.moveTo(left.sx, left.sy);
    ctx.lineTo(right.sx, right.sy);
    ctx.stroke();
  }

  for (let tx = minTx; tx <= maxTx; tx++) {
    const wx = tx * TILE_SIZE;
    const top = camera.worldToScreen(wx, minTy * TILE_SIZE);
    const bottom = camera.worldToScreen(wx, maxTy * TILE_SIZE);
    ctx.beginPath();
    ctx.moveTo(top.sx, top.sy);
    ctx.lineTo(bottom.sx, bottom.sy);
    ctx.stroke();
  }

  ctx.restore();
}
