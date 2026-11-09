import {
  nearerOnSegment,
  nearestRail,
  type RailHit,
  type RailPath,
  type RailSegment,
  segmentLength,
} from "../railway/RailPath.js";

/** Pixels farther than this from every rail centerline stay terrain. */
const REACH = 22;

/** Pixel tracks baked into the normal terrain cache on both backends.
 * Global arclength fixes sleeper phase across chunks and reloads. */
export function railPixel(paths: readonly RailPath[], x: number, y: number): string | undefined {
  let hit: RailHit = { distance: Infinity, lateral: 0, along: 0 };
  for (const path of paths) {
    const p = nearestRail(path, x + 0.5, y + 0.5);
    if (p.distance < hit.distance) hit = p;
  }
  return railColor(hit, x, y);
}
function railColor(hit: RailHit, x: number, y: number): string | undefined {
  if (hit.distance > REACH) return;
  const across = Math.abs(hit.lateral),
    phase = ((hit.along % 20) + 20) % 20;
  const noise = (Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) >>> 0;
  if (Math.abs(across - 10) < 1) return "#bac3c6";
  if (Math.abs(across - 10) < 2) return "#47555b";
  if (across < 18 && phase < 4) return across > 12 ? "#6e583d" : "#92714b";
  return noise % 5 === 0 ? "#8b8d81" : noise % 3 === 0 ? "#a1a394" : "#b1b1a1";
}

interface Candidate {
  segment: RailSegment;
  length: number;
  along: number;
}
/** Segments that can reach a pixel of the tile, keeping path order and arclength.
 * A segment farther than REACH (+1 for rounding) from the tile never decides a
 * colored pixel, so `railPixel` over the candidates matches it exactly. */
function tileCandidates(paths: readonly RailPath[], left: number, top: number, size: number) {
  const out: Candidate[][] = [];
  for (const path of paths) {
    let along = 0;
    const near: Candidate[] = [];
    for (const segment of path.segments) {
      const length = segmentLength(segment);
      if (tileGap(segment, left, top, size) <= REACH + 1) near.push({ segment, length, along });
      along += length;
    }
    if (near.length) out.push(near);
  }
  return out;
}

/** Distance from the tile to the segment's bounds (an arc's whole circle). */
function tileGap(s: RailSegment, left: number, top: number, size: number) {
  const r = s.kind === "arc" ? s.radius : 0;
  const minX = s.kind === "line" ? Math.min(s.x, s.endX) : s.x - r,
    maxX = s.kind === "line" ? Math.max(s.x, s.endX) : s.x + r,
    minY = s.kind === "line" ? Math.min(s.y, s.endY) : s.y - r,
    maxY = s.kind === "line" ? Math.max(s.y, s.endY) : s.y + r;
  return Math.hypot(
    Math.max(0, minX - (left + size), left - maxX),
    Math.max(0, minY - (top + size), top - maxY),
  );
}
/** `railPixel` restricted to the tile's candidates. */
function candidatePixel(candidates: Candidate[][], x: number, y: number) {
  let hit: RailHit = { distance: Infinity, lateral: 0, along: 0 };
  for (const near of candidates) {
    let best: RailHit = { distance: Infinity, lateral: 0, along: 0 };
    for (const c of near)
      best = nearerOnSegment(c.segment, c.length, c.along, x + 0.5, y + 0.5, best);
    if (best.distance < hit.distance) hit = best;
  }
  return railColor(hit, x, y);
}

export function drawRailTile(
  ctx: OffscreenCanvasRenderingContext2D,
  paths: readonly RailPath[],
  tx: number,
  ty: number,
  dx: number,
  dy: number,
) {
  const candidates = tileCandidates(paths, tx * 16, ty * 16, 16);
  if (!candidates.length) return;
  for (let y = 0; y < 16; y++) {
    let last: string | undefined,
      start = 0;
    for (let x = 0; x <= 16; x++) {
      const color = x < 16 ? candidatePixel(candidates, tx * 16 + x, ty * 16 + y) : undefined;
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
