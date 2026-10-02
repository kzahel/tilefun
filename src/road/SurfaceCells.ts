import type { SurfacePiece } from "./CitySurfaceRecipes.js";

/** Clip original opaque source pieces into one persistent 16px cell. A full
 * opaque replacement discards hidden layers; partial crossing shadows remain. */
export function surfaceCell(pieces: readonly SurfacePiece[], x: number, y: number): SurfacePiece[] {
  let result: SurfacePiece[] = [];
  for (const p of pieces) {
    const left = Math.max(x * 16, p.x),
      top = Math.max(y * 16, p.y),
      right = Math.min((x + 1) * 16, p.x + p.rect[2]),
      bottom = Math.min((y + 1) * 16, p.y + p.rect[3]);
    if (left >= right || top >= bottom) continue;
    const piece: SurfacePiece = {
      ...p,
      rect: [p.rect[0] + left - p.x, p.rect[1] + top - p.y, right - left, bottom - top],
      x: left - x * 16,
      y: top - y * 16,
    };
    if (right - left === 16 && bottom - top === 16) result = [];
    result.push(piece);
  }
  return result;
}
export const surfaceCellKey = (pieces: readonly SurfacePiece[]) =>
  JSON.stringify(pieces.map((p) => [...p.rect, p.x, p.y]));
