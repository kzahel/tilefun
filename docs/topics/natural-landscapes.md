# Natural overworld landscapes

Topic: natural-landscapes
Status: seeded explorer/lab preview implemented for review; ordinary regional defaults unchanged.
Updated: 2026-10-07.

Owns natural land cover, forest composition, scattered vegetation and small ponds
in the current regional overworld. [City generation](city-generation.md) owns
generator policy and settlements; [world geometry](world-geometry.md) owns physical
terrain elevation, slopes and stacked spaces. [Tactical 068](../tactical/068-natural-landscape-preview.md)
records the first review delivery and validation.

## User direction

Train travel between towns currently feels like plain grass. The request is for
natural landscapes throughout suitable overworld land, including dense forests,
standalone wild trees, varied tree patterns, natural habitats and small ponds.
Start simply, reuse existing art and labs, and show regional planning and biome
differences for review. Leave room for future cliffs, mountains and elevated mesas.
The owner authorized the first audit/preview slice on 2026-10-07. No particular
art composition or density has been accepted yet.

Follow-up direction: the owner likes the full-world train preview and specifically
wants the previously reviewed repeating/staggered forest patterns, including large
impassable interiors. The initial all-walkable woodland requirement was too narrow.
Retain open meadows and ordinary trees, with distinct solid thickets that shape
routes. This is direction for the new preview, not a recorded approval of its edges
or collision geometry.

## Current foundation and gap

- `RegionalPlanner.ts` already samples elevation and moisture and labels meadow,
  woodland, rural, shore and water. These labels are broad geographic hints;
  woodland labeling does not guarantee realized trees.
- `RegionalTerrain.ts` maps geographic elevation to water, sand or grass.
  Geographic elevation here is a noise field used for materials, not a physical
  terrain-height contract.
- `createGenerator` composes `RailwayStrategy → TrafficStrategy →
  DenseDistrictStrategy`. Its current props are settlement/transport furnishings.
  `CountrySource` in `CountrysidePlanner.ts` has no callers in `src`: its farms
  and woodland loops are not part of the current generator.
- That unused woodland recipe has moisture-gated 128-tile squares, sparse jittered
  oak grids, a rectangular trail and picnic furniture. Reconnecting it alone would
  not supply continuous, irregular natural habitats or scattered meadow trees.
- Runtime oak/palm props and the outdoor catalog provide starting assets.
  Pattern Studio's `FencedTrees.ts` is a **candidate horizontal fenced row**;
  it is not automatically an approved, arbitrary-shaped wild forest kit.
  Audit other existing sources and their review status before selecting palettes.
- World explorer already supplies regional overlays, bounded real-tile previews,
  seed/location links and gameplay handoff. World geometry lab supplies shared
  Realm/Worker gameplay, real generated train scenes and height proofs. Terrain
  reference supplies material/transition inspection. Extend these complementary
  tools instead of implementing another world viewer or simulation.

## Preview landscape vocabulary

Begin with one temperate landscape family and several habitats. These are local
ecological/composition differences, not yet a climate simulation or a large biome roster.

| Habitat | Proposed appearance | Playability intent |
| --- | --- | --- |
| Meadow | Open grass, occasional standalone trees, small loose groups | Open play/build space and long views |
| Open woodland | Irregular groves, mixed sizes where art permits, grassy gaps | Easy walking between trees |
| Dense woodland | Recognizable forest interiors, softer edges, occasional clearings | Dense scenery with connected walkable gaps |
| Solid thicket | Native multi-tree patterns in staggered overlapping rows | Large impassable interiors; travel around edges and between patches |
| Pond edge | Small irregular water bodies, dry banks, clustered compatible vegetation | Readable shores and routes around water |

Use broad continuous habitat fields, local grove/clearing shapes and individual
placements at separate scales. Density should taper at forest edges. Avoid uniform
random sprinkling, obvious chunk squares, repeated planted rows and identical
clearings. Meadows must remain intentionally open; “everywhere” means all eligible
overworld regions participate, not that every tile contains a tree.

