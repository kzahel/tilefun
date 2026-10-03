import type { SpriteCatalog } from "../assets/SpriteCatalog.js";
import { CHUNK_SIZE, TILE_SIZE } from "../config/constants.js";
import { compileTreeRun } from "../patterns/FencedTrees.js";
import type { Camera } from "../rendering/Camera.js";
import type { OverlayFrame } from "../rendering/OverlayFrame.js";
import type { RemoteEditorCursor } from "../shared/protocol.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import type { World } from "../world/World.js";
import type { EditorMode } from "./EditorMode.js";
import type { EditorModel } from "./EditorModel.js";
import { getSubgridBrushPoints } from "./TerrainEditor.js";

const ELEVATION_COLORS = ["", "rgba(255,255,0,0.2)", "rgba(255,160,0,0.25)", "rgba(255,60,0,0.3)"];

export function collectEditorOverlay(
  out: OverlayFrame,
  camera: Camera,
  editor: EditorMode,
  model: EditorModel,
  visible: ChunkRange,
  world: World,
  assets: SpriteCatalog,
): void {
  const scale = camera.scale;
  const rect = (
    wx: number,
    wy: number,
    w: number,
    h: number,
    fill: string,
    stroke = "",
    lineWidth = 1,
  ) => {
    const p = camera.worldToScreen(wx, wy);
    out.rect(p.sx, p.sy, w * scale, h * scale, fill, stroke, lineWidth);
  };
  const grid = (
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    step: number,
    color: string,
    horizontalFirst: boolean,
  ) => {
    const horizontal = () => {
      for (let y = minY; y <= maxY; y += step) {
        const a = camera.worldToScreen(minX, y),
          b = camera.worldToScreen(maxX, y);
        out.line(a.sx, a.sy, b.sx, b.sy, color);
      }
    };
    const vertical = () => {
      for (let x = minX; x <= maxX; x += step) {
        const a = camera.worldToScreen(x, minY),
          b = camera.worldToScreen(x, maxY);
        out.line(a.sx, a.sy, b.sx, b.sy, color);
      }
    };
    if (horizontalFirst) {
      horizontal();
      vertical();
    } else {
      vertical();
      horizontal();
    }
  };
  if (!model.indoor && camera.zoom >= 0.3)
    grid(
      visible.minCx * CHUNK_SIZE * TILE_SIZE,
      visible.minCy * CHUNK_SIZE * TILE_SIZE,
      (visible.maxCx + 1) * CHUNK_SIZE * TILE_SIZE,
      (visible.maxCy + 1) * CHUNK_SIZE * TILE_SIZE,
      TILE_SIZE,
      "rgba(255, 255, 255, 0.12)",
      true,
    );
  if (model.editorTab === "elevation") {
    for (let cy = visible.minCy; cy <= visible.maxCy; cy++)
      for (let cx = visible.minCx; cx <= visible.maxCx; cx++) {
        const chunk = world.getChunkIfLoaded(cx, cy);
        if (!chunk) continue;
        for (let ly = 0; ly < CHUNK_SIZE; ly++)
          for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            const h = chunk.getHeight(lx, ly);
            if (h <= 0) continue;
            const color = ELEVATION_COLORS[h] ?? ELEVATION_COLORS[3];
            if (color)
              rect(
                (cx * CHUNK_SIZE + lx) * TILE_SIZE,
                (cy * CHUNK_SIZE + ly) * TILE_SIZE,
                TILE_SIZE,
                TILE_SIZE,
                color,
              );
          }
      }
  }
  if (!model.indoor) collectCursor(out, camera, editor, model);
  const error = (message: string, maxWidth: number) => {
    out.rect(12, 12, Math.min(camera.viewportWidth - 24, maxWidth), 38, "#201410dd");
    out.label(message, 20, 36, "#ffa090", "14px monospace");
  };
  if (model.indoor && model.editorTab === "patterns") {
    const preview = editor.getRoomPreview(),
      doc = editor.roomState?.document;
    if (doc) grid(0, 0, doc.width * 32, doc.height * 32, 32, "#8bcbff80", false);
    const color = preview?.error
      ? "#ff555560"
      : model.effectivePaintMode === "unpaint"
        ? "#ffae5550"
        : "#8bd1c030";
    const points = preview?.points ?? [
      { x: Math.floor(editor.cursorTileX / 2), y: Math.floor(editor.cursorTileY / 2) },
    ];
    for (const p of points) rect(p.x * 32, p.y * 32, 32, 32, color);
    if (preview?.error) error(preview.error, 900);
    return;
  }
  if (model.editorTab === "patterns") {
    const preview = editor.getPatternPreview();
    if (!preview) return;
    if (assets.has("me-complete"))
      for (const run of preview.runs)
        for (const p of compileTreeRun(run.length)) {
          const pos = camera.worldToScreen(
            run.x * 16 + run.length * 8 + p.dx - p.spriteWidth / 2,
            (run.y + 1) * 16 - p.spriteHeight,
          );
          const d = out.next("sprite");
          d.sheetKey = "me-complete";
          d.srcX = p.frameCol * 16;
          d.srcY = p.frameRow * 16;
          d.srcWidth = p.spriteWidth;
          d.srcHeight = p.spriteHeight;
          d.x = pos.sx;
          d.y = pos.sy;
          d.width = p.spriteWidth * scale;
          d.height = p.spriteHeight * scale;
          d.alpha = 0.55;
        }
    const color = preview.error ? "#ff555560" : preview.erase ? "#ffae5550" : "#8bd1c050";
    for (const p of preview.points) rect(p.x * 16, p.y * 16, 16, 16, color);
    if (preview.error) error(preview.error, 800);
  }
}

