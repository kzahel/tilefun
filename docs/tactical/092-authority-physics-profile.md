# Authority physics profile

Status: complete, 2026-10-10.
Owner: [performance](../topics/performance.md).

After 091, the user authorized profiling ground-support and collision work and
asked what “whole walking ticks” means. This slice measures the remaining cost and
selects a bounded next optimization; it changes diagnostics only, not runtime physics.

## Measurement boundary

A whole walking tick is one `GameServer.tick` invocation while the benchmark
player holds Right. It includes Realm input-queue simulation, AI, NPC physics,
streaming, gameplay hooks and replication. Main-thread prediction/rendering is
separate. At 60Hz a scheduled update has 16.67ms between deadlines. Tick p95 is the
95th-percentile elapsed duration of these invocations, not the sum of phase p95s.
Elapsed timings can include preemption/GC; they are not a thread CPU-time census.

The older “physics” label times only `EntityManager.update`, not all player
physics. Ordinary input-driven player simulation runs earlier inside Realm.tick
and skips the corresponding EntityManager player step. The new probe measures
that input phase separately and labels the rarely used EntityManager player pass
as passive movement. This explains why its player-movement time can be tiny while
the user is walking. It does not remove player movement from the whole tick.

## Probe

`mobile-authority.mjs --physics-profile=true --worker-cpu=true` adds optional
fail-closed source transforms inside its isolated Vite server. They time NPC
movement, ground tracking, both index refreshes, separation, attachments,
animation, Realm input processing and passive player jump/support. Native query
wrappers count prop/entity candidate arrays by phase; NPC resolution counts
separate zero displacement from movement. The default probe has neither deep
phase instrumentation nor CPU sampling.

`worker-cpu.mjs` attaches only to the uniquely matching owned authority Worker,
samples at 1,000µs and detaches afterward. Raw CPU profiles stay temporary; the
sanitized summaries retain relative source names and self/inclusive sampled time.
Inclusive rows overlap and must not be added. Their line numbers refer to Vite's
transformed code. Timings are read before stopping/exporting the profiler, because
export can pause the Worker and otherwise contaminate the last timing sample.
Counters reset after debugger attachment. Sampling and query wrappers still add
overhead/allocation; compare separate shallow controls for ordinary timing.

The production source is a frozen archive of commit `54ffc80`, with the same
regional thicket seed 2026/dog clearing, native Worker/Canvas/IndexedDB and keyboard
Right control as 091. Concurrent server-recovery/touch changes are excluded. The
archive is temporary and is not a Git worktree. Two-second warmup, 15-second main
sampling window; setup/readout remain approximate boundaries across async CDP.
Physical Pixel 7a/Android 17, native Chrome, charging, no CPU throttle. Phone app,
owned tabs/origin and USB routes are restored/released afterward.

An eight-second desktop smoke verifies the diagnostic path. Initial phone CPU
captures revealed the export contamination and a missing counter in readout;
they are exploratory and excluded from acceptance. The final accepted profile is
one idle and one walking capture, supported by two separate shallow controls per
motion. Shallow controls used earlier diagnostic readout/setup code with identical
production runtime. This is attribution, not an optimization comparison.
[Sanitized evidence](../benchmarks/092-authority-physics-profile.json) records six
accepted samples and source hashes; raw stacks remain local.

## Results

| Phase | Idle p95 / mean | Walking p95 / mean |
| --- | --- | --- |
| Whole tick (deep capture) | 10.2 / 7.59ms | 11.2 / 7.92ms |
| EntityManager total | 2.8 / 1.96ms | 3.8 / 2.59ms |
| NPC movement | 1.8 / 1.17ms | 2.5 / 1.66ms |
| Ground tracking | 0.7 / 0.41ms | 0.8 / 0.49ms |
| Realm player-input phase | 0.8 / 0.27ms | 0.6 / 0.24ms |
| Separation | 0.2 / 0.07ms | 0.2 / 0.08ms |

NPC movement accounts for about 60–64% of EntityManager mean time, ground tracking
about 19–21%. Phase p95s cannot be added to reconstruct tick p95. Whole shallow
controls are 9.5–9.6ms idle and 10.9–11.2ms walking; EntityManager p95 is 2.5–2.6ms
idle and 3.5ms walking. The later deep captures are warmer (28.8–29.5°C versus
27.6–28.6°C for shallow references); all thermal status readings are zero. This
neither establishes sustained thermal behavior nor isolates profiling overhead.

In the accepted walking window, 27,840 of 36,532 NPC collision resolutions (76.2%)
have dx=dy=0; idle is 15,663/20,362 (76.9%). NPC movement performs 73,064 prop queries
returning 925,159 candidates, and 72,524 entity queries returning 322,963 candidates.
Ground tracking instead performs 25,975 of each query, returning 325,373 props and
116,259 entities. Some prop-blocked poses never reach the entity query.

The sampled walking stack attributes about 1.06s inclusively to `resolveCollision`
and 0.304s/0.239s of self time to entity/prop query functions across all phases.
It also identifies interest-demand assembly (0.704s self) and replication/serialization
as remaining costs. These are sampled inclusive/self times with diagnostic overhead,
not expected savings or mutually exclusive tick categories. Query wrappers themselves
appear prominently in the sample and must not be mistaken for shipped runtime cost.

Both final captures have zero page errors and resimulation error below 0.001px.
Walking advances 612.4px, ending with 241 resident/43 active actors; idle retains
242/22. Movement begins before profiler attachment, so the measured starting point
and distance differ from the 624px shallow controls. Main-frame p95 is 16.7–16.8ms;
there is one >25ms interval in final walking. Tick maxima are 22.8ms idle/43ms
walking, so intermittent hitches and the 4–6ms authority target remain open.

## Selected next slice

First prototype duplicate collision-probe reuse in the NPC movement path.
`resolveCollision` currently tests X and then Y even when both tests refer to the
same footprint. Zero-displacement calls alone offer up to 27,840 repeated second
probes in this walking window, about 38% of NPC prop-query calls. Reuse the verdict
within that synchronous resolution while retaining both axis clipping, the blocked
return value and `onWanderBlocked` behavior. A pure/stable-query contract must be
verified; a generic callback can have side effects. Preserve candidate/body order,
RNG, terrain/water/elevation policy, attachments and saved state.

Use an original/optimized oracle for blocked zero moves, one-axis travel, airborne
momentum, aquatic bodies, contacts and attachment groups, then native phone controls.
This opportunity is smaller than introducing a persistent ground-support cache with
terrain/prop/moving-roof invalidation. No collision fast path is implemented here.
A finer spatial index and incremental interest-demand assembly remain later candidates.

## Validation

The eight-second desktop smoke and final native phone captures exercise real
Worker startup, optional source transforms, exact Worker target selection, profile
start/stop/export and cleanup. Default shallow captures exercise the unchanged
production policy. All three typechecks, 2,192 unit tests in 232 files and lint
pass (118 existing warnings/34 infos). These standard checks exercise the combined
checkout including concurrent recovery/touch changes; the timing probes use the
frozen production revision. No shipped engine/render/input behavior changes, so
full browser/build/streaming gates from 091 are retained rather than repeated.
Phone foreground restoration and exact runtime/diagnostic hashes are verified.
No production source, inventory, immutable art or approval event changes.
