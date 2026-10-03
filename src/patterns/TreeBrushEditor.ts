import { CHUNK_SIZE_PX } from "../config/constants.js";
import { aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import type { Prop } from "../entities/Prop.js";
import type { PropManager } from "../entities/PropManager.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import { editTreeRuns, type TreeRun, treeRunLength, treeRunProp } from "./FencedTrees.js";
import { type GridPoint, strokeCells } from "./GridStroke.js";
export interface TreeBrushCommand {
  start: GridPoint;
  end: GridPoint;
  erase: boolean;
}
export interface TreeBrushStatus {
  error: string;
  canUndo: boolean;
  canRedo: boolean;
}
interface Change {
  y: number;
  min: number;
  max: number;
  before: TreeRun[];
  after: TreeRun[];
}

/** Authoritative transactions. Undo compares only the affected row, so another
 * editor's changed row cannot be silently overwritten. Props are compiled output. */
export class TreeBrushEditor {
  private histories = new Map<string, { past: Change[]; future: Change[] }>();
  constructor(
    private readonly props: PropManager,
    private readonly markDirty: () => void,
  ) {}
  forget(client: string) {
    this.histories.delete(client);
  }
  private history(client: string) {
    const h = this.histories.get(client) ?? { past: [], future: [] };
    this.histories.set(client, h);
    return h;
  }
  status(client: string, error = ""): TreeBrushStatus {
    const h = this.history(client);
    return { error, canUndo: h.past.length > 0, canRedo: h.future.length > 0 };
  }
  private row(y: number, min = -Infinity, max = Infinity): { props: Prop[]; runs: TreeRun[] } {
    const props = this.props.props.filter(
      (p) =>
        treeRunLength(p.type) !== null &&
        p.position.wy === (y + 1) * 16 &&
        p.position.wx / 16 + (treeRunLength(p.type) ?? 0) / 2 >= min &&
        p.position.wx / 16 - (treeRunLength(p.type) ?? 0) / 2 <= max,
    );
    const runs = props
      .map((p) => ({
        x: (p.position.wx - (treeRunLength(p.type) ?? 0) * 8) / 16,
        y,
        length: treeRunLength(p.type) ?? 0,
      }))
      .sort((a, b) => a.x - b.x);
    return { props, runs };
  }
  private replace(y: number, runs: TreeRun[], min: number, max: number) {
    const old = this.row(y, min, max),
      replacements = runs.map((r) =>
        treeRunProp(r.length, r.x * 16 + r.length * 8, (r.y + 1) * 16),
      ),
      ids = new Set(old.props.map((p) => p.id));
    for (const p of replacements) {
      if (!p.collider) continue;
      const bounds = getEntityAABB(p.position, p.collider);
      for (const other of this.props.props) {
        if (ids.has(other.id)) continue;
        for (const collider of other.walls ?? (other.collider ? [other.collider] : []))
          if (aabbsOverlap(bounds, getEntityAABB(other.position, collider)))
            throw new Error(
              "Tree footprint overlaps another prop. Move the row or remove the obstruction.",
            );
      }
    }
    for (const p of old.props) this.props.remove(p.id);
    for (const p of replacements) this.props.add(p);
    this.markDirty();
  }
  edit(client: string, command: TreeBrushCommand): TreeBrushStatus {
    try {
      if (typeof command.erase !== "boolean") throw new Error("Invalid erase mode");
      const points = strokeCells([command.start, command.end], "horizontal"),
        y = command.start.y,
        min = Math.min(command.start.x, command.end.x) - 1,
        max = Math.max(command.start.x, command.end.x) + 1,
        before = this.row(y, min, max).runs;
      const after = editTreeRuns(before, points, command.erase);
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        this.replace(y, after, min, max);
        const h = this.history(client);
        h.past.push({ y, min, max, before, after });
        if (h.past.length > 50) h.past.shift();
        h.future = [];
      }
      return this.status(client);
    } catch (e) {
      return this.status(client, e instanceof Error ? e.message : String(e));
    }
  }
  historyRange(client: string, direction: "undo" | "redo"): ChunkRange | undefined {
    const h = this.history(client),
      c = (direction === "undo" ? h.past : h.future).at(-1);
    if (!c) return;
    return {
      minCx: Math.floor(((c.min - 129) * 16) / CHUNK_SIZE_PX),
      maxCx: Math.floor(((c.max + 129) * 16) / CHUNK_SIZE_PX),
      minCy: Math.floor((c.y * 16 - 32) / CHUNK_SIZE_PX),
      maxCy: Math.floor((c.y * 16 + 32) / CHUNK_SIZE_PX),
    };
  }
  travel(client: string, direction: "undo" | "redo"): TreeBrushStatus {
    try {
      if (direction !== "undo" && direction !== "redo")
        throw new Error("Invalid history operation");
      const h = this.history(client),
        from = direction === "undo" ? h.past : h.future,
        to = direction === "undo" ? h.future : h.past,
        c = from.at(-1);
      if (!c) return this.status(client);
      const expected = direction === "undo" ? c.after : c.before,
        target = direction === "undo" ? c.before : c.after;
      if (JSON.stringify(this.row(c.y, c.min, c.max).runs) !== JSON.stringify(expected))
        throw new Error("This row changed since your stroke. Undo would overwrite another edit.");
      this.replace(c.y, target, c.min, c.max);
      from.pop();
      to.push(c);
      return this.status(client);
    } catch (e) {
      return this.status(client, e instanceof Error ? e.message : String(e));
    }
  }
}
