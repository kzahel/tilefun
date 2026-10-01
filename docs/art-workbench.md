# Art workbench

Start from [Indexes, atlases & labs](https://tilefun.graehlarts.com/tilefun/tools.html),
linked from the game's hamburger sidebar and world menu. The index describes all
nine tools and has shortcuts for source sheets, city art, review categories,
and map/tile previews. Tool headers and the in-game catalogs link back there.

The giant [complete Modern Exteriors sheet](https://tilefun.graehlarts.com/tilefun/art-workbench.html?sheet=me-complete&view=sheet)
opens at whole-sheet scale, ignoring the browser's previous selection. Use
Select region to highlight art, Save note for a shared comment, and Copy selection
link to share it. Shortcuts support `sheet`, `rect`, `q`, `theme`, `filter`, and
`noteStatus`; search/filter state survives reload and selection links.

Open [the live workbench](https://tilefun.graehlarts.com/tilefun/art-workbench.html).
This deployment serves the checkout through Vite. The central index and world
explorer link to the workbench. Local development uses the same
`/tilefun/art-workbench.html` path.

## Find and annotate art

Choose a source sheet, search its named slices, or use the **City apartments**,
**Existing house props**, and **Current facades** shortcuts. Modern Exteriors
contains Condo 1–9, modular floors, roof/entrance pieces, balconies, and fire
escapes. These are candidates for denser cities; an indexed sprite is not
necessarily part of a working building recipe yet.

Drag to pan and tap to select a native 16px tile. **Select region** lets you drag
an inclusive tile-aligned rectangle. Wheel, pinch, or the zoom buttons change
scale; arrow keys pan the focused canvas. Selecting a search result uses its
exact source rectangle, including packed Interior sprites whose coordinates
are not aligned to 16px. **Whole sheet** restores the overview. **Copy selection
link** preserves the sheet ID and exact rectangle.

Green boxes show recorded uses. Blue boxes show existing named slices at close
zoom. Gold marks the selection; pink marks open notes on the current source
revision. The selection panel shows overlapping named slices, uses, systems,
and repository source locations. Choose building/pattern/prop/terrain, write a
note, and **Save note**. The **Notes** list spans all sheets and supports pending,
in-progress, resolved, reopen, and source-selection navigation. Refresh fetches
agent replies and status changes. Export downloads the current notes and any
unsent events.

For a second machine, see [setup and local-data transfer](setup-and-local-data.md).
It distinguishes committed atlas assets from original packs, and explains how
to preserve full server review history, pending browser feedback and drafts.

## Shared feedback

Notes are posted to `/tilefun/api/art-notes` and appended to the ignored
`data/art-notes/notes.ndjson` inbox. A thread has immutable sheet ID, PNG SHA-256,
original dimensions, and source rectangle. It also records intersecting slice
keys, intent, note, status, reply, event ID, and date. GET returns the last event
for each thread. Retries are idempotent; status updates retain the target and
append an event. Plain text is displayed as text, including notes containing
markup.

The workbench stores drafts and a persistent browser outbox. It reports
**pending server save** until posting succeeds and retries on reconnect,
Refresh, or every fifteen seconds. Server persistence lets another browser or
an agent read the same notes. Browser-only/static hosting can browse and export
notes, but shared persistence requires the Vite/preview plugin or standalone
server. `ART_NOTES_DIR` overrides the inbox; automated browser tests use
`test-results/art-notes` so they cannot contaminate the human review inbox.

Read pending human notes with:

```sh
npm run art:notes
npm run art:notes -- --status=all --json
npm run art:notes -- set-status THREAD_ID in-progress 'Auditing facade pieces'
npm run art:notes -- set-status THREAD_ID resolved 'Added the approved building recipe'
```

Read the source revision and exact rectangle before acting. Preserve the note's
selection when replying. Never resolve a note merely because a candidate was
found: resolve after delivering the requested recipe/pattern or recording why
it will not be used. A note is a request to inspect art, not automatic approval
of collision, door placement, perspective, or a new generator version.

## Inventory and coverage

`public/data/art-catalog.json` describes 91 PNG sheets and currently 396 recorded
source uses. Both major atlas indexes are reused directly, rather than copied
into a second slicing catalog: 4,816 matched Exteriors slices and 19,493 packed
Interiors entries. **Indexed** means the original slicing/index exists and can
be browsed; **recorded use** means a source definition or literal reference was
found. Neither claims an instance is present in the currently loaded world.

The catalog builder reads shared prop definitions, building recipes, terrain
variant registration, BlendGraph base fills/mask banks, road overlay banks,
the detail registry, furniture definitions, and the shared sprite manifest.
Whole mask banks and animation sheets represent registered banks, rather than
proof that every frame is drawn. System references are conservative literal
references in production TypeScript; comments, templates, and tests do not
count. Dynamic architecture selectors, runtime/editor placements, and some
legacy extraction provenance are coverage gaps. **Without a recorded use**
means untracked, not guaranteed unused. Existing labels remain visible even
when they are legacy or inaccurate; inspect the original indexed name/art.

Regenerate after source definitions or images change:

```sh
npm run art:catalog
```

Builds verify the catalog against the current definitions and PNG hashes. The
browser also hashes the actual fetched PNG before permitting annotation,
refusing pixels from a stale inventory. Old notes keep their original bounds
and revision, are flagged when the image changes, and are never silently
retargeted. The initial implementation does not archive old PNG binaries;
retrieve the corresponding repository revision for an exact historical image.
The tool uses a viewport-sized canvas, lazy indexes, and bounded search-result
pages instead of a full-atlas-sized canvas or thousands of DOM thumbnails.

## Building prefab showcase

The [building lab](https://tilefun.graehlarts.com/tilefun/building-lab.html)
composes the source-audited candidates from the dense-city note: 28 individual
prefabs and three block arrangements. The queue starts with **Unchecked**.
Use **Previous / Next** to move through candidates without reopening a dropdown
or scrolling. The preview fits its stage; review controls sit alongside it on
desktop and immediately below it on phones. The scene and building selectors
remain available for an explicit jump, and links preserve both IDs.

- **Looks right** records your approval and advances. Approved candidates are
  hidden from Unchecked; **Show → Approved / All candidates** brings them back.
- **Needs changes** requires a reason, records a report, and advances. Reported
  candidates also leave Unchecked. After two reports the lab pauses, showing
  both reasons and the server save status. Say **“ready” in chat** when you want
  the agent to fix the batch. **Keep reviewing** starts another batch without
  discarding the reports; **Check for updates** reloads the latest compositions.
- **Undo last review** reopens the last judged candidate. Arrow keys navigate,
  Space approves, and X requests changes when focus is outside form controls.
- **Save feedback** leaves an ordinary note without judging or advancing. On a
  block, choose **Whole block** or jump to an individual building with **Note
  about**. **Building feedback & replies** shows the shared history.

Decisions persist in the shared art inbox and are visible from another browser.
Batch/pause state and target-specific drafts persist in the current browser.
Offline submissions keep their exact target and retry after reconnect; check
**pending server save** before telling the agent the batch is ready.

Each note pins the scene, recipe IDs, recipe-definition hash, source rectangle,
and verified PNG revision. Judgments also pin the unannotated rendered pixels
and their human decision time. Source, recipe, or rendered appearance changes
return a candidate to Unchecked. View scale and diagnostic geometry overlays do
not invalidate approval. Resolving a note or adding an agent reply is separate
from approving a building; neither hides an unchecked candidate. Old ordinary
feedback is preserved and never backfilled as approval. The art workbench and
`npm run art:notes` read these same threads; both tools reuse the persistent
outbox/transport and source-verification code.

`CityBuildingPrefabs.ts` supplies the source art, piece offsets, bounds, and
entrances. The lab calls the same `createProp`, `collectScene`, and
`drawScene2D` pipeline that gameplay uses. The terrain is a diagnostic pavement
stage rather than a second city generator. Explicit facade sockets distinguish
the closed left bay, open infill, and closed right entrance. Complete chains
must close both ends and match internal attachments. The vendor's large top
sprites are split into roof and wall bands; all roof sections share a datum.
Detached roof-access sprites are deferred accessories, not required caps.
Storefronts use the flat `Floor_Modular_Building` family, with the same 112px
frontage for shop, upper walls, and roof. Ground walls are 48px high, upper
floors are 64px high, and shop signs overhang the ground wall. Each shop has its
own door approach position. The projecting Condo 4 family is incompatible with
these flat shop fronts; the earlier bay/brick-fill attempt was removed.
The additional audited source regions are `Roof_1` at `[2256,1936,112,96]` and
`Middle_Floor_1` at `[2544,1984,112,64]`, pinned to the same original PNG. These
regions extend the original shortlist, and are explicitly recorded in
`CITY_COMMERCIAL_ENVELOPE`. Tests reject incompatible profiles, widths, and
ground datums. The main storefront art already includes its edges; adjacent
extension strips are not appended as duplicate caps. Bare storefront entries were retired; old `-1`
review bookmarks open the complete two-level building. Apartment candidate IDs
remain bookmarkable, with updated names and composition hashes. Saved notes
keep their original context and flag changed compositions when opened in the
lab. Frozen generator recipes retain their old outputs.
Hotels include the full top band `[1904,1824,272,32]` (missing from the vendor
atlas index) and the separate 16px `Hotel_Modular_4` trim. The detached panels
at `[1952,1808,32,16]` / `[2112,1808,32,16]` are omitted following human feedback;
their identity and proper attachment remain uncertain. They can be revisited
as optional accessories after an art audit. `CITY_HOTEL_ART` records the active
source regions and optional signboards:
rooftop `[1968,1744,144,64]` and
right-side `[2192,1952,48,176]`. Each 3/4/6-level hotel has no-sign, rooftop-sign,
and side-sign shared recipes. **Hotel sign** switches between them above the
preview, preserving the floor count and a bookmarkable recipe ID. The existing
unsuffixed hotel IDs mean no sign; new IDs end in `-roof-sign` / `-side-sign`.
Each variant has its own review and draft. Restoring the roof reopens old hotel
judgments; apartment and shop recipes stay unchanged. The hotel block uses the
no-sign variant, so side signage does not overlap a neighboring facade.
`buildingVisualBounds` derives art extents from shared pieces for both preview
framing and gameplay culling, including the projecting side sign. Hotel wall
footprints remain 272×32 with the same doorway regardless of signage.
Hotel entry art and shop signs retain their own placement/layering. Native
source bounds and the exact selected PNG fingerprint are tested. The lab's
**Facade attachments & roof** panel exposes the topology for review.
The preview resets nearest-neighbor canvas sampling after each resize, matching
gameplay. A pixel-level browser regression checks adjoining facade edges
against the opaque source pixels, including after a redraw.

These are **candidates** for human review. The frozen Regional v1/v2/v3 district
lists do not spawn them; height variation does not promise playable upper
floors. Starter coverage includes the main Condo 4/Hotel families and five
shop fronts from the selected rectangle; remaining signs, commercial fronts,
and accessories can expand the library after this review.

## Next work

See [Tactical 006](tactical/006-art-workbench-and-city-variety-plan.md) for the
progression from annotated source art to audited building recipes and denser,
varied city profiles using shared explorer/game realization.
[Tactical 007](tactical/007-dense-city-districts-and-street-life-plan.md) records
the current playable dense-neighborhood review and remaining street/parking,
park/square, architecture, market and crowd phases.

## Street starter review

The [street starter run](https://tilefun.graehlarts.com/tilefun/building-lab.html?run=streets)
shares the Building Lab page, note inbox, source verification, verdict handling,
offline outbox, and approve/report/pause workflow. Its six cases cover parking
pay stations, lighting/bollards, bins, seating/planters, stationary cars, and a
combined commercial sidewalk. Review navigation/filter/pause state is scoped
to this run; building decisions remain independent. Undo targets the current
run. Direct links preserve `run=streets&case=street-v1-…`.

This is phase 0 of [Tactical 007](tactical/007-dense-city-districts-and-street-life-plan.md).
It frames the shop's lower floors for street-level context. Pavement bands and
parking outlines are a diagnostic stage; generated streets, walking NPCs, and
a playable district follow after this palette review. Geometry shows the 40px
walking strip in green, the shop approach in gold, and actual game collision in
red. Furniture colliders fit the curb zone; cars fit their parking bays. The
normal game factories and scene renderer draw all sprite pieces.

`StreetRecipes.ts` owns seven new source-audited prop definitions and six place
cases. The gameplay factory, editor palette, art inventory and scene review use
those definitions; frozen generators do not select them. Existing lamps/benches
are reused. Each new prop records its vendor slice, native size, facing, zone,
collider and material. Source references are labeled **Street starter review
(candidate)** rather than claiming that world generation already uses them.

For backward compatibility street notes extend the existing `buildingReview`
record with `scene: "street"`, an immutable `caseId`, and the `propTypes` used
alongside `prefabIds`. The definition hash includes the entire scene and realized
building/prop geometry. Verdicts pin unannotated rendered pixels as before.
Scene IDs and source/recipe/render revisions keep approvals independent even
when two scenes use the same building. Saved feedback, atlas links and
`npm run art:notes` expose the street case and prop identities. A changed scene
returns to Unchecked; an agent reply never creates approval.


### Road foundation review

[Road foundation](https://tilefun.graehlarts.com/tilefun/building-lab.html?run=surfaces)
is linked from the central tools index. Nine cases compare road widths, curb
joins, crossings and a rounded raised median using the two annotated source
banks and neighboring warm pavement. It reuses Building Lab's review controls,
shared inbox, offline saving, exact appearance invalidation and two-report
pause, with independent navigation. No agent-generated approval events.

Surface records use `buildingReview.scene: "surface"`, a `surface-v1-*` case ID,
`surfaceRecipe: "city-surfaces-v1"` and `prefabIds: []`. The field name remains
for backwards compatibility; no building IDs stand in for terrain. Source-use
inventory labels every sampled surface rect as a candidate, with direct atlas
links in the review. `CitySurfaceRecipes.ts` owns composition for reuse in the
next district renderer; this checkpoint does not change existing worldgen.

## Playable dense neighborhood review

Open [Dense neighborhood review](https://tilefun.graehlarts.com/tilefun/building-lab.html?run=districts),
linked from the central index. Three independently reviewed windows show the
whole neighborhood, apartment/shop frontage, and hotel/pocket green. They are
views of one actual `regional-v4` seed-2026 world at tile 300,519, not separately
assembled art fixtures. **Explore / play this neighborhood** opens the existing
explorer with the complete descriptor; **Play here** enters the same generator.

The shared Building Lab controls preserve drafts, next/previous, approval hiding,
offline feedback, undo and two-report pause. Notes identify `scene: district`,
`districtRecipe: dense-district-v1`, the case, promoted building IDs, prop types,
composition hash and unannotated render fingerprint. They do not approve the
underlying building or road cases. CLI and source-atlas history link back to the
exact view. The three new views initially have no human approvals.

Geometry shows reserved native-art lots/doors, actual factory colliders, and
planned pedestrian routes. Walkers in the preview are initial poses; gameplay
uses existing authoritative waypoint movement and collision. Shops/apartments
use existing persistent interiors. Rear/side space stays landscaped because
these building elevations face south. The pocket green is deliberately sparse;
parking, furnishing zones and more varied public-space recipes follow review.

`dense-city-assets-v1.json` pins eight previously reviewed building variants,
source fingerprint and native pieces under `prop-city-dense-v1-*` IDs. Builds
never regenerate this snapshot from editable candidates. The catalogue labels
these pieces and promoted neutral surface clips as **Dense districts
(regional-v4, promoted)** and links the manifest/composer/renderer. Existing
review candidates remain separately labeled. The divider feedback changed
only its candidate scene; the eight other approved road scenes retain their
exact composition and rendered fingerprints. The divider is not generated
by the first dense district.

Classic/island and Regional v1/v2/v3 remain frozen. Regional v4 explicitly uses
the original regional geography outside a compact four-block settlement core;
it does not include v3's farms/woodlands, broader city-profile variation or final
regional-road joins. The default stays v3. Future appearance/layout changes must
use a new pinned revision so saved v4 worlds do not silently change.
