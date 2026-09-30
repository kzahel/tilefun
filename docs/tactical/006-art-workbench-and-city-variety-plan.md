# Art workbench and denser, varied cities

Status: art workbench and first shared building prefab/block showcase implemented
2026-09-30; human composition review and new city profiles remain planned.

## Motivation

Tactical 005 established shared, versioned world generation and real-tile
previews. Regional v3 is a useful starting world, but its settlements have a
limited facade family and spacious layout. The next product goal is denser,
more varied cities, including multi-unit buildings with SF/NYC-like visual
character. Modern Exteriors has more relevant art than the current recipes
realize. We need a shared way to identify that art, know which pieces are
already sliced and referenced, and turn human selections into reviewed assets.

Do the art communication step first. Density alone repeats the existing
facade more often; distinct building families, heights, street frontage, and
neighborhood structure need to develop together.

## 1. Source inventory and annotation — implemented

The [art workbench](../art-workbench.md) reuses the existing Exteriors/Interiors
indexes and derives source uses from production definitions. It browses major
sheets, searches slices, traces systems/source locations, overlays use regions,
and selects either a tile, region, or exact indexed sprite. Selection URLs and
PNG fingerprints make discussions reproducible. Notes persist in a machine
inbox, with an offline browser outbox, pending/in-progress/resolved states,
agent replies via CLI, and cross-browser visibility. The existing public Vite
deployment serves the tool; there is no separate deployment to visit.

Initial inventory: 91 source sheets, 228 recorded uses, 4,816 matched Exteriors
slices, and 19,493 Interiors entries. Coverage is explicit and conservative;
registered/editor-available art and actual generator references are distinct.
No generator recipe, legacy label, or saved world changes merely by annotating
art. Existing house props and current Regional facades have shortcuts; **City
apartments** opens the Condo family, including upper floors, roofs, ground
floors, balconies, and fire escapes. SF/NYC are desired visual directions, not
vendor classifications automatically assigned from a sprite name.

Validation covers exact packed coordinates, rectangle bounds, pinned old
source revisions/dimensions, real PNG hash verification, immutable note targets,
serialized writes/idempotent retries, persistence across new store/browser
instances, same-origin writes, mobile selection, and offline recovery. Typecheck and build
pass, with 1,053 unit tests and all 128 browser tests green. Desktop and phone
layout captures were visually inspected; phone input checks use browser touch
emulation, not a physical device.

## 2. Audit candidate building families — first showcase implemented

