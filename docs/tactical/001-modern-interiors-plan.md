# 001 Modern Interiors Plan

Historical parent plan: original phase labels below have not been reconciled
with all later deliveries. Read [patterns and interiors](../topics/patterns-and-interiors.md)
for current state and the later wall, furniture and gameplay-room work.

## Goal

Build first-class indoor apartment support using the Modern Interiors asset pack. The end state is enterable buildings from the overworld, indoor maps with explicit architectural and furnishing layers, and procedural apartment generation from curated prefab room metadata.

## Current Understanding

- Modern Exteriors is already wired into runtime through `me-complete.png` and `public/data/me-atlas-index.json`, but it is mostly exterior-facing and has shallow semantics.
- Modern Interiors is the right source for apartments. It contains:
  - `Interiors_16x16.png`, a large 16-column master sheet.
  - `Room_Builder_16x16.png` plus room-builder subfiles for floors, walls, baseboards, arched entryways, floor shadows, connectors, and 3D walls.
  - Theme sheets for living rooms, bathrooms, bedrooms, kitchens, hospitals, shops, museums, condominiums, and other indoor contexts.
  - Numbered singles for furniture and decor, with normal, shadowless, and black-shadow variants.
  - Example home designs already split into layer images where layer 1 is shell/floor/walls and later layers are furniture/foreground.
- Automatic matching from numbered singles back to source sheets is useful but incomplete. Runtime should use a generated packed atlas with stable keys instead of depending on exact original atlas coordinates.

## Design Direction

- Treat Modern Interiors as a separate runtime asset family from Modern Exteriors.
- Generate a packed runtime atlas and JSON index from the source pack.
- Layer curated metadata on top of generated metadata:
  - Generated metadata: key, source path, source kind, atlas rect, size, variant, theme, room-builder category.
  - Curated metadata: semantic role, collision footprint, sort anchor, draw layer, room tags, doorway behavior, placement rules.
- Add explicit indoor map support instead of forcing interiors into the existing terrain/autotile model.
- Use portals to link exterior doors to `interiorId` instances and back to overworld exits.
- Bump save format when indoor layers become persistent. Backward compatibility should load old worlds with no indoor maps.

## Implementation Chunks

### Chunk 1: Generated Modern Interiors Atlas

Status: completed

- Add a script that packs Modern Interiors singles, room-builder tiles/sheets, and home-design layer images into a generated runtime atlas.
- Emit `public/data/modern-interiors-atlas.json`.
- Emit `public/assets/tilesets/modern-interiors-atlas.png`.
- Add asset source credit for Modern Interiors.
- Keep this chunk data-only plus tooling; no runtime rendering behavior yet.

Completed artifacts:

- `scripts/index-interiors-atlas.mjs`
- `npm run assets:interiors`
- `public/assets/tilesets/modern-interiors-atlas.png`
- `public/data/modern-interiors-atlas.json`

Generated counts:

- 19,493 total entries.
- 15,964 furniture/decor singles across normal, shadowless, and black-shadow variants.
- 3,476 room-builder tile entries.
- 9 room-builder sheet entries.
- 44 home-design layer/preview entries.
- Atlas size: 2048x8800.

### Chunk 2: Atlas Browser and Validation Scene

Status: completed

- Add a runtime loader for the Modern Interiors atlas index.
- Add a simple in-game or dev-only browser/filter for interior entries.
- Render one known prefab, starting with `Generic_Home_1`, using its layer images.
- Validate scale, transparency, draw order, and visual fidelity against the source preview.

Completed artifacts:

- `src/assets/ModernInteriorsAtlasIndex.ts`
- `src/editor/InteriorCatalog.ts`
- `src/scenes/InteriorCatalogScene.ts`
- `tests/interiors.spec.ts`

Runtime behavior:

- `modern-interiors-atlas.png` now loads as the `modern-interiors` sheet.
- `modern-interiors-atlas.json` now loads during client initialization.
- The side menu exposes an `Interiors` validation panel.
- The panel filters atlas entries by source kind, category, variant, and search text.
- The panel renders `Generic_Home_1` as a composed layer stack next to the source preview.

### Chunk 3: Headless Validation Capture Workflow

Status: completed

- Add URL-driven startup state for validation panels so Playwright can open directly to a target view.
- Support `?panel=interiors` with optional interior filters:
  - `interiorDesign`
  - `interiorSource`
  - `interiorCategory`
  - `interiorVariant`
  - `interiorSearch`
