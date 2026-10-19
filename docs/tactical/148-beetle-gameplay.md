# Beetle gameplay integration

Status: integrated, validated and ready for commit, 2026-10-19.
Owner: [Original vehicles](../topics/original-vehicles.md).

The owner reviewed [146](146-beetle-pipeline-review.md), said “looks fine” and
requested committing the assets and making the Beetle available for spawning
and normal gameplay, then authoring the next queued vehicle (school bus).
Appearance feedback applies to the frozen 2,554-triangle GLB SHA-256
`4e5094968f9eb2e734dd3aea694d302f9cef519f5501a2a61961973f0c368de1`.
Keep its review snapshots and prior review-time metadata unchanged.

Use the shared original catalog from [145](145-original-coupe-gameplay.md): exact
reviewed model, matching cardinal fallback, measured physical bounds, suitable
compact handling, editor placement, ordinary road traffic and shared lab loading.
No new traffic quota, private lab behavior or source-bank modifications are needed.
The original bank stays 45 types/180 views; the combined roster becomes 47 types.

A YA Codex Sol 6.1/high/bypass worker implements the bounded runtime export and
meaningful unit/browser coverage. The coordinator owns docs, queue, final checks
and commits. The runtime export should accept a family config for later originals
and reject model/capture hash drift. Normal builds consume retained outputs.

## Evidence and next step

**Beetle-style compact** is `vehicle-v1:beetle`, registered through the original
catalog for Edit → Vehicles, normal generated-road selection, shared Traffic
playground, sprite loading, mesh loading, handling and serialization. Actual GLB
vertex bounds are 80.8696×37.0435×34.087px with tire contacts at Z≈0. Conservative
collision bounds are 81×38×35px; existing road-width policy requires 88px lanes
and the shared turning radius is 56.7px. Compact speed is 105px/s, acceleration
180px/s², pushing 40px/s with weight 90. Ordinary Fast/reverse and roof support
remain shared. No source-bank or engine behavior is replaced.

`runtime-export.py` plus `runtime-beetle-v1.json` pin the exact accepted review
manifest, model, atlas, cardinal game captures and retained source-only replay.
`runtime-measure.py` imports the actual GLB for conservative bounds. Export copies
that GLB unchanged, packs the four native cardinals at the standard ground origin
and updates only this original catalog entry. Existing entries are preserved.
Configurable larger viewports retain pixel density and reject occupied-pixel
clipping; four packing regressions cover padding, row isolation, anchors and
one-pixel failures. Replaying the runtime export preserves the exact GLB, fallback
PNG and provenance receipt; all frozen authoring/review bytes remain unchanged.

161 focused unit checks pass, including exact model/fallback pixels, measured
dimensions, all facings, replication/save semantics, shared palette/assets/own
mesh uniqueness, ordinary generated-road admission and source-bank preservation.
Seven production-preview full-Chromium Beetle checks pass: own GPU model/five
draw meshes, failed-model sprite fallback and roof riding; mobile placement,
boarding, driving, durable save/reload, parked stability and deletion in Canvas,
GPU and failed-model modes; forward/reverse rolling turns and stopped heading in
Canvas/GPU. Restored runtime entity IDs are allowed to change; durable traffic
identity, saved position and reattached driver are verified separately.

Typechecks, lint, art catalog and production build pass. Workshop generation
verifies all 1,407 identities in full Chromium at retina scale, including the
concurrent committed wildlife batch. The complete unit run passes 4,464 tests,
with five known Windows symlink/process-signal failures and ten static-server
skips. A minimal replay extracted only four required staged files reproduces
the exact accepted GLB and atlas; 212 staged source/review/runtime input hashes
verify. Drafts and local replay outputs stay ignored; final source/review/runtime
bytes and required pipeline inputs are deliberately retained.

The four existing ambulance/coupe Canvas/GPU placement/driving/save/delete browser
regressions also pass with the expanded picker, bringing focused production
browser coverage to eleven cases. Streaming readiness passes. Staged Workshop
comparison preserves every one of HEAD's 1,406 existing candidate records and
adds only the Beetle identity.

The broad browser attempt stops at five unrelated failures: four existing aquatic
hunter population assumptions plus an animal-browser assertion while concurrent
raptor source/tests changed beyond this vehicle's built snapshot. Nine pass, one
is interrupted and 1,117 do not run. This is not a full-browser pass. The separate
eleven-case vehicle run uses the validated production build and passes. Logs and
local diagnostics remain under ignored `data/vehicle-bake/beetle-runtime/`.

Commit this accepted Beetle/pipeline/runtime slice before school-bus authoring;
concurrent wildlife source changes and their tactical remain outside the vehicle
commit. The next vehicle is a separately reviewed yellow school bus.
