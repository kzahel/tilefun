export interface GridPoint {
  x: number;
  y: number;
}
export type StrokeShape = "free" | "horizontal" | "rectangle";
const valid = (p: GridPoint) =>
  Number.isSafeInteger(p.x) &&
  Number.isSafeInteger(p.y) &&
  Math.abs(p.x) <= 1_000_000 &&
  Math.abs(p.y) <= 1_000_000;

/** Inclusive integer line. Pointer sampling frequency cannot leave holes. */
export function gridLine(a: GridPoint, b: GridPoint): GridPoint[] {
  if (!valid(a) || !valid(b)) throw new Error("Invalid grid coordinate");
  if (Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) > 512)
    throw new Error("Stroke is too long (512 cells maximum)");
  const points: GridPoint[] = [];
  let x = a.x,
    y = a.y,
    error = Math.abs(b.x - a.x) - Math.abs(b.y - a.y);
  const dx = Math.abs(b.x - a.x),
    dy = Math.abs(b.y - a.y),
    sx = a.x < b.x ? 1 : -1,
    sy = a.y < b.y ? 1 : -1;
  while (true) {
    points.push({ x, y });
    if (x === b.x && y === b.y) return points;
    const twice = 2 * error;
    if (twice > -dy) {
      error -= dy;
      x += sx;
    }
    if (twice < dx) {
      error += dx;
      y += sy;
    }
  }
}

/** Host and UI use this exact snapping/interpolation contract. */
export function strokeCells(path: readonly GridPoint[], shape: StrokeShape): GridPoint[] {
  const first = path[0],
    last = path.at(-1);
  if (!first || !last || path.length > 1024) throw new Error("Invalid stroke path");
  if (!path.every(valid)) throw new Error("Invalid grid coordinate");
  if (shape === "horizontal") return gridLine(first, { x: last.x, y: first.y });
  if (shape === "rectangle") {
    const width = Math.abs(last.x - first.x) + 1,
      height = Math.abs(last.y - first.y) + 1;
    if (width * height > 4096) throw new Error("Rectangle is too large");
    return Array.from({ length: height }, (_, dy) =>
      Array.from({ length: width }, (_, dx) => ({
        x: Math.min(first.x, last.x) + dx,
        y: Math.min(first.y, last.y) + dy,
      })),
    ).flat();
  }
  const points = new Map<string, GridPoint>();
  for (let i = 0; i < path.length; i++)
    for (const p of gridLine(path[i - 1] ?? first, path[i] ?? last)) {
      points.set(`${p.x},${p.y}`, p);
      if (points.size > 4096) throw new Error("Stroke is too large");
    }
  return [...points.values()];
}

/** A history entry is a whole validated gesture, never a pointer sample. */
export class DocumentHistory<T> {
  private past: T[] = [];
  private future: T[] = [];
  constructor(
    public current: T,
    private readonly limit = 50,
  ) {}
  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
  commit(next: T): boolean {
    if (JSON.stringify(next) === JSON.stringify(this.current)) return false;
    this.past.push(this.current);
    if (this.past.length > this.limit) this.past.shift();
    this.current = next;
    this.future = [];
    return true;
  }
  undo(): T {
    const next = this.past.pop();
    if (next !== undefined) {
      this.future.push(this.current);
      this.current = next;
    }
    return this.current;
  }
  redo(): T {
    const next = this.future.pop();
    if (next !== undefined) {
      this.past.push(this.current);
      this.current = next;
    }
    return this.current;
  }
}
