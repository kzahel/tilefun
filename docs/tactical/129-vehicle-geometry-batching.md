# 129: Runtime road-vehicle geometry batching

Status: implemented, measured and validated; physical phone image comparison unmeasured after disconnection.
Date: 2026-10-12.
Owner: [performance](../topics/performance.md).

## Scope and contracts

Following the [wide-view investigation](127-wide-view-investigation.md), compile
compatible opaque road-vehicle pieces once at loading through shared CarMeshAsset.
GpuMeshBodies enables compilation for every registered road model in game and
embedded labs. Source meshCount remains the authored part count; drawMeshCount and
GPU asset-state drawMeshes report the compiled count. Actual GPU draw-call counters
remain separate, including body/outline passes and view culling.

VehicleGeometryBatches combines only ordinary visible leaf meshes under the same
parent, with identity local matrices, identical material/draw state and compatible
Float32 attributes/indexing. It copies literal attributes/indices without baking
transforms or changing triangles. Parent wheel/steer/equipment groups retain their
transforms and independent motion. Tagged effects, transparent/transmissive or
custom draws, skins/instances/morphs, partial ranges and unsupported attributes
retain their original meshes. All original and compiled geometries belong to the
asset's idempotent disposal; textures/materials and decoded bitmaps keep their
existing ownership. No per-frame batch compilation or pose quantization is added.

Opaque source-part depth ordering matters even when all pieces share material.
Naive combining changes a few edge/overlap pixels; these candidates are rejected.
The registry records qualified raster-sensitive source parts that stay independent:
compact hood/front fenders, bus roof edge, selected sedan/window/trunk surfaces,
garbage-truck chassis/loader faces, and emergency roof/cab surfaces. Compilation
fails closed if a declared surface disappears, retaining the ordinary failed-load
sprite path. This is source-bank qualification, not an inferred approval or a
relaxed image tolerance. New/revised registrations need the same pixel comparison.

Typical road models compile from 32–55 pieces to 5–10 draw meshes. Ambulance uses
15 and garbage trucks 20 after preserving their sensitive surfaces. Flash lenses
retain independent cloned materials and shared presentation time; absolute wheel
travel/reset and rig pivots stay native. Promoted GLBs, Blender sources, atlases,
colliders, projection, target resolution, outline, prediction and authority stay
unchanged. No target-reuse, terrain budget, LOD or renderer-default change is included.

Direct CarMeshAsset/loadCarMesh callers retain source hierarchy unless explicitly
opting in. Train inspection registrations stay unbatched: their roof/bogie/coupler
queries and original pixels remain intact, and live train sprites remain the default.
The performance slice does not activate or approve train art.

## Native image qualification

[Sanitized evidence](../benchmarks/129-vehicle-geometry-batching.json) retains final
pixel comparisons, rejected native candidates, exact GLB hashes, frozen runtime
fingerprints and all four phone timing distributions. Private controller/browser
state and raw local artifacts remain temporary.

The reusable vehicle-batch-parity runner loads the actual 45 registered road GLBs
and three current blue train prototypes with an exact archived pre-change
CarMeshAsset reference. Full bundled Chromium uses native WebGL2 body targets,
production projection, registrations and CarPixelOutline. It compares all RGBA
bytes before and after outlining, without changing tolerances. Nonempty mesh and
body-render guards reject invalid/blank comparisons. Static shared Three imports
and per-run Vite caches prevent mixed class identities and cross-run cache conflicts.
Diagnostic part-ID recolors identify overlaps but are excluded from conformance.

The final dense corpus has 72 neutral-yaw views (five-degree spacing, preserving
exact cardinal/diagonal values), four pitched/rolled views, travel 0/7/-13/0 and
off/two flashing phases. **43,776 paired poses across 48 models** have zero body
or outline pixel differences and zero page/shader errors. This is discrete pose
coverage on desktop Chromium, not proof for every continuous angle or GPU driver.

