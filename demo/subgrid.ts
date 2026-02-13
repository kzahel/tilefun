/// <reference types="vite/client" />
/**
 * Sub-Grid Blob Autotile Demo — imports real game autotile modules.
 * Changes to src/autotile/ are reflected here via Vite HMR.
 */

import { BlendGraph } from "../src/autotile/BlendGraph.js";
import { AutotileBit } from "../src/autotile/bitmask.js";
import type { TileBlendResult } from "../src/autotile/computeTileBlend.js";
import { computeTileBlend } from "../src/autotile/computeTileBlend.js";
import { GM_BLOB_47 } from "../src/autotile/gmBlobLayout.js";
import { ALL_TERRAIN_IDS, TERRAIN_DEPTH, TerrainId } from "../src/autotile/TerrainId.js";

// ===================== DISPLAY METADATA (demo-only) =====================

interface TerrainDisplay {
  label: string;
  color: string;
}

const TERRAIN_DISPLAY: Record<TerrainId, TerrainDisplay> = {
  [TerrainId.DeepWater]: { label: "Deep Water", color: "#1a3a5c" },
  [TerrainId.ShallowWater]: { label: "Shallow Water", color: "#3a7ab8" },
  [TerrainId.Sand]: { label: "Sand", color: "#c2a860" },
  [TerrainId.SandLight]: { label: "Sand Light", color: "#d4c888" },
  [TerrainId.Grass]: { label: "Grass", color: "#6b935f" },
  [TerrainId.DirtLight]: { label: "Dirt Light", color: "#a08050" },
  [TerrainId.DirtWarm]: { label: "Dirt Warm", color: "#8b6030" },
  [TerrainId.Asphalt]: { label: "Asphalt", color: "#4a4a50" },
  [TerrainId.Sidewalk]: { label: "Sidewalk", color: "#b0aaaa" },
  [TerrainId.RoadWhite]: { label: "Road White", color: "#e0e0e0" },
  [TerrainId.RoadYellow]: { label: "Road Yellow", color: "#d4a030" },
  [TerrainId.Playground]: { label: "Playground", color: "#c87050" },
  [TerrainId.Curb]: { label: "Curb", color: "#808080" },
};

// ===================== SHARED INSTANCES =====================

const blendGraph = new BlendGraph();
const BASE_URL = import.meta.env.BASE_URL as string;

// ===================== STATE =====================

const CELL = 48;
const PAD = 28;
const POINT_R = { center: 10, mid: 8, corner: 6 };

let gridSize = 3;
let sgSize = 2 * gridSize + 1;
let subgrid = new Uint8Array(sgSize * sgSize);
let baseTerrain: TerrainId = TerrainId.Grass;
let paintTerrain: TerrainId = TerrainId.ShallowWater;
type BrushMode = "positive" | "negative" | "unpaint";
type BrushShape = "grid1" | "grid2" | "grid3" | "cross" | "tile";
let brushMode: BrushMode = "positive";
let brushShape: BrushShape = "grid1";
let hoveredPoint: { sx: number; sy: number } | null = null;
let hoveredTile: { tx: number; ty: number } | null = null;
let painting = false;
let paintButton = 0;
let showSheets = true;
let showMasks = false;

// ===================== SHEET LOADING =====================

const sheetCache = new Map<string, HTMLImageElement>();

function getSheet(assetPath: string): HTMLImageElement {
  const cached = sheetCache.get(assetPath);
  if (cached) return cached;
  const img = new Image();
  img.src = BASE_URL + assetPath;
  sheetCache.set(assetPath, img);
  img.onload = () => render();
  return img;
}

// ===================== SUBGRID UTILITIES =====================

function sgIdx(sx: number, sy: number): number {
  return sy * sgSize + sx;
}

function getSg(sx: number, sy: number): TerrainId {
  if (sx < 0 || sy < 0 || sx >= sgSize || sy >= sgSize) return baseTerrain;
  return (subgrid[sgIdx(sx, sy)] ?? baseTerrain) as TerrainId;
}

function setSg(sx: number, sy: number, val: TerrainId): void {
  if (sx >= 0 && sy >= 0 && sx < sgSize && sy < sgSize) subgrid[sgIdx(sx, sy)] = val;
}

function pointType(sx: number, sy: number): "center" | "corner" | "mid" {
  const xEven = sx % 2 === 0;
  const yEven = sy % 2 === 0;
  if (!xEven && !yEven) return "center";
  if (xEven && yEven) return "corner";
  return "mid";
}

function pointTypeLabel(sx: number, sy: number): string {
  const t = pointType(sx, sy);
  if (t === "center") return "Center (tile terrain)";
  if (t === "corner") return "Corner (diagonal)";
  return sx % 2 === 1 ? "H-midpoint (N/S edge)" : "V-midpoint (W/E edge)";
}

// ===================== COORDINATE CONVERSION =====================

function sgToCanvas(sx: number, sy: number): { x: number; y: number } {
  return { x: PAD + sx * CELL, y: PAD + sy * CELL };
}

