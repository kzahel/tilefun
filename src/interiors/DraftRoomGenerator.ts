import { getModernInteriorsEntry } from "../assets/ModernInteriorsAtlasIndex.js";

const TILE_SIZE = 16;

interface SpriteRef {
  key: string;
  sourceRect?: [number, number, number, number];
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  atlasImage: CanvasImageSource,
  ref: SpriteRef,
  dx: number,
  dy: number,
  scale: number,
): void {
  const entry = getModernInteriorsEntry(ref.key);
  if (!entry) return;
  const [atlasX, atlasY, entryW, entryH] = entry.rect;
  const [sourceX, sourceY, sourceW, sourceH] = ref.sourceRect ?? [0, 0, entryW, entryH];
  ctx.drawImage(
    atlasImage,
    atlasX + sourceX,
    atlasY + sourceY,
    sourceW,
    sourceH,
    dx,
    dy,
    sourceW * scale,
    sourceH * scale,
  );
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  atlasImage: CanvasImageSource,
  key: string,
  tileX: number,
  tileY: number,
  originX: number,
  originY: number,
  scale: number,
): void {
  drawSprite(
    ctx,
    atlasImage,
    { key },
    originX + tileX * TILE_SIZE * scale,
    originY + tileY * TILE_SIZE * scale,
    scale,
  );
}

function fillTiles(
  ctx: CanvasRenderingContext2D,
  atlasImage: CanvasImageSource,
  key: string,
  originX: number,
  originY: number,
  widthTiles: number,
  heightTiles: number,
  scale: number,
): void {
  for (let y = 0; y < heightTiles; y++) {
    for (let x = 0; x < widthTiles; x++) {
      drawTile(ctx, atlasImage, key, x, y, originX, originY, scale);
    }
  }
}

function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  ctx.fillStyle = "#dbe8ff";
  ctx.font = "12px monospace";
  ctx.fillText(text, x, y);
}

function drawKey(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  ctx.fillStyle = "#94a3b8";
  ctx.font = "9px monospace";
  ctx.fillText(text, x, y);
}

function drawRoleBox(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
  ctx.fillStyle = color;
  ctx.font = "bold 9px monospace";
  ctx.fillText(label, x + 4, y + 11);
}

function drawDraftPieceRoom(
  ctx: CanvasRenderingContext2D,
  atlasImage: CanvasImageSource,
  originX: number,
  originY: number,
  scale: number,
): void {
  drawLabel(ctx, "Draft A: individual 3d-wall pieces", originX, originY - 14);
  fillTiles(ctx, atlasImage, "room-builder/floors/c00-r30", originX, originY, 8, 7, scale);

  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 8; x++) {
      drawTile(
        ctx,
        atlasImage,
        `room-builder/3d-walls/c${String(x).padStart(2, "0")}-r${String(y).padStart(2, "0")}`,
        x,
        y,
        originX,
        originY,
        scale,
      );
    }
  }

  const ts = TILE_SIZE * scale;
  drawRoleBox(ctx, "N", originX, originY, 8 * ts, 2 * ts, "#60a5fa");
  drawRoleBox(ctx, "W", originX, originY, 2 * ts, 7 * ts, "#34d399");
  drawRoleBox(ctx, "E", originX + 6 * ts, originY, 2 * ts, 7 * ts, "#34d399");
  drawRoleBox(ctx, "S", originX, originY + 5 * ts, 8 * ts, 2 * ts, "#fbbf24");
  drawRoleBox(ctx, "NW", originX, originY, 2 * ts, 2 * ts, "#f87171");
  drawRoleBox(ctx, "NE", originX + 6 * ts, originY, 2 * ts, 2 * ts, "#f87171");
  drawKey(
    ctx,
    "piece keys c00-r00..c07-r06 + floors/c00-r30 underlay",
    originX,
    originY + 122 * scale,
  );
}

function drawDraftCropRoom(
  ctx: CanvasRenderingContext2D,
  atlasImage: CanvasImageSource,
  originX: number,
  originY: number,
  scale: number,
): void {
  drawLabel(ctx, "Draft B: same source as full crop", originX, originY - 14);
  fillTiles(ctx, atlasImage, "room-builder/floors/c00-r30", originX, originY, 8, 7, scale);
  drawSprite(
    ctx,
    atlasImage,
    {
      key: "room-builder-sheet/3d-walls",
      sourceRect: [0, 0, 128, 112],
    },
    originX,
    originY,
    scale,
  );
  drawKey(ctx, "control: sheet/3d-walls [0,0,128,112]", originX, originY + 122 * scale);
}

function drawDraftFlatRoom(
  ctx: CanvasRenderingContext2D,
  atlasImage: CanvasImageSource,
  originX: number,
  originY: number,
  scale: number,
): void {
  drawLabel(ctx, "Draft C: flat tile guess", originX, originY - 14);
  fillTiles(
    ctx,
    atlasImage,
    "room-builder/floors/c00-r30",
    originX,
    originY + 2 * TILE_SIZE * scale,
    10,
    6,
    scale,
  );

  for (let x = 0; x < 10; x++) {
    drawTile(ctx, atlasImage, "room-builder/walls/c00-r06", x, 0, originX, originY, scale);
    drawTile(ctx, atlasImage, "room-builder/walls/c00-r07", x, 1, originX, originY, scale);
    if (x < 4 || x > 5) {
      drawTile(ctx, atlasImage, "room-builder/baseboards/c00-r02", x, 7, originX, originY, scale);
    }
  }

  for (let y = 2; y < 7; y++) {
    drawTile(ctx, atlasImage, "room-builder/walls/c04-r06", 0, y, originX, originY, scale);
    drawTile(ctx, atlasImage, "room-builder/walls/c04-r06", 9, y, originX, originY, scale);
  }

  drawTile(ctx, atlasImage, "room-builder/floor-connectors/c00-r00", 4, 7, originX, originY, scale);
  drawTile(ctx, atlasImage, "room-builder/floor-connectors/c00-r00", 5, 7, originX, originY, scale);
  drawKey(ctx, "walls c00/c04, baseboards c00-r02, floor c00-r30", originX, originY + 138 * scale);
}

export function drawDraftInteriorRoomComparison(
  canvas: HTMLCanvasElement,
  atlasImage: CanvasImageSource,
): void {
  const scale = 2;
  canvas.width = 496;
  canvas.height = 920;
  canvas.style.width = `${canvas.width}px`;
  canvas.style.height = `${canvas.height}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#0e1118";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#9bd7ff";
  ctx.font = "bold 14px monospace";
  ctx.fillText("Generated room draft - first atlas spatial mapping pass", 16, 22);

  drawDraftPieceRoom(ctx, atlasImage, 32, 58, scale);
  drawDraftCropRoom(ctx, atlasImage, 32, 348, scale);
  drawDraftFlatRoom(ctx, atlasImage, 32, 638, scale);
}
