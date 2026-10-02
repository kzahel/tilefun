import type { Prop } from "../entities/Prop.js";
import type { FacadePiece } from "../generation/regional/BuildingRecipes.js";
import type { GridPoint } from "./GridStroke.js";

/** Candidate v1: audited cap/repeat rectangles from the user's marked source region.
 * The ground anchor is top-left; visual canopy overhang is not a connection. */
export const FENCED_TREES = {
  id: "fenced-trees-v1",
  name: "Broadleaf trees · south fence",
  sheetId: "me-complete",
  gridSize: 16,
  connections: ["E", "W"],
  dirtyHalo: 1,
  minimumLength: 4,
  maximumLength: 128,
  sourceFingerprint: "1429a07733836963fc6f1bf703bba59e2e766152bea54a9e936a65089c2d0737",
  sources: {
    left: [1568, 0, 48, 96],
    repeat: [1632, 0, 80, 96],
    right: [1728, 0, 48, 96],
  },
  groundDepth: 16,
  fenceDepth: 8,
  status: "candidate",
} as const;
export interface TreeRun {
  x: number;
  y: number;
  length: number;
}
export const treeRunType = (length: number) => `pattern:fenced-trees-v1:${length}`;
export function treeRunLength(type: string): number | null {
  const m = /^pattern:fenced-trees-v1:([1-9][0-9]{0,2})$/.exec(type);
  const length = Number(m?.[1]);
  return Number.isInteger(length) &&
    length >= FENCED_TREES.minimumLength &&
    length <= FENCED_TREES.maximumLength
    ? length
    : null;
}
export function treeRuns(cells: readonly GridPoint[]): TreeRun[] {
  const rows = new Map<number, Set<number>>();
  for (const p of cells) {
    const row = rows.get(p.y) ?? new Set<number>();
    row.add(p.x);
    rows.set(p.y, row);
  }
  const runs: TreeRun[] = [];
  for (const [y, row] of [...rows].sort((a, b) => a[0] - b[0])) {
    const xs = [...row].sort((a, b) => a - b);
    let start = xs[0],
      previous = start;
    for (const x of [...xs.slice(1), Infinity]) {
      if (start === undefined || previous === undefined) break;
      if (x !== previous + 1) {
        const length = previous - start + 1;
        if (length < 4 || length > 128)
          throw new Error(
            `Tree row needs 4–128 cells; this edit leaves a ${length}-cell run. Extend it or erase the whole short end.`,
          );
        runs.push({ x: start, y, length });
        start = x;
      }
      previous = x;
    }
  }
  return runs;
}
export function treeRunCells(runs: readonly TreeRun[]): GridPoint[] {
  return runs.flatMap((r) => Array.from({ length: r.length }, (_, i) => ({ x: r.x + i, y: r.y })));
}
export function compileTreeRun(length: number): FacadePiece[] {
  if (treeRunLength(treeRunType(length)) === null) throw new Error("Unsupported tree run length");
  const piece = (sx: number, w: number, left: number): FacadePiece => ({
    frameCol: sx / 16,
    frameRow: 0,
    spriteWidth: w,
    spriteHeight: 96,
    dx: left + w / 2 - length * 8,
    dy: 0,
  });
  return [
    piece(1568, 48, -16),
    ...Array.from({ length: length - 4 }, (_, i) => piece(1632 + (i % 5) * 16, 16, 32 + i * 16)),
    piece(1728, 48, (length - 2) * 16),
  ];
}
/** Normal game Prop: ordinary chunk indexing, collision, save/load and replication. */
export function treeRunProp(length: number, wx: number, wy: number): Prop {
  return {
    id: 0,
    type: treeRunType(length),
    position: { wx, wy },
    isProp: true,
    sprite: {
      sheetKey: "me-complete",
      frameCol: 98,
      frameRow: 0,
      spriteWidth: length * 16 + 32,
      spriteHeight: 96,
      parts: compileTreeRun(length),
    },
    collider: { offsetX: 0, offsetY: 0, width: length * 16, height: 16 },
    walls: null,
  };
}