function canvasToSg(cx: number, cy: number): { sx: number; sy: number } {
  return { sx: Math.round((cx - PAD) / CELL), sy: Math.round((cy - PAD) / CELL) };
}

function canvasToTile(cx: number, cy: number): { tx: number; ty: number } | null {
  const tx = Math.floor((cx - PAD) / (CELL * 2));
  const ty = Math.floor((cy - PAD) / (CELL * 2));
  if (tx >= 0 && tx < gridSize && ty >= 0 && ty < gridSize) return { tx, ty };
  return null;
}

// ===================== BRUSH HELPERS =====================

function getBrushPoints(sx: number, sy: number): { sx: number; sy: number }[] {
  const pts: { sx: number; sy: number }[] = [];
  switch (brushShape) {
    case "grid1":
      pts.push({ sx, sy });
      break;
    case "grid2":
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++) pts.push({ sx: sx + dx, sy: sy + dy });
      break;
    case "grid3":
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) pts.push({ sx: sx + dx, sy: sy + dy });
      break;
    case "cross":
      pts.push({ sx, sy });
      pts.push({ sx: sx - 1, sy });
      pts.push({ sx: sx + 1, sy });
      pts.push({ sx, sy: sy - 1 });
      pts.push({ sx, sy: sy + 1 });
      break;
    case "tile": {
      // Snap to nearest tile center (odd,odd), then paint all 9 subgrid points
      const tcx = sx % 2 === 0 ? (sx > 0 ? sx - 1 : sx + 1) : sx;
      const tcy = sy % 2 === 0 ? (sy > 0 ? sy - 1 : sy + 1) : sy;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) pts.push({ sx: tcx + dx, sy: tcy + dy });
      break;
    }
  }
  return pts.filter((p) => p.sx >= 0 && p.sy >= 0 && p.sx < sgSize && p.sy < sgSize);
}

function findUnpaintReplacement(sx: number, sy: number): TerrainId {
  const counts = new Map<TerrainId, number>();
  const dirs: [number, number][] = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];
  for (const [dx, dy] of dirs) {
    const t = getSg(sx + dx, sy + dy);
    if (t !== paintTerrain) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  if (counts.size === 0) return baseTerrain;
  let best: TerrainId = baseTerrain;
  let bestCount = 0;
  for (const [t, c] of counts) {
    if (c > bestCount) {
      best = t;
      bestCount = c;
    }
  }
  return best;
}

// ===================== COMPUTATION (uses real game algorithm) =====================

interface TileInfo extends TileBlendResult {
  center: TerrainId;
  neighbors: {
    N: TerrainId;
    NE: TerrainId;
    E: TerrainId;
    SE: TerrainId;
    S: TerrainId;
    SW: TerrainId;
    W: TerrainId;
    NW: TerrainId;
  };
  allTerrains: TerrainId[];
}

function computeTileInfo(tx: number, ty: number): TileInfo {
  const cx = 2 * tx + 1;
  const cy = 2 * ty + 1;

  const center = getSg(cx, cy);
  const n = getSg(cx, cy - 1);
  const ne = getSg(cx + 1, cy - 1);
  const e = getSg(cx + 1, cy);
  const se = getSg(cx + 1, cy + 1);
  const s = getSg(cx, cy + 1);
  const sw = getSg(cx - 1, cy + 1);
  const w = getSg(cx - 1, cy);
  const nw = getSg(cx - 1, cy - 1);

  // Call the real game algorithm (negative mode forces paintTerrain as base)
  const forced = brushMode === "negative" ? paintTerrain : undefined;
  const result = computeTileBlend(center, n, ne, e, se, s, sw, w, nw, blendGraph, forced);

  // Gather unique terrains for display
  const seen = new Set<TerrainId>([center, n, ne, e, se, s, sw, w, nw]);

  return {
    ...result,
    center,
    neighbors: { N: n, NE: ne, E: e, SE: se, S: s, SW: sw, W: w, NW: nw },
    allTerrains: [...seen],
  };
}

// ===================== RENDERING =====================

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

function resizeCanvas(): void {
  const w = PAD * 2 + (sgSize - 1) * CELL;
  canvas.width = w;
  canvas.height = w;
}

