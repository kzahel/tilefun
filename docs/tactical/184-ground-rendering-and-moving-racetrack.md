# 184 · Ground rendering and moving racetrack

Status: implemented and qualified on native Pixel 7a · 2026-10-22.
Owners: [rendering architecture](../topics/rendering-architecture.md),
[performance](../topics/performance.md).

The owner authorizes the ground-pattern guardrails and investigation/fixes for
noticeable driving slowdown through the infield and around the circuit. Cover
moving cameras, including walking; stationary overview acceptance is insufficient.

## Scope and initial finding

- Require explicit terrain/object destinations in mixed authored ground patterns.
  Ground stays in ordinary cached chunks, with content/lifecycle invalidation;
  source image sheets remain supported. Elevated structures keep correct ordering.
- Extend the existing real Worker/IndexedDB diagnostic with actual depot/circuit
  vehicle selection and native steering. The older street-driving control could
  leave the venue. Retain motion and source-upload attribution separately from
  clean timing, with owned physical-device routes/tabs and thermal gates.
- A desktop moving circuit census finds three full-viewport bridge overlay uploads
  per frame: about 2.8 GB in twelve seconds at 411×789. Surface presentation also
  submits every actor separately, breaking the ordered texture batches delivered
  in 180. This census attributes work; native timing is recorded below.
- Coalesce adjacent scene runs without changing order. Rasterize elevated surface
  geometry into bounded local images, reuse unchanged imagery across integer
  camera translations, and cull invisible surfaces. Keep ordinary terrain and
  authority unchanged; share the game and embedded-host rendering path.

## Validation plan

Use existing Node ordering, native terrain-cache and ground compilation coverage
for ownership/invalidation. Add focused regressions for the failure boundaries.
Use full bundled Chromium only for crop/cache pixel equivalence, GPU uploads,
context recovery and affected game/lab presentation. Run required typechecks,
unit/Node integration, lint, inventories/build, browser suite and GPU streaming
readiness. Compare cold-phone native controls sequentially, without validation
or deep profiling during timing; retain displacement, readiness and thermal limits.

## Implementation and acceptance

`ParkingPiece.layer` is required at authoring. The terrain compiler and object
reconstructor select that metadata rather than English labels; cell IDs, object
IDs and source rectangles stay unchanged. The manifest's three static parking
render fingerprints match the previous source exactly. Explicit source revisions
and the affected excluded engine identities refresh normally; no bank is promoted.

`presentSurfaceScene` keeps the previous topological slab order and actor/shadow
pairs, but borrows one reusable draw-order run until the next surface boundary.
The headless ordering regression compares the complete flattened sequence and
limits the number of scene runs. Canvas and GPU consume the same semantic passes.

The GPU backend owns the new local rect/line surface images. Integer crop origins
and rebased commands preserve raster phase. Geometry/styles and fractional phase
changes invalidate; integer pans reuse. Entirely invisible surface images are
culled. LRU residency is 32 images / 8 MiB of raster data. Explicit source release
drains queued quads before disposing texture pages. Assets, realm clear, recovery
and disposal retire these resources; no graphics objects enter world/scene data.
Other overlay kinds and oversized images retain the general compatibility path.

Desktop and native phone each pass **18 cache-versus-rebuilt exact RGBA pairs**.
Against the old full-screen path, Skia AA rounding differs by at most **2/1 channel
values**, respectively. This uses the existing overlay reference allowance;
no existing test tolerance is changed. Qualification includes integer/fractional
movement, four zooms, geometry edits, invalidation/recovery, culling, eviction
and realm reset. The focused production-browser regression also requires zero
warm-pan uploads/builds across three independent surface passes.

The first native circuit controls reproduce **21.67 → 54.55 FPS**. The final
opposite-order source-verified repeat measures **19.40 original / 54.46 current**,
with 66.8 → 33.3ms frame p95. These are twenty-second fresh-world samples after
eight-second warmups, native touch steering and no viewport/CPU emulation.
Both repeat boundaries have thermal status zero (26.6–26.9°C). Original/current
native populations differ slightly with normal admission/traffic, so this is not
an exact actor-state or marginal simulation-cost comparison. Authority remains
about 60Hz; all accepted page-error lists are empty.

