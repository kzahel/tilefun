import { CHUNK_SIZE_PX } from "../../config/constants.js";

/**
 * The fixed view's camera on the 3D scene (tactical 251): a point lands on screen
 * `(x, y − z)`, as `projectWorld` places it, so top-down play is a camera preset
 * of the one scene. Game axes: X east, Y south, Z up, world pixels.
 *
 * It is an oblique projection, not a camera that could stand anywhere: every view
 * ray runs north and down at 45°, and height moves a point up the screen by as
 * much as distance north does.
 */
export interface ObliqueCamera {
  /** World point at the centre of the view (the fixed camera's x and y). */
  readonly x: number;
  readonly y: number;
  /** Screen pixels per world pixel. */
  readonly scale: number;
}

/** How far towards the viewer (south of the view's bottom edge, plus height) and
 * away from it (north of the top edge, plus depth below ground) the depth range
 * reaches, in world pixels. */
const NEAR_MARGIN = 1536;
const FAR_MARGIN = 1024;

/**
 * Clip coordinates of a point relative to the camera's centre, in the view's
 * scene axes (X east, Y north, Z up: game Y mirrored once). Row-major. Depth is
 * nearness along a view ray: farther south and higher up are both nearer.
 */
export function obliqueProjection(scale: number, width: number, height: number): number[] {
  const near = height / (2 * scale) + NEAR_MARGIN,
    far = height / (2 * scale) + FAR_MARGIN;
  const x = (2 * scale) / width,
    y = (2 * scale) / height,
    d = 2 / (near + far);
  return [x, 0, 0, 0, 0, y, y, 0, 0, d, -d, (near - far) / (near + far), 0, 0, 0, 1];
}

/** Screen position (pixels from the view's top-left corner) and clip depth of a
 * point in game axes. */
export function obliqueScreen(
  camera: ObliqueCamera,
  width: number,
  height: number,
  x: number,
  y: number,
  z = 0,
): { sx: number; sy: number; depth: number } {
  const m = obliqueProjection(camera.scale, width, height);
  const dx = x - camera.x,
    north = -(y - camera.y);
  const at = (row: number) =>
    (m[row * 4] ?? 0) * dx +
    (m[row * 4 + 1] ?? 0) * north +
    (m[row * 4 + 2] ?? 0) * z +
    (m[row * 4 + 3] ?? 0);
  return {
    sx: ((at(0) + 1) / 2) * width,
    sy: ((1 - at(1)) / 2) * height,
    depth: at(2),
  };
}

export interface WorldRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** The ground rectangle the camera shows (heights are drawn above their ground). */
export function obliqueGround(camera: ObliqueCamera, width: number, height: number): WorldRect {
  const halfWidth = width / (2 * camera.scale),
    halfHeight = height / (2 * camera.scale);
  return {
    left: camera.x - halfWidth,
    right: camera.x + halfWidth,
    top: camera.y - halfHeight,
    bottom: camera.y + halfHeight,
  };
}

/** Whether a screen square of `radius` world pixels each way around a point
 * (game axes) touches the view whose ground is `ground`: height lifts the point
 * up the screen, as far as the same distance north would. */
export function squareShows(
  ground: WorldRect,
  point: { readonly wx: number; readonly wy: number; readonly zOffset: number },
  radius: number,
): boolean {
  const y = point.wy - point.zOffset;
  return (
    point.wx + radius > ground.left &&
    point.wx - radius < ground.right &&
    y + radius > ground.top &&
    y - radius < ground.bottom
  );
}

/** Wider than the ground on screen: a prop reaches sideways out of its own
 * chunk, and tall things south of the bottom edge stand up into the view. */
export function grown(rect: WorldRect, side: number, below: number): WorldRect {
  return {
    left: rect.left - side,
    right: rect.right + side,
    top: rect.top - side,
    bottom: rect.bottom + below,
  };
}

/** Chunk coordinates that touch `rect`, nearest its centre first. */
export function chunksInRect(
  rect: WorldRect,
): { cx: number; cy: number; key: string; distance: number }[] {
  const x = (rect.left + rect.right) / 2,
    y = (rect.top + rect.bottom) / 2;
  const wanted: { cx: number; cy: number; key: string; distance: number }[] = [];
  const maxCx = Math.floor(rect.right / CHUNK_SIZE_PX),
    maxCy = Math.floor(rect.bottom / CHUNK_SIZE_PX);
  for (let cy = Math.floor(rect.top / CHUNK_SIZE_PX); cy <= maxCy; cy++)
    for (let cx = Math.floor(rect.left / CHUNK_SIZE_PX); cx <= maxCx; cx++) {
      const nx = Math.max(cx * CHUNK_SIZE_PX, Math.min(x, (cx + 1) * CHUNK_SIZE_PX));
      const ny = Math.max(cy * CHUNK_SIZE_PX, Math.min(y, (cy + 1) * CHUNK_SIZE_PX));
      wanted.push({ cx, cy, key: `${cx},${cy}`, distance: Math.hypot(nx - x, ny - y) });
    }
  return wanted.sort((a, b) => a.distance - b.distance);
}
