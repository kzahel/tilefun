# Connected farmsteads, town pets and larger cities

Owner: [city generation](../topics/city-generation.md), with
[natural landscapes](../topics/natural-landscapes.md) and [wildlife](../topics/wildlife.md).
Started 2026-10-09. Status: complete. Owner authorized proceeding after the proposed
farmstead/town-pet first slice and larger-city follow-up. Commit validated slices.

## Contract

Compose the current regional generator, keeping regional-v13 and stable seeded
feature IDs. Fresh worlds expose changed output; no save deletion/backfill.
Reserve connected dry farm lots and narrow dirt lanes before natural cover,
ponds and wildlife. Reuse the existing country house, shed, crops and animals;
no new source art, bank promotion or historical snapshot changes. No route through
water, buildings or rail. Paths must visibly connect to roads and front yards.

Town/village cats and dogs use production fauna AI and ordinary durable records.
Safe home areas keep them off traffic lanes; preserve saved RNG/phase, deletion,
manual creation, harmless escape and no player bounce. Farms can use the same
habitat boundary for pasture animals. Offscreen simulation/respawns stay unchanged.

Larger cities use a connected larger grid and denser promoted facades, retaining
compact villages and green areas. Preserve exact authoring/archived review output:
new current composition is separate from frozen review recipes. No unapproved
candidate architecture or parked/park/pedestrian art is promoted.

## Tracker

| Slice | Scope | State | Evidence / commit |
| --- | --- | --- | --- |
| A | Dry connected farmstead, access lane, farmhouse/shed/crops/pasture; inspection arrival | Complete | 14 new units / 29 focused checks; six native browser checks pass; a0bb4bf |
| B | Durable village/city cats and dogs, safe habitat bounds and pet inspection | Complete | Shared safe yards, clear spawns, saved state/tombstones; six native browser checks pass; a0bb4bf |
| C | Larger denser current cities, compact villages, connected sidewalks/doors, city inspection | Complete | 29 focused checks pass; native Canvas/GPU captures inspected; fea3d52 |
| D | Whole-world regressions, native Canvas/GPU inspection, streaming, docs and clean commits | Complete | 2,048 units pass; 485/487 browsers, only recorded archive failures; six streaming phases pass |

Validate seeded/query-order/seam geometry and bounded planning; realized paths,
collision-free initial animals, territory constraints, saved/deleted residents;
production Realm/Worker and ordinary-game behavior. Required typechecks, full
units, lint, catalog then manifest, build, complete browser suite and streaming
readiness. Preserve exact existing wildlife review objects and promoted banks.
Retain known archived fox-preview failures and intermittent train evidence.

## Execution

Planning audit: farm/woodland CountrySource has no current generator callers;
current dense realization uses a compact 2×2 block recipe. Natural reservations
already precede cover/ponds/wildlife and can consume independent farm plans.
Existing fauna supports durable baseline behavior; add a saved safe-area boundary
rather than separate town AI. No new art production or approval is implied.


A/B checkpoint: independent 64-entry farm planner admits dry lots on long existing
road connections, tries opposite road sides, rejects settlements/other roads/rail,
and reserves lots plus 2.5-tile dirt lanes upstream of natural cover. Native country
house, shed and twenty crops accompany six durable cow/sheep/goat/pig residents.
Town greens receive one cat and one dog per park, with existing furniture shared
between placement and spawn validation. Saved full-footprint habitat bounds keep
routine/escape paths inside safe yards; no separate AI or respawn policy.

29 focused checks pass (new settlement checks, district geometry, scenario session
and Worker controls). Existing land-fauna authority checks pass after explicit
zero ground height for newly created profiles, including frozen offscreen pets.
New persistence tests select nearby scenario residents, not the distant startup
population; parked paths are pedestrian-safe paving. Initial six browser behavior
checks pass. Visual inspection exposed unfinished blend data after paused reload:
explicit shared Realm.ensureReady now completes ordinary autotile preparation
after async loads. This leaves live tick budgets and animal clocks unchanged.
New tests require computed terrain before and after reload. Final captures follow.


