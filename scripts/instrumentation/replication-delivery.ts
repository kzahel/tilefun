import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createReplicationRig } from "../../src/server/testing/ReplicationDeliveryHarness.js";
import { ReplicationDeliveryQueue } from "../../src/server/testing/ReplicationDeliveryQueue.js";

// Seeded application-message schedules, not a model of UDP/SCTP congestion.
const profiles = [
  { name: "ordered-100ms", loss: 0, jitter: false, burst: false },
  { name: "loss-1pct", loss: 0.01, jitter: false, burst: false },
  { name: "loss-5pct", loss: 0.05, jitter: false, burst: false },
  { name: "loss-20pct", loss: 0.2, jitter: false, burst: false },
  { name: "burst-6frames", loss: 0, jitter: false, burst: true },
  { name: "reorder-0to200ms", loss: 0, jitter: true, burst: false },
];
const legacyUnreliableFrames = process.argv.includes("--legacy-unreliable");
const results = [];
for (const profile of profiles) {
  for (const seed of [42, 2026, 8675309]) {
    const rig = createReplicationRig();
    let rng = seed >>> 0;
    const random = () => {
      rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
      return rng / 2 ** 32;
    };
    let reordered = 0;
    let lastTick = 0;
    let positionError = 0;
    const spawned: number[] = [];
    const queue = new ReplicationDeliveryQueue((frame) => {
      if (frame.type !== "frame") return;
      if (frame.serverTick < lastTick) reordered++;
      lastTick = frame.serverTick;
      rig.view.applyFrame(frame);
    }, legacyUnreliableFrames);
    try {
      for (let tick = 0; tick < 360; tick++) {
        if (tick < 40) {
          rig.transport.clientSide.send({
            type: "edit-spawn",
            entityType: "chicken",
            wx: 80 + tick,
            wy: 80,
          });
          const id = rig.server.entityManager.entities.at(-1)?.id;
          if (id === undefined) throw new Error("Missing spawned fixture entity");
          spawned.push(id);
        }
        if (tick < 180) rig.chicken.position.wx = 50 + tick;
        if (tick >= 120 && tick < 160) {
          const entity = rig.server.entityManager.entities.find(
            (e) => e.id === spawned[tick - 120],
          );
          if (!entity) throw new Error("Missing fixture entity for metadata update");
          entity.noShadow = true;
        }
        if (tick >= 200 && tick < 220) {
          const id = spawned[tick - 200];
          if (id === undefined) throw new Error("Missing fixture entity for deletion");
          rig.transport.clientSide.send({ type: "edit-delete-entity", entityId: id });
        }
        const frame = rig.tick();
        const impaired = tick < 240;
        const drop = impaired && (random() < profile.loss || (profile.burst && tick % 30 < 6));
        queue.enqueue(
          frame,
          tick,
          impaired ? (profile.jitter ? Math.floor(random() * 13) : 6) : 0,
          drop,
        );
        queue.drain(tick);
      }
      queue.drain(Number.POSITIVE_INFINITY);
      // An additional clean window starts only after every delayed packet has drained.
      rig.settle(120);
      const expected = rig.state(rig.control);
      const actual = rig.state(rig.view);
      const actualById = new Map(actual.map((e) => [e.id, e]));
      const expectedIds = new Set(expected.map((e) => e.id));
      let missing = 0;
      let mismatched = 0;
      for (const entity of expected) {
        const replica = actualById.get(entity.id);
        if (!replica) {
          missing++;
          continue;
        }
        if (JSON.stringify(replica) !== JSON.stringify(entity)) mismatched++;
        positionError = Math.max(
          positionError,
          Math.hypot(
            replica.position.wx - entity.position.wx,
            replica.position.wy - entity.position.wy,
          ),
        );
      }
      const extra = actual.filter((e) => !expectedIds.has(e.id)).length;
      results.push({
        profile: profile.name,
        seed,
        dropped: queue.dropped,
        delayedByLoss: queue.delayedByLoss,
        reordered,
        missing,
        extra,
        mismatched,
        maxPositionErrorPx: positionError,
        wireBytes: rig.wireBytes,
        convergedAfter120CleanFrames: missing + extra + mismatched === 0,
      });
    } finally {
      rig.server.destroy();
    }
  }
}
const report = {
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sourceDirty: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim() !== "",
  policy: legacyUnreliableFrames ? "legacy-unreliable" : "production-ordered-sync",
  scope:
    "Real replication/codec; channel model with bounded 30-tick loss delay on sync and drops/reordering on entities; not UDP/SCTP impairment",
  steps: { impaired: 240, initialClean: 120, recoveryAfterDrain: 120, tickHz: 60 },
  results,
};
const output = process.argv.find((arg) => arg.startsWith("--output="))?.slice(9);
if (output) {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
}
console.table(results);
// Explicit opt-in for characterization runs. By default failure to converge fails the diagnostic.
if (
  results.some((result) => !result.convergedAfter120CleanFrames) &&
  !process.argv.includes("--expect-known-gaps")
)
  process.exitCode = 1;