The first dense-city note selects source rectangle `[1104, 1808, 1136, 864]` in
the pinned Exteriors PNG. `CityBuildingPrefabs.ts` records that selection's
fingerprint and note ID and supplies 22 shared candidate configurations.
The [building lab](https://tilefun.graehlarts.com/tilefun/building-lab.html?scene=mixed)
shows three apartment forms, hotels, and five retail fronts, with height and
mixed-use variants plus apartment/retail/hotel block examples. There is no
baked facade atlas: source parts pass through the ordinary prop factory,
scene collector, and game renderer. Source-use inventory now includes these
candidate recipes, with a distinct showcase system label.

The 64px window strip is a facade wing, not a standalone home. The flat-front
prefab combines it with an 80px door strip; hotel entrance carpet is a separate
piece. Ground storefronts draw after upper facades so their projecting signs
remain visible. Block frontages use native widths, without stretching art.
Bounds, approach positions, source rectangle/fingerprint, and preservation of
the frozen district recipe list are checked. Single/scene links preserve IDs;
source links point back into the art workbench. Starter coverage does not yet
include every sign, storefront variant, or accessory in the broad selection.
The original note remains in progress while composition review and city
integration are outstanding.

Validation: typecheck, build, and all 1,059 unit tests pass. The full browser
suite passed 135 tests; after the final door-wing composition adjustment, all
20 affected building-lab, art-workbench, world-creation, and gameplay checks
passed again. Desktop and emulated phone captures were visually inspected.

Review follow-up: the building lab now has a **Leave feedback** form below the
preview for a whole block or one building. Notes and replies use the same inbox
as source annotations, with shared outbox/retry and PNG-verification code.
Threads preserve scene/recipe IDs, a recipe-definition hash, and a preview URL;
drafts and offline submissions stay with their original target. This removes
the need to manually copy a recipe ID into a source-sheet annotation.
Follow-up validation: typecheck/build and 1,060 unit tests pass; all 138 browser
tests passed, with all 14 lab/workbench checks rerun after the final draft and
target-preservation fixes. The feedback form's phone layout was inspected.

The first composition feedback identified dark seams between facade strips.
The lab's resized canvas had reset to smooth image sampling, blending
transparent atlas gutters into opaque sprite edges. Resetting nearest-neighbor
sampling after every resize fixes this. A regression failed on the old preview
and now checks exact source RGBA at the join before/after redraw. Typecheck,
build, 1,060 unit tests, and all 139 browser tests pass; corrected captures were
visually reviewed.

Next audit work:

Use the human pending notes as the shortlist. Start with Condo 1–9, especially
Condo 4's floor/roof/ground pieces and Condo 7–9's balconies/fire escapes; also
inspect the modular building and Office themes. These are candidate art,
not yet audited recipes. For each family record:

- Stable family/variant IDs and exact source rectangles, with links to notes.
- Facing and perspective, repeatable middle pieces, corner/end caps, roof
  termination, recolor/material options, and any complete example sprites.
- Native pixel height versus occupied ground footprint; entrances/stoops,
  street alignment, occlusion, walls/collision, and walkable approach clearance.
- Supported configurations and rejected combinations. Check fire escapes and
  roof props as decorative pieces before implying playable upper floors.

Compose small building examples for side-by-side human review, using the same
parts and renderer the game consumes. Link recipes back to source selections
and source uses back to recipe IDs. Build check failures must identify missing
or invalid rectangles rather than silently selecting a neighboring tile.
Resolve the originating art notes only after delivering their requested use.

## 3. Shared building/prefab metadata

Extend the existing facade recipe contract rather than adding a new explorer
renderer. Recipes own part placement, ground geometry, entrance semantics,
height, supported floor count, and rendering/collision facts. Store family
options separately from the district planner's choice of a lot/height/family.
Reusable facades may combine several noncontiguous source regions; the note
workflow can start with several related single-region notes, then gain grouped
selections and recipe-preview links if needed.

Expand automatic inventory adapters for dynamic architectural selectors,
extracted props' original rectangles, composed sprites, and explicit prefab
links. Prefer read-only adapters over a duplicate manually maintained list of
coordinates. Add observed runtime usage only as a separately labeled diagnostic
layer: a static reference and a spawned instance answer different questions.

## 4. Dense and varied city profiles

Freeze Classic and existing Regional v1/v2/v3 descriptors. Add a new pinned
Regional revision/profile for the changed realization, retaining all existing
world identities and terrain outputs. Profile parameters should control
frontage width, block size, lot coverage, building-height range, gaps/setbacks,
shop/residential mix, parks, street widths, and family/material distribution.
Resolve configuration in the descriptor and persist it once, so seed/profile
links produce the same buildings in the explorer and actual game.

Prototype a dense center, compact residential blocks, and mixed shop/residential
streets. SF-like and NYC-like profiles should vary the composition and street
character, not just swap a color. Use finite city/district ownership and stable
lot IDs. Dense footprints must not overhang navigable sidewalks, erase avenue
connections, obstruct crossings, or place entrances against another building.
Terrain admission remains authoritative; do not stamp cities across unsuitable
water/coast merely to reach a density target.

The planner emits shared lot/family choices and placement facts. Game authority
and explorer consume the same realization, facade recipes, tile derivation,
scene collector, and renderer. Add configurable profile controls to the
explorer, and carry the complete identity into Create/Play here and game world
creation. Keep overview/detail ownership consistent and resident work bounded.

## 5. Review and gameplay integration

Add reproducible city cases for varied seeds, street corners, dense frontage,
height transitions, shops beneath apartments, parks, and coast boundaries.
Review both full blocks and individual building compositions. Validate safe
arrival, entrance approach, camera occlusion, chunk boundary seams, actor route
access, persistent edits/tombstones, and shared child-interior identity. Reuse
existing furnished interiors; floor count in exterior art must not promise
multi-floor gameplay before that feature is implemented.

Measure actual generation/render/asset costs of denser scenes and enforce
existing bounded worker/residency contracts. Revisit prop/actor budgets only
with evidence. Desktop mobile layout is not a substitute for physical phone
profiling. Final acceptance includes human style review and an actual game
visit from the exact explorer preview, with unchanged older revisions.

The immediate next checkpoint is human review of the shared building/block
showcase, then promotion of approved families into a new pinned dense-city
profile. Existing generators remain frozen.
