# 040 — GPU compatibility baseline

Status: complete, 2026-10-04. Parent: [039](039-fixed-view-gpu-parent.md).

Pin the current projection as pure shared arithmetic and check known ground and
height landmarks, zoom, viewport origin and ground inverse. Camera delegates to
that arithmetic; pixel rounding remains at the existing draw operations.

Existing independent evidence: Canvas scene-operation tests, indoor reference
snapshots, renderer recording/boundary tests and browser editor/interior scenarios.
The GPU slice adds full-Chromium side-by-side raster fixtures without overwriting
approved snapshots. Mesh artwork is excluded from sprite parity comparisons.

Projection fixtures pass; typechecks, 1,436 unit tests and lint passed (existing
warnings). Full GPU/browser and inventory validation follows with the backend;
no approved raster snapshots were changed.