function collectCursor(
  out: OverlayFrame,
  camera: Camera,
  editor: EditorMode,
  model: EditorModel,
): void {
  const scale = camera.scale,
    tileSize = TILE_SIZE * scale;
  const red = model.effectivePaintMode === "unpaint";
  if (model.editorTab === "elevation") {
    if (!Number.isFinite(editor.cursorTileX)) return;
    const half = Math.floor(model.elevationGridSize / 2);
    const p = camera.worldToScreen(
      (editor.cursorTileX - half) * TILE_SIZE,
      (editor.cursorTileY - half) * TILE_SIZE,
    );
    const size = model.elevationGridSize * tileSize;
    out.rect(p.sx, p.sy, size, size, "rgba(255, 200, 60, 0.2)", "rgba(255, 200, 60, 0.7)", 2);
    return;
  }
  if (
    model.editorTab !== "props" &&
    (model.brushMode === "subgrid" || model.brushMode === "cross" || model.brushMode === "x")
  ) {
    const x = editor.cursorSubgridX,
      y = editor.cursorSubgridY;
    if (!Number.isFinite(x)) return;
    const halfTile = TILE_SIZE / 2,
      h = halfTile * scale;
    const base = red ? "255, 80, 80" : "240, 160, 48";
    const fill = `rgba(${base}, 0.25)`,
      stroke = `rgba(${base}, 0.8)`;
    const shape =
      model.brushMode === "cross" ? "cross" : model.brushMode === "x" ? "x" : model.subgridShape;
    if (shape === "cross" || shape === "x") {
      for (const [px, py] of getSubgridBrushPoints(x, y, shape)) {
        const p = camera.worldToScreen(px * halfTile, py * halfTile);
        out.rect(p.sx - h / 2, p.sy - h / 2, h, h, fill, stroke);
      }
    } else {
      const half = model.brushSize / 2;
      const a = camera.worldToScreen((x - half) * halfTile, (y - half) * halfTile);
      const b = camera.worldToScreen((x + half) * halfTile, (y + half) * halfTile);
      out.rect(a.sx, a.sy, b.sx - a.sx, b.sy - a.sy, fill, stroke, 2);
    }
    const p = camera.worldToScreen(x * halfTile, y * halfTile),
      d = out.next("circle");
    d.x = p.sx;
    d.y = p.sy;
    d.width = Math.max(3, 2 * scale);
    d.fill = stroke;
    return;
  }
  if (model.editorTab !== "props" && model.brushMode === "corner") {
    const x = editor.cursorCornerX,
      y = editor.cursorCornerY;
    if (!Number.isFinite(x)) return;
    const halfTile = TILE_SIZE / 2,
      h = halfTile * scale,
      base = red ? "255, 80, 80" : "80, 200, 255";
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const p = camera.worldToScreen((x + dx) * halfTile, (y + dy) * halfTile);
        out.rect(p.sx - h / 2, p.sy - h / 2, h, h, `rgba(${base}, 0.25)`, `rgba(${base}, 0.8)`);
      }
    const p = camera.worldToScreen(x * halfTile, y * halfTile),
      d = out.next("cross");
    d.x = p.sx;
    d.y = p.sy;
    d.width = Math.max(4, 3 * scale);
    d.stroke = `rgba(${base}, 0.9)`;
    d.lineWidth = 2;
    return;
  }
  if (!Number.isFinite(editor.cursorTileX)) return;
  const p = camera.worldToScreen(editor.cursorTileX * TILE_SIZE, editor.cursorTileY * TILE_SIZE);
  const erase = red && model.editorTab !== "props";
  const fill = erase ? "rgba(255, 80, 80, 0.25)" : "rgba(255, 255, 255, 0.25)";
  const stroke = erase ? "rgba(255, 80, 80, 0.6)" : "rgba(255, 255, 255, 0.6)";
  if (model.editorTab !== "props" && model.bridgeDepth !== 0) {
    const h = tileSize / 2;
    out.rect(p.sx + h / 2, p.sy + h / 2, h, h, fill);
    out.rect(p.sx + h / 2, p.sy - h / 2, h, h, fill);
    out.rect(p.sx + h / 2, p.sy + tileSize - h / 2, h, h, fill);
    out.rect(p.sx - h / 2, p.sy + h / 2, h, h, fill);
    out.rect(p.sx + tileSize - h / 2, p.sy + h / 2, h, h, fill);
    out.rect(p.sx, p.sy, tileSize, tileSize, "", stroke, 2);
  } else out.rect(p.sx, p.sy, tileSize, tileSize, fill, stroke, 2);
}

export function collectRemoteCursors(
  out: OverlayFrame,
  camera: Camera,
  cursors: readonly RemoteEditorCursor[],
): void {
  const rgba = (hex: string, alpha: number) =>
    `rgba(${Number.parseInt(hex.slice(1, 3), 16)}, ${Number.parseInt(hex.slice(3, 5), 16)}, ${Number.parseInt(hex.slice(5, 7), 16)}, ${alpha})`;
  const size = TILE_SIZE * camera.scale;
  for (const c of cursors) {
    if (!Number.isFinite(c.tileX)) continue;
    const p = camera.worldToScreen(c.tileX * TILE_SIZE, c.tileY * TILE_SIZE);
    out.rect(p.sx, p.sy, size, size, rgba(c.color, 0.2), rgba(c.color, 0.7), 2);
    const x = p.sx + size / 2,
      y = p.sy - 4;
    out.label(c.displayName, x + 1, y + 1, "rgba(0, 0, 0, 0.7)", "bold 11px monospace", true);
    out.label(c.displayName, x, y, c.color, "bold 11px monospace", true);
  }
}
