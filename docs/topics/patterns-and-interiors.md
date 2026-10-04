# Shared pattern drawing and interiors

Topic: patterns-and-interiors
Status: Workshop/game pattern drawing and persistent gameplay room editing
implemented; tree-kit review/promotion and Workshop-to-game prefab import remain.
Updated: 2026-10-03.

Owns the shared semantic editing contract and current interior direction.
[Tactical 011](../tactical/011-shared-pattern-brushes-and-room-drawing.md) records
implementation details and validation; [Workshop](../tilefun-workshop.md) and
[Indoor Workbench](../interior-workbench.md) document usage.

## Current state and invariants

- `src/patterns/` owns versioned semantic documents, grid strokes, atomic edits,
  undo/redo and compiler adapters. Rule code has no DOM/React dependency.
  Workshop and gameplay share the terrain/road solvers and apartment compiler.
- Pattern studio draws rooms, fenced-tree strips, terrain and city surfaces on
  actual art. The legacy Indoor Workbench remains for tile-level experiments.
- Gameplay room plans persist with the interior realm and replicate on revision
  changes. Host validation and expected revisions reject stale/conflicting edits
  atomically. Old saves retain their original boundaries until edited.
- The street door/arrival landing stays reserved. Existing occupants need usable
  ground and a route out. Furniture footprint/access/doorway validation uses the
  compiled floor; invalid edits reject without silently removing furniture.
- Browser drafts and gameplay worlds are separate stores. Editing a room does
  not promote a kit or change a frozen generated-world revision.

## Player location, reload and building connections

The runtime retains one shared realm per parent world/building/floor (`0` for
existing interiors). Rooms in an edited floor share that realm. Door IDs name
connections into the realm; they do not create separate instances.
`BuildingDoors.ts` defines outdoor endpoints and indoor activation/arrival anchors.
Legacy identities resolve to the existing `street` connection. Explicit saved
connections can share one interior; leaving uses the selected door's endpoint,
not the player's entry history. The original street connection stays required.
Newly visited city buildings (`prop-city-*`) use saved `shop-v2` or
`apartment-v2` layouts. Shops have a sales floor and preparation room; apartments
have a bedroom, kitchen, living area and shared entrance hall. Audited facade
thresholds expose both butcher doors and the bay/arched apartment entrances.
Their left-to-right order matches the indoor south-wall openings. Both players
and empty arrival landings must retain a route to every exit after room edits.

The primary connection keeps the ID `street`; secondary IDs come from the pinned
facade facts (`butcher-right`, `bay`). Controls select the nearest doorway and
the server validates its ID and proximity. Outdoor endpoints follow a moved
building when its prop is available. No outdoor generator, facade art, promotion
bank or existing approved review image changes.

Previously visited rooms retain their saved identity, furniture, edits and single
street exit. Either visible exterior entrance can enter such a room at its original
landing; adding a second physical opening would require an explicit room migration.
Older regional/country-house recipes retain their original compact interiors.
Upper floors and per-building authored variants remain future work.

Four new layout cases are registered, unchecked, in Workshop's **Playable building
layouts** batch (`rooms-16`). This is a runtime content change using existing art,
not a human approval of those new furnished compositions.

`PlayerLocationStore` owns one durable current-location record per profile
(falling back to connection ID for legacy callers), separate from each realm's
saved visit history. It includes the realm, parent world, generator identity and
player position/progress. Solo startup and multiplayer auto-resume restore it;
explicit world selection still travels normally. Old saves without a location
record retain the previous startup fallback until the first checkpoint.

Transfers save the destination before committing the location record. A failed
commit restores the original live entity and leaves the prior durable location
intact. Simulation/input and checkpoints exclude provisional transfers. Profile
takeover waits for the previous transfer before saving/detaching its player;
a takeover save failure keeps the original connection usable and rejects the
replacement. Retired connections cannot reconnect and overwrite their replacement.
Reconnect waits for travel to settle before publishing a fresh baseline. Separate
profiles have separate locations. This coordinates clients of one authority;
independent solo tabs are still independent servers sharing browser storage,
not a supported local multiplayer session.

Restore checks actual compiled room ground, including extensions beyond the
original room. Unavailable buildings and invalid saved interior geometry fall
back to the saved parent/doorway when possible. Storage failures abort restoration
rather than silently overwriting the location with an outdoor fallback.

Dev full reload uses Vite's awaited `vite:beforeFullReload` hook to settle and
save the local authority before navigation. HMR replacement also waits for
shutdown. Ordinary navigation/crashes cannot await unload: realm transfers are
committed immediately, movement checkpoints run every five seconds, and hiding/
unloading makes a best-effort save. Camera restoration requires both the same
profile and realm; legacy unscoped coordinates are discarded.

Evidence: `RealmBrowser.test.ts` covers restart/resume, fallback, location-write
failure, takeover during successful/failed commits and explicit exit selection;
`PlayerLocationStore.test.ts` checks filesystem reopening and ordered retries.
`player-dev-reload.spec.ts` sends the real Vite full-reload event; gameplay interior
and room-editing browser tests cover saved furniture and expanded-room restoration.
`BuildingLayouts.test.ts` checks every pinned city facade's door geometry and
furnished connectivity; `RealmBrowser.test.ts` additionally checks simultaneous
entry through different doors, selected exits, restart and legacy city saves.
`building-doors.spec.ts` walks across both new layouts with real input, exits at
the opposite outdoor door and reloads in the same interior. The renderer also
handles the interval between receiving the realm identity and its room baseline.

