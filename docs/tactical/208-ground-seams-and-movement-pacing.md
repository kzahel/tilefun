# Ground seams and movement pacing

Status: implementation/native and diagnostic qualification complete; production delivery pending.
Updated: 2026-11-03.

Owner request: fix the 207 terrain bob and investigate running/driving pacing
blips seen on a phone. Preserve ordinary game/Worker/P2P and embedded lab ownership;
retain one physics step and bounded replay. Both configured Android test phones
were offline. Physical-phone/browser confirmation remains outstanding.

## Terrain contact geometry

Sections cache canonical solid descriptors. One static Rapier Compound joins the
retained parts with `CompoundFlags.FIX_INTERNAL_EDGES`; the existing geometry
version/residency checks determine when its shape changes. Static collider identity
is retained through shape replacement; actor bodies/motors are unchanged. This
uses the engine's normal constraints rather than height masking, a contact hook,
or a second collision resolver. Solid volume, cliffs, ramp slopes, deck undersides
and spawn queries remain. Removed the compiler's unused one-way/water result maps.

207's player/dog crossing reproduction now stays within 0.02px, instead of the
0.59px lift. Sampled cardinal/glancing car/dog pushes show no upward bob. New
regressions cover actual crossing/pushing/support, no rebuild at rest, solid-volume
queries and walking off a real cliff. Existing jumps, head support, sleep/edit,
garage/bridge/save and numerical replay cases pass. Welded compound parts sometimes
retain near-zero geometric contacts without per-part solver points in Rapier
0.21; static support classification admits those resting contacts, while rejecting
distant speculative contacts and separating jump motion.

The aggregate is rebuilt when any retained geometry changes, not every step.
Read-only diagnostics expose part count, aggregate rebuild count and last cost.
Native flat geometry takes roughly 0.3–1.7ms to prepare; deliberately fragmented
1,536–2,304-part checkerboards take 16–26ms. This is a remaining cold/edit cost,
higher than the old independent-box probe's full rebuild ticks (roughly 4–12ms).
Ordinary sampled Worker scenes had 12–28 parts and last-build costs of 0.2–0.9ms;
the earlier arrival scene had 291 parts/3.2ms. These are desktop probes, not a
Chromebook/phone speedup claim. Profile incremental aggregate updates for complex
edited terrain if device traces expose rebuild tails; do not undo seam correctness.

## Presentation pacing reproduction and fixes

The ordinary GPU game with meshes, CDP touch input and Chromium CPU rate 4 retained
16.8ms frame p99 while moving. Its camera clock could regress or nearly stop after
physics rebase: the follow routine correctly rejected those timestamps and visibly
held the camera while the player moved. Across the captured walk/sprint stages,
there were seven such held-camera samples before the fix and zero afterward.
Camera follow now consumes the supplied monotonic render time; numerical physics
ticks still own simulation/replay and contact membership.

A native zero-replay acknowledgement reproduced a separate 0.8px discontinuity
at alpha 0.25 despite matching current positions. Restoring only the current pose
collapsed the interpolation interval. Numerical states now retain previous XYZ;
the wire sends three float32 displacements from the current float64 pose (12
additional bytes/body), preserving precision without another absolute XYZ triplet.
Teleport admission resets previous pose; normal fixed ticks and restore preserve
it. Frame tag is 0x0e; endpoints need matching builds. Driving acknowledgement
coverage checks the rendered car pose as well as authority/seat convergence.

Under a constrained replay slice, presentation also switched from committed
prediction to older buffered actors. It now holds the last committed local
presentation component until replay completes; unrelated actors remain buffered.
No partially replayed contact graph is presented. Existing replay time/step/history
bounds remain; a slow device can still show a short hold rather than a backwards
swap. A native sliced-replay regression checks this boundary.

`streaming:bench --frame-timeline` now records actual presented XYZ, camera pose,
camera time, alpha, acknowledgements and correction data alongside frame times.
Scenario diagnostics expose camera time and prediction metrics for driving traces.
The car-bridge diagnostic uses normal Worker control/rendering at 844x390/DPR2
and CPU rate 4. A browser-only control reinstates the old three presentation
behaviors; it is not a retained runtime backend. The final paired sample has two
held-camera samples in the control and zero in the fixed lane, no backwards car
samples in either, and two short car holds in the fixed lane. Frame p99 remains
16.8ms. These short captures do not establish that every handset pacing issue is
fixed; physical-phone confirmation and heavy-scene/frame-tail profiling remain.

[Bounded numerical evidence](../benchmarks/208-ground-and-movement-pacing.json)
records both game captures, driving control and geometry costs. Raw local timelines
contain runtime state and remain outside Git. Main-game before/after both include
the welded geometry prototype, isolating presentation changes; page CPU throttling
does not reproduce a physical handset's CPU/GPU/thermal limits.

## Qualification

107 focused native checks in eight files and focused lint pass. All TypeScript
projects, updated inventories/build, affected production browser boundaries and
the final streaming readiness check must pass before development readiness.
Commit implementation first, then delivery evidence/inventories and mark ready last.
