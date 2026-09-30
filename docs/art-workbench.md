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
composes the source-audited candidates from the dense-city note: 22 individual
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
