import { nearestRail, type RailPath } from "../railway/RailPath.js";

/** Pixel tracks baked into the normal terrain cache on both backends.
 * Global arclength fixes sleeper phase across chunks and reloads. */
export function railPixel(paths: readonly RailPath[], x: number, y: number): string | undefined {
  let hit = { distance: Infinity, lateral: 0, along: 0 };
  for (const path of paths) {
    const p = nearestRail(path, x + 0.5, y + 0.5);
    if (p.distance < hit.distance) hit = p;
  }
  if (hit.distance > 22) return;
  const across = Math.abs(hit.lateral),
    phase = ((hit.along % 20) + 20) % 20;
  const noise = (Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) >>> 0;
  if (Math.abs(across - 10) < 1) return "#bac3c6";
  if (Math.abs(across - 10) < 2) return "#47555b";
  if (across < 18 && phase < 4) return across > 12 ? "#6e583d" : "#92714b";
  return noise % 5 === 0 ? "#8b8d81" : noise % 3 === 0 ? "#a1a394" : "#b1b1a1";
}

export function drawRailTile(
  ctx: OffscreenCanvasRenderingContext2D,
  paths: readonly RailPath[],
  tx: number,
  ty: number,
  dx: number,
  dy: number,
) {
  for (let y = 0; y < 16; y++) {
    let last: string | undefined,
      start = 0;
    for (let x = 0; x <= 16; x++) {
      const color = x < 16 ? railPixel(paths, tx * 16 + x, ty * 16 + y) : undefined;
      if (color !== last) {
        if (last) {
          ctx.fillStyle = last;
          ctx.fillRect(dx + start, dy + y, x - start, 1);
        }
        start = x;
        last = color;
      }
    }
  }
}
