# Physics adapter churn and simplified models

Status: bounded native comparison completed, 2026-11-02; production unchanged.
Owner: [physics engine](../topics/physics-engine.md).
Follow-up to the negative [202 cutover decision](202-persistent-realm-collision-proof.md).

## Question and comparison contract

The owner asked whether copying explains the current cost and whether a simplified
optimized model can distinguish adapter overhead from the underlying physics cost.
The comparison is native first: no Worker transport, AI, replication, prediction or
renderer. It is not a new Chromebook/cutover qualification or a replacement engine.

The current motor passes entity references into temporary lists/maps/sets; it does
not clone the entire scene or copy a snapshot per NPC. Push transactions make
shallow entity/position copies. `characterShape` constructs descriptors, vectors
and rotations even when `PersistentCollisionWorld.actor` keeps an existing
collider. Neighborhood synchronization scans all resident actors for each motor.
Each motor also calls `world.step()` to refresh collision queries. These controlled
colliders have no independent dynamic integration, but the full world pipeline
still runs repeatedly. Small JS/WASM argument/result conversions occur around
queries; the persistent terrain arrays are compiled only on section rebuilds.
This inspection does not measure allocated bytes, GC attribution or copied bytes.

`npx tsx scripts/benchmark-physics-model.ts --output=<capture-directory>` replays
prescribed tick-start positions and 64px/sec intent for ordinary dog box shapes.
It uses the earlier 24/96/384 counts and 24×18px spread grid, plus approaching
pairs initially separated by 0.5px. All bodies are queried every tick. Resetting
starts makes this a common query workload, not a closed-loop animal simulation.
The same persistent section-floor compiler and actor dimensions supply all lanes.

| Lane | What it measures / omits |
| --- | --- |
| Adapter | Real production motor, fine CollisionIndex, support and bounded pushing; no outer Realm/AI/replication |
| Adapter, cached descriptors | Same adapter with a benchmark-local cuboid descriptor factory cache; fixed, unrotated boxes only; final diagnostic endpoints must match the original |
| Lean sequential KCC | Cached handles/shapes, one KCC and endpoint support cast per actor; one world refresh per actor; omits pushing, support identity and special contact policies/callbacks |
| Lean batched KCC | Same simple queries, one world refresh; proposals see tick-start positions and commit afterward; deliberately tests stale-peer consequences |
| Simple rigid bodies | Cached dynamic boxes, locked rotations, gravity, 0.2m soft CCD prediction, one shared world step; no KCC or existing character gameplay policies |

The descriptor-cache ablation is intentionally confined to the benchmark. Mutable
descriptor reuse is safe only for this fixed synchronous fixture; it is not a
production caching API or a general vehicle/shape implementation. The lean models
are simpler algorithms with different semantics, not isolated allocation toggles.

Timings use 40 warmup and 120 measured ticks, three sequential trials, reversed
lane order in trial two. Instrumentation is installed only for one extra warm
diagnostic tick. Nested operation times are not additive and single-tick diagnostic
timings are attribution hints, not benchmark distributions. Endpoint overlap
checks are outside timing and detect XY penetration greater than 0.05px in these
same-height fixtures. They do not establish general 3D contact correctness.

## Results

[Raw capture](../benchmarks/203-physics-models-native.json): Apple M4 Pro,
Node v26.7.0 native execution, 90 cases.
The report records parent source revision `43ea0b26` and dirty=true for the new
benchmark, committed with this record. No production engine source changed.
Ranges below are the minimum/maximum p95 across three trials, milliseconds per
whole microbenchmark tick, not the full Realm or browser authority tick.

| 384 actors | Spread | Approaching pairs |
| --- | ---: | ---: |
| Current adapter | 28.11–29.64 | 37.30–39.06 |
| Adapter, cached descriptors | 30.18–31.22 | 37.92–40.36 |
| Lean sequential KCC | 11.33–12.33 | 13.69–14.31 |
| Lean batched KCC | 2.19–2.34 | 4.57–4.84 (**incorrect contacts**) |
| Simple rigid bodies | 0.33–0.37 | 0.39–0.42 |

The 24/96-actor approaching-pair adapter ranges are 1.13–1.22/5.98–6.81ms;
lean sequential is 0.35–0.50/1.78–1.87ms; simple rigid bodies is
0.030–0.040/0.101–0.104ms. This is not the normal-game workload used in 202.

One warm 384-actor diagnostic tick makes **17,256 descriptor factory requests,
8,436 actor synchronizations and 384 world refreshes** in the adapter. Each
neighborhood synchronization also loops the 384 resident actor entries, about
147,456 visits per tick despite the input's fine spatial query. Existing collider
identities are retained: no actor-shape replacements occur. Descriptor caching
constructs no descriptors during that diagnostic and agrees exactly with the
original adapter's final endpoints in all 18 cohort/layout/trial comparisons,
but is not faster at 96/384. String-key lookup and the other churn remain; this
ablation does not establish that all allocation reduction is useless.

In the approaching-pair diagnostic the adapter performs 1,152 KCC queries and
1,920 endpoint support casts; the lean controllers perform 384 of each. The
performance gap therefore includes **omitted gameplay/contact work**, not just
copying or JS overhead. Per-actor world refresh costs about 9ms in one 384-actor
native diagnostic versus about 0.03ms for one controlled-collider refresh. These
single diagnostic timings are nested and are not distributions to add together.

Naive batched KCC produces 192 overlapping pairs at 384 actors (about 0.433px
penetration), and fails the paired fixture at every tested count/trial. Each actor
independently consumes the shared gap; committing both proposals is invalid.
The simple rigid-body model with soft CCD has no >0.05px endpoint overlaps in
these fixtures, as do the original adapter and lean sequential model. This is one
narrow same-height contact check; it says nothing about head standing, jump ascent,
ramps, moving supports or correction quality. The rigid-body model is repeatedly
reset to prescribed starts, not a stability or emergent pile test.

## Interpretation and next boundary

The current integration is not evidence that a once-per-tick Rapier simulation
must cost 100ms on a Chromebook. Persistent geometry avoids scene reconstruction,
but the motor still repeats neighborhood discovery, descriptor construction,
callback setup and full-world refresh per actor. Removing only descriptor
construction does not solve that architecture. Native cost without Worker
messages also shows that transport copying is not needed to explain this hotspot.
No transferred/copied-byte or GC-allocation profile was captured, so do not claim
those costs are zero or precisely apportioned.

The useful next proof is one tick owner that synchronizes each active body's
pose/intent once, runs one shared contact phase, and commits consistent results.
Retain the anchored, nonrotating player box and the required intentional character
rules. Compare a cached sequential-query controller against a controlled dynamic
NPC model; do not adopt the stale-peer KCC batch merely because it is fast.
Qualify pushing/release, head standing, side jumping, ramps/seams and private
prediction before repeating unchanged normal-game Chromebook workloads from 202.
The simple rigid-body cost is headroom for this design experiment, not a promised
speedup or permission to default-cutover. The negative 202 game gate remains.

Validation: the complete 90-case runner exits successfully with finite poses,
matching descriptor-ablation diagnostic endpoints, expected stale-peer failures,
and no >0.05px overlaps in the other same-height fixtures. The new standalone
script passes Biome and strict TypeScript checking including its imported source.
No browser, asset/build or broad game suite was needed for a diagnostic-only file;
production runtime and prior playable readiness are unchanged.