function render(): void {
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const usedMasks = new Set<number>();

  // Draw tiles
  for (let ty = 0; ty < gridSize; ty++) {
    for (let tx = 0; tx < gridSize; tx++) {
      drawTile(tx, ty, usedMasks);
    }
  }

  // Draw tile grid lines
  ctx.strokeStyle = "#ffffff18";
  ctx.lineWidth = 1;
  for (let i = 0; i <= gridSize; i++) {
    const p = PAD + i * CELL * 2;
    ctx.beginPath();
    ctx.moveTo(p, PAD);
    ctx.lineTo(p, PAD + (sgSize - 1) * CELL);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(PAD, p);
    ctx.lineTo(PAD + (sgSize - 1) * CELL, p);
    ctx.stroke();
  }

  // Draw sub-grid points
  for (let sy = 0; sy < sgSize; sy++) {
    for (let sx = 0; sx < sgSize; sx++) {
      drawPoint(sx, sy);
    }
  }

  // Brush preview on hover
  if (hoveredPoint && !painting && brushShape !== "tile") {
    const pts = getBrushPoints(hoveredPoint.sx, hoveredPoint.sy);
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = brushMode === "unpaint" ? "#ff5050" : TERRAIN_DISPLAY[paintTerrain].color;
    for (const p of pts) {
      const { x, y } = sgToCanvas(p.sx, p.sy);
      const type = pointType(p.sx, p.sy);
      const r = POINT_R[type] + 3;
      if (type === "center") {
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      } else if (type === "corner") {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(x, y - r);
        ctx.lineTo(x + r, y);
        ctx.lineTo(x, y + r);
        ctx.lineTo(x - r, y);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1.0;
  }

  // Highlight hovered tile
  if (hoveredTile) {
    const { tx, ty } = hoveredTile;
    const x = PAD + tx * CELL * 2;
    const y = PAD + ty * CELL * 2;
    ctx.strokeStyle = "#fff4";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, CELL * 2 - 2, CELL * 2 - 2);
  }

  renderReference(usedMasks);
}

function drawTile(tx: number, ty: number, usedMasks: Set<number>): void {
  const info = computeTileInfo(tx, ty);
  const x = PAD + tx * CELL * 2;
  const y = PAD + ty * CELL * 2;
  const size = CELL * 2;

  // Base fill (color fallback)
  ctx.fillStyle = TERRAIN_DISPLAY[info.base].color;
  ctx.fillRect(x, y, size, size);

  if (showSheets) {
    // Draw base fill from sheet (mask 255 = solid fill)
    const baseFill = blendGraph.getBaseFill(info.base);
    if (baseFill) {
      const sheet = blendGraph.allSheets[baseFill.sheetIndex];
      if (sheet) {
        const img = getSheet(sheet.assetPath);
        if (img.complete && img.naturalWidth) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, baseFill.col * 16, baseFill.row * 16, 16, 16, x, y, size, size);
        }
      }
    }

    // Draw blend layers
    for (const layer of info.layers) {
      usedMasks.add(layer.mask);
      const img = getSheet(layer.assetPath);
      if (img.complete && img.naturalWidth) {
        ctx.imageSmoothingEnabled = false;
        if (layer.isAlpha) ctx.globalAlpha = 0.7;
        ctx.drawImage(img, layer.col * 16, layer.row * 16, 16, 16, x, y, size, size);
        ctx.globalAlpha = 1.0;
      }
    }
  } else {
    // Color mode: draw mask regions
    for (const layer of info.layers) {
      usedMasks.add(layer.mask);
      const c = TERRAIN_DISPLAY[layer.terrain].color;
      const m = layer.mask;
      const s3 = size / 3;
      ctx.fillStyle = c;
      if (m & AutotileBit.N) ctx.fillRect(x + s3, y, s3, s3);
      if (m & AutotileBit.W) ctx.fillRect(x, y + s3, s3, s3);
      if (m & AutotileBit.E) ctx.fillRect(x + size - s3, y + s3, s3, s3);
      if (m & AutotileBit.S) ctx.fillRect(x + s3, y + size - s3, s3, s3);
      if (m & AutotileBit.NW) ctx.fillRect(x, y, s3, s3);
      if (m & AutotileBit.NE) ctx.fillRect(x + size - s3, y, s3, s3);
      if (m & AutotileBit.SW) ctx.fillRect(x, y + size - s3, s3, s3);
      if (m & AutotileBit.SE) ctx.fillRect(x + size - s3, y + size - s3, s3, s3);
      // Center always filled if any cardinal
      if (m & 0x0f) ctx.fillRect(x + s3, y + s3, s3, s3);
    }
  }

  // Mask label
  if (showMasks && info.layers.length > 0) {
    const maskStr = info.layers.map((l) => l.mask).join(",");
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(maskStr, x + size / 2, y + size / 2);
  }
}

