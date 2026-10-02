import { aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import type { Prop } from "../entities/Prop.js";
import type { PropManager } from "../entities/PropManager.js";
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
  private row(y: number): { props: Prop[]; runs: TreeRun[] } {
    const props = this.props.props.filter(
      (p) => treeRunLength(p.type) !== null && p.position.wy === (y + 1) * 16,
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
  private replace(y: number, runs: TreeRun[]) {
    const old = this.row(y),
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
    for (const p of old.props) this.props.remove(p.id, false);
    for (const p of replacements) this.props.add(p);
    this.markDirty();
  }
  edit(client: string, command: TreeBrushCommand): TreeBrushStatus {
    try {
      if (typeof command.erase !== "boolean") throw new Error("Invalid erase mode");
      const points = strokeCells([command.start, command.end], "horizontal"),
        y = command.start.y,
        before = this.row(y).runs;
      const after = editTreeRuns(before, points, command.erase);
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        this.replace(y, after);
        const h = this.history(client);
        h.past.push({ y, before, after });
        if (h.past.length > 50) h.past.shift();
        h.future = [];
      }
      return this.status(client);
    } catch (e) {
      return this.status(client, e instanceof Error ? e.message : String(e));
    }
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
      if (JSON.stringify(this.row(c.y).runs) !== JSON.stringify(expected))
        throw new Error("This row changed since your stroke. Undo would overwrite another edit.");
      this.replace(c.y, target);
      from.pop();
      to.push(c);
      return this.status(client);
    } catch (e) {
      return this.status(client, e instanceof Error ? e.message : String(e));
    }
  }
}