A/B delivery checkpoint: 29 focused checks, typechecks and lint pass (existing
118 warnings / 34 infos). Catalog and manifest updated: 737 verified candidate
identities, with exact existing wildlife records retained. Build passes. Six
native Canvas/GPU farm/village/city-pet browser checks pass in 14.1s; post-reload
captures visually inspected. Explicit readiness fixes the observed incomplete
blend data, and safe-yard tests also check the actual feet-anchored body AABB.
Farm framing uses 0.25; settlement scenes use 0.3. Final approach extensions pass all 14 new units, and both farm capture checks
pass (5.0s). The complete farm and village GPU captures were visually inspected.
Wildlife status refresh remains blocked by absent ignored
`data/wildlife-campaign-v2/progress.json`; the last validated production table is
preserved. Complete regressions follow C.
[Focused units](/tmp/tilefun-farms-unit-final.log),
[native browser checks](/tmp/tilefun-farms-browser-final.log),
[farm Canvas](/tmp/tilefun-farmstead-canvas.png),
[village GPU](/tmp/tilefun-village-pets-gpu.png).


C implementation checkpoint: current cities have seeded 16/24 blocks with two
parks, shopping bands, taller central homes and lower residential edges. Villages
keep the compact layout. Separate current recipe identity preserves compact
authoring output and immutable archived review snapshots. Existing threshold
geometry and whole pedestrian routes pass over the expanded production grid;
chunk ownership, bounded queries and source cache limits remain unchanged.
New checks cover both city sizes, settlement reservation fit, native facade mix,
all green pavements and exactly one cat/dog per green. City-center arrival uses
the actual generated intersection; Canvas/GPU native checks and full units follow.


Native C checkpoint: eight Canvas/GPU checks pass in 17.6s; the city-center GPU
capture was visually inspected. Typechecks, lint, catalog, manifest and build
pass; 741 candidate identities are verified, with all 27 existing wildlife
objects exact. The first full unit run passes 2046/2047 (218/219 files).
TrafficJourney's fire-truck reaches only one junction choice in the old fixed
100-second compact-grid window; roof support stays correct. Its unchanged
three-choice requirement now determines completion, with a 300-second simulation
cap and unchanged 43-family admission count. The corrected journey and complete
browser regressions are running. Streaming readiness passes.


Traffic follow-up: extending the test duration disproved the initial timing
hypothesis. The newly admitted folded ladder truck reached an avenue with no
wide enough onward circulation. Current larger cities now have an 8-tile outer
boulevard connected to their central avenues. Interior streets remain 6 tiles,
compact villages unchanged. Full-body pedestrian routes and door approaches
still pass. All 44 admitted vehicle families now complete three junction choices
with stable roof support; raised-ladder traffic remains excluded. All 29 focused
settlement/district/traffic checks pass in 24.94s. The old interrupted browser run
used the pre-boulevard build; final complete regressions use the rebuilt source.


D checkpoint: the rebuilt boulevard source passes all 2,047 unit tests in 219
files (116.75s), typechecks, lint (existing 118 warnings / 34 infos), updated
catalog/manifest and build. Final current-world streaming passes all six phases
with zero missing-data, incomplete-cache or stale-cache frames, page errors or
readiness failures. This is desktop Canvas readiness, not universal GPU/phone
frame-pacing evidence. Exact 27 wildlife candidate objects and promoted banks,
source pixels and archived snapshots are unchanged. Complete browser run pending.
[Full units](/tmp/tilefun-settlement-full-units-final.log),
[streaming report](/tmp/tilefun-settlement-streaming-final.json).


Browser checkpoint: the larger population invalidates a former test-only
assumption that sprite `person7` uniquely identifies the crossing walker. The
old test deletes a different block walker, then incorrectly checks the crossing
walker ID. Its selection now uses the generated crossing route and retains the
exact persisted-ID assertion plus resumed-world checks. This is a test correction;
production actor persistence is unchanged. The two recorded archived fox-preview
review failures reproduce; immutable archive pixels/playback remain untouched.
Final full suite and corrected saved-world check are pending.


