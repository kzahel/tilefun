# 156 — Vehicle paints in game

Owner authorization, 2026-10-20: “great make them work in game! proceed. commit.
push when done.” This activates the fourteen exact schemes from
[154's paint study](154-vehicle-paint-study.md) without altering its frozen bytes
or synthesizing formal Workshop approvals.

## Delivered behavior

Edit → Vehicles offers a sticky paint-swatch bar for Beetle, pickup and sports
coupe. Selection controls the next placement and its ghost; Original preserves
the original palette. The Traffic lab offers the same catalog through normal
shared authority. Model counts, bounds, handling and base GLBs stay unchanged.

Authority validates a model-scoped `paintSchemeId`, persists it in traffic records
and replicates it through baseline/delta snapshots and mount prediction. Missing
old fields mean original paint. Invalid requests/records are rejected before
publication/restoration. Ordinary road population selects stable weighted colors
once from the generated identity; saved cars never reroll.

The GPU renderer keeps one base mesh asset per family and lazily caches requested
512² atlases. It changes existing material maps during each synchronous draw and
restores them afterward. It creates no new geometry/material object per scheme.
Frame-boundary publication, late-load cleanup and disposal use ResourceSlot.
Complete matching sprite sheets cover Canvas, disabled/loading/failed meshes and
failed paint textures. The existing native fallback registration is unchanged.

Frames now use tag 0x05, with an optional baseline paint byte at bit 17 and nullable
delta byte at bit 18. All endpoints must update together; older 0x04 is rejected.
The wire dictionary is append-only. [Paint instructions](../vehicle-paint-variants.md)
own the reusable source/runtime process and cache/memory contract.

## Validation

- Fourteen atlases and fourteen cardinal sheets are packaged from exact frozen
  sources with a retained deterministic export receipt. No build regeneration.
- Three runtime base meshes plus fourteen external textures reproduce all 672
  reviewed RGBA frames exactly. Mesh, geometry and material object identities stay
  unchanged across palettes, and original-paint reset is exact.
- All fourteen schemes pass normal authority placement and durable reload.
  Two independent clients receive original/painted/cleared snapshots and reconnect
  baselines through RealmReplicator and the binary codec.
- Three live generated-road selector tests admit a non-default owned paint for
  each family through the ordinary population path. Twelve focused paint tests pass.
- The full bounded Windows unit run has 6,045 passes, five known platform failures
  and ten skips (6,060 tests, 340 files, 503s); the three natural-paint tests were
  added afterward and pass separately. FsSecurity/privateDataPlugin symlink
  privileges and SQLite SIGKILL account for the same prior platform failures;
  staticFiles setup/cleanup has the existing symlink failure and ten skips.
- Twenty-one combined browser cases pass: every shared GPU palette, all three
  families' mesh/atlas failures, mobile editor placement/reopen in Canvas and GPU,
  original coupe registration, placement/driving and the frozen study UI.
- Twelve subsequent driving cases pass, including all six painted mobile-editor
  cases extended to board, drive with the predicted paint and reopen while seated;
  existing car controls/contact and four renderer variants also pass.
- GPU-with-meshes streaming `--assert-ready` passes: no browser errors and no
  missing/incomplete visible terrain during walk, sprint or reverse. This is a
  bounded desktop readiness check, not a physical-phone pacing claim.
- All three typechecks, build and lint pass (120 existing warnings, 37 infos).
  Inventories contain 681 sheets / 1,392 source uses and verify 1,840 Workshop
  identities in normal Chromium at retina scale.
- Replaying only staged Git inputs verifies 101 input hashes, all 29 output hashes
  and the exact export receipt. The frozen paint-study verifier still passes;
  original geometry and reviewed pixels remain unchanged.

Final evidence is recorded under `art-source/vehicle-bake/paint-runtime/validation-156.json`.
Raw captures, logs, browser/auth files and replay workspaces remain ignored in `data/`.

## Next

Extend curated schemes to additional original families using explicit owned paint
regions, while retaining one normal vehicle definition per geometry.