function drawPoint(sx: number, sy: number): void {
  const terrain = getSg(sx, sy);
  const { x, y } = sgToCanvas(sx, sy);
  const type = pointType(sx, sy);
  const r = POINT_R[type];
  const isHovered = hoveredPoint !== null && hoveredPoint.sx === sx && hoveredPoint.sy === sy;
  const drawR = isHovered ? r + 2 : r;

  ctx.fillStyle = TERRAIN_DISPLAY[terrain].color;
  ctx.strokeStyle = isHovered ? "#fff" : "#ffffff60";
  ctx.lineWidth = isHovered ? 2 : 1;

  if (type === "center") {
    ctx.fillRect(x - drawR, y - drawR, drawR * 2, drawR * 2);
    ctx.strokeRect(x - drawR, y - drawR, drawR * 2, drawR * 2);
  } else if (type === "corner") {
    ctx.beginPath();
    ctx.arc(x, y, drawR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(x, y - drawR);
    ctx.lineTo(x + drawR, y);
    ctx.lineTo(x, y + drawR);
    ctx.lineTo(x - drawR, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

// ===================== INFO PANEL =====================

function updateInfo(): void {
  const tileDiv = document.getElementById("tileInfo")!;
  const pointDiv = document.getElementById("pointInfo")!;

  if (hoveredTile) {
    const { tx, ty } = hoveredTile;
    const info = computeTileInfo(tx, ty);
    let html = "";
    html += `<div class="row"><span class="lbl">Position:</span><span class="val">(${tx}, ${ty})</span></div>`;
    html += `<div class="row"><span class="lbl">Center:</span><span class="val" style="color:${TERRAIN_DISPLAY[info.center].color}">${TERRAIN_DISPLAY[info.center].label}</span></div>`;
    html += `<div class="row"><span class="lbl">Base:</span><span class="val" style="color:${TERRAIN_DISPLAY[info.base].color}">${TERRAIN_DISPLAY[info.base].label} (depth ${TERRAIN_DEPTH[info.base]})</span></div>`;
    if (brushMode !== "positive") {
      html += `<div class="row"><span class="lbl">Mode:</span><span class="val" style="color:${brushMode === "negative" ? "#c84" : "#f55"}">${brushMode}${brushMode === "negative" ? ` (${TERRAIN_DISPLAY[paintTerrain].label} as base)` : ""}</span></div>`;
    }

    if (info.layers.length === 0) {
      html += `<div style="color:#666; margin-top:4px">No blends (uniform neighbors)</div>`;
    }
    for (const layer of info.layers) {
      const td = TERRAIN_DISPLAY[layer.terrain];
      html += `<div style="margin-top:6px; border-top:1px solid #2a3a5e; padding-top:4px">`;
      html += `<div class="row"><span class="lbl">Overlay:</span><span class="val" style="color:${td.color}">${td.label}</span></div>`;
      html += `<div class="row"><span class="lbl">Sheet:</span><span class="val">${layer.sheetKey}${layer.isAlpha ? " (alpha)" : ""}</span></div>`;
      html += `<div class="row"><span class="lbl">Raw mask:</span><span class="val">${layer.rawMask} &rarr; canon: ${layer.mask}</span></div>`;
      html += `<div class="row"><span class="lbl">Sprite:</span><span class="val">col ${layer.col}, row ${layer.row}</span></div>`;
      html += maskGridHtml(layer.mask);
      html += `</div>`;
    }
    tileDiv.innerHTML = html;
  } else {
    tileDiv.innerHTML = `<span style="color:#666">Hover over a tile</span>`;
  }

  if (hoveredPoint) {
    const { sx, sy } = hoveredPoint;
    const terrain = getSg(sx, sy);
    const type = pointTypeLabel(sx, sy);
    let html = "";
    html += `<div class="row"><span class="lbl">Sub-grid:</span><span class="val">(${sx}, ${sy})</span></div>`;
    html += `<div class="row"><span class="lbl">Type:</span><span class="val">${type}</span></div>`;
    html += `<div class="row"><span class="lbl">Terrain:</span><span class="val" style="color:${TERRAIN_DISPLAY[terrain].color}">${TERRAIN_DISPLAY[terrain].label}</span></div>`;

    // Show which tiles this point affects
    const affects: string[] = [];
    const pt = pointType(sx, sy);
    if (pt === "center") {
      affects.push(`tile (${(sx - 1) / 2}, ${(sy - 1) / 2})`);
    } else if (pt === "corner") {
      for (const [dx, dy, dir] of [
        [-1, -1, "SE"],
        [1, -1, "SW"],
        [-1, 1, "NE"],
        [1, 1, "NW"],
      ] as const) {
        const tx2 = (sx + dx - 1) / 2;
        const ty2 = (sy + dy - 1) / 2;
        if (tx2 >= 0 && tx2 < gridSize && ty2 >= 0 && ty2 < gridSize)
          affects.push(`(${tx2},${ty2}) as ${dir}`);
      }
    } else {
      if (sx % 2 === 1) {
        // H-midpoint
        const tx2 = (sx - 1) / 2;
        if (sy > 0) {
          const ty2 = (sy - 2) / 2;
          if (ty2 >= 0 && ty2 < gridSize) affects.push(`(${tx2},${ty2}) as S`);
        }
        if (sy < sgSize - 1) {
          const ty2 = sy / 2;
          if (ty2 >= 0 && ty2 < gridSize) affects.push(`(${tx2},${ty2}) as N`);
        }
      } else {
        // V-midpoint
        const ty2 = (sy - 1) / 2;
        if (sx > 0) {
          const tx2 = (sx - 2) / 2;
          if (tx2 >= 0 && tx2 < gridSize) affects.push(`(${tx2},${ty2}) as E`);
        }
        if (sx < sgSize - 1) {
          const tx2 = sx / 2;
          if (tx2 >= 0 && tx2 < gridSize) affects.push(`(${tx2},${ty2}) as W`);
        }
      }
    }
    if (affects.length > 0) {
      html += `<div class="row"><span class="lbl">Affects:</span><span class="val">${affects.join(", ")}</span></div>`;
    }

    if (pt === "corner") {
      const cornerTerrain = terrain;
      const adjMids: TerrainId[] = [];
      if (sx > 0) adjMids.push(getSg(sx - 1, sy));
      if (sx < sgSize - 1) adjMids.push(getSg(sx + 1, sy));
      if (sy > 0) adjMids.push(getSg(sx, sy - 1));
      if (sy < sgSize - 1) adjMids.push(getSg(sx, sy + 1));
      const allSame = adjMids.length > 0 && adjMids.every((t) => t === cornerTerrain);
      if (allSame) {
        html += `<div style="color:#666; font-size:11px; margin-top:4px">Corner matches neighbors - no blend here</div>`;
      } else if (
        adjMids.length > 0 &&
        adjMids.every((t) => TERRAIN_DEPTH[t] > TERRAIN_DEPTH[cornerTerrain])
      ) {
        html += `<div style="color:#6a6; font-size:11px; margin-top:4px">Lower depth than neighbors: visible as concave cutout</div>`;
      } else if (
        adjMids.length > 0 &&
        adjMids.every((t) => TERRAIN_DEPTH[t] < TERRAIN_DEPTH[cornerTerrain])
      ) {
        html += `<div style="color:#c84; font-size:11px; margin-top:4px">Higher depth than neighbors: diagonal bit stripped, invisible alone</div>`;
      } else {
        html += `<div style="color:#88a; font-size:11px; margin-top:4px">Corner: visibility depends on depth relative to adjacent midpoints</div>`;
      }
    }
    pointDiv.innerHTML = html;
  } else {
    pointDiv.innerHTML = `<span style="color:#666">Hover over a point</span>`;
  }
}

function maskGridHtml(mask: number): string {
  const bits: [number, string][] = [
    [AutotileBit.NW, "NW"],
    [AutotileBit.N, "N"],
    [AutotileBit.NE, "NE"],
    [AutotileBit.W, "W"],
    [0, "\u00b7"],
    [AutotileBit.E, "E"],
    [AutotileBit.SW, "SW"],
    [AutotileBit.S, "S"],
    [AutotileBit.SE, "SE"],
  ];
  let html = '<div class="mask-grid">';
  for (const [bit, label] of bits) {
    if (bit === 0) {
      html += `<div class="bit center">${label}</div>`;
    } else {
      const on = (mask & bit) !== 0;
      html += `<div class="bit ${on ? "on" : "off"}">${label}</div>`;
    }
  }
  html += "</div>";
  return html;
}

// ===================== INTERACTION =====================

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const { sx, sy } = canvasToSg(mx, my);

  if (sx >= 0 && sx < sgSize && sy >= 0 && sy < sgSize) {
    const { x: px, y: py } = sgToCanvas(sx, sy);
    const dist = Math.hypot(mx - px, my - py);
    hoveredPoint = dist < CELL * 0.4 ? { sx, sy } : null;
  } else {
    hoveredPoint = null;
  }

  hoveredTile = canvasToTile(mx, my);
  if (painting) doPaint();
  render();
  updateInfo();
});

canvas.addEventListener("mouseleave", () => {
  hoveredPoint = null;
  hoveredTile = null;
  painting = false;
  render();
  updateInfo();
});

canvas.addEventListener("mousedown", (e) => {
  e.preventDefault();
  painting = true;
  paintButton = e.button;
  doPaint();
});

canvas.addEventListener("mouseup", () => {
  painting = false;
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

/**
 * Paint a full tile with smooth edges by setting the 9 subgrid points of the
 * tile plus 8 extra midpoints on cardinal neighbors. The extras give each
 * neighbor enough cardinal bits for diagonal corners to survive canonicalization,
 * producing smooth concave/convex blob transitions instead of thin slivers.
 *
 * The 17-point pattern (tile center at cx,cy):
 *
 *       .  X  .  X  .        ← row cy-2  (N neighbor W,E midpoints)
 *       X  X  X  X  X        ← row cy-1  (tile NW,N,NE + W neighbor N + E neighbor N)
 *       .  X  X  X  .        ← row cy    (tile W,center,E)
 *       X  X  X  X  X        ← row cy+1  (tile SW,S,SE + W neighbor S + E neighbor S)
 *       .  X  .  X  .        ← row cy+2  (S neighbor W,E midpoints)
 */
function paintFullTile(tx: number, ty: number, terrain: TerrainId): void {
  const cx = 2 * tx + 1;
  const cy = 2 * ty + 1;

  // 9 subgrid points of this tile (center + 8 neighbors)
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      setSg(cx + dx, cy + dy, terrain);
    }
  }

  // 8 extra midpoints on cardinal neighbors (perpendicular to the shared edge)
  // North neighbor: its W and E midpoints
  setSg(cx - 1, cy - 2, terrain);
  setSg(cx + 1, cy - 2, terrain);
  // South neighbor: its W and E midpoints
  setSg(cx - 1, cy + 2, terrain);
  setSg(cx + 1, cy + 2, terrain);
  // West neighbor: its N and S midpoints
  setSg(cx - 2, cy - 1, terrain);
  setSg(cx - 2, cy + 1, terrain);
  // East neighbor: its N and S midpoints
  setSg(cx + 2, cy - 1, terrain);
  setSg(cx + 2, cy + 1, terrain);
}

function doPaint(): void {
  if (paintButton === 2) {
    // Right-click: always paint baseTerrain (universal eraser)
    if (brushShape === "tile") {
      if (!hoveredTile) return;
      paintFullTile(hoveredTile.tx, hoveredTile.ty, baseTerrain);
    } else {
      if (!hoveredPoint) return;
      const pts = getBrushPoints(hoveredPoint.sx, hoveredPoint.sy);
      for (const p of pts) setSg(p.sx, p.sy, baseTerrain);
    }
  } else if (brushMode === "unpaint") {
    // Unpaint: replace matching points with most common adjacent terrain
    if (!hoveredPoint) return;
    const pts = getBrushPoints(hoveredPoint.sx, hoveredPoint.sy);
    for (const p of pts) {
      if (getSg(p.sx, p.sy) === paintTerrain) {
        setSg(p.sx, p.sy, findUnpaintReplacement(p.sx, p.sy));
      }
    }
  } else {
    // Positive / Negative: paint normally (negative only affects resolve)
    if (brushShape === "tile") {
      if (!hoveredTile) return;
      paintFullTile(hoveredTile.tx, hoveredTile.ty, paintTerrain);
    } else {
      if (!hoveredPoint) return;
      const pts = getBrushPoints(hoveredPoint.sx, hoveredPoint.sy);
      for (const p of pts) setSg(p.sx, p.sy, paintTerrain);
    }
  }
  render();
  updateInfo();
  updateUrl();
}

// ===================== REFERENCE GRID =====================

function renderReference(usedMasks: Set<number>): void {
  const grid = document.getElementById("refGrid")!;
  if (grid.children.length === 0) buildReferenceGrid();

  for (const cell of grid.children) {
    const mask = parseInt((cell as HTMLElement).dataset.mask ?? "-1", 10);
    cell.classList.toggle("highlight", usedMasks.has(mask));
  }
}

function buildReferenceGrid(): void {
  const grid = document.getElementById("refGrid")!;
  grid.innerHTML = "";

  const posMap = new Map<number, number>();
  for (const [mask, col, row] of GM_BLOB_47) posMap.set(row * 12 + col, mask);

  // Find a representative sheet for the reference display
  const baseFill = blendGraph.getBaseFill(TerrainId.ShallowWater);
  const grassBlend = blendGraph.getBlend(TerrainId.Grass, TerrainId.ShallowWater);
  const baseSheet = baseFill ? blendGraph.allSheets[baseFill.sheetIndex] : undefined;
  const blendSheet = grassBlend ? blendGraph.allSheets[grassBlend.sheetIndex] : undefined;

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 12; col++) {
      const cell = document.createElement("div");
      cell.className = "ref-cell";
      const mask = posMap.get(row * 12 + col);

      if (mask === undefined) {
        cell.classList.add("unused");
        cell.innerHTML = `<canvas width="48" height="48" style="width:48px;height:48px"></canvas><div class="mask-num">--</div>`;
        cell.dataset.mask = "-1";
      } else {
        const c = document.createElement("canvas");
        c.width = 48;
        c.height = 48;
        c.style.width = "48px";
        c.style.height = "48px";
        c.style.imageRendering = "pixelated";
        const rc = c.getContext("2d")!;

        const drawIt = (): void => {
          rc.imageSmoothingEnabled = false;
          // Draw secondary (water) as base
          rc.fillStyle = TERRAIN_DISPLAY[TerrainId.ShallowWater].color;
          rc.fillRect(0, 0, 48, 48);
          if (baseSheet && baseFill) {
            const baseImg = getSheet(baseSheet.assetPath);
            if (baseImg.complete && baseImg.naturalWidth) {
              rc.drawImage(baseImg, baseFill.col * 16, baseFill.row * 16, 16, 16, 0, 0, 48, 48);
            }
          }
          // Draw the blend tile on top
          if (blendSheet) {
            const blendImg = getSheet(blendSheet.assetPath);
            if (blendImg.complete && blendImg.naturalWidth) {
              rc.drawImage(blendImg, col * 16, row * 16, 16, 16, 0, 0, 48, 48);
            }
          }
        };

        if (blendSheet) {
          const blendImg = getSheet(blendSheet.assetPath);
          if (blendImg.complete) drawIt();
          else blendImg.addEventListener("load", drawIt);
        }

        cell.appendChild(c);
        const label = document.createElement("div");
        label.className = "mask-num";
        label.textContent = String(mask);
        cell.appendChild(label);
        cell.dataset.mask = String(mask);
        cell.title = `Mask ${mask} (0b${mask.toString(2).padStart(8, "0")}) at [${col},${row}]`;
      }

      grid.appendChild(cell);
    }
  }
}