- Add a repeatable screenshot capture command for remote review.
- Save generated screenshots under ignored `test-results/interiors` artifacts instead of requiring manual browser interaction.
- Do not commit generated screenshot binaries; regenerate or copy them to temporary local paths for review links.

Completed artifacts:

- Startup route handling in `src/client/GameClient.ts`.
- Route-state support in `src/editor/InteriorCatalog.ts`.
- `tests/interiors-screenshots.spec.ts`.
- `npm run screenshots:interiors`.

Generated review captures:

- `test-results/interiors/generic-home-1-panel.png`
- `test-results/interiors/generic-home-1-layer-stack.png`
- `test-results/interiors/generic-home-1-source-preview.png`
- `test-results/interiors/room-builder-walls-panel.png`
- `test-results/interiors/room-builder-walls-grid.png`

### Chunk 4: Curated Architectural Metadata

Status: in progress

- Create curated metadata for room-builder floors, wall strips, baseboards, arched entryways, floor connectors, and door/opening variants.
- Define roles such as `floor-fill`, `back-wall`, `front-wall`, `side-wall`, `doorway`, `threshold`, and `foreground-wall`.
- Add basic collision metadata for walls and passable metadata for doorways.

Initial spatial-mapping subchunk:

- Add a draft generated-room renderer that uses atlas metadata, room-builder sheet crops, and individual room-builder tile keys.
- Render three room attempts in one screenshot:
  - Draft A: individual `3d-walls` tile keys from `c00-r00..c07-r06`, with role overlays for north, west, east, south, and corner hypotheses.
  - Draft B: the equivalent `3d-walls` sheet crop as a visual control.
  - Draft C: a rough flat-wall guess assembled from wall, baseboard, floor, and floor-connector tile keys.
- Capture the comparison with Playwright so feedback can happen from screenshots.
- Generate labeled source-grid captures for the wall/border/baseboard sheets used while validating atlas geometry.

Generated review captures:

- `test-results/interiors/draft-generated-room-comparison.png` (first draft, now replaced by the room grammar capture below)
- `test-results/interiors/3d-walls-source-grid.png`
- `test-results/interiors/borders-source-grid.png`
- `test-results/interiors/baseboards-source-grid.png`

Follow-up spatial-mapping result:

- The first comparison proved tile extraction but did not establish room roles. The 3D walls sheet contains several color families of partly assembled wall features; its first `c00..c07` crop should not be treated as a generic room.
- Exact tile matches against `Generic_Home_1_Layer_1.png` identify a useful gray family: `c11-r02/r03` form the repeating two-tile back-wall face; `c10-r00/r01/r02` and `c13-r00/r01/r02` form left and right edges. The same example uses `c08-r03/r04` and `c08-r00/r01` at a passage in a divider.
- `src/interiors/RoomGrammar.ts` now builds compact, wide, and divided cutaway rooms with explicit roles and blocking metadata. The front rail and its passage are still a visual hypothesis, not yet validated against an authored room.
- Repeatable capture: `test-results/interiors/room-grammar-variants.png` from `npm run screenshots:interiors`.

Generic Home 1 geometry study:

- The unfurnished source is 14 columns wide and 214 pixels high: 13 complete 16-pixel rows plus a 6-pixel bottom trim. Its upper wood-floored room widens asymmetrically into west and east bays, narrows through tapered corners, and joins a lower gray-tiled room through a one-tile divider passage.
- Walkable openings reach the north, west, east, and south image boundaries. The divider passage is a fifth named connection. The semantic cell map and tile recipe live in `src/interiors/GenericHomeGeometry.ts`.
- Rebuilding the image from room-builder tiles yields one visible pixel difference from the source. The visual comparison and topology map are captured as `test-results/interiors/generic-home-1-geometry-study.png`.
- The straight east interior column and the hall row can be repeated without moving corner or doorway pieces. A 16-column, 16-row derived variant is captured as `test-results/interiors/generic-home-1-derived-variation.png`.
- The simpler room grammar now uses the source's one-tile passage and six-pixel bottom trim. Taper pieces are reserved for shape changes instead of being placed at every front corner.
- The simple divided-room preview now replaces both side-wall cells at the divider with the source's left and right end caps; its wall face reaches both outer edges without a one-tile seam.

Layered shell follow-up:

