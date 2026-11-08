import { VIEW_BACKDROP_CSS } from "../../config/constants.js";
import { type AABB, getEntityAABB } from "../../entities/collision.js";
import type { Prop, PropCollider } from "../../entities/Prop.js";
import type { LayeredInteriorMap } from "../../interiors/LayeredInteriorMap.js";
import { drawLayeredInteriorMap } from "../CanvasInteriorMap.js";
import { regionColor } from "./FirstPersonImages.js";
import type { PropImageFrame, PropSolid } from "./FirstPersonProps.js";

/** Furniture artwork in the interiors atlas and the sprite point that meets the prop's position. */
export interface InteriorFurnitureArt {
  readonly rect: readonly [number, number, number, number];
  readonly anchor: readonly [number, number];
  /** Rugs and other floor-layer pieces lie flat on the floor. */
  readonly floor: boolean;
  /** Pictures and other wall-layer pieces hang on the wall that contains their anchor. */
  readonly wall: boolean;
}

/**
 * The room the player is in (tactical 230 slice 2). Supplied by the play glue, so
 * the view does not compile rooms itself. Room walls arrive as the colliders of
 * one replicated shell prop; this adds the room's artwork.
 */
export interface FirstPersonInterior {
  /** Changes whenever the room's plan or artwork changes. */
  readonly key: string;
  readonly map: LayeredInteriorMap;
  /** Type of the replicated prop whose `walls` are the room's wall colliders. */
  readonly shellType: string;
  furniture(type: string): InteriorFurnitureArt | undefined;
}

/** The fixed view's backdrop around a room. */
const BACKGROUND_CSS = VIEW_BACKDROP_CSS;
export const INTERIOR_BACKGROUND = Number.parseInt(VIEW_BACKDROP_CSS.slice(1), 16);

/** Room raster size in native pixels; rows are world Y shifted down by `offsetY`. */
export function roomRasterSize(map: LayeredInteriorMap): {
  width: number;
  height: number;
  offsetY: number;
} {
  const offsetY = map.contentOffsetY ?? 0;
  return {
    width: map.width * 16,
    height: Math.max(map.pixelHeight, map.height * 16 + offsetY),
    offsetY,
  };
}

/**
 * The room picture as the shell prop's artwork, so the shared projection
 * (`projectedUv`: x, y − z) puts wall tops and south faces where the fixed view
 * draws them.
 */
export function roomShellFrame(shell: Prop, map: LayeredInteriorMap): PropImageFrame {
  const { width, height, offsetY } = roomRasterSize(map);
  return {
    left: -shell.position.wx,
    top: -offsetY - shell.position.wy,
    width,
    height,
  };
}

/** RGBA pixels of the room's wall layers alone (floor and void transparent). */
export interface RoomPixels {
  readonly data: ArrayLike<number>;
  readonly width: number;
  readonly height: number;
}

/** Fallback wall height (world px) where no wall artwork is drawn, e.g. the outer boundary. */
export const DEFAULT_ROOM_WALL_HEIGHT = 32;
const MAX_ROOM_WALL_HEIGHT = 64;
const MIN_ROOM_WALL_HEIGHT = 8;

/** Raster pixel of a world point at height 0, through the shell's frame. */
function rasterPoint(shell: Prop, frame: PropImageFrame, elevation: number, x: number, y: number) {
  return {
    x: x - (shell.position.wx + frame.left),
    y: y - (shell.position.wy - elevation + frame.top),
  };
}

/**
 * Painted rows above a wall's base: the median, over its painted columns, of the
 * rows from the base to the top of the first painted band within the footprint.
 * Room art draws a wall's cap and face over its own footprint (and above it in
 * taller styles), so this is the height whose south face shows exactly that band.
 * 0 when nothing is painted.
 */