Later palettes could add conifer woodland, dry scrub or wetland if source art and
review support them. Future wildlife can consume habitat suitability; population,
AI and new animal production are separate work and are not required for this slice.

## Shared contracts

1. **One natural plan.** Pure seed/coordinate queries provide habitat weights,
   vegetation suitability and bounded pond/clearing features to overview and exact
   realization. The map must describe the habitat the game actually realizes.
   Broad views may omit small ponds; detail views must reveal the actual footprint.
2. **Explicit precedence.** Base geography precedes established settlement and
   transport reservations; local ponds and vegetation honor those reservations.
   Road/rail/station access, bridge ramps, door approaches and spawn/arrival space
   stay usable. Check actual trunk/ground footprints and visual canopy overhangs,
   including curved rail and roof passengers, not only tree anchor points.
3. **No circular planning.** Existing roads/rail are planned from the base geography;
   first-slice ponds are admitted outside their reservations. Vegetation follows
   final land/water. Do not let rail query nature while nature recursively queries rail.
4. **Stable bounded ownership.** Features have deterministic owner cells and IDs,
   halo discovery across chunk boundaries and bounded caches. Generation is
   independent of chunk order, query size, camera and worker scheduling. Sampling
   budgets may coarsen an overview, never alter actual trees or ponds.
5. **Editable ordinary world content.** Trees use normal procedural props and
   preserve deletion/move records on unload and reload. Ponds use shared terrain
   realization/edit semantics. No separate scenery-only tree layer with different
   collision or persistence.
6. **Art and physical meaning stay distinct.** Ground footprints, trunk collision,
   canopy extents, placement spacing and terrain compatibility need explicit
   metadata. Reuse compatible existing assets; new compositions/source crops have
   their own review identities. Ordinary woodland retains trunk gaps; explicitly
   solid thickets have continuous ground bands and narrower tapered cap footprints.
7. **Shared engine consumers.** Explorer exact views, lab recipes and game consume
   the same natural planner/realizer. Keep the existing terrain cache, depth ordering,
   authority and prediction owners; no lab-only forest physics or train motion.

## Elevation later

Keep habitat, ground material, physical landform and local decoration distinct.
Future landform sampling can supply physical height, slope, exposed cliff edges
and water-level suitability without replacing vegetation composition. Do not
invent unused persisted height/biome schemas now or reinterpret the current noise
elevation as world pixels.

The next elevation proof should be one walkable mesa: a flat top, visible cliff
edges and one ramp approach, with trees on suitable level ground and exclusions
at steep edges. Prove support, falling, shadows, occlusion, seams and editing in
World geometry before generating ranges. Road/rail grades and water at different
heights then need explicit planning, not a terrain-noise amplitude increase.
Use ordinary ground plus bounded additional surfaces where necessary, consistent
with the existing geometry direction; avoid making every landscape tile a prop.

## Delivered preview (2026-10-07)

