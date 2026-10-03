# 033 — Shared terrain placement and remaining consumers

Status: complete. Parent: [022](022-renderer-backend-decoupling.md), remaining R4.
Depends on [032](032-renderer-host-lifecycle.md).

## Inspected coupling and delivery

`TileRenderer.collectTerrainDraws` still mixes cache advancement with placement
policy. Extract a neutral `TerrainFrame` that computes culling, pixel rounding,
seam overscan and resource placements from a view, loaded chunks and resource-ID
lookup. Keep the bounded reusable placement pool there. Separate visible-only
resource preparation (native review/explorer row budgets) from collection; the
normal gameplay halo scheduler retains its current deadlines and priorities.
Partial resources must expire on content/asset change, replacement and disposal.

Migrate explorer, traffic, geometry and native building/district composition to
shared frame submissions and lifecycle operations. Preserve explorer ready-only
terrain, 32-row work budget, source switching, ready-chunk clipping, DPI scaling
and asset arrival. Represent scene clipping as data. New sprite-only assets must
not force unchanged terrain to rebuild; validate an explicit additive update
before using it, while replacements still invalidate resources.

Native character review source bytes are part of approved candidate identities
(`CharacterCandidates` hashes `CharacterTestScene.ts?raw`). Preserve that exact
controller. Keep its Canvas composition adapter, but route the adapter through
the same semantic scene-pass consumer used by the full backend. This is a fixed
Canvas reference surface, not an alternative gameplay presentation pipeline.
Document other native reference adapters with the same narrow rationale. Do not
reopen approvals merely to rename a renderer call.

## Acceptance and validation

A recording resource provider uses the same terrain culling/placement code as
Canvas. Test partial/completed selection, camera movement without static rebuild,
equal-revision replacement, clipping, independent buffers, retention and expiry.
Existing explorer lifecycle, pixel fingerprints, geometry/traffic/scenario and
GPU review tests must pass. Run typechecks, all unit tests and lint; regenerate
catalog/manifest, compare full candidate records, build, full browser checks and
streaming readiness. Review final imports/call sites and record remaining native
composition adapters explicitly. Complete R3/R4 only after their actual gates pass.

## Evidence

- `TerrainFrame` now owns scalar camera projection, culling, seam overscan and
  bounded placement reuse. Visible-only preparation is explicit and gameplay
  halo budgets remain unchanged. Ground resource lookup validates placement.
- Explorer, traffic, outdoor geometry, building/street/district and pattern
  terrain previews now use backend preparation/submission/lifecycle. Explorer
  ready-chunk clips are data; additive sprites preserve prepared terrain.
- Fixed native character composition retains exact source bytes and uses the
  shared scene-pass Canvas consumer. Room reference adapters remain intentional.
- Types, 1,416 unit tests, lint (124 existing warnings/32 infos), regenerated
  catalog/manifest and build pass; all 551 candidate records are unchanged.
  All 293 browser tests pass.
- [Matched placement evidence](../benchmarks/033-shared-terrain.json): identical
  geometry hash and 27,000 draws over 3,000 frames. Sampled allocations decrease
  from 4,528,388 to 1,935,552 bytes (about 57%). This isolated CPU allocation
  probe excludes rasterization/simulation and does not establish phone FPS.
- v4/v10 traversal readiness passes: zero missing-data or incomplete-cache
  samples while standing/walking/sprinting/reversing/zooming. Cold entry retains
  2–3 unfinished-cache frames; timing is not compared during concurrent checks.

