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
