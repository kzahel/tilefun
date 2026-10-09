# Connected farmsteads, town pets and larger cities

Owner: [city generation](../topics/city-generation.md), with
[natural landscapes](../topics/natural-landscapes.md) and [wildlife](../topics/wildlife.md).
Started 2026-10-09. Status: active. Owner authorized proceeding after the proposed
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
| A | Dry connected farmstead, access lane, farmhouse/shed/crops/pasture; inspection arrival | Delivered; final regressions pending | 14 new units / 29 focused checks; six native browser checks pass |
| B | Durable village/city cats and dogs, safe habitat bounds and pet inspection | Delivered; final regressions pending | Shared safe yards, clear spawns, saved state/tombstones; six native browser checks pass |
| C | Larger denser current cities, compact villages, connected sidewalks/doors, city inspection | Planned | Pending |
| D | Whole-world regressions, native Canvas/GPU inspection, streaming, docs and clean commits | Planned | Pending |

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