export function paintedRun(
  pixels: RoomPixels,
  shell: Prop,
  frame: PropImageFrame,
  elevation: number,
  bounds: AABB,
): number {
  const a = rasterPoint(shell, frame, elevation, bounds.left, bounds.bottom);
  const right = rasterPoint(shell, frame, elevation, bounds.right, bounds.bottom).x;
  const depth = bounds.bottom - bounds.top;
  const runs: number[] = [];
  for (let x = Math.max(0, Math.floor(a.x)); x < Math.min(pixels.width, right); x += 2) {
    // Rows up from the base to the top of the band; unpainted rows at the bottom
    // of the footprint (a strip drawn above its base) still count toward the height.
    let rows = 0;
    let painted = false;
    for (let y = Math.floor(a.y) - 1; y >= 0 && y < pixels.height; y--) {
      const opaque = (pixels.data[(y * pixels.width + x) * 4 + 3] ?? 0) >= 16;
      if (!opaque && (painted || rows >= depth)) break;
      painted ||= opaque;
      rows++;
    }
    if (painted) runs.push(rows);
  }
  runs.sort((p, q) => p - q);
  return runs[Math.floor(runs.length / 2)] ?? 0;
}

const clampHeight = (h: number) =>
  Math.max(MIN_ROOM_WALL_HEIGHT, Math.min(MAX_ROOM_WALL_HEIGHT, Math.round(h)));

/**
 * The shell split for drawing; the replicated prop is not changed. `painted` walls
 * have room art over their footprint and wear it; `plain` walls have none (the
 * outer boundary, or void) and draw untextured. Collision walls are 64 px tall, so
 * east–west walls take their painted run as height. North–south walls (whose cap
 * is painted along their whole length) and plain walls take the room's typical
 * east–west height.
 */
export function paintedShell(
  shell: Prop,
  frame: PropImageFrame,
  elevation: number,
  pixels: RoomPixels | undefined,
): { painted: Prop; plain: Prop } {
  const measured = (shell.walls ?? []).map((wall) => {
    const bounds = getEntityAABB(shell.position, wall);
    if (!pixels) return { wall, painted: false, run: 0 };
    const a = rasterPoint(shell, frame, elevation, bounds.left, bounds.top);
    const b = rasterPoint(shell, frame, elevation, bounds.right, bounds.bottom);
    const painted = regionColor(pixels, a.x, a.y, b.x, b.y) !== undefined;
    const across = bounds.right - bounds.left >= bounds.bottom - bounds.top;
    return {
      wall,
      painted,
      run: painted && across ? paintedRun(pixels, shell, frame, elevation, bounds) : 0,
    };
  });
  const runs = measured.flatMap((m) => (m.run ? [m.run] : [])).sort((p, q) => p - q);
  const typical = clampHeight(runs[Math.floor(runs.length / 2)] ?? DEFAULT_ROOM_WALL_HEIGHT);
  const painted: PropCollider[] = [];
  const plain: PropCollider[] = [];
  for (const m of measured)
    (m.painted ? painted : plain).push({
      ...m.wall,
      zHeight: m.run ? clampHeight(m.run) : typical,
    });
  return { painted: { ...shell, walls: painted }, plain: { ...shell, walls: plain } };
}

/** A wall's side colour: its south face's painted wall pixels (floor and void ignored). */
export function shellSideColor(
  pixels: RoomPixels,
  shell: Prop,
  frame: PropImageFrame,
  elevation: number,
  solid: PropSolid,
): number | undefined {
  const low = solid.corners[0]?.[2] ?? 0,
    high = solid.corners[4]?.[2] ?? low;
  const { left, right, bottom } = solid.bounds;
  const a = rasterPoint(shell, frame, elevation, left, bottom - high);
  const b = rasterPoint(shell, frame, elevation, right, bottom - low);
  return regionColor(pixels, a.x, a.y, b.x, b.y);
}

/** Furniture artwork placed by its anchor rather than the sprite's bottom centre. */
export function furnitureFrame(art: InteriorFurnitureArt): PropImageFrame {
  return { left: -art.anchor[0], top: -art.anchor[1], width: art.rect[2], height: art.rect[3] };
}

/** The floor plane over the whole map at height 0: positions and UVs into the floor raster. */
export function roomFloorQuad(map: LayeredInteriorMap): { positions: number[]; uvs: number[] } {
  const { width, height, offsetY } = roomRasterSize(map);
  const depth = map.height * 16;
  const corner = (x: number, y: number) => ({
    p: [x, y, 0],
    uv: [x / width, (y + offsetY) / height],
  });
  const a = corner(0, 0),
    b = corner(width, 0),
    c = corner(width, depth),
    d = corner(0, depth);
  const positions: number[] = [];
  const uvs: number[] = [];
  for (const v of [a, b, c, a, c, d]) {
    positions.push(...v.p);
    uvs.push(...v.uv);
  }
  return { positions, uvs };
}

