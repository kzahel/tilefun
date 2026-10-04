# 044 — GPU integration and lifecycle

Status: complete, 2026-10-04. Parent: [039](039-fixed-view-gpu-parent.md).

Exercise all shared passes and resource transitions. Add actual context-loss tests,
retained-resource tests, edited raster invalidation and warm/cold comparisons.
Run the full existing browser suite without changing approved snapshots. Expand
the comparison lab with shared interior content and overlays. Keep its deterministic
readback diagnostics separate from runtime GPU rendering.

Audit borrowed frame consumption, target reuse, source image lifetime and source
replacement. Bound caches and remove avoidable allocations in new hot paths.
Validate setup failure leaves Canvas usable, teardown is idempotent, and context
restoration rebuilds graphics from CPU assets. No default switch in this slice.

## Delivered evidence

All 296 browser tests pass, including real WebGL context loss/restoration with
unchanged player identity, Worker gameplay input, shared traffic mesh rendering,
interior/editor passes and composed world/UI feedback capture. Typechecks,
1,444 unit tests, lint, catalog/manifest generation and production build pass.
Existing lint warnings remain; approved candidate identities are unchanged.

The lab compares actual compact-car fallback artwork against the shared mesh
adapter. A neutral asset transform registers the proxy to the sprite ground
anchor (the prior source origins differed by four pixels), with a landmark test.
Smooth shadows rasterize at final screen resolution: maximum channel difference
one at zoom 0.5, 1 and 1.5. Interior fixture pixels match exactly; editor text has
three pixels differing by two due to the additional 8-bit alpha composition.
The original exact sprite baseline remains exact.

Texture pages use a 64 MiB soft residency budget and retire cold pages; current
working sets may exceed that budget. One reusable mesh target is capped at
1024² pixels. Overlay commands are copied into owned storage before retention;
unchanged overlays avoid uploads. Device restoration rebuilds resources from CPU
assets, and feedback capture explicitly composes the GPU world and original UI.
No reconstructed artwork approval or production-default change is implied.
