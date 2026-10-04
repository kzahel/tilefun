# 042 — Optional mesh bodies

Status: complete, 2026-10-04. Parent: [039](039-fixed-view-gpu-parent.md).

Add a neutral optional mesh instance to SpriteItem, an explicit readiness resolver
and a disposable resource slot that rejects stale async publication. Canvas keeps
the sprite alternative. GPU uses the current car proxy as a labelled diagnostic
asset under an explicit meshes option. No artwork or collider promotion.

Render each body into one bounded reusable target using fixed X / (Z-Y) projection,
then composite in the supplied draw order with current clips and opacity. Flush
before reusing the target, isolate depth and restore renderer state. The renderer
comparison lab uses this same body path. Verify anchors, one-body fallback,
occlusion, alpha and recovery; record the source proxy's known visual limitations.

Delivered neutral mesh instances, pure readiness resolution and generation-checked
async ownership. The car body uses the pinned proxy geometry/source, normalized
to +X forward, in one capped 1024² target (depth isolated per body). Shared drawing
selects the complete sprite fallback until ready; the comparison lab exercises
that exact path and verifies rotation, ordering and switching back. The legacy
source-projection lab remains its independent diagnostic adapter; new gameplay
inspection uses RendererLab. Unknown car faces remain explicitly amber.

Typechecks, 1,441 unit tests, unchanged lint warnings, inventories, production
build and all three GPU browser tests passed. Target memory at normal zoom is
1,179,648 estimated bytes; no CPU readback occurs during gameplay mesh rendering.
The lab deliberately reads pixels for comparisons. No artwork was promoted.
