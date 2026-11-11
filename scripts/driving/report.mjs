export function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? null;
  return { count: sorted.length, p50: at(0.5), p95: at(0.95), p99: at(0.99), max: at(1) };
}

/** Workload gates, never performance thresholds. Keep rejected runs in reports. */
export function qualify(fixture, sample) {
  const reasons = [];
  const ticks = sample.end.tick - sample.start.tick;
  const expectedCars = fixture === "clear" ? 1 : 37;
  for (const state of [sample.start, ...sample.checkpoints, sample.end]) {
    if (!state.seated) reasons.push("driver left the fixture car");
    if (state.vehicles !== expectedCars)
      reasons.push(`expected ${expectedCars} vehicles, got ${state.vehicles}`);
  }
  if (!(ticks > 0)) reasons.push("authority did not advance");
  if (fixture === "clear") {
    // From rest at 112 px/s, allowing acceleration, transport fences and modest
    // suspension drag. Normalize by actual simulated ticks, never wall seconds.
    const target = Math.max(0, (ticks * 112) / 60 - 40);
    const progress = sample.end.x - sample.start.x;
    if (progress < target * 0.9 || progress > ((ticks * 112) / 60) * 1.05)
      reasons.push("clear route did not sustain the prescribed forward motion");
    if (sample.maxLateral > 2) reasons.push("clear route left the lane");
    if (sample.end.x >= 7400) reasons.push("clear route exhausted its prepared road");
  } else {
    if (sample.end.x - sample.start.x < 40 || sample.end.x - sample.start.x > 400)
      reasons.push("driver did not reach the fixed queue");
    if (sample.end.speed > 4) reasons.push("queue was not backed up at the end");
    const queued = sample.end.poses?.filter((pose) => pose.name.startsWith("queue:")) ?? [];
    if (queued.length !== 32 || queued.filter((pose) => pose.speed < 4).length < 28)
      reasons.push("the four traffic queues did not remain backed up");
  }
  const wheelQueries =
    sample.physics.collision.wheelQueries - sample.physicsBefore.collision.wheelQueries;
  if (!(wheelQueries > 0)) reasons.push("no wheel contacts queried");
  return { valid: !reasons.length, reasons: [...new Set(reasons)], ticks, wheelQueries };
}

export function assertComparable(before, after) {
  for (const key of [
    "schemaVersion",
    "browser",
    "headed",
    "seconds",
    "runtime",
    "device",
    "fixtures",
    "zoomOverride",
    "pacing",
    "allocationSampled",
    "profiled",
    "traced",
    "measurementVersion",
  ])
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key]))
      throw Error(`Incompatible driving reports: ${key}`);
  if (before.errors.length || after.errors.length)
    throw Error("Cannot compare reports with page errors");
  for (const report of [before, after])
    if (report.cells.some((cell) => !cell.qualification.valid))
      throw Error("Cannot compare unqualified driving workloads");
  for (const cell of after.cells) {
    const old = before.cells.find((c) => c.fixture === cell.fixture && c.trial === cell.trial);
    if (!old || old.recipeSha256 !== cell.recipeSha256)
      throw Error("Incompatible driving reports: fixture/trial or recipe");
    if (old.start.poses.length !== cell.start.poses.length)
      throw Error("Incompatible driving reports: initial population differs");
    for (let i = 0; i < cell.start.poses.length; i++) {
      const a = old.start.poses[i],
        b = cell.start.poses[i];
      if (!a || a.name !== b.name || Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) > 1)
        throw Error("Incompatible driving reports: initial poses differ");
    }
    const a = old.qualification.ticks,
      b = cell.qualification.ticks;
    // Different authority throughput is itself a result, but a wall-time sample
    // that covered very different simulation work cannot be an A/B CPU estimate.
    if (Math.abs(a - b) > Math.max(a, b) * 0.05)
      throw Error("Incompatible driving reports: simulated ticks differ by more than 5%");
    if (
      cell.fixture === "clear" &&
      Math.abs(old.distance - cell.distance) > Math.max(old.distance, cell.distance) * 0.05
    )
      throw Error("Incompatible driving reports: travelled distance differs by more than 5%");
  }
  if (before.cells.length !== after.cells.length)
    throw Error("Incompatible driving reports: trial count");
}
