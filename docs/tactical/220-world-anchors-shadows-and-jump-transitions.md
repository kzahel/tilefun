# Anchored resources, ramp shadows and jump transitions

Status: implemented and qualified for owner feel review. Owner feedback 2026-11-04.
Owners: [physics](../topics/physics-engine.md), [prediction](../topics/player-prediction.md),
[rendering](../topics/rendering-architecture.md), [resource behavior](../topics/wildlife-behaviors.md).

## Scope and contracts

- Audit edible plants and other resource markers. Anchored ground supplies/sites
  must stay put; actual carryable loose items retain normal physical interactions.
  Classify authority and replica consistently without requiring private work state.
- Reproduce the vehicle footprint falling through a ramp crest to terrain. Select
  finite receivers using the displayed caster geometry and retain underpass/depth
  behavior. No new art, shadow maps or second collision authority.
- Reproduce display/camera discontinuities as a rider lands on or leaves a train,
  using production prediction, normal buffered presentation and delayed frames.
  Repair timeline/contact handoffs without another movement/carry solver.
- A fresh airborne jump press held through landing queues exactly one jump.
  Release cancels the held request; consuming it cannot auto-repeat indefinitely.
  Queue state must survive ordinary binary replay and clear on explicit relocation.
- Commit qualified checkpoints, update owning docs, run affected native/browser
  boundaries and inventories/build, and mark playable delivery ready.

## Resource and jump queue checkpoint

The editor's Edible plant is a nongrowing `greens` resource. The old rule made
all work items without growth/storage metadata loose, including greens, ground
seeds, nectar and water. Classification now anchors all noncarryable supplies/sites;
only actual carryable resource types become loose. Type identity works on replicas
without private work state. Native coverage audits every forage/source kind and
walks through a planted resource while still physically pushing loose fruit.
Existing moved plants stay at their current saved location; the change stops new
physics displacement rather than inventing an original placement.

The common motor records a fresh airborne press while held. It consumes that
single queue on the next grounded tick, cancels on release/expired controls, and
clears on explicit relocation. Holding the original takeoff press never loops.
Frame 0x14 adds one byte per body for the queue, with malformed-flag rejection.
Native checks restore a queued midflight state through the normal binary frame,
verify one landing jump and exact replay, then release/relocation cancellation.

Both changes keep the one shared world step and ordinary input/prediction owners.
No species art, ledgers or asset approvals change.

## Projection and presentation checkpoint

The screenshot's detached shadow has a root-height failure path: a rotated car's
root can lie below the ramp under its projected footprint. The caster now uses
the upper faces of its displayed rotated bounds, at most three finite quads with
shared mask coordinates. Each clips receivers against its own plane; using one
global maximum would incorrectly shadow an overhead deck above a lower end.
Query height bounds come from actual finite vertices rather than extrapolating
steep planes to AABB corners. Native checks sample both sides of the crest and
preserve low-end underpass behavior; the real GPU probe adds the same tilted case.

Landing reconciliation could choose the newly joined anchor's previous pose even
when an exact same-past-tick comparison existed. It now uses the matching pose;
previous-interval fallback remains only when that comparison is unavailable.
A second fault occurs on alighting: a prescribed group can change from predicted
time to the delayed remote buffer, moving backward roughly 13px in the native
reproduction. The group now retains one bounded display translation and eases it
out over 0.2s. No integration or physics velocity changes. Reset/culling clears
state; large relocations do not create a new correction. The common path does not
copy the full entity array again unless an actual released group needs blending.

A normal generated-service native test delivers frames three ticks late, jumps
and lands, jumps off, then samples two fractions of each tick. It rejects any
backward consist step, oversized forward step and discontinuous rider travel
across the first flight/landing. The production browser flow also records actual
submitted train/camera/player positions while exercising ordinary jump, queued
landing jump, and side alighting through the real Worker/input path.

The first production trace also caught forward train correction steps (about
7.2px instead of its normal 3.2px frame travel) during a rider jump. Prescribed
groups now retain their own matching-tick reconciliation offset, independent of
player contact errors. A landing rider keeps its own residual rather than moving
the train or dropping that residual on contact. Group release includes the
carrier's own current offset before returning to the buffer. The native test now
forces a rejected rider strafe near landing as well as delayed frames; the old
predictor fails, while the separate carrier correction passes.

Camera assertions use the common render timestamp rather than wall time measured
inside a draw call: submission work can vary within a frame. Both clocks are
retained in the browser receipt. The first wall-clock-based camera assertion
failed on variable submission timing; this did not demonstrate a camera fault.

The stricter production trace exposed a separate underlying simulation fault:
private train velocity becomes zero while authority remains 192px/s, exactly when
the leading carriage lacks terrain. Actors/props had a two-chunk replication
buffer but terrain only one. A rear-roof rider can receive the whole consist
without its leading collision context, so unknown terrain blocks private preflight.
Ready terrain now uses at least the existing actor/prop buffer. A native narrow-view
replication regression fails before this change (9 chunks instead of 25) and
checks unchanged deltas, bounded interest, departures and no generation afterward.
This does not expand activation, add a prediction-only collision exception or
change the shared physics step. Carrier correction smoothing is not a substitute
for closing this missing collision context.

## Qualification and delivery

[Portable evidence](../benchmarks/220-anchors-shadows-and-jump-transitions.json)
records source digests, bounded regressions and measurement limits. The final
ordinary Worker keyboard/renderer trace passes jump, queued landing jump and
side alighting. During cruise, maximum train travel residual is about 0.0042px
and camera residual 0.0751px per measured render interval; lateral camera step is
zero. Before widening terrain interest, the otherwise same carrier-correction
implementation reaches 5.91px train residual. Instrumented confirmation finds
zero missing carriage collision corners and zero falsely blocked cruise samples.
These are world-pixel draw measurements on desktop Chromium, not phone evidence.

Focused native checks pass for resource classes, ordinary pushes, one-use queue,
binary codec/replay, receiver clipping, collection, resource work, vehicle/rail
support, presentation and prediction. The final prediction/replication lane is
36 tests. All 24 GPU renderer browser cases pass, including the added crest
pixel probe. The final six-case game/pair/realm/train run passes, including
delayed P2P, the ordinary Worker flow, lab controls and Worker teardown.
All three typechecks, affected lint, catalog, Workshop manifest (2,121 identities
verified in normal Chromium at retina scale), production build and diff checks
pass. The temporary private-predictor browser probe was removed after isolating
the collision-context cause; the retained browser test observes submitted draws.

Final GPU/meshes streaming readiness at 4× CDP CPU passes all six stages with
zero final missing/incomplete/stale terrain, 16.8ms frame p99 throughout, and one
33.3ms maximum on reversal. The wider terrain buffer adds bounded initial payload
and client terrain data; it does not expand activation or out-of-view render
images. This is no matched bandwidth, crowd-performance or physical-device claim.

Ancillary wildlife status refresh was attempted after recording the resource
checkpoint but cannot run because the ignored local campaign progress JSON is
absent (`data/wildlife-campaign-v2/progress.json`). No art/roster status changed,
and no campaign state or approvals were invented.

Next: owner Save and reload, then approach a planted supply, hold a fresh airborne
jump press through landing, and repeat moving-train landing/alighting plus the
ramp crest on the affected device. Co-op endpoints must reload together for
frame 0x14. No live dev-server restart is required.