// ===================== PRESETS =====================

interface Preset {
  name: string;
  desc: string;
  setup: (g: Uint8Array) => void;
}

function ctr(): { cx: number; cy: number } {
  const t = Math.floor(gridSize / 2);
  return { cx: 2 * t + 1, cy: 2 * t + 1 };
}

const PRESETS: Preset[] = [
  {
    name: "Single midpoint",
    desc: "One H-midpoint painted. The fundamental unit of sub-grid painting.",
    setup: (g) => {
      const { cx, cy } = ctr();
      g[sgIdx(cx, cy - 1)] = paintTerrain;
    },
  },
  {
    name: "Lone corner",
    desc: "One corner painted. Lower depth = visible concave cutout. Higher depth = invisible (diagonal bit stripped).",
    setup: (g) => {
      const { cx, cy } = ctr();
      g[sgIdx(cx - 1, cy - 1)] = paintTerrain;
    },
  },
  {
    name: "Corner + 2 mids",
    desc: "Corner + 2 adjacent midpoints = convex corner shape (mask 19). Minimum to make a corner visible.",
    setup: (g) => {
      const { cx, cy } = ctr();
      g[sgIdx(cx - 1, cy - 1)] = paintTerrain;
      g[sgIdx(cx, cy - 1)] = paintTerrain;
      g[sgIdx(cx - 1, cy)] = paintTerrain;
    },
  },
  {
    name: "L-shape (no diag)",
    desc: "Two adjacent midpoints (N+W) without corner = L-shape (mask 3). IMPOSSIBLE with old corner system!",
    setup: (g) => {
      const { cx, cy } = ctr();
      g[sgIdx(cx, cy - 1)] = paintTerrain;
      g[sgIdx(cx - 1, cy)] = paintTerrain;
    },
  },
  {
    name: "Cross (N+S)",
    desc: "Opposite midpoints (N+S) = cross shape (mask 9). Also impossible with corners.",
    setup: (g) => {
      const { cx, cy } = ctr();
      g[sgIdx(cx, cy - 1)] = paintTerrain;
      g[sgIdx(cx, cy + 1)] = paintTerrain;
    },
  },
  {
    name: "Full ring",
    desc: "All 8 neighbors of center tile = mask 255 (full fill). Same as painting a whole tile.",
    setup: (g) => {
      const { cx, cy } = ctr();
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          g[sgIdx(cx + dx, cy + dy)] = paintTerrain;
        }
    },
  },
  {
    name: "All cardinals",
    desc: "4 midpoints (N/S/W/E) but no corners = mask 15 (cross, all cardinals, no diagonals).",
    setup: (g) => {
      const { cx, cy } = ctr();
      g[sgIdx(cx, cy - 1)] = paintTerrain;
      g[sgIdx(cx, cy + 1)] = paintTerrain;
      g[sgIdx(cx - 1, cy)] = paintTerrain;
      g[sgIdx(cx + 1, cy)] = paintTerrain;
    },
  },
  {
    name: "Thin river",
    desc: "A horizontal line of midpoints across the grid.",
    setup: (g) => {
      const { cy } = ctr();
      for (let sx = 0; sx < sgSize; sx++) g[sgIdx(sx, cy - 1)] = paintTerrain;
    },
  },
  {
    name: "Diagonal path",
    desc: "Midpoints placed diagonally. Demonstrates varied mask patterns.",
    setup: (g) => {
      for (let i = 1; i < sgSize - 1; i++) {
        g[sgIdx(i, i)] = paintTerrain;
        if (i + 1 < sgSize) g[sgIdx(i + 1, i)] = paintTerrain;
      }
    },
  },
];

