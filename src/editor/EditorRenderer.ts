import { CHUNK_SIZE, TILE_SIZE } from "../config/constants.js";
import type { Camera } from "../rendering/Camera.js";
import type { EditorMode, PaintMode, SubgridShape } from "./EditorMode.js";
import { getSubgridBrushPoints } from "./TerrainEditor.js";

interface ChunkRange {
  minCx: number;
  minCy: number;
  maxCx: number;
  maxCy: number;
}

interface EditorState {
  brushMode: "tile" | "subgrid" | "corner";
  effectivePaintMode: PaintMode;
  subgridShape: SubgridShape;
  brushSize: 1 | 2 | 3;
}

/** Draw editor overlays: tile grid + cursor highlight. */
export function drawEditorOverlay(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  editorMode: EditorMode,
  state: EditorState,
  visible: ChunkRange,
): void {
  drawEditorGrid(ctx, camera, visible);
  drawCursorHighlight(ctx, camera, editorMode, state);
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

function drawCursorHighlight(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  editorMode: EditorMode,
  state: EditorState,
): void {
  if (state.brushMode === "subgrid") {
    drawSubgridCursorHighlight(ctx, camera, editorMode, state);
  } else if (state.brushMode === "corner") {
    drawCornerCursorHighlight(ctx, camera, editorMode, state.effectivePaintMode);
  } else {
    drawTileCursorHighlight(ctx, camera, editorMode, state.effectivePaintMode);
  }
}

function getCursorColor(mode: PaintMode): { fill: string; stroke: string } {
  if (mode === "unpaint") {
    return { fill: "rgba(255, 80, 80, 0.25)", stroke: "rgba(255, 80, 80, 0.6)" };
  }
  if (mode === "negative") {
    return { fill: "rgba(200, 160, 60, 0.25)", stroke: "rgba(200, 160, 60, 0.6)" };
  }
  return { fill: "rgba(255, 255, 255, 0.25)", stroke: "rgba(255, 255, 255, 0.6)" };
}

function drawTileCursorHighlight(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  editorMode: EditorMode,
  paintMode: PaintMode,
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
  ctx.fillRect(tileScreen.sx, tileScreen.sy, tileScreenSize, tileScreenSize);
  ctx.strokeRect(tileScreen.sx, tileScreen.sy, tileScreenSize, tileScreenSize);
  ctx.restore();
}

function drawSubgridCursorHighlight(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  editorMode: EditorMode,
  state: EditorState,
): void {
  const gsx = editorMode.cursorSubgridX;
  const gsy = editorMode.cursorSubgridY;
  if (!Number.isFinite(gsx)) return;

  const halfTile = TILE_SIZE / 2;
  const halfTileScreen = halfTile * camera.scale;
  const shape = state.subgridShape;
  const paintMode = state.effectivePaintMode;

  const baseColor =
    paintMode === "unpaint"
      ? "255, 80, 80"
      : paintMode === "negative"
        ? "200, 160, 60"
        : "240, 160, 48";

  ctx.save();

  if (shape === "cross") {
    const points = getSubgridBrushPoints(gsx, gsy, "cross");
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
    const brushSize = state.brushSize;
    const half = Math.floor(brushSize / 2);

    const wx0 = (gsx - half) * halfTile;
    const wy0 = (gsy - half) * halfTile;
    const wx1 = (gsx - half + brushSize) * halfTile;
    const wy1 = (gsy - half + brushSize) * halfTile;

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
  paintMode: PaintMode,
): void {
  const gsx = editorMode.cursorCornerX;
  const gsy = editorMode.cursorCornerY;
  if (!Number.isFinite(gsx)) return;

  const halfTile = TILE_SIZE / 2;
  const baseColor =
    paintMode === "unpaint"
      ? "255, 80, 80"
      : paintMode === "negative"
        ? "200, 160, 60"
        : "80, 200, 255";

  const wx0 = (gsx - 1) * halfTile;
  const wy0 = (gsy - 1) * halfTile;
  const wx1 = (gsx + 2) * halfTile;
  const wy1 = (gsy + 2) * halfTile;

  const topLeft = camera.worldToScreen(wx0, wy0);
  const botRight = camera.worldToScreen(wx1, wy1);
  const w = botRight.sx - topLeft.sx;
  const h = botRight.sy - topLeft.sy;

  ctx.save();
  ctx.fillStyle = `rgba(${baseColor}, 0.2)`;
  ctx.strokeStyle = `rgba(${baseColor}, 0.7)`;
  ctx.lineWidth = 2;
  ctx.fillRect(topLeft.sx, topLeft.sy, w, h);
  ctx.strokeRect(topLeft.sx, topLeft.sy, w, h);

  // Center crosshair
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