Integration audit follow-up: native rail stations begin beyond the established
+44-tile southern town edge. Symmetric four-row cities had extended into that
reservation. Extra current city rows now grow northward while the original
central intersection, road connection and southern edge stay fixed. Existing
railway alignments/stops and frozen compact layouts are unchanged. New geometry
coverage inspects physical building walls across four seeds and native nearby
rail/platform reservations; all 30 focused settlement/district/traffic checks
pass in 25.17s. Final-source full units and inventory verification are running.


Final validation refinements: an isolated native ant probe observes the normal
arrival alert/escape/recovery followed by ordinary crawl after the old five-second
poll window. The motion assertion remains exact but allows twelve seconds for
that complete activity cycle. No ant AI or source art changed. The concurrent
final-source unit run passes 2046/2048; fish (20s) and forest-kit (5s) checks hit
explicit timeouts. They will be rerun in the complete unit suite without a
concurrent native browser run. Typechecks, lint, catalog/741 manifest identities
pass for the rail-clear city source.


Serial final-source units pass all 2,048 tests / 219 files (106.78s), and build
passes. The corrected persisted-ID test and both native ant cycles pass. Focused
browser capture detects seven streamed center walkers after northward city
growth, rather than the old symmetric view's nine. The city-center native check
now requires the crossing plus the four surrounding block routes (at least five);
headless full-city checks still require exact 17/25 routes and 16/24 blocks.
Final native/streaming checks continue on this fixed source.


Focused completion: all thirteen native checks pass in 50.2s, including the
corrected dense saved-world tombstone, both ant motion/contact/saved-phase cycles
and all eight farm/settlement scenes. Final northward city-center GPU capture
was visually inspected. The implementation is fixed; remaining work is the
serial complete browser suite and final evidence/closure.


## Completion

All requested slices are delivered in the current regional-v13 composition:
connected dry farmsteads and dirt access lanes, six durable pasture residents per
farm, one durable cat/dog per green, compact villages and larger 16/24-block
cities with connected boulevards, dense cores, lower edges and rail-clear southern
stations. Inspect fresh development worlds or the four native in-memory arrivals.
No source art, promoted banks or immutable archived review snapshots changed.

Final source: typechecks, lint (existing 118 warnings / 34 infos), catalog, 741
verified candidate identities and build pass. All 2,048 unit tests in 219 files
pass (106.78s). Thirteen focused native checks pass (50.2s), followed by the
complete browser run: 485/487 pass in 19.5m. Its only failures are the two
previously recorded immutable fox-preview review checks (`wildlife-review.spec.ts`
14/72); no archive regeneration or weakened review checks. All wildlife gameplay,
the eight new farm/settlement checks, saved-world actor tombstones, both complete
city-train journeys and phone roof riding pass. Final streaming has six clean
phases, with no page errors, readiness failures, missing/incomplete/stale terrain
frames. This is desktop Canvas readiness, not universal GPU/phone pacing proof.

All 27 existing wildlife candidate objects remain exact. Gameplay progress is
persisted here and in owning topics before the final wildlife-status refresh.
The refresh cannot run without ignored `data/wildlife-campaign-v2/progress.json`;
retain the last validated production table rather than fabricate campaign receipts.

[Final full units](/tmp/tilefun-settlement-units-serial.log),
[focused native checks](/tmp/tilefun-settlement-focused-completion-final.log),
[complete browser run](/tmp/tilefun-settlement-browser-completion.log),
[streaming report](/tmp/tilefun-settlement-streaming-completion.json),
[city GPU capture](/tmp/tilefun-city-center-gpu.png),
[farm GPU capture](/tmp/tilefun-farmstead-gpu.png).

Commits: `b3f6db3` plan, `a0bb4bf` farm/pets and explicit terrain readiness,
`fea3d52` city expansion/boulevards, `25c2534` station-clear northward growth
and native test identity/timing corrections, followed by final evidence closure.
Next: owner playtest of farm spacing, dirt-lane approaches and city density.
