# Diagnostic probes

## Grass cache retention

Run `node scripts/instrumentation/grass-cache-retention.mjs` from the repository
root. It uses isolated bundled Chromium and a minimal Vite page, generates two
batches of 1,000 discarded chunks, and reports heap usage after explicit GC.
The blade counts check equal work. This diagnoses retained cache memory; it is
not a gameplay allocation-rate, phone, GPU-memory or frame-pacing benchmark.
Small residual heap changes include browser/JIT bookkeeping. See
[Tactical 013](../../docs/tactical/013-renderer-boundary-and-allocation-audit.md).

## Grass frame allocation

Run `node scripts/instrumentation/grass-frame-allocation.mjs` from the repository
root. It warms nine resident grass chunks with 16 interacting entities, then
samples allocations for 600 collections in isolated bundled Chromium. The
sampling profiler includes objects collected during the sample; byte counts
are estimates, not timing gates. Three hashes cover exact grass output at fixed
animation times, including push angles and iteration order. The script also
works on the pre-pooling collector for before/after captures. This synthetic
workload excludes drawing, streaming, sorting, prediction and simulation.

## Terrain scheduler allocation

Run `node scripts/instrumentation/terrain-scheduler-allocation.mjs` from the
repository root. It samples 3,000 frames after a 60-frame warmup with 80 ready
chunks, then with 80 pending chunks. Zero row budget isolates membership and
job bookkeeping from raster work. A separate ordered-job hash covers camera
reversals and changes in old imagery availability. Bundled Chromium's sampling
includes collected objects; byte counts are estimates, not FPS/timing gates.
The script also works against the pre-reuse scheduler for before/after captures.

## Prop depth metadata allocation

Run `node scripts/instrumentation/prop-depth-allocation.mjs` from the repository
root; add `--fresh` to use the unchanged uncached helper. The script warms 60
collections, then samples 600 over 400 props (two finite surfaces and one infinite
wall each). It reports storage creation, eight metadata/depth hashes through edits,
and five unprofiled timing batches. Sampling includes collected objects; the
synthetic workload excludes raster, streaming and simulation. Use these results
for allocation/parity evidence, not as an end-to-end FPS or timing gate.

## Protocol instrumentation

Temporary scripts for auditing which messages still go through JSON fallback (`0xFF`) and roughly how large they are.

## Scripts

- `protocol-fallback-audit.ts`
  - Runs a controlled local `GameServer` simulation with two clients.
  - Reports measured JSON-fallback bytes/counts for client and server message types actually emitted in that scenario.

- `protocol-fallback-size-samples.ts`
  - Encodes representative payloads for each fallback message type.
  - Prints one-shot sample sizes (bytes) for quick comparisons.

## Run

From repo root:

```bash
npx -y tsx scripts/instrumentation/protocol-fallback-audit.ts
npx -y tsx scripts/instrumentation/protocol-fallback-size-samples.ts
```

## Notes

- These are intentionally ad hoc and easy to delete.
- They do not modify runtime behavior or production code paths.

## Replication delivery validation

`replication-delivery.ts` exercises the real server replicator, binary codec and
client replica under seeded entity-frame loss, delay, bursts and reordering.
Reliable traffic is unaffected. It is a repeatable diagnostic, independent of
the ad hoc JSON fallback audits above.

```sh
npx tsx scripts/instrumentation/replication-delivery.ts --output=/tmp/rtc-delivery.json
```

The default exit status is 1 when any scenario does not converge after its clean
recovery window. `--expect-known-gaps` permits a characterization run without
changing the recorded result. Current failures and real WebRTC browser checks
are documented in [Tactical 014](../../docs/tactical/014-webrtc-delivery-validation.md).
This models application-frame faults, not UDP/SCTP congestion or WAN behavior.
