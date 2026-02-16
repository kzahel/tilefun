import { CHUNK_SIZE, TILE_SIZE } from "../config/constants.js";
import type { Camera } from "../rendering/Camera.js";
import type { RemoteEditorCursor } from "../shared/protocol.js";
import type { World } from "../world/World.js";
import type { EditorMode } from "./EditorMode.js";
import type { EditorModel } from "./EditorModel.js";
import { getSubgridBrushPoints } from "./TerrainEditor.js";

interface ChunkRange {
  minCx: number;
  minCy: number;
  maxCx: number;
  maxCy: number;
}

const ELEVATION_OVERLAY_COLORS = [
  "", // height 0: no overlay
  "rgba(255,255,0,0.2)",
  "rgba(255,160,0,0.25)",
  "rgba(255,60,0,0.3)",
];

/** Draw editor overlays: tile grid + cursor highlight. */
export function drawEditorOverlay(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  editorMode: EditorMode,
  model: EditorModel,
  visible: ChunkRange,
  world?: World,
): void {
  drawEditorGrid(ctx, camera, visible);
  if (model.editorTab === "elevation" && world) {
    drawElevationOverlay(ctx, camera, world, visible);
  }
  drawCursorHighlight(ctx, camera, editorMode, model);
}

function drawEditorGrid(ctx: CanvasRenderingContext2D, camera: Camera, visible: ChunkRange): void {
  if (camera.zoom < 0.3) return;

  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1;

  const minTx = visible.minCx * CHUNK_SIZE;
  const maxTx = (visible.maxCx + 1) * CHUNK_SIZE;
  const minTy = visible.minCy * CHUNK_SIZE;
  const maxTy = (visible.maxCy + 1) * CHUNK_SIZE;

  for (let ty = minTy; ty <= maxTy; ty++) {
    const left = camera.worldToScreen(minTx * TILE_SIZE, ty * TILE_SIZE);
    const right = camera.worldToScreen(maxTx * TILE_SIZE, ty * TILE_SIZE);
    ctx.beginPath();
    ctx.moveTo(left.sx, left.sy);
    ctx.lineTo(right.sx, right.sy);
    ctx.stroke();
  }

  for (let tx = minTx; tx <= maxTx; tx++) {
    const top = camera.worldToScreen(tx * TILE_SIZE, minTy * TILE_SIZE);
    const bottom = camera.worldToScreen(tx * TILE_SIZE, maxTy * TILE_SIZE);
    ctx.beginPath();
    ctx.moveTo(top.sx, top.sy);
    ctx.lineTo(bottom.sx, bottom.sy);
    ctx.stroke();
  }

  ctx.restore();
}

function drawElevationOverlay(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  world: World,
  visible: ChunkRange,
): void {
  const tileScreenSize = TILE_SIZE * camera.scale;

  for (let cy = visible.minCy; cy <= visible.maxCy; cy++) {
    for (let cx = visible.minCx; cx <= visible.maxCx; cx++) {
      const chunk = world.getChunkIfLoaded(cx, cy);
      if (!chunk) continue;

      let hasElevation = false;
      for (let i = 0; i < chunk.heightGrid.length; i++) {
        if (chunk.heightGrid[i] !== 0) {
          hasElevation = true;
          break;
        }
      }
      if (!hasElevation) continue;

      for (let ly = 0; ly < CHUNK_SIZE; ly++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const h = chunk.getHeight(lx, ly);
          if (h <= 0) continue;
          const color = ELEVATION_OVERLAY_COLORS[h] ?? ELEVATION_OVERLAY_COLORS[3];
          if (!color) continue;

          const tx = cx * CHUNK_SIZE + lx;
          const ty = cy * CHUNK_SIZE + ly;
          const screen = camera.worldToScreen(tx * TILE_SIZE, ty * TILE_SIZE);

          ctx.fillStyle = color;
          ctx.fillRect(screen.sx, screen.sy, tileScreenSize, tileScreenSize);
        }
      }
    }
  }
}

function drawCursorHighlight(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  editorMode: EditorMode,
  model: EditorModel,
): void {
  if (model.editorTab === "elevation") {
    drawElevationCursorHighlight(ctx, camera, editorMode, model);
    return;
  }
  if (model.editorTab === "props") {
    drawTileCursorHighlight(ctx, camera, editorMode, "positive", 0);
    return;
  }
  if (model.brushMode === "subgrid" || model.brushMode === "cross" || model.brushMode === "x") {
    drawSubgridCursorHighlight(ctx, camera, editorMode, model);
  } else if (model.brushMode === "corner") {
    drawCornerCursorHighlight(ctx, camera, editorMode, model.effectivePaintMode);
  } else {
    drawTileCursorHighlight(ctx, camera, editorMode, model.effectivePaintMode, model.bridgeDepth);
  }
}

