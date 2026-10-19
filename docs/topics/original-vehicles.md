# Original vehicle authoring

Topic: original-vehicles
Status: eight road originals integrated; autonomous run 153 continues with the next families.
Updated: 2026-10-19.

The owner separately authorized an original **explorer motorboat** and working
lake gameplay in [152](../tactical/152-explorer-boat-and-lakes.md). Its independent
hollow-hull Blender/UV source and zero-wheel outboard rig do not change the car
queue, the 45 source ports or the original-road vehicle queue. [Boats](boats.md)
owns its runtime, exact pending review and water generation.

Owns original vehicles beyond the existing sprite bank: high-detail art masters,
pixel-style transfer, low-poly deliverables, reusable authoring instructions and
the expansion backlog. [Vehicle porting](vehicle-model-porting.md) continues to
own the 45 existing sprite ports; these prototypes do not change those counts.

## Current decision and gate

On 2026-10-19 the owner authorized an eight-hour autonomous production run through
the backlog, including game availability and incremental commits/pushes, without
per-vehicle appearance pauses or a quantity guarantee. [153](../tactical/153-autonomous-vehicle-production.md)
owns the bounded run and [ledger](../../art-source/vehicle-bake/autonomous-153.json).
The hard cutoff is 2026-10-20 05:19:36 UTC. Existing human review records remain
unchanged; new runtime activations use explicit batch authorization plus honest
agent QA. Batch 1 activates pickup, classic roadster, off-road SUV, delivery van and racing
coupe. Together with the three earlier originals, the normal catalog has **53 road
types, 52 traffic-eligible types**, plus the separately owned boat (54 drivable
types). All five additions retain exact frozen GLBs/cardinal pixels and pass 56
full-Chromium gameplay checks across all eight originals. The complete unit run
passes 5,768 tests with the five known Windows failures and ten skips; typechecks,
lint, build and the 1,774-identity Workshop inventory pass. New origin-centered
bounds use the versioned v3 exporter; pickup is conservatively 95×39×36px.
Microcar, woody wagon and limousine sources are next in independent review.
Historical checkpoint details below retain their original counts and gates.

The owner accepted school bus v1 and explicitly authorized runtime integration.
[150](../tactical/150-school-bus-gameplay.md) adds **Yellow school bus** to editor
spawning, normal road traffic and shared game/lab own-mesh presentation. The exact
reviewed GLB and native cardinal fallback are retained. Conservative 122×43×44px
bounds require 98px roads; handling is 78px/s with 100px/s² acceleration. The combined
roster is 48 types/47 ordinary traffic types; the source bank remains 45 types/180 views.
Pickup authoring/review is recorded under [151](../tactical/151-pickup-pipeline-review.md).
The owner likes its appearance; run 153 now activates its exact reviewed model.

The owner prefers [141](../tactical/141-sports-car-style-experiments.md)'s approach 3,
especially characteristic outer and internal outlines. [142](../tactical/142-red-car-low-poly-pipeline.md)
tests that look on economical textured GLBs. Preference and authorization to
experiment are not an exact-revision production art approval.

The red-car appearance gate is now cleared for the corrected v3. Beetle,
school-bus and pickup are the next queued pipeline experiments under the owner's
earlier instruction; none started during this asset-commit checkpoint.

The owner then requested the Beetle explicitly on 2026-10-19. [146](../tactical/146-beetle-pipeline-review.md)
owns its rounded-family authoring and review delivery. Warm yellow paint and blue
glass carry the approved outline style onto a domed roof, rounded hood/rear deck
and substantial fenders. This checkpoint prepares an actual low-poly model for
appearance review; school bus and pickup remain queued.

Beetle v1 is now a frozen **2,554-triangle**, five-mesh export with one opaque
512² unlit atlas and four independently rolling wheels (198,312 GLB bytes).
Its direct semantic UV route authors glass/frames on the body skin, avoiding the
draft's intersecting curved-glass overlays. It uses the same actual-GLB pixel
presentation and unchanged game camera as the coupe. Independent full-roll body
clearance, collision negative control, all 32 study/game headings and desktop,
mobile and network-free offline preview checks pass. The declared Beetle crown
sample region has 25/25 supported samples per wheel; visual coverage is checked
separately. Retained-script replay reproduces the exact GLB and atlas.

The exact review page and evidence are under
`public/demos/original-vehicles/beetle-v1/`, registered separately as
`projection:original-vehicle-beetle-v1`. The self-contained local review is
`data/vehicle-bake/beetle-review.html`. On 2026-10-19 the owner said “looks fine”
and requested commit/gameplay integration, then the next vehicle. [148](../tactical/148-beetle-gameplay.md)
owns this activation; the frozen review keeps its original review-time metadata.
Its component master uses economical topology and
does not demonstrate high-to-low transfer. The existing coupe and 45 source ports
retain their exact bytes and counts.

The shared catalog now adds `vehicle-v1:beetle` (**Beetle-style compact**) to
editor spawning and eligible road traffic. Its physical bounds are measured from
the actual imported GLB: 80.8696×37.0435×34.087px, conservatively rounded to
81×38×35px; road admission is 88px and turning radius 56.7px. Compact handling is
105px/s with 180px/s² acceleration. The two originals bring the combined gameplay
roster to 47 types/46 traffic-eligible types. Its runtime GLB is byte-identical to
the reviewed revision, with matching native cardinal captures in the standard
sprite fallback. Normal loading, disabled/failed meshes, saves and shared lab
presentation use existing authority/rendering paths.

