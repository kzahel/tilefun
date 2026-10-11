---
name: tilefun-vehicle-authoring
description: Reconstruct Tilefun vehicle sprites as editable Blender meshes with source-matched UV paint, native-pixel comparisons and independently rotating wheels. Use for another vehicle or a vehicle-family refinement; other asset classes need their own geometry templates.
---

Work in the Tilefun repository root (contains `src/traffic/vehicles-v1.json` and
`scripts/authored-assets/pipeline.py`). Read `AGENTS.md`,
`docs/topics/3d-assets.md` and `docs/topics/art-review.md` for current state and
review contracts. Use the repository's deterministic Blender tools; this task
needs coherent geometry and reusable UVs, rather than a generated bitmap.

Read `docs/topics/vehicle-model-porting.md` before choosing the next vehicle.
It owns the full queue and each model's status; update its row, next action,
evidence and summary counts at every authoring/delivery/integration checkpoint.

## Choose the route from evidence

Identify the requested sprite in the vehicle bank before choosing a template.
`python scripts/authored-assets/pipeline.py list` lists extraction support,
not completed models. A small red compact is `compact-4`; an ambulance is
`ambulance`. Inspect original directional crops when the description is ambiguous.

For compact palette variants, run the validated recipe in
[references/compact-variants.md](references/compact-variants.md). It checks all
four source alpha masks, physical metadata and a consistent colour correspondence
before reusing the fitted mesh/UVs. Unmapped authored colours require explicit
material roles. Do not bypass a mismatch with nearest-colour guesses or hide
shape errors by moving cameras.

Exact final blue/green/red bundles are tracked in `art-source/vehicle-models/`,
with self-contained GLBs in `public/assets/models/vehicles/`. The default compact
palette replay uses these pinned, tracked dependencies and works in a fresh clone.
Run `verify_bundles.py` before using them. Older experiments/galleries stay ignored.
Do not silently replace missing inputs or overwrite a retained final revision.

For the ambulance, `author_ambulance.py` constructs a new family in a fresh
workspace; its retained v1 recipe can replay the exact finished scene. Read the
ambulance section in `scripts/authored-assets/README.md` and the current tracker
before choosing construction or refinement. Its own cameras, radius-8 wheels,
asymmetric side graphics and roof ownership must not inherit compact defaults.

For emergency-light revisions, preserve earlier captures and use separate lens
meshes with versioned `tilefun_*` GLB extras; fixed bases must remain untagged.
Read the light contract in `docs/tactical/116-ambulance-beacons-and-light-tags.md`.
V2's refinement and real GLB probe preserve body/wheel UVs and verify material
isolation, phase alternation and off reset. Asset tags do not wire a gameplay switch.

Police and stowed fire truck have independent fitted configurations in
`scripts/authored-assets/emergency-families.json`; use the police/fire section
of the scripts README and `author_emergency_vehicle.py`. Do not inherit the
compact geometry or assume their side cameras face the same screen direction.
Police source colors repeat across opposite views; record the physical bar's
south/west reversal. Fire rails/rungs must parent only to `Ladder_Hinge`; verify
independent hinge motion on the actual GLB. A working hinge does not qualify
the raised source pose or clearance. Per-vehicle light probes read that asset's
`lights.json` instead of assuming ambulance's lens count.

Stowed fire v2 corrects the initial axle/well mismatch with
`refine_fire_wheels.py` and `fire-wheel-fit.json`, preserving tracked v1.
Use its retained v2 recipe for exact replay; the initial family constructor
still represents immutable v1. Read tactical 118 before revising this family.

Green garbage truck uses `author_garbage_truck.py` and
`garbage-truck-family.json`, with six wheels, per-axle radii/tracks, an actual
recessed loader mouth and a separate loader hinge. Read tactical 119 and the
scripts README. Probe the entire declared wheel set and every independent wheel;
never assume four wheels or shared radii. Verify steering flags against the rig.
One amber lens carries `tilefun_signal=warning` alongside the compatible effect
tags. Check its declared bright/dim phases; a dim half-cycle is valid for one lens.
Camera/roof and opposite-view beacon contradictions stay explicit. Orange needs
family eligibility before reuse. `retain_vehicle.py` packages this source-owned
checkpoint after actual GLB light inspection; it never replaces prior revisions.

For the additional sedan family, use the tracked
`scripts/authored-assets/additional-sedan-family.json` with
`prepare_family_vehicle.py`, then `retain_family.py` into a fresh revision.
`author_passenger_vehicle.py` checks four-view normalized alpha, records explicit
per-crop origin shifts and samples every color's own source, including local
paint exceptions. Sloped cabin sides preserve side glass in end views; roof and
front/rear windows have separate owners. Inspect opposing roof-paint/projection
limits, all native borders and actual wheel/floor fit. This family is independent
of the compact and police templates; the ordinary retained-source checklist and
own-asset engine qualification still apply.

For buses, use `bus-a-family.json` (1–4) or `bus-b-family.json` (5–6),
`prepare_bus_vehicle.py` and `retain_bus.py`. Read the bus workflow in the scripts
README. Keep asymmetric doors and source facing directions explicit. Separate
sloped floor ends are declared in `wheelWellFit.extraFloorMeshes`; run both the
ordinary actual GLB wheel/main-floor probe and `verify_floor_bevels.mjs` against
every retained bus. The latter proves actual tire/hub sphere separation and
rejects a displaced floor end. Roof vents/opposing mirrors and whole-body
steering remain explicit limitations.

