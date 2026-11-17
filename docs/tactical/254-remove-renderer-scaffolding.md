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
- [ ] Verify unchanged review identities, focused browser boundaries, streaming
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
Final hosted qualification is pending on the cleanup commit, without deploying.