- Generic Home 1's source preview is an exact pixel composite of Layer 1 (architecture) and Layer 2 (transparent furniture/decorations). Several architectural pieces also contain transparent pixels: the shallow front edge and tapered side corners are examples.
- `src/interiors/LayeredInteriorMap.ts` now stores independent floor, wall, foreground, and object placements within each semantic cell. The two tapered cells in the source shell each have both a floor underlay and transparent wall foreground piece.
- The Generic Home shell and its stretched variant now render through those layer channels. The source shell remains one visible pixel from the Layer 1 asset, and the repeatable `generic-home-1-layer-study.png` capture shows floor, wall, and recombined output separately.
- `src/interiors/ConnectedRoomGrammar.ts` now compiles two-room semantic plans into those layer channels. The straight and offset examples select two-tile back/divider walls, source passage caps, a transparent floor-overlaid taper at the offset, and the six-pixel front trim. `test-results/interiors/connected-room-grammar.png` places both outputs next to the source shell and their semantic maps.
- The apartment sketch renderer still uses its first flat one-cell wall recipe. The next visual-grammar pass should adapt its room adjacency and openings to the new connected-room rules before evaluating whole-apartment previews.

### Chunk 5: Indoor Map Model

Status: pending

- Add an indoor map representation with explicit layers:
  - `floor`
  - `wallBack`
  - `wallFront`
  - `furniture`
  - `foreground`
  - `collision`
  - `portals`
- Decide whether indoor maps are chunked or fixed-size room instances for the first version.
- Add sync and persistence models.
- Bump save format and migrate old saves to empty indoor data.

### Chunk 6: First Enterable Building Flow

Status: pending

- Attach portal metadata to one exterior building/door prop.
- Enter from overworld into a fixed test apartment.
- Exit back to the correct overworld door.
- Preserve player position and camera behavior cleanly across the transition.

### Chunk 7: Procedural Apartment Generator

Status: in progress

Wall compiler architecture and continued visual review are now detailed in
[the wall solver and rapid review plan](002-interior-wall-solver-plan.md).

The first separately placeable furniture catalog and its adapted review workflow
are detailed in [the furniture plan](003-interior-furniture-plan.md).

Floor-plan-driven prototype:

- `src/interiors/ApartmentFloorPlan.ts` parses an editable character grid: `L` living, `B` bedroom, `K` kitchen, `T` bath, `H` hall, `#` wall, `+` passage, and space outside. `ApartmentArchitecture.ts` expands each sketch cell into a two-by-two group of 16-pixel atlas tiles so shared walls can use one visible side-wall face and dividers can use two source rows.
- The parser checks door orientation, requires an exterior entrance, and flood-fills passable cells to reject disconnected rooms.
- The layered preview uses the approved Generic Home material family: wood in living, bedrooms, and halls; gray tile in kitchens and baths; gray 3D wall tiles throughout. It derives source jambs, side-wall tapers over floor, and shallow south-facing trim from the sketch. A horizontal-to-side-wall elbow uses the source corner sequence; an inset south edge uses the shallow rail and tapers. Side passages too close to an upper corner are rejected with a location-specific error. The small, large, irregular, and offset-room examples all retain connected floors.
- The Interiors panel exposes the sketch for live edits and shows validation errors. Run `npm run screenshots:interiors` for `small-apartment.png`, `large-apartment.png`, `strange-apartment.png`, `stepped-apartment.png`, and an edited `custom-apartment.png` in `test-results/interiors/`.
- `src/interiors/AdvancedSuite.ts` now composes the validated Generic Home shell with west/east side rooms and an optional lower room. The four-room cross and asymmetric five-room examples use source-family wall faces, floor continuation at each connection, and semantic reachability checks. Their captures are `advanced-suite-cross.png` and `advanced-suite-offset.png`.
- The side branches now use the source's tapered wall returns over a wood floor underlay. Wood continues through the east opening before changing to tile inside that room. The lower branch replaces the source's shallow exterior trim with a shared two-row divider and matching passage caps, removing the dark seam between rooms.
- The upper side-room joins use the complete five-row corner sequence from the atlas. A one-row top margin lets the rooms rise far enough above their openings for the wall border and face shading to turn together; shorter returns had left dark strokes inside the wall face.
- This prototype fills architectural surfaces. Furniture placement, generated floor plans from apartment constraints, indoor collision/portal persistence, and game-world entry remain follow-up work.