The cooled infield driving pair measures **19.39 → 52.68 FPS**. Both cases move
throughout the sixteen-second capture, including a native reverse at eight
seconds, with thermal status zero at 26.0–26.1°C. The old renderer uses about
244 raster draw calls per frame versus 32 current, and uploads about 1,193 MiB
versus 25.5 MiB over the sample. The opposite-order circuit pair uses about
177 → 30 raster calls per frame and 1,530 → 71.9 MiB of source uploads.

At the ordinary close-up zoom, infield driving and walking/reverse each measure
about **59 FPS**, with frame p95 16.8ms and no sampled terrain debt. These are
sixteen-second native controls with ordinary collision and a real game Worker.
The exploratory old depot sample measures 17.13 FPS; a following current case
ends at thermal status one (27.9°C) and is excluded. A later cruise setup rejects
its thermal preflight before any timed sample. Neither contributes accepted timing.

A sixty-second **continuously moving** circuit lap at normal zoom measures
**59.41 FPS**, frame p95 16.8ms, about 5,598px of sampled travel, and no sampled
terrain debt. It uses ordinary analog throttle 0.6 to stay below native racer
speed, rather than changing traffic or collision. Every full motion interval
advances more than one pixel. Its boundaries are 28.5 → 28.3°C, thermal status
zero. This is a different input workload from the full-throttle gain comparisons.
The following sixty-second wide analog lap also keeps moving, but ends at thermal
status one (28.5°C); its timing is excluded. Sustained wide-view thermal/power
acceptance is not established.

The forty-second close-up and sixty-second wide full-throttle circuit captures
average 59.41 and 54.08 FPS, respectively, but encounter racers and stop during
their tails. They characterize mixed moving/stationary work, not continuous
driving for their full duration. The twenty-second matched circuit repeat and
cooled sixteen-second infield pair contain no stopped full motion intervals.
The current wide circuit repeat samples ten stale chunk observations; the longer
mixed wide case samples sixteen stale and one incomplete observation. Neither
samples a missing chunk. These once-per-second observations are not an every-frame
no-holes guarantee. Further wide-view pacing/readiness work remains separate.

All client/server/Worker typechecks, **6,715 units across 373 files**, Node visual
integration, lint (existing 121 warnings / 42 infos), catalog/manifest and build
pass. The GPU + meshes streaming gate passes cold, standing, walk, sprint, reverse
and zoom-out, with zero missing/incomplete/stale frames and no errors/failures.
These readiness checks are separate from phone pacing. The complete browser suite
passes **836/836** in 36.3 minutes, including the previously intermittent transporter
reload assertion. No simulation or test tolerance changed.

Commit integration: rebase over audio commits `2613be1c` and `1ba5b75c` preserves
both audio records and renumbers this tactical from 182 to 184. Conflicts are
limited to the tactical index and generated manifest digest; no runtime rendering
code conflicts. Regenerated catalog/manifest, all typechecks, lint, build, six
terrain/ordering unit checks and all twenty GPU browser checks pass on the combined
tree. The full-suite and physical-device measurements above precede this rebase;
the receipt retains their original base and source hashes.

The [sanitized receipt](../benchmarks/ground-rendering-moving-racetrack.json)
owns case/source/probe hashes, accepted metrics, limits and thermal exclusions.
The public server is verified to serve the new backend/cache, coalesced surface
submission and explicit parking-layer metadata. A game reload picks them up;
existing terrain does not need regeneration for this renderer fix.

All seven original Chrome tab IDs/URLs are preserved; owned test pages/workers
are closed. Only task-owned USB routes and the CDP relay are removed, preserving
original routes and leaving the handset at Home. The isolated test origins are
cleared; original-origin storage APIs are not used. Original saves are not audited
for byte identity. Device selectors and raw route/target inventories remain local.

Next: reload and playtest the owner's location. If wide-view spikes remain
noticeable, profile terrain publication and remaining render cost on that exact
route; the current evidence does not justify changing simulation cadence.