[Open the landscape lab](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-forest&landscape=balanced#/tool/world-geometry).
Six fixed cases cover meadow, grove, forest, clearing/edge, pond bank and the real
seed-2026 town railway. Each offers sparse/balanced/lush composition, walking,
pause, zoom, reset and temporary save/reload; the train case has roof boarding and
train/player follow. Eighteen distinct candidates appear in the Natural landscapes
Workshop batch, with exact-source composition fingerprints and shared review notes.
No human verdict was created by implementation or validation.

The [regional overview](https://tilefun.graehlarts.com/tilefun/world-explorer.html?seed=2026&x=-350&y=-450&zoom=1&landscape=balanced)
uses the same habitat/pond planner. Light meadow, medium woodland and dark forest
show suitability; blue markers show admitted ponds at bounded regional scales.
Zoom in for the actual terrain and oak props. Broad views omit local ponds and
infrastructure exclusion detail. Composition changes invalidate exact tile caches;
share links preserve the profile. **Walk here in landscape lab** opens a temporary
scene at dry, unobstructed ground nearby. Saved-world and archived views cannot
apply this experimental composition; creating an ordinary world omits it.

`NaturalLandscape` owns deterministic fields, reservations, local ponds and tree
anchors. `NaturalStrategy` composes normal railway/traffic/district generation.
The optional profile is supplied to `createGenerator`, RealmOptions and data-only
ScenarioRecipe; it is not a new persisted world descriptor or historical generator.
The default factory path remains unchanged. Trees use ordinary procedural IDs,
normal geometry, replication, edit records and residency. Neighbor-priority spacing
removes close trunk pairs without relying on query order. Ponds have shallow/deep
water and sand banks, bounded wholly inside deterministic owner cells.

This first spatial/composition proof uses the existing oak sprite only. The audit
found three standalone source tree families and three cap/center forest kits,
including loopable dense examples. Their outdoor geometry and composition review
remain separate from the working oak prop; fenced tree rows are not wild forests.
[Plan 068](../tactical/068-natural-landscape-preview.md#asset-audit-checkpoint)
records the reuse decisions and current evidence. New palettes, ground plants and
forest modules are follow-up work; no new wildlife or elevation art was produced.

## Repeating forest thickets (2026-10-07)

The owner reported thin vertical lines between repeats. A source-only runtime
probe reproduced a background gap at standard zoom: a 128px repeat scales to
307.2px while independently rounded origins sometimes advance by 308px. The shared
sprite renderer now snaps both projected edges, eliminating gaps/overlaps on
Canvas and GPU; no atlas pixels, crop periods or row spacing changed. Natural
candidate fingerprints now include the shared sprite drawing source explicitly.
The seeded composition remains unapproved pending human review.

[Open Forest pattern 1](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-thicket-1&landscape=thicket#/tool/world-geometry).
The **Extra dense · forest patterns** profile adds large forest masses using all
three native kits (F01–F09), with separate pinned scenes for each. The earlier
forest case is now labelled **Woodland · individual trees**. Nine scenes × four
profiles give 36 candidates; all new/changed compositions remain reviewable.

`ForestThicket.ts` compiles ordinary multipart props from unmodified atlas crops.
Centers retain their 128/128/112-pixel horizontal periods and 48-pixel vertical
step. Each row gets a seed/global-row phase on the 16-pixel grid. Left/right caps
finish each run, preserving F03's shorter source height. This reuses the accepted
staggered-interior direction without claiming the new boundaries were already
approved. No fenced-tree art or source pixels changed.

The same natural planner chooses bounded irregular masses in 128-tile owners,
admits complete dry rows outside infrastructure, and suppresses overlapping lone
trees. Three kits form coherent patches rather than alternating within a row.
Their continuous center footprints block normal walking/jumping; caps narrow at
the sides, and trees remain removable through ordinary procedural edit records.
Rows have finite 80-pixel collision height and no walkable canopy platform.
The precise regional map distinguishes their solid ground from walkable woodland;
broad maps still omit local footprint detail.

The Extra dense profile also increases broad forest cover. The pinned town-to-town
ride streams actual thicket rows while retaining production track clearance and
roof support. Default-world generation remains unchanged.

## Review and next step

Current sequence: review the mixture of open woodland and solid forest → integrate
the chosen current regional composition → broader palettes/ground plants → mesa
proof. Compare **sparse / balanced / lush / extra dense** at the same seed/location.
Review mass size, staggered edges, source-ground joins, collision at the visible
front and sides, available routes, shore readability and scenery pacing.

Performance evidence must include sustained forest/train traversal, generation
cost, prop residency and visible readiness. High-speed travel is a primary use
case, not a final screenshot-only check. Exact review and promotion follow
[art review](art-review.md); runtime output follows the one-current-generator
policy. Do not retain multiple historical landscape generators.