Beetle/pipeline integration is committed and pushed as `7b5e1851`. Eleven focused
production browser checks, 161 focused units, typechecks, lint, build and streaming
readiness pass; broader suite limits are recorded in 148. The owner-authorized
next checkpoint is [149](../tactical/149-school-bus-pipeline-review.md): a yellow
school bus with its own long body, door/window ownership and larger transparent
review viewport at the same pixel density. Pickup remains queued after that.

School bus v1 is now a separate **2,564-triangle**, five-mesh review candidate
with one 512² unlit atlas (182,232 GLB bytes). Its long rounded body/hood, repeated
blue windows/rails and side-owned folding door use original semantic surface UV
paint. The 224px transparent viewport preserves the existing native pixel density
and world scale; all prior Beetle render pixels remain exact. Independent actual
GLB clearance/rolling, native/game views, source-only replay and desktop/mobile/
offline checks pass. [149](../tactical/149-school-bus-pipeline-review.md) owns the
exact retained revision and evidence. It is available through the original-vehicle
review collection and `data/vehicle-bake/school-bus-review.html`; gameplay
activation was authorized on 2026-10-19 when the owner said “looks great. integrate it. commit. then proceed directly with the pickup.”
[150](../tactical/150-school-bus-gameplay.md) owns exact-revision integration;
[151](../tactical/151-pickup-pipeline-review.md) owns the next regular-cab/open-bed
family review. The bus review snapshot retains its original review-time metadata.

The owner likes the style but flagged upper tire crowns above the fenders.
`a-reduced-projection/mid-fenders-v3` corrects the source geometry with integrated
shoulders and a modest inward track adjustment. It is 2,299 exported triangles,
one unchanged 512² palette atlas, five draw meshes and four independent wheels.
The coordinator inspected both 16-heading camera sets and verified actual GLB
clearance/roll. On 2026-10-19 the owner reviewed this version, said "good looks
better" and requested committing the final assets. This records appearance
feedback for GLB SHA-256
`05de49fc16a281db97fb6854d94252e44bb8f1502a5749e8580d95cba908df64`.
Frozen review snapshots keep their original review-time metadata.

The owner then explicitly authorized gameplay integration, commit and push.
[145](../tactical/145-original-coupe-gameplay.md) registers **Red sports coupe** in
Edit → Vehicles, the shared Traffic playground and normal automatic road selection.
`src/traffic/original-vehicles.json` owns its additive definition; the immutable
source bank remains 45 types/180 views. The combined gameplay roster is 46 types,
45 eligible for ordinary road traffic (raised ladder firetruck remains excluded).
Its exact reviewed GLB is copied to the normal runtime asset directory with a
matching four-view game-camera sprite fallback. Physical bounds are 82×36×19px,
road-width admission is 84px, and shared sporty handling is 156px/s. Existing
collision, driving, roof support, streaming and save paths handle the new type.
The combined rolling-steering implementation uses its measured 57.4px turning
radius. Final Canvas/GPU checks include forward/reverse rolling turns, stopped
heading, placement, boarding, save/reload/deletion and failed-mesh fallback.

School-bus runtime integration is committed and pushed as `baa84509`. The exact
reviewed model, fallback and measured bounds ship through ordinary editor/road
traffic and game/lab paths. Fourteen combined Beetle/bus production-browser cases
pass; [150](../tactical/150-school-bus-gameplay.md) owns detailed evidence.

Pickup v1 is now a separate **2,984-triangle**, five-mesh candidate with one opaque
512² unlit atlas (207,472 GLB bytes). It has a teal regular cab, rounded hood,
continuous framed blue glass and a real recessed open cargo bed with inner walls,
wheelhouses and tailgate. Its own semantic UV topology and four radius-8 wheels
use the same pixel presentation. Actual full-roll clearance, explicit crown
support, real bed-floor triangle rays, source-only replay and all 32 study/game
views pass; visual inspection is separate from those geometric proofs.
[151](../tactical/151-pickup-pipeline-review.md) owns the frozen review and retained
source. Open `data/vehicle-bake/pickup-review.html` for standalone inspection.
The owner subsequently said “Looks great” about the pickup; runtime integration
remains pending. The brainstorming backlog now contains 36 future vehicle ideas,
covering everyday cars, open racers, leisure vehicles, mobile shops, working
trucks, machinery and motorcycles. These remain ideas; no new vehicle production
has started. Six standalone motorcycle/scooter styles join the existing sidecar:
classic street, sport, cruiser, dirt, touring and retro scooter. Their two-wheel
geometry, wheel rigs and rider pose need their own authoring contract rather than
inheriting a four-wheel car template; the sidecar has a separate three-wheel layout.

## Pipeline invariants

- Keep immutable high-detail sources, target pixel drawings and retained revisions.
- Use one view-independent UV atlas; outer pixel ink belongs in the renderer.
- Keep wheel paint/rigs independent and count the actual exported geometry/materials.
- Compare the actual GLB at native scale and intermediate headings, including roll.
- Inspect far-side tire coverage beneath real fender surfaces independently of
  nonintersection; the owner flagged exposed upper tire crowns in the first pilot.
- Reusable recipes must run from retained inputs without ignored scratch state.
- Human style review precedes expansion and any runtime activation.

## Queue and evidence

[`art-source/vehicle-bake/roster.json`](../../art-source/vehicle-bake/roster.json)
owns the machine-readable queue. [Vehicle status](../vehicle-status.md) is its
generated review table. Source instructions and experiment contract live in
[`scripts/vehicle-bake/README.md`](../../scripts/vehicle-bake/README.md).
