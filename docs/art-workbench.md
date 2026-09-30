# Art workbench

Open [the live workbench](https://tilefun.graehlarts.com/tilefun/art-workbench.html).
This deployment serves the checkout through Vite. The game menu and world
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

`public/data/art-catalog.json` describes 91 PNG sheets and currently 356 recorded
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

The [building lab](https://tilefun.graehlarts.com/tilefun/building-lab.html?scene=mixed)
composes the first source-audited candidates from the dense-city note. There are
22 prefab configurations: bay-window, flat-front, and compact apartments;
hotels; and bakery, butcher, bait, ice-cream, and fitness storefronts with
mixed-use variants. Apartment, retail, and hotel blocks align frontage at
native dimensions with a mix of heights. Select an individual building, inspect
its source pieces, or toggle shared footprints/entrance approach positions.
Links preserve the scene and prefab ID. Name that recipe ID in art feedback.

`CityBuildingPrefabs.ts` supplies the source art, piece offsets, bounds, and
entrances. The lab calls the same `createProp`, `collectScene`, and
`drawScene2D` pipeline that gameplay uses. The terrain is a diagnostic pavement
stage rather than a second city generator. The narrow window-only strip is
combined with a door-bearing wing for a standalone flat-front apartment. Hotel
entry art and shop signs retain their own placement/layering. Native source
bounds and the exact selected PNG fingerprint are tested.

These are **candidates** for human review. The frozen Regional v1/v2/v3 district
lists do not spawn them; height variation does not promise playable upper
floors. Starter coverage includes the main Condo 4/Hotel families and five
shop fronts from the selected rectangle; remaining signs, commercial fronts,
and accessories can expand the library after this review.

## Next work

See [Tactical 006](tactical/006-art-workbench-and-city-variety-plan.md) for the
progression from annotated source art to audited building recipes and denser,
varied city profiles using shared explorer/game realization.
