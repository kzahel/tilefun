# School bus gameplay integration

Status: integrated; focused production validation complete, 2026-10-19.
Owner: [Original vehicles](../topics/original-vehicles.md).

The owner accepted [149](149-school-bus-pipeline-review.md), saying “looks great.
integrate it. commit. then proceed directly with the pickup.” Appearance feedback
applies to the frozen 2,564-triangle GLB SHA-256
`4b71cb259c5226af9657fe624585354ad66c41b3b66c5a2a2cf25ba61d3df42f`.
Do not regenerate the reviewed art or rewrite its frozen review metadata.

## Delivery contract

Add **Yellow school bus** through the shared original catalog: editor placement,
normal road traffic on suitably wide roads, shared game/Traffic presentation,
driving, save/reload and unchanged cardinal sprite fallback. The 45-type source
bank remains immutable; the combined game roster becomes 48 types/47 ordinary
traffic-eligible types. The bus has no new flashing-light or equipment controls.

Use the versioned config-driven runtime exporter with exact retained input-map
receipts. Copy the reviewed GLB without re-export; measure actual imported bounds,
set conservative physical dimensions and explicit bus handling. Its 224px capture
uses ground (112,112) at native world-pixel density. Pack exact cardinal pixels
around (96,144) in 192×224 row frames; crop transparent margins only, never resize.
Preserve the original runtime exporter and previous provenance receipts.

A YA Codex Sol 6.1/high/bypass worker owns bounded runtime changes and focused
unit/browser coverage. The coordinator owns docs, inventory, final validation and
commits, preserving concurrent wildlife changes. Pickup authoring and independent
QA run in their own family paths; pickup activation awaits owner appearance review.

## Evidence and next step

The bus is `vehicle-v1:school-bus`, using `school-bus-authored-v1` at radius112,
height/lateral scale1. Actual imported bounds are 121.2174×42.7826×43.1304px;
conservative collision dimensions are 122×43×44px. Shared rules admit roads at
98px and derive an 85.4px turning radius. Bus speed is 78px/s, acceleration 100,
push speed 64 and push weight 500, using the established bus handling path.

`runtime-school-bus-v1.json` pins the exact frozen review and retained source-only
replay; the existing `runtime-export-v2.py` needs no change. Actual replay is
byte-identical for GLB, fallback PNG and provenance, with 16 verified dependencies
and no ignored scratch input. Both prior original entries and 540 protected files
remain unchanged, including all accepted bus art and the historical exporter.

Ten focused original-catalog tests and five runtime-export regressions pass.
Checks cover actual GLB geometry/material/atlas, native fallback pixels, physical
bounds, all facings, persistent/replicated state, road admission and narrow-road
exclusion. A dynamic screen-edge test exposed its old compact-size assumption. It now
uses each registered mesh radius and the shared fallback envelope; all 108 scene
collection tests pass. The production collector and shared engine are unchanged.
Final global and browser results follow below.
Commit the accepted bus integration before delivering the pickup review.

Typechecks, lint (119 existing warnings/35 infos), art catalog, 1,549-candidate
normal-Chromium retina inventory verification and production build pass. The first
manifest attempt timed out during normal-browser verification while broad tests
competed for resources; the unchanged-input retry passes.

The combined Beetle/bus production run covers 14 cases, seven per family: own GPU
model, failed-mesh fallback/roof support, mobile placement/boarding/driving/save/
reload/deletion in Canvas/GPU/failed modes, and forward/reverse rolling turns with
stopped heading. The broader unit run encountered known Windows failures and
load timeouts. The completed lower-concurrency rerun passes 4,967 tests with the
same five known Windows symlink/process-signal failures and ten static-server
skips; all new vehicle checks pass. The first high-concurrency attempt was stopped
while a long wildlife file was still active after several load timeouts; no clean
result is claimed for that attempt. No whole-browser-suite pass is claimed.

Integration is committed/pushed as `baa84509`; [151](151-pickup-pipeline-review.md)
records the subsequent pickup appearance-review checkpoint.