function buildPresets(): void {
  const row = document.getElementById("presetRow")!;
  for (const p of PRESETS) {
    const btn = document.createElement("button");
    btn.className = "preset-btn";
    btn.textContent = p.name;
    btn.addEventListener("click", () => {
      clearGrid();
      p.setup(subgrid);
      document.getElementById("presetDesc")!.textContent = p.desc;
      render();
      updateInfo();
      updateUrl();
    });
    btn.addEventListener("mouseenter", () => {
      document.getElementById("presetDesc")!.textContent = p.desc;
    });
    row.appendChild(btn);
  }
}

// ===================== URL STATE =====================

function encodeState(): string {
  let data = "";
  for (let i = 0; i < subgrid.length; i++) data += (subgrid[i] ?? 0).toString();
  const modeCode = { positive: 0, negative: 1, unpaint: 2 }[brushMode] ?? 0;
  return `#g=${gridSize}&b=${baseTerrain}&p=${paintTerrain}&m=${modeCode}&d=${data}`;
}

function decodeState(hash: string): boolean {
  if (!hash || hash.length < 2) return false;
  const params = new URLSearchParams(hash.slice(1));
  const g = parseInt(params.get("g") ?? "", 10);
  const b = parseInt(params.get("b") ?? "", 10);
  const p = parseInt(params.get("p") ?? "", 10);
  const d = params.get("d");
  if (!g || g < 2 || g > 6) return false;

  gridSize = g;
  sgSize = 2 * gridSize + 1;
  subgrid = new Uint8Array(sgSize * sgSize);
  if (b >= 0 && b < ALL_TERRAIN_IDS.length) baseTerrain = b as TerrainId;
  if (p >= 0 && p < ALL_TERRAIN_IDS.length) paintTerrain = p as TerrainId;
  const m = parseInt(params.get("m") ?? "", 10);
  if (m === 1) brushMode = "negative";
  else if (m === 2) brushMode = "unpaint";
  else brushMode = "positive";

  subgrid.fill(baseTerrain);

  if (d && d.length === subgrid.length) {
    for (let i = 0; i < d.length; i++) {
      const v = parseInt(d[i] ?? "", 10);
      if (v >= 0 && v < ALL_TERRAIN_IDS.length) subgrid[i] = v;
    }
  }
  return true;
}

