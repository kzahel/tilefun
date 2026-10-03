# 028 — Backend-independent sprite metadata

Status: delivered. Parent: [022](022-renderer-backend-decoupling.md), R3 prerequisite.

## Scope and inspected boundary

`Spritesheet` currently combines image ownership, tile dimensions, region lookup
and Canvas drawing. `GameContext.sheets` exposes that complete object even for
asset-presence queries in `scenes/renderWorld.ts`. Introduce immutable plain
metadata and a metadata-only catalog, populated at asset load/composition time.
Canvas resources retain the same images and draw behavior. Frame-contract work
will migrate the remaining concrete resource access; this slice does not claim
that `GameContext` is already backend-independent.

Source region arithmetic, aliases and pixel rounding must remain identical.
Replacing resources must explicitly refresh the catalog; no image or Canvas
object may be reachable from catalog entries. Catalog synchronization happens
at load time, not on walking frames. Do not copy static metadata per frame.

## Acceptance and validation

Test dimensions/regions, aliases, same-key replacement and removal, immutable
metadata and absence of resource references. Use the catalog in real gameplay
asset availability decisions. Run typechecks, unit tests and lint, catalog then
manifest generation, production build and full Playwright checks. Record review
fingerprint changes separately from broad source-digest updates.

## Evidence

Typechecks, 1,389 unit tests and lint pass (existing warnings). The first unit
run overlapped manifest regeneration; rerunning after generation passes. Art
catalog and manifest regenerated, production build passes, and all 551 candidate
records are byte-equivalent as parsed JSON to the pre-slice manifest. Full browser
validation passes: 290 passed and one pre-existing skipped test.

[Allocation baseline](../benchmarks/022-renderer-baseline.json): 600 elevation
frames retain nine layouts/3,456 descriptors; 3,000-frame terrain workloads retain
80 scheduler records and unchanged ordering hash. Synthetic sampling only, not
a phone frame-time claim. The Pixel 7a is attached; integrated testing follows.
