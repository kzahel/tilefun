# 108: Drive the authored blue car in the game

Status: complete. Date: 2026-10-11. Owners: [3D assets](../topics/3d-assets.md),
[rendering](../topics/rendering-architecture.md).

## Scope and behavior

The owner requested the retained blue compact in ordinary gameplay using existing
controls and physics. Optional **Debug → Renderer → GPU + 3D car** (F3 opens Debug),
or `?renderer=gpu&meshes`, now loads exact `compact-1-v7.glb`. Only
`vehicle-v1:compact-1` selects that versioned body; other cars and Canvas/GPU
sprite modes retain their sprites. Traffic and renderer comparison consume the
same implementation. This is inspection, not a formal art promotion.

The GLB's embedded atlas uses nearest sampling and unlit materials. One inner
asset transform converts GLB +Y-up/-X-forward to game +Z-up/+X-forward; its
world-pixel scale, ground center and tire contacts are authored. Outer entity
orientation, world placement and height still come from shared presentation.
One 128-square local-depth target and one color target provide native-world-pixel
inward silhouette ink before nearest enlargement (192 KiB target storage).
Internal window ink stays in the retained atlas. Neither normal builds nor
runtime loading require Blender.

Shared presentation supplies cosmetic wheel phase from interpolated signed
travel. View-owned IDs survive the temporary render clones supplied by game/lab
state views; absent actors are evicted and world teardown clears the cache.
Stopped positions hold phase; large displacements, clock/visibility gaps reset
the sample rather than adding teleport travel. Each mesh draw applies its absolute
phase, avoiding cross-car leakage from the shared model. Front steering stays
neutral. Gameplay input, simulation, prediction, cardinal collision, roof support
and saves are unchanged.

Loading/failing/disabled models retain exactly one complete sprite. ResourceSlot
fences late completion; model disposal frees unique geometry/material/texture
resources and closes loader ImageBitmaps. Graphics context recovery retains the
same game/Worker. Existing body ordering still resolves whole objects, with
triangle depth only inside each body; arbitrary interpenetration is not supported.
Native sprites contain a painted shadow; the mesh does not add that sprite shadow.

## Validation

Unit coverage checks GLB basis/ground normalization, absolute rigid wheel transforms,
shared-resource disposal, render-clone continuity, independent car phase, removal/ID
reuse, stopped travel and teleport/gap fences without changing entity physics.
Full Chromium checks the actual GLB in renderer comparison, visible yaw changes,
foreground composition, missing-GLB fallback and shared Traffic presentation.
The game test uses seed 2026, arrival tile (212,491), then approaches the native
blue compact on the west street near world (3360,7344). It boards that exact model,
checks 55 loaded parts and changing wheel quaternions, drives to a tap destination,
stops, saves, reloads inside and exits. No test-only vehicle simulation is added.

Visual inspection captures are local: [lab capture](/tmp/tilefun-blue-car-lab.png)
and [game capture](/tmp/tilefun-driving-car-gpu&meshes.png). Retained model bytes are unchanged.
Catalog consumer line references update; the manifest rebuild also changes the
152 source-pinned natural-landscape experiment identities because they include raw
`collectScene` source. All other 609 candidate records, batches and tools are unchanged. No approval is
inferred or copied to those new identities.

Earlier GPU mesh timing captures describe the older projected proxy, not this
55-part/842-triangle asset and silhouette pass. This slice makes no desktop/phone
performance claim.

All three typechecks, 2,371 tests in 245 unit files and lint pass (118 existing
warnings/34 infos). All 544 browser checks pass in 22 minutes, including live
renderer switching, graphics context recovery, shared Traffic resources, native
roof/garage contacts and the new game driving/fallback checks. Catalog generation
retains 245 sheets/1,086 uses; all 761 manifest identities verify in normal full
Chromium at retina scale. Fresh inventory checks and production build pass.
The retained bundle verifier still passes all three exact GLB/source/texture pins.

## Next step

Review the car under the game camera at turns, stops and roof contacts. Qualify
front steering clearance and measure actual desktop/phone mesh costs before
broadening the asset set or changing collision. Continuous physical orientation
and shared authority/prediction OBB response remain a separate implementation.