function updateUrl(): void {
  history.replaceState(null, "", encodeState());
}

// ===================== CONTROLS =====================

function buildPalette(): void {
  const pal = document.getElementById("palette")!;
  pal.innerHTML = "";
  for (const id of ALL_TERRAIN_IDS) {
    const td = TERRAIN_DISPLAY[id];
    const sw = document.createElement("div");
    sw.className = `swatch${id === paintTerrain ? " active" : ""}`;
    sw.style.background = td.color;
    sw.title = td.label;
    sw.dataset.id = String(id);
    sw.addEventListener("click", () => {
      paintTerrain = id;
      document.querySelectorAll<HTMLElement>(".palette .swatch").forEach((s) => {
        s.classList.toggle("active", s.dataset.id === String(paintTerrain));
      });
      updateUrl();
    });
    pal.appendChild(sw);
  }
}

function buildBaseSel(): void {
  const sel = document.getElementById("baseSel") as HTMLSelectElement;
  sel.innerHTML = "";
  for (const id of ALL_TERRAIN_IDS) {
    const td = TERRAIN_DISPLAY[id];
    const opt = document.createElement("option");
    opt.value = String(id);
    opt.textContent = td.label;
    if (id === baseTerrain) opt.selected = true;
    sel.appendChild(opt);
  }
  sel.addEventListener("change", () => {
    baseTerrain = parseInt(sel.value, 10) as TerrainId;
    updateUrl();
  });
}

