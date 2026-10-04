# Underground garage proof

Date: 2026-10-04. Owner: [world geometry](../topics/world-geometry.md).
Status: complete; ready for human review.

## Bounded model

The authorized next proof is one underground parking floor beneath usable ground,
joined continuously to the street by an open descending ramp. Keep the existing
raised-deck fixture and whole-patch cutaway. No world generation, art promotion,
vehicle routes, indoor realm migration or player-centered cutaway holes.

Continue using `SurfacePatch` through the existing prop-definition adapter:

- A floor carries `id`, `spaceId`, a plane and footprint, slab thickness and
  neighboring floor IDs. `excavation: {}` lowers the solid terrain base locally
  to that plane; it represents an open entrance when there is no ceiling ID.
- `excavation: { ceilingId }` identifies a separate matching ceiling slab. Its
  top remains usable ground; its underside is the room's physical ceiling.
- Excavation footprints are tile-aligned and nonoverlapping. A ceiling must
  match its floor footprint and clear the floor everywhere. Several ordinary
  surfaces can later sit within a deeper excavation; this slice proves one floor.
- Neighbor IDs remain authoring metadata. Actual traversability follows the
  connected geometry and clearance, not a teleport or a portal-state override.
- Space identity is derived from XYZ and floor/ceiling membership, including
  during jumps. Existing XYZ/velocity persistence is sufficient to restore this
  identity; there is no independently mutable saved floor selector.

This is bounded surface authoring, not arbitrary voxel carving. Terrain retains
its original height grid. Only explicitly declared openings lower its collision
base. Queries partition the moving footprint at tile and opening boundaries,
keeping even a narrow strip of uncut terrain solid. The same queries are used for
movement, support, landing and shadow support by authority and prediction.
Surrounding solid terrain provides the underground retaining boundaries; the
ceiling's existing slab collision supplies headroom and usable ground above.
Legacy terrain-only behavior remains on its existing path outside excavations.
Tile solid/water flags are unchanged; digging beneath those is not yet supported.

## Fixture and presentation

[Open the garage](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=garage#/tool/world-geometry).
The selector retains the raised-deck regression scene. Garage starts are entrance
at street height, underground at −48, and street at the same XY at 0. Descend by
walking right and return left. Pause, reset, save/reload and touch controls remain
available. Status reports height, support and derived space; manual lower/upper
views reveal garage/ramp or street without affecting physics.

The lab still uses the production Realm, Worker, predictor and shared presentation
host. Shared surface rendering supports negative floors and their shadows. In
automatic mode a covered floor stays hidden from an exterior observer until its
ceiling is cut away; an observer inside that room can always see the floor, even
when perspective leaves the ceiling visible. This is a schematic inspection view,
not a general terrain mesh or multi-actor occlusion implementation. The garage
has its own excluded experiment candidate; it does not collect art approval.

## Validation

- Real Realm: continuous descent/ascent, no flight or realm switch, ceiling
  impacts, solid terrain perimeter, usable street at the same XY.
- Save/reload on the slope and underground; a translated fixture across x=256.
- Binary prop replication and client prediction preserve excavation metadata and
  negative heights, matching authority throughout the walk.
- Query tests cover exact sloped bases, adjacent openings, narrow uncut strips,
  space identity and rejected malformed floor/ceiling declarations.
- Canvas/GPU browser checks exercise real Worker walking, jumping, reload,
  inspection, fixture switching and disposal. Inspect both rendered levels.
- Validation completed: typechecks, lint (existing warnings only), 1,489 unit
  tests, regenerated art catalog/Workshop manifest, and production build passed.
  The browser suite passed 320 checks with one intentional skip; its remaining
  WebSocket security check hit another local process on the fixed test port.
  Both security transports passed when rerun on unused ports (321 passing
  checks overall). Garage coverage includes Canvas, GPU and phone controls.
- Browser/build validation used an isolated source snapshot to avoid concurrent
  unrelated Workshop edits; only harness ports changed. Canvas/GPU street and
  basement captures and the phone layout were inspected.
- `streaming:bench -- --assert-ready` passed on the shared checkout; every
  scenario ended with zero missing, incomplete or stale chunks. Final focused
  excavation/garage tests also passed after declaration validation was tightened.

## Follow-on boundary

Review descent, ceiling/retaining boundaries, same-XY level distinction and
save/reload. A road/rail crossing is a subsequent consumer after this proof.
NPC navigation, vehicle grades, authoring tools, stacked actor ordering and indoor
realm conversion still need explicit integration. Player-centered/growing cutaway
holes remain deferred.