function getCursorColor(mode: string): { fill: string; stroke: string } {
  if (mode === "unpaint") {
    return { fill: "rgba(255, 80, 80, 0.25)", stroke: "rgba(255, 80, 80, 0.6)" };
  }
  return { fill: "rgba(255, 255, 255, 0.25)", stroke: "rgba(255, 255, 255, 0.6)" };
}

function drawTileCursorHighlight(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  editorMode: EditorMode,
  paintMode: string,
  bridgeDepth = 0,
): void {
  const tx = editorMode.cursorTileX;
  const ty = editorMode.cursorTileY;
  if (!Number.isFinite(tx)) return;

  const tileScreen = camera.worldToScreen(tx * TILE_SIZE, ty * TILE_SIZE);
  const tileScreenSize = TILE_SIZE * camera.scale;
  const color = getCursorColor(paintMode);

  ctx.save();
  ctx.fillStyle = color.fill;
  ctx.strokeStyle = color.stroke;
  ctx.lineWidth = 2;

  if (bridgeDepth === 0) {
    ctx.fillRect(tileScreen.sx, tileScreen.sy, tileScreenSize, tileScreenSize);
    ctx.strokeRect(tileScreen.sx, tileScreen.sy, tileScreenSize, tileScreenSize);
  } else {
    const h = tileScreenSize / 2;
    ctx.fillRect(tileScreen.sx + h / 2, tileScreen.sy + h / 2, h, h);
    ctx.fillRect(tileScreen.sx + h / 2, tileScreen.sy - h / 2, h, h);
    ctx.fillRect(tileScreen.sx + h / 2, tileScreen.sy + tileScreenSize - h / 2, h, h);
    ctx.fillRect(tileScreen.sx - h / 2, tileScreen.sy + h / 2, h, h);
    ctx.fillRect(tileScreen.sx + tileScreenSize - h / 2, tileScreen.sy + h / 2, h, h);
    ctx.strokeRect(tileScreen.sx, tileScreen.sy, tileScreenSize, tileScreenSize);
  }

  ctx.restore();
}