Validation (2026-10-03): typechecks, 1,319 unit tests, 282 browser tests, build,
lint (existing warnings) and streaming readiness passed. All 513 prior Workshop
candidate records remain unchanged; the four new cases have no compiler exclusions
and match their hashes in normal Chromium at retina scale.

## Earlier interior work

[001](../tactical/001-modern-interiors-plan.md) is the original broad plan;
[002](../tactical/002-interior-wall-solver-plan.md) records the wall solver and
233 human-approved wall cases. Preserve those exact images and reopen wall work
only for a concrete furnished-scene failure. [003](../tactical/003-interior-furniture-plan.md)
records curated furniture, motion reviews and the shared support-depth fix.
Its final recorded checkpoint reopened bedside/worktable reviews; read current
feedback before assuming they are still pending.

Use [counterexample search](../interior-counterexamples.md) for reproducible
wall failures and [art review](art-review.md) for exact approvals and pause rules.
Rendering evidence and runners are routed through [performance](performance.md).

## Shared motion lab runtime

Furniture motion now compiles its layouts to ordinary props and runs a memory-backed
Realm in a Worker through [Gameplay scenarios](gameplay-scenarios.md). The layout
model keeps placement validation, path targets and review rendering; it has no
private player simulation. Physics version 2 reopens previous motion judgments
while retaining exact historical approvals and static art. Gameplay collider
compilation lives in FurniturePhysics, independent of the lab model.

## Next work

Review the four playable building layouts and try both entrances in co-op, then add
explicit Workshop-to-game prefab promotion/import with reviewed doorway and
occupancy contracts. The five fenced-tree kit cases were delivered unchecked;
consult the inbox before promotion. Additional tree variants, playground tubes
and new furniture families remain separate candidates, not implicit approvals.

## Automatic doorway traversal

Walking straight toward a door now enters/exits without pressing E. The trigger
is a narrow 16px-wide threshold with 100ms of directional intent; passing sideways,
standing nearby and editor movement do not trigger it. Reload/spawn, arrival and
an attempted crossing require leaving the nearby doorway before another automatic
crossing. E/the button remain available for explicit interaction.

The existing building/door connection selects the shared interior and exact exit.
The server validates grounded, unmounted play-mode movement and proximity (allowing
one tile of prediction lead along the approach, never sideways), prepares
the destination and saves the source, then broadcasts a 400ms cosmetic walk and
waits 180ms for the local fade. Authority stays at the safe source throughout that
walk. Only the existing transactional realm transfer changes the saved location.
After commit, clients wait for the destination player/room baseline (or outdoor
terrain cache). Indoor arrival fades in during its one-tile walk. Outdoor arrival
starts at the exact facade pose where the entry walk ends, reveals that doorway
for 180ms, then walks out to the validated landing. The cosmetic exit origin
comes from the selected door, never an offset from a potentially relocated safe
landing. Other players see the exit walk immediately; only the traveller waits
for their local reveal.
Guided poses never modify collision, prediction or persistence. Source players are
excluded from peer-driven simulation while travelling; arrival briefly suppresses
movement and interactions. Failed requests, disconnects and a bounded presentation
timeout release the fade/input lock. Dev reload still awaits the transfer lifecycle.

The butcher's two doors use the exact matching Modern Exteriors opening/closing
sheet as independent overlays, without modifying frozen facade pixels or generator
identities. Peers see the door/walk, while only the traveller sees the fade; concurrent
users keep a shared door open. Both apartment entrances have automatic travel and
fades, but retain static facade panels: the available condo animation sheets do not
match those pinned panels. Matching apartment art is the next visual extension.

New unchecked Workshop `doorways-v1` candidates show all 14 frames against each
butcher entrance. Existing static review identities remain unchanged. The six character
motion identities refresh because their review contract includes the shared Realm
controller source; their source art is unchanged. Evidence includes
`DoorTraversal.test.ts`, `DoorPresentation.test.ts`, `RealmBrowser.test.ts`, real-input
`building-doors.spec.ts` and a real Vite reload during departure in
`player-dev-reload.spec.ts`.

Validation (2026-10-03): all 293 browser tests passed, followed by eight focused
building/reload checks after the final approach-tolerance and visual endpoint
refinement. The 1,387-test unit suite passed; a later concurrent run hit two
five-second timeouts in furniture/city generation, whose 20 tests passed when
rerun separately. Typechecks, build, lint (existing warnings), art inventory and
Workshop raster parity passed. Streaming v4/v10 walking, sprinting and reversal
had zero missing-data or unfinished-cache frames (`--assert-ready` passed).
Next: review the two butcher animation candidates, then source or author matching
apartment door panels under new review identities.

Exit presentation correction (2026-10-04): the old exit started one tile before
its landing and spent almost half its walk under the fade, so the player first
became visible already out on the sidewalk. Entry and exit now share the facade
anchor, with the exit walk delayed until the reveal finishes. The authoritative
safe landing and the entry timing are unchanged. Regression checks cover both
butcher and condo secondary doors and sample actual presented player positions
through fade-in, rather than only checking the final server position. Exit door
overlays are resolved after outdoor destination preparation, so evicting the
facade while the player is indoors cannot silently drop its opening animation.

Validation: 1,421 unit tests and all 285 browser tests passed, including the
rendered exit/reveal regression and dev reload during travel. Typechecks, build,
lint (existing warnings), inventory generation and all 551 Workshop raster
identities passed. Current-generator streaming readiness passed with no missing
or unfinished terrain frames. Existing Workshop candidate records are unchanged.
