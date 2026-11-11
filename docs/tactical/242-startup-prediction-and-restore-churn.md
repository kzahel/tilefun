# 242 — Startup prediction and restore churn

Status: delivered and measured · 2026-11-11.
Owner: [performance](../topics/performance.md).
Follows [241](241-budget-terrain-raster-completion.md).

## Investigation

Fresh Pixel 7a production captures retain startup samples after the unchanged
180 idle authority ticks and terrain/mesh warmup. A CPU+trace run's early
19.277 ms game callback spends about 13.3 ms sampled in the predictor's physics
step, including 6.8 ms in geometry preparation and 4.6 ms in the compiler (nested,
not additive). No GC overlaps that callback. A second fresh page has no callback
over 12 ms. Three separate ordinary 10 s controls have update maxima
21.1 / 12.2 / 8.3 ms and zero missed intervals. Browser/JIT state is not reset.
These explain a first-use cost, not the exact older unprofiled 27–33 ms updates.

Manual idle stepping warms authority, not active client prediction. Clock admin
fences also reset the lab predictor. Keep that cost inside measurements; do not
skip the first frame or change warmup to manufacture a cadence win. The normal
game reconciles ordinary frames without the lab clock reset (`PlayScene` requests
a reset for a door transition); this lab resume is not a control for every game
pause/resume. Loading, collision compilation, browser warmup and recurring
snapshot churn are distinct.

## Delivered change

- Prediction history keeps at most 120 position triples, recycling retired
  records, instead of cloning whole entities/components for a distance check.
  Replacement tick order and reset semantics stay the same.
- Numerical restore records retain their independent spread copies, preserving
  absent optional fields. Whole-record reuse was rejected after isolated tests
  showed 2.3× restore time; even a direct-field copy was slower.
- Each scene owns immediate Rapier setter vectors and a readback transform vector.
  Published quaternion/velocity arrays retain their previous immutable ownership.
  Solver order, inputs, arithmetic, snapshot format and all game/lab consumers
  remain shared and unchanged.

Raw captures and preserved production baseline stay in ignored
`data/scratch/startup-242/`. Phone allocation sampling is separate from ordinary
cadence and CPU/trace attribution; exclude sampler-stop MajorGC from natural GC.

## Isolated restore measurement

On the Mac / Node 24, an isolated 37-car scene repeats 5,000 restores after
200 warmup restores, with three ordinary timing trials and a separate 32 KiB
allocation sample including collected objects. There are no world steps.
Preserved baseline and current source are separately bundled with the same
unchanged dependencies and workload.

Sampled allocation falls **149.6 → 106.4 MiB (29%)** for the same 185,000 body
restores. Median timing is **69.1 → 68.3 ms**, effectively unchanged within this
small sequential test. This isolates immediate setter-vector savings; it is not
a physical-phone timing claim or a whole-game allocation percentage.

The rejected `Object.assign` numerical-record reuse takes ~142–147 ms in the
same workload, versus ~60–67 ms for the original. Direct/manual field copies
also lose CPU time. Retain spread copies and their automatic optional-field
removal; keep only the scratch change that avoids that regression.

## Physical phone results

[Sanitized evidence](../benchmarks/242-startup-prediction-and-restore.json)
retains startup attribution, isolated restore results and all 16 final phone
cells. Both allocation and ordinary campaigns use before/after/after/before
order, with two 10-second runs per fixture and lane. All cells qualify and all
four comparison gates pass. Clear routes drive 1,082–1,086 pixels; jam drivers
reach the fixed queue at about 234 pixels. Authority advances 599–601 ticks.
Native viewport, assets, dependencies, harness, policies and initial placements
match. Battery temperature stays 25.7–26.7°C in the final campaign, thermal
status 0, on external power. Browser/JIT and client replay work are not frozen.

The baseline is the preserved ordinary production build from 241; its runtime
sources match `168f3fa9`. The after build uses the final scratch/history change,
with the slower numerical-record prototype excluded. Reports' checkout hashes
are not served baseline identity: source hashes and actual served module hashes
are recorded separately. Candidate identities/pixels are unchanged.

| Main-thread sampled allocation / 10 s | Before a / b | After a / b |
| --- | ---: | ---: |
| Clear | 85.6 / 95.4 MiB | 86.5 / 84.9 MiB |
| Jam | 390.1 / 449.5 MiB | 375.8 / 396.8 MiB |

Observed means are lower, but between-run variation is large and the qualification
gate does not hold the client's replay-step count fixed. **This does not establish
a reliable whole-game allocation percentage.** The 29% isolated restore result
must not be applied to all main-thread work. Sampling includes collected objects
and benchmark bookkeeping; it is neither a leak nor GC-time measurement.

Separate ordinary runs:

| Metric | Before a / b | After a / b |
| --- | ---: | ---: |
| Clear update median | 2.3 / 2.7 ms | 2.3 / 2.5 ms |
| Clear update p95 | 3.3 / 3.8 ms | 3.5 / 3.4 ms |
| Clear update max | 25.2 / 23.4 ms | 24.1 / 31.0 ms |
| Clear missed intervals | 1 / 1 | 1 / 1 |
| Jam update median | 2.8 / 2.9 ms | 2.6 / 2.9 ms |
| Jam update p95 | 4.0 / 3.9 ms | 3.7 / 4.0 ms |
| Jam update max | 8.8 / 11.6 ms | 7.0 / 9.6 ms |
| Jam missed intervals | 0 / 2 | 1 / 1 |

There is no established whole-run cadence improvement or startup fix. Startup
update spikes remain; final ordinary controls have no trace to assign their exact
causes. These prepared roads exclude regional generation and city-art streaming;
no Steam Deck measurement. Temporary tabs, Workers, servers and USB routes are
cleaned up and the final device doctor passes.

## Validation and next work

Native restore tests cover frozen retained packets, multiple bodies, optional
metadata removal, setter isolation and no hidden step. Prediction-history
tests cover position ownership, replacement, bounded retirement and reset. Existing
shared prediction, vehicle, multi-seat and lab-client checks remain authoritative.
76 focused native tests across nine files pass, as do all four typecheck projects.
The rebuilt production Worker settings/lifecycle and embedded lab scheduling
checks pass. Streaming readiness passes. All 2,130 Workshop identities remain
unchanged; inventory differences are a source locator and input digest.

Independent baseline/current native bundles run both clear and jam fixtures for
900 ticks after the same warmup. At 30 checkpoints per fixture, full authority
numerical states/contact graphs and predictor entities/diagnostics match exactly,
including delayed deliveries and replay backlogs. The canonical record omits
random UUID and tag sets; its SHA-256 is
`6069297294d23da40d4019aa737bed63d1e6ab24c7b5ddf5382d33b45c3383b2`.

Next, add per-run client prediction/replay-step and body-read counters to the
driving records before making further whole-game allocation claims. The remaining
large buckets include remote presentation, projected decals and body transforms;
optimize them only with equal-work comparisons. Keep startup collision preparation
and unrelated browser pauses separate; this change claims neither zero GC nor
universal hitch-free driving.