function drawSubgridCursorHighlight(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  editorMode: EditorMode,
  model: EditorModel,
): void {
  const gsx = editorMode.cursorSubgridX;
  const gsy = editorMode.cursorSubgridY;
  if (!Number.isFinite(gsx)) return;

  const halfTile = TILE_SIZE / 2;
  const halfTileScreen = halfTile * camera.scale;
  const shape =
    model.brushMode === "cross" ? "cross" : model.brushMode === "x" ? "x" : model.subgridShape;
  const paintMode = model.effectivePaintMode;

  const baseColor = paintMode === "unpaint" ? "255, 80, 80" : "240, 160, 48";

  ctx.save();

  if (shape === "cross" || shape === "x") {
    const points = getSubgridBrushPoints(gsx, gsy, shape);
    ctx.fillStyle = `rgba(${baseColor}, 0.25)`;
    ctx.strokeStyle = `rgba(${baseColor}, 0.8)`;
    ctx.lineWidth = 1;
    for (const [px, py] of points) {
      const screen = camera.worldToScreen(px * halfTile, py * halfTile);
      const x = screen.sx - halfTileScreen / 2;
      const y = screen.sy - halfTileScreen / 2;
      ctx.fillRect(x, y, halfTileScreen, halfTileScreen);
      ctx.strokeRect(x, y, halfTileScreen, halfTileScreen);
    }
  } else {
    const brushSize = model.brushSize;
    const halfBrush = brushSize / 2;

    const wx0 = (gsx - halfBrush) * halfTile;
    const wy0 = (gsy - halfBrush) * halfTile;
    const wx1 = (gsx + halfBrush) * halfTile;
    const wy1 = (gsy + halfBrush) * halfTile;

    const topLeft = camera.worldToScreen(wx0, wy0);
    const botRight = camera.worldToScreen(wx1, wy1);
    const w = botRight.sx - topLeft.sx;
    const h = botRight.sy - topLeft.sy;

    ctx.fillStyle = `rgba(${baseColor}, 0.25)`;
    ctx.strokeStyle = `rgba(${baseColor}, 0.8)`;
    ctx.lineWidth = 2;
    ctx.fillRect(topLeft.sx, topLeft.sy, w, h);
    ctx.strokeRect(topLeft.sx, topLeft.sy, w, h);
  }

  // Center dot
  const center = camera.worldToScreen(gsx * halfTile, gsy * halfTile);
  const radius = Math.max(3, 2 * camera.scale);
  ctx.beginPath();
  ctx.arc(center.sx, center.sy, radius, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${baseColor}, 0.8)`;
  ctx.fill();

  ctx.restore();
}

function drawCornerCursorHighlight(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  editorMode: EditorMode,
  paintMode: string,
): void {
  const gsx = editorMode.cursorCornerX;
  const gsy = editorMode.cursorCornerY;
  if (!Number.isFinite(gsx)) return;

  const halfTile = TILE_SIZE / 2;
  const halfTileScreen = halfTile * camera.scale;
  const baseColor = paintMode === "unpaint" ? "255, 80, 80" : "80, 200, 255";

  ctx.save();
  ctx.fillStyle = `rgba(${baseColor}, 0.25)`;
  ctx.strokeStyle = `rgba(${baseColor}, 0.8)`;
  ctx.lineWidth = 1;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const screen = camera.worldToScreen((gsx + dx) * halfTile, (gsy + dy) * halfTile);
      const x = screen.sx - halfTileScreen / 2;
      const y = screen.sy - halfTileScreen / 2;
      ctx.fillRect(x, y, halfTileScreen, halfTileScreen);
      ctx.strokeRect(x, y, halfTileScreen, halfTileScreen);
    }
  }

  const center = camera.worldToScreen(gsx * halfTile, gsy * halfTile);
  const r = Math.max(4, 3 * camera.scale);
  ctx.strokeStyle = `rgba(${baseColor}, 0.9)`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(center.sx - r, center.sy);
  ctx.lineTo(center.sx + r, center.sy);
  ctx.moveTo(center.sx, center.sy - r);
  ctx.lineTo(center.sx, center.sy + r);
  ctx.stroke();

  ctx.restore();
}

function drawElevationCursorHighlight(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  editorMode: EditorMode,
  model: EditorModel,
): void {
  const tx = editorMode.cursorTileX;
  const ty = editorMode.cursorTileY;
  if (!Number.isFinite(tx)) return;

  const gridSize = model.elevationGridSize;
  const half = Math.floor(gridSize / 2);
  const tileScreenSize = TILE_SIZE * camera.scale;

  const topLeft = camera.worldToScreen((tx - half) * TILE_SIZE, (ty - half) * TILE_SIZE);
  const w = gridSize * tileScreenSize;
  const h = gridSize * tileScreenSize;

  ctx.save();
  ctx.fillStyle = "rgba(255, 200, 60, 0.2)";
  ctx.strokeStyle = "rgba(255, 200, 60, 0.7)";
  ctx.lineWidth = 2;
  ctx.fillRect(topLeft.sx, topLeft.sy, w, h);
  ctx.strokeRect(topLeft.sx, topLeft.sy, w, h);
  ctx.restore();
}

function hexToRgba(hex: string, alpha: number): string {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Draw remote players' editor cursors as colored tile highlights with name labels. */
export function drawRemoteCursors(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  cursors: readonly RemoteEditorCursor[],
): void {
  if (cursors.length === 0) return;

  const tileScreenSize = TILE_SIZE * camera.scale;

  ctx.save();
  for (const cursor of cursors) {
    if (!Number.isFinite(cursor.tileX)) continue;

    const screen = camera.worldToScreen(cursor.tileX * TILE_SIZE, cursor.tileY * TILE_SIZE);

    ctx.fillStyle = hexToRgba(cursor.color, 0.2);
    ctx.strokeStyle = hexToRgba(cursor.color, 0.7);
    ctx.lineWidth = 2;
    ctx.fillRect(screen.sx, screen.sy, tileScreenSize, tileScreenSize);
    ctx.strokeRect(screen.sx, screen.sy, tileScreenSize, tileScreenSize);

    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    const lx = screen.sx + tileScreenSize / 2;
    const ly = screen.sy - 4;

    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillText(cursor.displayName, lx + 1, ly + 1);
    ctx.fillStyle = cursor.color;
    ctx.fillText(cursor.displayName, lx, ly);
  }
  ctx.restore();
}
