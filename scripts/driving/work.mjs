// Explicit v3 work contract. Never infer missing fields from old cadence records.
const counters = [
  "inputs",
  "reconciliations",
  "restores",
  "restoredBodies",
  "forwardSteps",
  "replaySteps",
  "worldSteps",
  "bodyReads",
  "motorUpdates",
  "wheelQueries",
  "geometryBuilds",
  "resets",
  "clears",
];

export function workProblem(work) {
  if (!work || counters.some((key) => !Number.isSafeInteger(work[key]) || work[key] < 0))
    return "missing or invalid client prediction work counters (requires v3)";
  if (!work.inputs || !work.worldSteps || !work.restores || !work.bodyReads)
    return "client prediction did not execute";
  if (work.worldSteps !== work.forwardSteps + work.replaySteps)
    return "client physics step counts disagree";
  // A queued reconciliation can be accepted before this measurement window.
  if (work.restoredBodies < work.restores) return "client restore counts disagree";
}

/** Reject materially different work instead of dividing total heap bytes by one
 * operation count: rendering, decode and replay are different allocation owners. */
export function assertWorkComparable(before, after) {
  for (const work of [before, after]) {
    const problem = workProblem(work);
    if (problem) throw Error(`Incompatible driving reports: ${problem}`);
  }
  for (const key of counters) {
    // Direct/replay is a partition of total steps. A few startup steps moving
    // between paths are not a large work change when almost all steps use replay.
    const scale = ["forwardSteps", "replaySteps"].includes(key)
      ? Math.max(before.worldSteps, after.worldSteps)
      : Math.max(before[key], after[key]);
    const tolerance = ["resets", "clears"].includes(key) ? 0 : Math.max(2, scale * 0.05);
    if (Math.abs(before[key] - after[key]) > tolerance)
      throw Error(`Incompatible driving reports: client ${key} differ beyond work tolerance`);
  }
}
