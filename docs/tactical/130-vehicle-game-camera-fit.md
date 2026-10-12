# Vehicle proportions, contact and travel heading

Date: 2026-10-12.
Status: Delivered.
Owners: [vehicles](../topics/vehicles.md), [rendering](../topics/rendering-architecture.md).

The owner reported overly tall in-world cars and requested a fix, grounded diagonal
travel and bodies facing their movement. Source-camera fit alone did not qualify
the fixed world-camera appearance: compact side height was 45 versus 37 native
pixels; police was 58 versus 38; garbage trucks were 118 versus 76.

## Contracts

`vehicle-mesh-fits.json` pins all 45 game-local vertical registrations. The shared
GPU factory applies this fixed transform around Z=0 after the rigid wheel pose
and before entity yaw. XY length/width, contact origin and the world x,y-z camera
are retained. Every source tire/body/equipment vertex undergoes the same invertible
registration, preserving separation and absolute wheel poses. The source GLBs,
Blender bundles, atlases, approved sprites, physical collision/support and saves
are unchanged. Direct authoring probes retain the unregistered source model.

This is visual source-camera registration, not a new physical vehicle geometry.
Projected wheels also receive the fixed vertical fit; there is no heading-dependent
lens, pose-dependent lift or per-frame refitting. Side heights are within one native
pixel for every model. End views still differ because the directional sprite cameras
are incompatible with one coherent fixed projection; the qualification reports all
four measurements rather than claiming an exact four-view match.

Ready road meshes add one low-opacity ground-plane contact ellipse, rotating with
that same body and origin. The mesh owns its geometry/material lifetime and has no
painted sprite shadow underneath. Loading, disabled and failed meshes retain their
complete original sprite and painted shadow. Train prototype presentation is unchanged.
Actual mesh draw counters include the added shadow; authored/compiled source counts
continue counting source model parts.

Cosmetic yaw follows valid displayed forward travel immediately. Replicated/predicted
velocity identifies forward/reverse intent so a backwards interpolation correction
cannot flip the car. Zero-motion samples retain the last heading, including diagonal
stops; timeline/teleport fences use current motion rather than the jump vector. There
is no smoothing clock or return to cardinal facing. Signed wheel travel stays bounded
and absolute. Real driving assertions compare heading with displayed motion.

Standing roof riders carry a data-only support-height correction. Raster consumption
applies it only while that exact support mesh is ready; original sprite fallback,
physics height and ground shadows remain intact. The collector searches only the
moving-roof subset. No backend resource enters shared simulation/prediction.

## Evidence and review

`node scripts/instrumentation/vehicle-fit-probe.mjs OUTPUT` uses retained GLBs, the
shared loader, batching and fixed projection in bundled full Chromium. It verifies
all 45 source side heights and every tire at eight yaws/four roll phases, records
all cardinal bounds and writes a ten-model source/before/fitted/diagonal comparison.
It owns and closes its browser and ephemeral Vite server. Output is temporary by
default; normal builds never regenerate the frozen review capture.

[Game-fit v2](https://tilefun.graehlarts.com/tilefun/assets/models/vehicles/review/game-fit-v2/)
is an additional exact candidate in the existing authored-vehicles batch. Its image,
45-model report, fit table and engine-source pins are retained; old candidates remain
immutable. It registers inspection evidence, not a human approval or GLB promotion.
The ten-family capture was visually inspected for proportions, contacts and heading.

Native regressions cover diagonal tire contacts through roll, correction-resistant
heading, all 45 roof attachments and atomic ready/fallback rider placement.
All 2,626 unit checks in 263 files, three typechecks, lint and production build pass.
Lint retains the existing 119 warnings/34 infos. The initial integration passes all 629 browser checks in
23.8 minutes, including real diagonal driving/rest, Canvas/GPU placement/reload,
vehicle grades, 180 unchanged vehicle appearance verifications, context recovery,
Workshop, interiors and Worker persistence. An earlier focused Canvas destination
timeout clears in this complete run. The initial velocity-only yaw candidate missed
the strict displayed-motion angle by about 0.001 radians; the final forward-motion
rule passes both GPU driving variants without relaxing their assertion.

Fitted unbatched-versus-batched qualification covers 48 road/train models and 6,912
body/outline pairs with zero mismatches or page errors. All 45-model tire checks pass
at eight yaws/four wheel phases. The native case checks actual compiled/exported
geometry, not inferred wheel names or an authoring-only preview. Regeneration verifies
811 candidates in normal Chromium at retina scale (63 compiler exclusions). All 226
previous vehicle/retained-model candidate records remain byte-identical; the additional
fit candidate pins the registry, source bank/catalog and engine sources as well as its
frozen PNG/report/table. No model/source/approval bytes are overwritten.

Evidence: [final units](/tmp/tilefun-fit-v2-all-units.log),
[full browser run](/tmp/tilefun-fit-browser-full.log),
[final fit report](/tmp/tilefun-vehicle-fit-v2/report.json),
[final batching parity](/tmp/tilefun-fit-v2-batch-parity/report.json),
[final focused browsers](/tmp/tilefun-fit-v2-browser.log),
[v2 comparison](/tmp/tilefun-vehicle-fit-v2/comparison.png).
The original live image hash equals v1's frozen capture. Final render review finds
that the positive-Y-down projection culls a one-sided XY shadow disc. V2 preserves
v1's exact files/candidate, qualifies actual shadow pixels on all 45 models, renders
the disc double-sided in one pass and places it 0.01px below the contact plane to
avoid darkening a zero-height floor. Tire contact, silhouette fit, heading and physics
are unchanged. The final scope passes a fresh all-model probe (including actual shadow visibility),
6,912 fitted batching comparisons, all 2,626 units, typechecks, inventories, lint and
build. All 45 final focused browser checks pass, including GPU switching/recovery,
own-model loading/failure, real driving/rest/reload, placement/deletion and the v2
comparison page on desktop/phone. The final picker and real GPU driving assertions
are unchanged and remain strict.
The broad run uses v1, before this material/plane correction; it is not a claim of
a second complete browser run on v2.

Next: owner driving/appearance playtest, including roof riding and all service types.
Further end-view silhouette changes need an explicit per-family geometry fitting
pass under this same coherent camera, with wheel-envelope qualification.
