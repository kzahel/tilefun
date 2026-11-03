# Surface-projected cartoon shadows and contact effects

Status: implementation complete; final performance record in progress; owner feel review pending. Authorized 2026-11-03.
Owners: [rendering](../topics/rendering-architecture.md), [world geometry](../topics/world-geometry.md), [embedded labs](../topics/embedded-engine-labs.md).

## Outcome

Keep stylized soft character ovals and oriented rounded vehicle footprints, while
projecting them onto finite terrain, ramps, decks and moving roofs. Split and clip
at receiver boundaries, select the highest valid surface below the caster, and
exclude the caster and overhead floors. Landing dust begins at its real contact
height/normal and can rise independently; ground marks follow their receivers.
Game and embedded presentation share the implementation. No second simulation,
shadow-map renderer, per-particle physics bodies or per-frame GPU readback.

## Implementation

- Read-only spatial receiver queries share authored surface planes and terrain
  excavation semantics. Presented bodies supply transforms. Ready meshes publish
  plain retained triangle data for exact roof receivers; fallbacks use body tops.
- Backend-neutral decal fragments carry clipped world vertices and mask UVs.
  Normal world ordering supports Canvas; GPU batches the same triangles after
  opaque world composition with depth test and no depth writes, before display.
  Three small reusable soft masks cover ovals and rounded rectangles.
- Contact effects use the same receiver query, carry world Z and emit along the
  surface normal. Attached marks use receiver-local coordinates; loose dust
  inherits support velocity and follows its own cosmetic trajectory.
- Keep immutable reference adapters and promoted source art unchanged. Publish
  the playable result through the existing geometry course and shared host.

## Qualification

Native tests own receiver selection, clipping/nonoverlap, ramps/crests, stacked
spaces, tilted/moving roofs, shape transforms and contact-effect lifetimes.
Focused full Chromium covers actual GPU blend/depth, production Worker input,
game/lab delivery, capture and teardown. Measure crowded receiver preparation and
GPU/meshes streaming readiness; use a physical Chromebook if reachable. Record
limits, update topics, commit checkpoints and mark ready only after passing checks.

## Delivered implementation

SurfaceReceivers provides spatially bounded candidate sources, exact planar
clipping with preserved mask UVs, highest-receiver subtraction and excavation
holes. Large static sources use a broad bucket rather than allocating a grid
along their whole length. The retained SurfaceMeshIndex builds once per asset;
queries transform only local candidate triangles. Published receiver data contains
no graphics handles or mutable simulation ownership.

Scene decals retain simple world polygons, plane equations and mask coordinates.
Three small retained masks cover ovals, rounded vehicle footprints and landing
rings. Coplanar pieces group for Canvas clipping. GPU vertices use the existing
20-float batch format; triangle fans use a degenerate second quad triangle, retaining
ordered batching. Screen-space copies last only until world completion; no borrowed
frame arrays survive submission. Depth writes stay off during the late blend.
Non-world overlays finish above it. A per-frame successful mesh-caster set prevents
a second footprint while an instance falls back to its baked sprite shadow. Cached room walls/furniture keep their own
painter ordering and receive inline decals rather than pretending to publish full
3D depth.

A crest pixel check found a one-pixel hole: the cached ramp raster's half-pixel
paint overscan extrapolated a higher depth into the adjoining deck. Surface depth
now clamps at its finite X edges by splitting only the two outer image strips.
This preserves cached color, normal batch stride and local image budgets; it does
not increase decal bias to cover the mismatch. The pixel oracle checks the seam,
correct ramp/deck tint, undarkened overhead slabs, 1,024 protected foreground-sprite
pixels, overlay protection and a native compact roof at 20.20px (rather than its
24px collision proxy).

The contact observer retains an airborne episode through transient missing jump
flags and confirms nearby physical support before emitting. A native/device check
caught false mid-air dust during roof prediction. The physical support plane uses
the existing body dimensions/rotation read-only; the emitted point/normal comes
from visible receiver geometry. Airborne wisps/stomp clouds retain their supplied
birth height. Falling puffs query local surfaces; marks attach to receiver-local
coordinates and expire quickly. Realm changes, scene exit and lab teardown clear
cosmetic state. A genuine support-clearance episode is required before dust:
stationary roof riders do not repeatedly emit when prediction toggles grounded
flags. None of this changes integration, input packets or body forces.

Review: [ramp start](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=car-dynamics&route=ramp&renderer=gpu&meshes#/tool/world-geometry).
Use **ramp** / **roof**, jump in place, then drive over the bridge and tip off the
ledge. The existing pause, model selector, capture and Save/reload remain available.

Qualification: 193 selected native checks across 11 files, all three TypeScript
projects, focused Biome checks (33 files), production build and 2,121
normal-Chromium retina Workshop identities pass. Across the focused browser runs,
34 distinct full-Chromium cases pass: GPU raster/depth/batching, car controls,
paired physics, delayed P2P Worker driving, vehicle geometry and shared apartment.
The final three affected delivery cases pass again after the support-clearance
fix: the GPU pixel oracle, actual ramp/mesh-roof jump/landings and shared apartment
entry/jump/return. An earlier rerun exposed stationary grounded-flag dust; it was
fixed with a native regression rather than extending the fixture timeout.
Delivery/device/performance receipts follow before readiness.