For a different body, use `scripts/authored-assets/README.md` and the generic
`pipeline.py init → calibrate → project → evaluate` tools. Author or fit a new
family template. Camera fitting needs correspondences spanning depth and height;
record pixels in raw crops, including the narrower front/back crops. Offsets into
the comparison canvas are handled separately. Preserve family assumptions in a
recipe instead of treating the compact's camera or landmarks as universal.

## Fit and inspect the things that mattered

- **Shape first:** compare all source silhouettes at native resolution. Check
  wheel contacts/axles, hood slope, roof height, rear profile, sill and fender
  radius/flare. Whole-car IoU can miss oversized internal fenders; inspect their
  boundaries too. Sprite shadows affect occupancy scores.
- **Separate window ownership:** side windows need continuous islands. Windshield
  glass belongs inside its aperture; guard cabin corners against duplicated
  projected glass. Check top/front corner intersections and all window borders.
- **Ink at final pixels:** outer silhouette ink is a logical-pixel pass after
  alignment; internal ink is atlas paint. A painted atlas border can disappear
  after sampling. Inspect every border in every native source view, especially
  the windshield top. Widen deliberately where needed, then verify joins and
  glass loss. GLB includes internal ink; it needs a separate outer-ink renderer.
- **Wheels as rigid components:** tire and hub share a centered roll pivot;
  optional steering is a parent of that pivot. Keep body/fenders static. Verify
  ground contact, independent wheel motion and forward/reverse quarter turns on
  the actual exported GLB. Compact forward is -X; inspect export axis conversion.
  Distance-driven roll is `-distance/radius`. A working pivot does not prove
  steering clearance.
- **Wheel wells are a separate acceptance check:** measure visible source wheel
  centers and project the actual exported cap centers with unchanged cameras.
  Inspect each tire against its painted well and fender in both side views;
  a valid pivot and whole-body silhouette score do not prove placement. Check
  floor/body triangles for tire intersections. Caps own wheel paint; tread and
  hidden caps must not sample nearby fender/body pixels. Record landmarks and
  tolerance in the rig; run the real GLB wheel-well probe, including displaced
  axle and solid-floor negative checks where supported.
- **Preserve uncertainty:** raw projection, conflicts and unseen masks are
  separate from cleaned paint. Choose source owners for disagreeing UV regions;
  author hidden surfaces explicitly. A palette transfer inherits hidden surfaces
  and does not make them observed.

## Deliver something reviewable

Render the actual mesh with emission/unlit materials, nearest sampling and
transparent background. Show a four-column/two-row sheet: original sprites above
matched Blender renders, plus native contour differences and novel angles. Check
the exported GLB/rig, not just the working scene. Save a self-contained `.blend`
with cleaned atlas and its own unused draft, atlas, GLB and recipe/provenance.

Use fresh offline workspaces and retained revision directories. Preserve earlier
candidate bytes. Keep exploratory outputs in the ignored vehicle folders or
`data/authored-assets/`; normal builds and Workshop must not require them.
For every finished vehicle, retain the exact final GLB, packed Blender/texture
source bundle and all replay dependencies in tracked directories by default.
Before delivery, read the next-vehicle commit checklist in
`art-source/vehicle-models/README.md` from the repository root. It owns what to
commit, why, byte preservation and tracked-file-only verification. Scripts alone
are not a substitute for the finished assets; an explicitly throwaway experiment
can remain local.
When preparing a production review slice, register the new exact candidate/batch
using retained, available review assets; chat feedback is not a formal promotion.
Follow the project's validation and
inventory commands, reporting existing platform failures separately. Update
the owning topic and tactical, and name the next family-specific fitting step.


For large cars 7–26, use the three explicit `large-car-*-family.json`
configurations and `prepare_large_car.py` / `retain_large_car.py`.
Retain only after actual exported whole-body wheel-envelope qualification:
`verify_body_wheel_envelopes.py` proves every neutral roll angle against
hood, cabin, fenders and floors, rejects a hood deliberately moved into tires,
and pins the exact GLB hash in `body-wheel-clearance.json`. A passing main-floor
or independent-wheel probe alone does not establish whole-body clearance.
Keep the bounded own roof/glass/deck UV regions and geometric window frames;
do not transfer cameras or hidden paint merely because source alpha matches.


For final service variants, use `author_service_vehicle.py` with the independent
orange-garbage or raised-fire config. Preserve explicit opposite crop registration,
source paint exceptions, six wheels and the raised ladder's authored rest pose.
For floor-only refinements, use `prepare_floor_revision.py` and
`service-floor-revisions.json`; preserve prior scene hashes, original perimeter
and barycentrically interpolated floor UVs. Keep all visible geometry/paint fixed.
Run `verify_vehicle_body_clearance.py` on the exact new exports and named-lens
`verify_service_lights.mjs` before `retain_service_vehicle.py`. Never identify
light phase by traversal order. Commit exact final bundles and constructor/config
inputs; source scripts alone cannot replace them.

Whole-bank qualification uses `verify_all_vehicle_clearance.py` in Blender and
`verify_engine_wheel_motion.mjs` through the real shared engine. Resolve declared
wheel children instead of assuming a tire naming convention or four axles. Every
exported corner/middle wheel must roll by its own radius with absolute reset,
without moving fixed body/equipment. Neutral roll proof is separate from steering
or animated hinge clearance; runtime keeps those poses at rest. Four siren types
and two silent warning types have distinct persistent-state limits; asset tags
must be paired with driver authority, touch/keyboard, save/replica and audio tests.