- Generate floor plans from room rectangles and doorway constraints.
- Extend the floor-plan compiler with furniture-safe wall/door clearances and more corner variants.
- Place furniture from curated room role pools.
- Validate walkability from entrance to major rooms and exits.
- Support deterministic generation from seed and apartment type.

### Chunk 8: Editor Workflow

Status: in progress

- The standalone Indoor Workbench at `/tilefun/interior-workbench.html` opens named apartment fixtures without starting the game. It shows editable semantic cells and the layered atlas rendering together, with plan painting, per-layer tile overrides, inspection, rectangular feedback flags, local autosave, and JSON export/import. On narrow screens the two views can be switched or stacked. See `docs/interior-workbench.md`.
- Add prefab stamping for rooms and whole apartments.
- Add collision/portal visualization and a playable indoor scene.
- Use exported flags and tile overrides to refine the compiler rules and atlas role metadata.

## Open Questions

- Should the first playable interiors be fixed-size instances or chunked indoor worlds?
- Should furniture be stored as props, indoor objects, or a new shared placed-object type?
- How much of the numbered singles should be curated manually versus grouped by theme and selected visually?
- Do we want normal, shadowless, or black-shadow furniture as the default visual style?
- Should indoor floor/wall layers render through the existing chunk cache or a separate indoor renderer?

## Status Log

- 2026-07-04: Created tactical plan and started Chunk 1.
- 2026-07-04: Completed Chunk 1 by adding the Modern Interiors atlas generator, generated atlas PNG, generated JSON index, npm script, and asset credit.
- 2026-07-04: Completed Chunk 2 by adding runtime Modern Interiors metadata loading, atlas image registration, an in-game validation/browser panel, and Playwright coverage for the layered home preview.
- 2026-07-04: Completed Chunk 3 by adding URL-driven interiors panel startup state and a Playwright screenshot capture workflow for remote review.
- 2026-07-04: Started Chunk 4 with a draft generated-room spatial-mapping renderer and screenshot capture.
- 2026-07-04: Added repeatable labeled source-grid captures for the 3D walls, borders, and baseboards sheets after stale scratch artifact paths were found.
- 2026-09-27: Matched architectural tiles against the source home shell and added a first reusable gray-wall room grammar with three rendered variants.
- 2026-09-27: Reconstructed Generic Home 1 from room-builder tiles, mapped its five connections and floor zones, corrected the simple room edge rules, and verified a stretched topology-preserving variant.
- 2026-09-27: Corrected the simple divided-room preview so the divider joins the left and right perimeter walls with the proper source end caps.
- 2026-09-27: Added editable apartment sketches, a tile-based floor-plan renderer, reachability validation, and three screenshot examples including a concave, offset plan.
- 2026-09-27: Confirmed the source prefab's two-layer alpha composition, introduced independent visual layers per semantic cell, and proved the layered shell reconstruction against Generic Home 1.
- 2026-09-27: Compiled two connected-room semantic plans through the layered source-tile grammar, including a shifted passage and an offset edge with a transparent taper.
- 2026-09-27: Added source-style branched four- and five-room suites with varied wing size and height, and verified every walkable cell connects to the entrance.
- 2026-09-27: Corrected the branched suite connections after screenshot review: tapered side-wall returns, source-style floor continuity through the east opening, and a continuous two-row divider at the south room.
- 2026-09-27: Reworked the two upper side-room joins with full-height atlas wall returns after reviewing zoomed screenshots; confirmed the border and shading now follow the source's complete corner sequence.
- 2026-09-27: Connected editable apartment sketches to a layered architectural compiler with shared two-row walls, source passage jambs, side-wall tapers, shallow front trim, short-return validation, and a stepped stress example.
- 2026-09-28: Corrected the apartment preview after visual review: restored the approved floor palette, removed doubled shared-wall rails, used atlas corner sequences at wall elbows, and added shallow rail and taper tiles to inset south edges. Renamed the staggered footprint example to “Offset rooms.”
- 2026-09-28: Matched the apartment preview's display to the approved demos at 2× atlas scale. Corrected horizontal door expansion so a one-cell sketch passage leaves one atlas column open through the two-row wall, matching Generic Home 1; removed dangling trim at inset endpoints.
- 2026-09-28: Added a dedicated indoor fixture workbench with side-by-side plan and rendering, pan/zoom, plan and atlas-tile painting, layer inspection, rectangular feedback flags, and portable JSON review files.
