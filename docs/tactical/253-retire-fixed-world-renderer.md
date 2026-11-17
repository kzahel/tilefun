# Retire fixed world rendering

Owner: renderer-unification. Authorized 2026-11-17 after the paired software-WebGL investigation.

The unified scene becomes the only interactive world renderer. Keep shared terrain
rasters, page atlases, vehicle body images and the immutable review raster.

- [x] Move software WebGL and ordinary browser tests to unified drawing.
- [x] Move room/grid labs, editing with a first-person seat and the prop editor.
- [x] Move explorer tiles and the terrain blend study to unified scene previews.
- [x] Replace fixed-pass assertions with shared/unified presentation diagnostics.
- [x] Replace loading/failure/context-loss fallback drawing with explicit frames.
- [x] Retire fixed-only renderer probes, parity captures and world drawing passes.
- [ ] Validate affected native/browser contracts and hosted Linux; update the topic inventory.

Validation uses pinned Node 24, isolated local data and bundled Chromium. Render
changes refresh the catalog then manifest before production/browser checks.
Hosted validation must exercise the changed revision without deploying it merely
to run tests. Record exact checks and remaining limits here as slices complete.

## Local migration checkpoint

The fixed GPU quad batch, world target/composition, deferred shadows, decals,
renderer lab, fixed-only probes and parity/film scripts are removed. Shared
resources are named `GpuRenderResources` and `GpuSceneSurface`; no interactive
GPU adapter extends `RasterRenderBackend`. That base and its native review
adapter retain the immutable approval contract.

The first focused browser pass passed 39 of 40 cases. It exposed explicit
Lower-level visibility being treated as opaque; hidden slabs now disable their
materials so they cannot write depth. The room pass exposed anonymous fixture
IDs losing furniture metadata. A shared `scenarioPropType` map restores those
art anchors without changing recipe/physics identities. Supported room objects
share their parent's sort row, and supported actor cards move along the top-down
view ray to their collected sort row without moving any pixels. The existing
full-body-on-bed pixel check now passes with the accepted crisp grid.

Current local evidence: typechecks, repository lint/Knip/health, 74 focused native
cases, 26 card/view cases, the production build and 2,130 exact review pixel
identities pass. The first room follow-up passed 13 of 14; its remaining bed
regression then passed separately after the depth correction. Broad native and
browser validation and hosted Linux are in progress. The broad native run passed
5,614 cases and found two fixed-pass expectations; the three affected tests pass
after migration, and Node integration passes. The streaming readiness assertion
passes cold/standing/walk/sprint/reverse/zoom with zero final missing, incomplete
or stale chunks (`/tmp/tilefun-retire-streaming/report.json`). Explorer now retains
one world handle, drains bounded scene builds/uploads and counts actual ground
pages; the desktop check completes with all nine visible ready chunks drawn.

The first broad browser attempt started before the production build exited. Its
temporary 404s and cached stale review controls invalidate that run as a suite
qualification. Restart against a completed, stable build; do not count it as
renderer regression evidence.

The ratchet baseline drops deleted modules and tightens the now-smaller view,
explorer, editor and vehicle modules; its 600-line/25-complexity thresholds stay.
Two unchanged files (`FirstPersonFaces` and `FirstPersonProps`) record already
committed parity repairs that predate this task. New view code shrinks from the
original baseline (901 to 880 lines, worst complexity 32 to 29); new room helpers
are separate bounded modules. Explorer adds one diagnostic dataset line (797 to
798 lines); its preview shrinks from 429/45 to 406/32 (lines/complexity).

## Hosted Linux checkpoint

Exact implementation revision: `c7b1c0ff7b11b6d77c8cf258669fb982d71983e4`.
[CI run 44059383502](https://github.com/kzahel/tilefun/actions/runs/44059383502)
passed on Ubuntu from `workflow_dispatch` using the temporary validation ref
`codex/renderer-retirement-20261117`; deployment was skipped and main was not pushed.
All 477 native files / 5,616 cases, eleven Worker cases, one Node integration,
three HTTP integration cases, twelve software-WebGL browser smoke cases, raster
verification, lint/Knip/health, typechecks, audits and production build passed.
The smoke asserts an actual unified world frame, so green is not an empty canvas.

Additional local captures inspected the shared terrain blend preview (pond) and
prop editor entered from an FPS seat. Both render correctly with no page errors.
The full stable-build browser suite remains in progress; record its final result
before closing the retirement slice.

## Broad browser result and cutaway correction

The stable `c7b1c0ff` build completed 539 browser cases in 13.1 minutes: 536
passed, one deer locomotion case passed on retry, and two failed. The cutaway
pixel oracle exposed real grid ownership: overhead grid lines were in the
ordinary merged grid, so Lower left them drawn and Auto blended them separately
from the slab. Each overhead deck now owns depth-writing grid lines with the
finished grid-on-surface colour, drawn first with its slab's opacity. The slab
then fails depth at those pixels, blending the group once. Explicit All/Upper/
Lower clears automatic fades and applies the requested level immediately.
The original full RGBA blend assertion remains unchanged and passes. Forty-three
focused native cases and all thirteen geometry/furniture browser cases pass.
The smaller view is now 828 lines, worst complexity 27.

The other failure was standalone startup: an orphaned Node 25 test process
(parent PID 1) held port 4196 with a `tilefun-workshop-standalone-*` temporary
SQLite database. Its occupied port prevented the new test server listening.
That confirmed test orphan was stopped; no player server was stopped. The
standalone check passed in 6.2 seconds after removing the orphan, without changing
its deadline or assertions. Graceful termination had stalled on its test database;
force-stopping that confirmed orphan released the port.

Render inventories and the completed production build were refreshed after the
cutaway fix; all 2,130 registered pixel fingerprints remain identical. Hosted CI will be repeated on the corrected revision. The other 537 browser cases exercised the
migration commit; the correction changes only overhead deck presentation and is
covered by the focused geometry/furniture rerun, rather than another full suite.