function clearGrid(): void {
  subgrid.fill(baseTerrain);
}

document.getElementById("clearBtn")?.addEventListener("click", () => {
  clearGrid();
  document.getElementById("presetDesc")!.textContent = "";
  render();
  updateInfo();
  updateUrl();
});

document.getElementById("shareBtn")?.addEventListener("click", () => {
  updateUrl();
  const url = location.href;
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.getElementById("shareBtn")!;
    btn.textContent = "Copied!";
    setTimeout(() => {
      btn.textContent = "Copy URL";
    }, 1500);
  });
});

(document.getElementById("gridSel") as HTMLSelectElement).addEventListener("change", (e) => {
  gridSize = parseInt((e.target as HTMLSelectElement).value, 10);
  sgSize = 2 * gridSize + 1;
  subgrid = new Uint8Array(sgSize * sgSize);
  subgrid.fill(baseTerrain);
  resizeCanvas();
  document.getElementById("refGrid")!.innerHTML = "";
  render();
  updateInfo();
  updateUrl();
});

(document.getElementById("showSheets") as HTMLInputElement).addEventListener("change", (e) => {
  showSheets = (e.target as HTMLInputElement).checked;
  render();
});

(document.getElementById("showMasks") as HTMLInputElement).addEventListener("change", (e) => {
  showMasks = (e.target as HTMLInputElement).checked;
  render();
});

// Mode buttons
function setMode(mode: BrushMode): void {
  brushMode = mode;
  document.querySelectorAll<HTMLElement>("#modeRow .brush-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === mode);
  });
  render();
  updateInfo();
}
document.querySelectorAll<HTMLElement>("#modeRow .brush-btn").forEach((btn) => {
  btn.addEventListener("click", () => setMode(btn.dataset.mode as BrushMode));
});

// Shape buttons
function setShape(shape: BrushShape): void {
  brushShape = shape;
  document.querySelectorAll<HTMLElement>("#shapeRow .brush-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.shape === shape);
  });
  render();
}
document.querySelectorAll<HTMLElement>("#shapeRow .brush-btn").forEach((btn) => {
  btn.addEventListener("click", () => setShape(btn.dataset.shape as BrushShape));
});

// Keyboard shortcuts
const SHAPE_KEYS: Record<string, BrushShape> = {
  "1": "grid1",
  "2": "grid2",
  "3": "grid3",
  "4": "cross",
  "5": "tile",
};
document.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (key === "z") {
    setMode("positive");
    return;
  }
  if (key === "x") {
    setMode("negative");
    return;
  }
  if (key === "c") {
    setMode("unpaint");
    return;
  }
  const shape = SHAPE_KEYS[key];
  if (shape) {
    setShape(shape);
    return;
  }
});

// ===================== INIT =====================

function init(): void {
  if (!decodeState(location.hash)) {
    subgrid.fill(baseTerrain);
  }

  (document.getElementById("gridSel") as HTMLSelectElement).value = String(gridSize);
  buildPalette();
  buildBaseSel();
  // Sync mode buttons with restored state
  document.querySelectorAll<HTMLElement>("#modeRow .brush-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === brushMode);
  });
  buildPresets();
  resizeCanvas();
  render();
  updateInfo();

  // Preload sheets from the blend graph
  for (const sheet of blendGraph.allSheets) {
    getSheet(sheet.assetPath);
  }
}

init();
