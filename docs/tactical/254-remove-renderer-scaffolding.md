# Remove retired renderer scaffolding

Owner: renderer-unification. Authorized 2026-11-17 after 253 completed.

Remove the fixed renderer's remaining runtime/test adapters while preserving
native review pixels, shared terrain/atlas/body-image resources and the unified
scene's top-down/first-person/XR cameras.

- [x] Separate interactive `RenderResources` from `ReviewRenderBackend` passes.
- [x] Delete the headless fixed-world fallback and fixed outdoor/room presenters.
- [x] Remove no-op world/view/flush hooks and the remaining renderer-enable gates.
- [x] Narrow lab presentation to terrain preparation and actual scene inputs.
- [x] Remove padded raster sampling, GPU depth/decal adapters, slab painter order,
  inactive pass variants and their obsolete tests.
- [x] Move the crowd replay to `collectWorldSprites` with an explicit new workload
  contract (`unified-sprites-v1`); refuse comparison with old workloads by default.
  Remove unused receiver-GLB loading and fixed draw-order metrics; scope records
  the actual sprite/pose stage, without GPU or receiver-geometry timing.
- [x] Retire the old surface-shadow comparison and three historical asset GPU
  harnesses that called removed APIs. Current bank checks and scene tests stay.
- [x] Verify unchanged review identities, focused browser boundaries, streaming
  readiness and final production build; record completion evidence.

The review raster retains the exact previously used native sampling branch.
`CachedInteriorRenderer` owns its native review room cache directly; game frame
storage no longer carries unused room content IDs. Review submissions are limited
to the actual clear/terrain/scene protocol, independent of interactive resources.
`RenderHost` owns frame setup, UI, captures and the shared `View3dHost` only.
`FirstPersonControl` chooses cameras; there is no renderer-off/top-down-enable
switch. Graphics loading/loss continues to show UI and clear drawn-camera state.

Initial focused validation passed 164 of 165 cases. The remaining assertion
tried to disable the deleted mode through a stubbed scene and was removed from
its camera/grass test; actual disposal and unavailable-graphics coverage remain.
The broad native run passed all 471 files / 5,585 cases. After the final bounded
review-protocol cleanup, all 58 affected native cases pass. Typechecks, lint,
Knip and the tightened code-health baseline pass; no baseline grew. The four
crowd-benchmark tests pass, including two identical recorded replay outcomes.

Further evidence is recorded below after stable inventories/build and browser
checks complete. Frozen approval images are never rewritten to hide differences.

## Local qualification

All 2,130 candidate IDs and pixel fingerprints are identical to the pre-cleanup
manifest, including verification in normal retina Chromium. Catalog then manifest
were regenerated and the production build completed before browser checks.
Thirty-two focused browser cases passed: mandatory unified drawing/retired links,
GPU host/assets/context recovery/failure/capture, geometry/cutaways, room motion,
furniture/character presentation, embedded resource lifecycle and Explorer
readiness/residency/device-pixel coverage. Five further split-screen and FPS touch
cases passed after the final no-op wrapper removal.

Streaming readiness passes cold, standing, walk, sprint, reverse and zoom-out,
with zero final missing/incomplete/stale terrain in every sample. The four crowd
benchmark checks pass after deleting unused receiver-GLB loading and rechecking
the two deterministic shared-stage outcomes. Lint/Knip/health and all typecheck
projects pass. No new physical-device performance or human approval is claimed.

The historical diagonal layout helper remains a generic layout function; it is
not a selectable gameplay renderer or a world-composition pass. Immutable native
review drawing, UI overlays and shared resource caches remain intentional owners.
Final hosted qualification passed on the cleanup commit, without deploying.

## Final diagnostic audit

The hosted run on `ad4770ef` passed every runtime gate. A final script-only audit
found the old city profiler still wrapping removed `quad`/`flush` methods, its
mesh-target intervention wrapping removed `meshes.draw`, and the movement probe
recording deleted raster coordinates. A short city smoke could not start because
its provenance list references deleted `src/traffic/TrafficSystem.ts`, confirming
the README's existing pre-reset/historical status. The old city harness, profiler
and exclusive course/CPU helpers are retired with the movement probe; no simulation
or traffic policy was changed to resurrect them. Current racetrack attribution,
render/streaming/driving benches and settling captures remain. Historical
measurement records are preserved. This follow-up changes no tested game code.

## Completion — 2026-11-17

[Hosted Linux CI 44069517975](https://github.com/kzahel/tilefun/actions/runs/44069517975)
passed every gate on `ad4770ef8a5154d2012afb1ba39b5e1d05db2dc5`: all native
shards, Worker and Node/HTTP integration, both software-WebGL smoke shards,
immutable raster verification, audits, lint/Knip/health, typechecks and production
build. Deployment was skipped. Local evidence is 5,585 broad native cases,
bounded follow-up cases, four deterministic crowd checks, 37 browser checks
without retries, streaming readiness and unchanged 2,130 review identities.

The final commit retires only stale diagnostic files and updates documentation;
tested game code and assets are unchanged. Final lint/Knip/health and typechecks
pass. Shared runtime resources, native review drawing and current measurement
runners remain. Next is ordinary family/device play review on the one scene.
Mark development ready after committing; main is not pushed or deployed.
