# 244 — Direct prediction body capture

Status: delivered as a simplification · 2026-11-11.
Owner: [player prediction](../topics/player-prediction.md).

The owner asked for a bounded product-code simplification rather than another
measurement expansion. This pass removes one conversion layer and repeated ID
searches; it does not change prediction timing or broaden into renderer work.

## Ownership and change

Before:

`replica ID map → flat array → repeated finds → captured request array → rebuilt private body map → published copy`

After:

`borrowed replica ID map → owned captured body map → direct handoff to private physics → published copy`

The ordered rendering array remains available. `RemoteStateView.serverEntityMap`
is a readonly alias of the replica's existing, now readonly-bound index: no second
index is built. Game and lab device sessions, seat resolution and direct prediction
consumers use that lookup. Reconciliation captures selected entities in physics
snapshot order. The replay takes that same owned map, removing the temporary
request array, array transforms and map reconstruction.

Replica entities still mutate when new frames arrive, so capture retains the
existing independent mutable component copies. Published copies also remain:
a replay can span frames while rendering must keep the last committed pose.
There is no pool, copy-on-write protocol, compact entity schema, new clock or
solver/scheduling change. Missing metadata still prevents partial physics replay.

## Acceptance and validation

This pass is accepted as a representation/ownership simplification if fixed-work
CPU does not regress and movement stays identical. A phone speedup requires its
own compatible evidence; a small helper timing change is insufficient.

- Native tests cover detached queued state, missing metadata and physics order,
  plus existing movement, contacts, multi-seat, revisions and lab consumers.
- The existing 900-tick clear/jam fixed schedule checks full authority/predictor
  checkpoint parity and work counts against `003fa5f0`.
- The existing recorded 1,051-entity crowd client replay supplies equal-work
  decode/reconcile/presentation timings. Three ordinary trials per lane alternate;
  verification is separate. This empty-input replay is distinct from active driving.
- Final normal production and phone clear/jam checks retain the existing v3 gates.

Raw recordings/bundles are ignored under `data/scratch/prediction-244/`.

## Results

[Sanitized evidence](../benchmarks/244-direct-prediction-body-capture.json)
records the final measurements. The baseline substitutes the original predictor,
seat lookup and device-session implementations from `003fa5f0` into the same
unchanged replay workload/dependencies. The phone baseline is the preserved
ordinary production bundle from that revision; served module hashes distinguish
it from the current checkout metadata.

The final fixed-work run starts after this task's build/test jobs stop. Earlier
samples overlapped those jobs and are excluded from acceptance timings; their
logs remain local. Other OS/background load is not frozen. The table reports the
median of three trial p50/p95 values, not pooled sample percentiles:

| Recorded crowd client CPU | Before | After |
| --- | ---: | ---: |
| Reconciliation p50 | 0.285 ms | 0.217 ms |
| Reconciliation p95 | 0.395 ms | 0.297 ms |
| Entire client update p50 | 5.562 ms | 5.519 ms |
| Entire client update p95 | 6.363 ms | 6.143 ms |

Reconciliation time is about 24% lower in this 1,051-entity recording. Total client
update median is essentially unchanged. This lane has empty input backlog and
no DOM, transport scheduling or WebGL; it is not a phone-frame result. No total
allocation sampling was added, so the removed temporary structures do not imply
a measured whole-thread heap percentage.

All 77 native tests across ten files, four typecheck projects, focused lint,
health, normal production build, two rebuilt-production Worker/lab browser checks
and streaming readiness pass. All 2,130 Workshop identities remain unchanged.
The readonly index alias adds two lines to the replica allowance; the predictor
shrinks from 968 to 963 lines. No complexity ceiling is raised.

Both 900-tick active-driving fixtures preserve the exact previous authority and
prediction checkpoint record and work counts under delayed, fully acknowledged
deliveries (900 direct steps and no replay steps per fixture). Sliced/unacknowledged
replay is covered by the native regression tests. Checkpoint SHA-256
`6069297294d23da40d4019aa737bed63d1e6ab24c7b5ddf5382d33b45c3383b2`.
The crowd verification independently matches every serialized replica state.

Both clear/jam phone scenarios qualify before and after. Client physics steps
are 1,298 → 1,191 and 1,302 → 1,197, beyond the v3 work tolerance. The observed
missed intervals fall from 1 / 2 to 0 / 0, but those differences cannot be credited
to this cleanup. Thermal status stays 0 at 25.2–25.3°C on external power. Owned
tabs/Workers, servers and USB routes are cleaned up; the final device doctor passes.

The representation-simplification acceptance criterion is met, with lower
fixed-work reconciliation cost and unchanged motion. This pass does not establish
the alternative 10% whole-thread allocation or 0.5 ms phone-update p95 performance
goal. Stop here; remaining per-frame presentation/decal copies are a separate
possible target using the already available fixed replay.
