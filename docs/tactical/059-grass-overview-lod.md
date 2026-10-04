# 059: Grass overview LOD

Status: complete (2026-10-04); phone timing unavailable at the thermal gate. Owner: [performance](../topics/performance.md).

Implement the agreed final small performance slice, then defer further engine
optimization until ordinary play or new features justify it. This supersedes
055's proposed immediate cached-sort follow-up.

## Plan and contracts

- Full blade detail at zoom >=0.5; smooth opacity transition between 0.25 and
  0.5; no individual blades at <=0.25. Base grass terrain remains unchanged.
- One presentation policy in the shared scene collector. Below the cutoff do
  not visit blade placements, compute animation/push, create items or sort/draw
  them. Clear grass frame storage when inactive, as for missing grass assets.
- Carry opacity as neutral scene data. Native Canvas and GPU use the common
  raster drawing code; other sprite/particle alpha and grass ordering stay intact.
- Gameplay and outdoor embedded hosts use this same collector. Indoor and
  grass-free diagnostic hosts keep their explicit policy. No generation, asset
  pixels, approved reference snapshots or renderer/pacing defaults change.
- Verify cutoff/no-work, fade/re-entry and pooled alpha reset with deterministic
  checks; inspect Canvas/GPU transition rendering. Measure matched overview
  movement, and run all required checks before committing.

This changes distant gameplay presentation deliberately; it does not claim a
cure for all frame stutters. Further sorting, instancing and engine migration
are deferred after this slice.

## Implementation and focused checks

The shared collector computes smoothstep opacity once per frame. It clears its
blade frame and bypasses blade placement, animation/push, item creation and sort
participation at <=0.25. Grass opacity is optional scalar scene data, consumed
inside the existing save/restore in the common Canvas/GPU drawing adapter. Full
detail resets pooled alpha to undefined; the pre-existing full-detail drawing
path remains unchanged. Both game and `ScenarioPresentationHost` use it.

Cutoff/fade tests cover no chunk lookup below the threshold, storage release,
pooled opacity reset, unpooled parity, chunk edits while hidden and restored full
detail. The monotonic fade has exact 0/1 endpoints and 0.5 opacity at 0.375×. It follows
zoom rather than elapsed time; preset jumps apply their target detail immediately.
The new browser fixture uses the actual blade sheet, shared collector and both
backends, plus opaque sprite/particle controls. Fixed blade angles and fixed
projection isolate opacity parity; actual-zoom screenshots are inspected too.
Full-opacity tests exposed existing Canvas/WebGL nearest-neighbor differences at
fractional scales and rotated blade edges. The new opacity test does not claim
to fix those sampling differences. No reference screenshots were regenerated.

The Pixel was available, but the <=31°C/status-zero entry gate timed out after
120 seconds at 32.6–32.7°C/status zero. No phone movement was measured; a second
backend run was not attempted under the same thermal condition. Mac comparisons
will exclude concurrent validation in this shared checkout.


## Movement results

[Six Mac cases](../benchmarks/059-grass-lod.md) pass readiness/recovery with no
page errors. At 0.1×, Canvas render CPU p95 is 47.4 → 1.6 ms and GPU is
9.4 → 1.6 ms. Frame p95 is 50.5 → 9.2 ms Canvas and 16.6 → 9.1 ms GPU.
Both after runs have zero calibrated slow intervals during 20 seconds of noclip
sprinting. The 1× after controls retain full grass and measure 0.5 ms render CPU
p95 on both backends, also without slow intervals. Runs use headed bundled
Chromium, a fresh same-seed world per case, faster fill, and no concurrent
build/test suites during retained Mac timings. Other surface-cutaway work landed
between observations; it is outside this outdoor fixture. These are sequential
observations, not randomized trials or proof that every kind of stutter is fixed.

This is a visual detail policy improvement: distant blades are deliberately
omitted. Base terrain remains visible, as inspected in the real-game overview
capture. No phone performance claim is made because its thermal gate failed.
The ordinary streaming readiness check also passes.


## Completion

Implementation: `3d787c6`. Typechecks, 1,505 unit tests across 178 files, lint
(115 existing warnings / 32 infos), catalog generation, 558-candidate manifest
verification and production build pass. All 334 browser tests pass, including
LOD fade/re-entry, GPU context recovery and switching, and the shared Traffic,
Character, Outdoor/World Geometry and indoor presentation hosts. The existing
streaming readiness runner and all six retained Mac measurement cases pass.
Raw reports and diagnostic screenshots remain local; committed measurement
summaries are allowlisted. The Pixel attempt remains explicitly unmeasured.

Owned test browsers, tabs and servers exited; temporary Android ports were
removed. Concurrent surface-cutaway/family-review work was preserved. Full-detail
asset appearance and production renderer/pacing defaults are unchanged.

Stop here for now. Further collection/sorting, instancing and hitch work are
recorded as deferred in the owning topic. Resume for a visible ordinary-play
problem, sustained mobile heat/battery concerns, or new feature load—not merely
because profiling can identify another hot function.