/** A flat artwork rectangle lying on the floor (`z` slightly above it), UVs over the whole image. */
export function floorDecalQuad(
  prop: Prop,
  frame: PropImageFrame,
  z: number,
): { positions: number[]; uvs: number[] } {
  const x0 = prop.position.wx + frame.left,
    y0 = prop.position.wy + frame.top;
  const x1 = x0 + frame.width,
    y1 = y0 + frame.height;
  const corners = [
    [x0, y0, 0, 0],
    [x1, y0, 1, 0],
    [x1, y1, 1, 1],
    [x0, y1, 0, 1],
  ] as const;
  const positions: number[] = [];
  const uvs: number[] = [];
  for (const i of [0, 1, 2, 0, 2, 3]) {
    const [x, y, u, v] = corners[i] ?? corners[0];
    positions.push(x, y, z);
    uvs.push(u, v);
  }
  return { positions, uvs };
}

/**
 * Opaque room rasters over the backdrop colour: the floor layer alone for the
 * floor plane (walls would otherwise paint over the floor behind them), and the
 * whole fixed-view picture for wall faces. `wallPixels` holds the wall layers
 * alone, unfilled, for measuring and colouring walls. Without the atlas both
 * rasters are backdrop and there are no wall pixels.
 */
export function rasterizeRoom(
  map: LayeredInteriorMap,
  atlas: CanvasImageSource | undefined,
): { floor: HTMLCanvasElement; walls: HTMLCanvasElement; wallPixels: ImageData | undefined } {
  const { width, height } = roomRasterSize(map);
  const canvas = () => {
    const c = document.createElement("canvas");
    c.width = Math.max(1, width);
    c.height = Math.max(1, height);
    return { canvas: c, ctx: c.getContext("2d", { willReadFrequently: true }) };
  };
  const backdrop = (ctx: CanvasRenderingContext2D) => {
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = BACKGROUND_CSS;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.globalCompositeOperation = "source-over";
  };
  const floor = canvas();
  const walls = canvas();
  let wallPixels: ImageData | undefined;
  if (atlas && floor.ctx && walls.ctx) {
    drawLayeredInteriorMap(floor.ctx, atlas, map, ["floor"]);
    drawLayeredInteriorMap(walls.ctx, atlas, map, ["wall", "foreground", "objects"]);
    wallPixels = walls.ctx.getImageData(0, 0, walls.canvas.width, walls.canvas.height);
    // The fixed view draws walls over the floor; faces wear that whole picture.
    walls.ctx.globalCompositeOperation = "destination-over";
    walls.ctx.drawImage(floor.canvas, 0, 0);
  }
  if (floor.ctx) backdrop(floor.ctx);
  if (walls.ctx) backdrop(walls.ctx);
  return { floor: floor.canvas, walls: walls.canvas, wallPixels };
}

/** The south face (y) of the painted wall whose footprint contains a point. */
export function containingWallFace(walls: Prop, x: number, y: number): number | undefined {
  for (const wall of walls.walls ?? []) {
    const b = getEntityAABB(walls.position, wall);
    if (x >= b.left && x < b.right && y >= b.top && y <= b.bottom) return b.bottom;
  }
  return undefined;
}

/**
 * Wall-layer artwork (a picture) hung on a wall's south face, a hair in front of
 * it. The fixed view draws rows y − z, so on the face plane y = faceY the art's
 * rows map to heights z = faceY − row.
 */
export function wallPieceQuad(
  prop: Prop,
  frame: PropImageFrame,
  faceY: number,
  elevation: number,
): { positions: number[]; uvs: number[] } {
  const x0 = prop.position.wx + frame.left,
    x1 = x0 + frame.width;
  const top = elevation + faceY - (prop.position.wy + frame.top);
  const bottom = top - frame.height;
  const y = faceY + 0.25;
  const corners = [
    [x0, top, 0, 0],
    [x1, top, 1, 0],
    [x1, bottom, 1, 1],
    [x0, bottom, 0, 1],
  ] as const;
  const positions: number[] = [];
  const uvs: number[] = [];
  for (const i of [0, 1, 2, 0, 2, 3]) {
    const [x, z, u, v] = corners[i] ?? corners[0];
    positions.push(x, y, z);
    uvs.push(u, v);
  }
  return { positions, uvs };
}
