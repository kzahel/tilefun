import { auditCase } from "./CounterexampleAudit.js";
import { caseIdentity } from "./CounterexampleGenerator.js";
import type { ReviewCase } from "./ReviewCases.js";

export function reductionCost(c: ReviewCase): number {
  const rows = c.sketch.split("\n");
  return (
    rows.length * Math.max(...rows.map((r) => r.length)) * 10000 +
    (c.profiles?.walls.length ?? 0) * 100 +
    (c.sketch.match(/\+/g)?.length ?? 0)
  );
}
function revised(c: ReviewCase, rows: string[][], walls = c.profiles?.walls): ReviewCase {
  const sketch = rows.map((r) => r.join("")).join("\n");
  const next = { ...c, sketch, ...(walls ? { profiles: { walls } } : {}) };
  let hash = 2166136261;
  for (const char of caseIdentity(next))
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return {
    ...next,
    id: `reduced-${hash.toString(16)}`,
    name: `Reduced candidate · ${c.name.replace(/^Reduced candidate · /, "")}`,
    relatedCaseId: c.relatedCaseId ?? c.id,
  };
}
/** Supported reductions delete bands/openings and trim empty interior rows/columns. */
export function smallerCases(c: ReviewCase): ReviewCase[] {
  if (!c.profiles || c.profiles.arch || c.furniture) return [];
  const rows = c.sketch.split("\n").map((r) => [...r]),
    walls = c.profiles.walls;
  const results: ReviewCase[] = [];
  const copy = () => rows.map((r) => [...r]);
  const chunk = Math.ceil(walls.length / 2);
  const removals = walls.map((_, i) => [i]);
  if (chunk > 1)
    removals.unshift(walls.map((_, i) => i).slice(0, chunk), walls.map((_, i) => i).slice(chunk));
  for (const indices of removals) {
    const grid = copy();
    for (const i of indices) {
      const w = walls[i];
      const row = w && grid[w.y];
      if (w && row) row[w.x] = "L";
    }
    results.push(
      revised(
        c,
        grid,
        walls.filter((_, i) => !indices.includes(i)),
      ),
    );
  }
  for (let y = 1; y < rows.length - 1; y++)
    for (let x = 1; x < (rows[y]?.length ?? 0) - 1; x++)
      if (rows[y]?.[x] === "+") {
        const grid = copy(),
          row = grid[y];
        if (row) row[x] = "L";
        results.push(revised(c, grid));
      }
  if (rows.length > 4)
    for (let y = 1; y < rows.length - 1; y++)
      if (rows[y]?.slice(1, -1).every((v) => v === "L")) {
        const grid = copy();
        grid.splice(y, 1);
        results.push(
          revised(
            c,
            grid,
            walls.map((w) => ({ ...w, y: w.y > y ? w.y - 1 : w.y })),
          ),
        );
      }
  const width = rows[0]?.length ?? 0;
  if (width > 4)
    for (let x = 1; x < width - 1; x++)
      if (rows.slice(1, -1).every((r) => r[x] === "L")) {
        const grid = copy();
        for (const row of grid) row.splice(x, 1);
        results.push(
          revised(
            c,
            grid,
            walls.map((w) => ({ ...w, x: w.x > x ? w.x - 1 : w.x })),
          ),
        );
      }
  return [
    ...new Map(
      results.filter((r) => reductionCost(r) < reductionCost(c)).map((r) => [caseIdentity(r), r]),
    ).values(),
  ].sort((a, b) => reductionCost(a) - reductionCost(b) || a.id.localeCompare(b.id));
}

/** One-minimal for these operations and this predicate, not a global minimum. */
export function reduceFailure(
  c: ReviewCase,
  stillFails: (candidate: ReviewCase) => boolean,
  budget = 500,
) {
  if (!c.profiles || c.profiles.arch || c.furniture)
    throw new Error("Reduction currently supports unfurnished profile walls without arches");
  if (!Number.isInteger(budget) || budget < 1) throw new Error("Invalid reduction budget");
  if (!stillFails(c)) throw new Error("Original case does not satisfy the failure predicate");
  let current = c,
    evaluations = 1;
  while (evaluations < budget) {
    let improved = false;
    for (const candidate of smallerCases(current)) {
      if (evaluations >= budget) return { fixture: current, evaluations, minimal: false };
      evaluations++;
      if (stillFails(candidate)) {
        current = candidate;
        improved = true;
        break;
      }
    }
    if (!improved) return { fixture: current, evaluations, minimal: true };
  }
  return { fixture: current, evaluations, minimal: false };
}

/** Visual failures have no automatic oracle. Keep pinned neighborhoods and ask
 * the human to confirm this smaller proposal through the normal review loop. */
export function proposeVisualReduction(c: ReviewCase, pins: [number, number][]) {
  if (!pins.length) throw new Error("Visual reduction requires a source-cell pin");
  const rows = c.sketch.split("\n");
  if (
    pins.some(
      ([x, y]) =>
        !Number.isInteger(x) ||
        !Number.isInteger(y) ||
        x < 0 ||
        y < 0 ||
        y >= rows.length ||
        x >= (rows[y]?.length ?? 0),
    )
  )
    throw new Error("Pin is outside the source sketch");
  const snapshot = (fixture: ReviewCase) => {
    const rows = fixture.sketch.split("\n");
    return JSON.stringify(
      pins.map(([x, y]) =>
        [-1, 0, 1].flatMap((dy) =>
          [-1, 0, 1].map((dx) => {
            const w = fixture.profiles?.walls.find((w) => w.x === x + dx && w.y === y + dy);
            return [rows[y + dy]?.[x + dx] ?? " ", w?.height, w?.thickness ?? "thin"];
          }),
        ),
      ),
    );
  };
  const original = snapshot(c);
  const reduced = reduceFailure(
    c,
    (candidate) => !auditCase(candidate).length && snapshot(candidate) === original,
  );
  return { ...reduced, needsVisualConfirmation: true as const };
}