The selected phone disconnects after all timing controls, before the planned
physical GPU image comparison. That connection attempt fails before page creation;
there is no phone pixel-conformance result. Desktop native pixel qualification and
physical gameplay performance are separate evidence lanes.

## Phone measurement

Frozen baseline `efb6b54` and candidate archives differ only in four rendering
modules. Public promoted assets are shared unchanged. Native Worker/IndexedDB,
seed-2026 city-core arrival, GPU meshes, 0.1 zoom, four-second warmup and eight-second
drives run before/after/after/before. All entries have 312 props, 108 resident actors,
eight active cars and six active route people. The same native sedan/road covers
approximately 878–882px. Actual native vehicle visibility/mix and wait states vary
with wall time; the JSON retains populations rather than assuming identical scenes.

All four start/end readings are 24.6–25.3°C, thermal status zero. No timing captures
overlap task tests/builds. The first baseline uses the earlier probe fingerprint
set; extra loader/compiler hashes are reconstructed from its already frozen archive.
Later captures fingerprint the loader/compiler/registry directly. Per-run isolated
Vite caches change setup, not production policy; samples start after visible
terrain readiness and warmup. Those admission checks are not per-frame readiness
assertions during movement.

| Weighted native phone wide driving | Original | Batched |
| --- | ---: | ---: |
| Mesh GPU calls per submitted frame | 244.76 | 44.21 |
| Other raster GPU calls per frame | 169.80 | 170.01 |
| Render CPU mean | 7.44ms | 6.52ms |
| rAF interval mean | 28.76ms | 27.90ms |
| rAF interval p95, each capture | about 50ms | 50ms |

Mesh calls fall about 81.9%, and render mean about 12.3%. Mean callback cadence
changes only about 3%; slow tails remain. This is renderer headroom, not stable
displayed 60Hz or an original-desync fix. Draw counts are requested GPU work;
rAF and inclusive render timings do not measure hardware GPU duration/display
presentation. Scope the win to these native city controls.

## Validation and next work

Three typecheck configurations and all 2,579 unit tests/262 files pass. Lint passes
with 119 existing warnings/34 infos. Focused regressions cover literal attributes/
triangle order, parent motion, unsupported/custom draw fallback, protected source
surfaces, absolute wheel/light resets, missing qualification and disposal once.
Catalog and manifest regeneration pass; normal Chromium verifies all 809 candidate
identities. Every candidate record remains identical; only broad inputDigest changes.
Build passes. All 61 affected full bundled Chromium checks pass on isolated auth/
data/port 4192 with one worker (5.2 minutes), covering GPU/vehicle presentation,
compiled game/Traffic counts, train preservation, fallback/recovery/switching, grades,
driving and placement. All six strict streaming-readiness scenarios pass without
missing/incomplete visible terrain. Owned task tabs, test servers and proxy close.
The USB disconnect removes the host forward; selected-phone reverse-route state and
prior foreground cannot be verified/restored while disconnected. Private restoration
notes remain local. No full browser-suite or physical phone pixel result is claimed.

Next, profile/reduce the remaining roughly 170 sprite/terrain submissions per wide
frame. Preserve scene order, clipping, shadows and texture lifetimes. Moving-camera
raster bursts/terrain preparation are a separate bounded-budget experiment with
visible readiness and backlog/catch-up gates. Do not infer that more server workers
would remove these measured rendering costs.

```sh
node scripts/instrumentation/vehicle-batch-parity.mjs --baseline-source=/path/to/original/CarMeshAsset.ts --dense=true --output=/tmp/tilefun-batch-parity
node scripts/instrumentation/city-audit.mjs --root=/path/to/frozen/source --revision=REV --arrival=core --overview-zoom=0.1 --stages=overview-drive --seconds=8 --warm-seconds=4 --output=/tmp/tilefun-batch-timing
```

Physical runs additionally use a selected unlocked phone, private dedicated HTTP/CDP
routes and a fixed thermal gate. Do not publish raw browser traces or private selectors.
