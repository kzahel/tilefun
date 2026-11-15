# Terrain blending

Topic: terrain-blending
Status: diagnostic lab delivered; owner-requested wider pond shore bands implemented.
Updated: 2026-11-15.

Owns terrain material adjacency, transition artwork, sample topology and visual
quality. Renderer sampling belongs to [renderer unification](renderer-unification.md);
landform placement belongs to [natural landscapes](natural-landscapes.md).

## Where we left off

- The Modern Exteriors source bank has **26 sheets**, not 26 active materials.
  Each 192 × 64 sheet has 48 cells: 47 canonical 16px blob shapes and one unused
  cell. Eight neighbour bits collapse to 47 masks by removing diagonals without
  both adjoining cardinal neighbours (`bitmask.ts`, `gmBlobLayout.ts`).
- **Nine ground materials** are active: deep/shallow water, sand/light sand,
  grass, light/warm dirt, playground and curb. ID gaps are retained for saves.
  Roads/markings/tracks live in a separate tile layer, above ground blending.
- A chunk stores **33 × 33 half-tile samples** for its 16 × 16 tiles. Rendering
  reads a tile's centre and eight surrounding samples. This evolved beyond the
  older four-corner dual-grid approach; it can express concave shapes too.
- `BlendGraph` registers directional **opaque pair artwork** and **alpha
  fallbacks**. Pair artwork contains both materials; it is not a reusable mask
  that can blend arbitrary textures. Grass alpha is `me13`; sand and light sand
  both use `me10`. Water and dirt have no alpha fallback. Unregistered source
  overlays, such as `me06`, are not the current game's grass fallback.
- `computeTileBlend` chooses a background by scoring dedicated pair coverage,
  with depth as a tie-breaker and optional brush-variant partner/overlay hints.
  This is not simply a fixed global onion stack. It excludes isolated centres
  from background candidates, then can add an isolated-centre blob.
- The renderer draws shallow-water undercoat, the chosen background fill,
  dedicated pair tiles in depth order, then alpha layers. Alpha overlays are
  normally restricted to the centre material. Up to **six transition layers**
  are packed per tile. Different materials at a junction can have opaque pair
  sprites that overwrite earlier artwork; adjacency alone gives no guarantee
  of a visually coherent junction.
- `TerrainEditor` can insert intermediate materials. Its adjacency graph accepts
  dedicated pairs in either direction and certain two-way alpha fallbacks.
  Its BFS uses all those permitted edges, **including alpha**, despite older
  comments saying dedicated-only. Bridge-enabled tile painting uses a cross
  stamp instead of the full 3 × 3 stamp, to avoid diagonal nubs. These are two
  simultaneous changes, not a pure comparison of bridge widths.
- Classic still uses `OnionStrategy`. Regional uses its own generator. Local
  regional ponds use normalised-distance water bands: deep water below 0.65,
  shallow below 1. Their sand and light-sand bands now each expand the noisy
  water ellipse's axes by two tiles, rather than the old 0.1/0.13 fractional
  radius widths. This keeps the shore broad on smaller/narrower ponds. Large lakes instead
  have a four-tile shallow shelf. Generation writes material samples directly;
  it does not run the editor's bridge insertion.

The 2026-11-15 pond parity comparison found identical ground at the snapped
1× setting in both renderers. The owner clarified that the underlying shoreline
composition itself looks poor. This work investigates that concern separately
from fractional-zoom texture sampling.

## Diagnostic lab

[Terrain blend lab](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/terrain-blends)
is registered in Workshop's tools/sidebar. It is an inspection tool with no
approval buttons or art promotion. No generator, brush or blending policy changes
are introduced by the lab.

- Actual current seed-2026 `pond:1:-2`, sampled through the regional generator,
  without props/actors/shadows, beside a false-colour map of its half-tile samples.
- Straight edge, outer/inner corner, diagonal, narrow channel, isolated sample,
  three-material junction, thin/wide nested bands and editor bridge insertion.
- Pair selectors, all five brush variants, and a directional pair table derived
  from the real `BlendGraph`, rather than copied metadata.
- Tap a tile or choose its X/Y coordinates. Inspect its nine samples, chosen
  background, source sheet coordinates, raw/canonical masks, individual layer
  sprites and cumulative composition. The complete map draws through the shared
  `GpuRenderBackend`/`TileRenderer`; the page shows a snapshot of that GPU frame.
  The source/cumulative tile crops are diagnostic Canvas crops, with default
  terrain-fill variation disabled as in normal asset loading.
- Cases can be linked with `?case=thin-bands` after the hash route. Pair choices,
  selected tile and bridge control are local page state, not persisted drafts.

The old [source viewer](https://tilefun.graehlarts.com/tilefun/assets/tilesets/me-autotile-viewer.html)
is retained as a 26-sheet artwork inventory; its stale transition map and
generation description have been corrected and it links to the new lab.

## Proposed quality questions

These are review criteria to develop, not claims that the current bank passes.

1. **Connectivity:** straight borders, concave/convex corners and diagonals
   preserve intended regions without holes, disconnected beads or spikes.
2. **Width:** narrow channels and bands stay legible, with reasonably consistent
   border thickness rather than alternating blobs and full-width sections.
3. **Junctions:** three-material joins retain every intended region and do not
   let an opaque pair wipe out an unrelated third material.
4. **Material fidelity:** the artwork agrees with the samples; any deliberate
   shoreline inset is consistent and does not suggest a different terrain.
5. **Visual rhythm:** avoid conspicuous repeating teeth, abrupt colour changes
   between sheets, and incompatible forward/reverse border styles.

Initial topology evidence before the production width change: the synthetic thin-band pond produces four isolated
light-sand overlays (mask 0, `me07`); the wider-band fixture produces none. This
supports investigating band width, but is not proof that widening alone fixes
the real pond. The real pond has no mask-0 overlays in this 32 × 32 crop. Its
repeated scallops must be inspected through other masks and their source artwork.

## Validation and next work

Native coverage checks that the real pond uses production samples across a
negative-coordinate seam, that inspector stacks equal packed chunk layers, and
that the bridge demo uses actual editor-inserted materials. Existing autotile,
adjacency and renderer-boundary checks remain the policy coverage.

`node scripts/terrain-blends/capture.mjs --headed` uses an isolated Vite server
and bundled Chromium, captures four representative cases, checks the composed
junction crop against GPU pixels, toggles editor bridges and checks mobile
selection/layout. It closes its browser/server and writes its report/captures
under the platform temp directory (`--out=DIR` overrides it).

2026-11-15 validation: 45 focused native checks pass across the study, autotiler,
adjacency and renderer boundary. The hardware-GPU capture run reports no page
errors; the junction inspector and rendered tile are byte-identical. Desktop
captures and the 390px mobile layout were visually checked. Wider bands remove
the synthetic isolated blobs but retain other scalloped edges, so band width
alone is not a complete visual correction.
Typechecks, focused lint, catalog generation, Workshop manifest generation
(2,130 existing candidate identities verified) and the production build pass.
The build used Node 24; the shell's Node 27 alpha fails in the existing `pngjs`
vehicle-bank checker before reaching this feature. The live origin was checked
to serve the new lab module before sharing its link.

## Wider pond shores (owner request, 2026-11-15)

Both dry material bands are nominally two tiles wide, measured by expanding
each axis of the noisy water ellipse. The waterline and deep/shallow thresholds
are retained. Pond admission/reserved banks cover the wider dry shore, and new
frogs start on the grassy ring beyond it with a matching home range. Lakes and
large water refuges retain their own shore rules. Existing saved terrain is not
repainted; use fresh areas or a recreated world to see the generation change.

The real-pond lab capture was visually checked. Native checks trace eight rays
around both the review pond and a narrow pond, requiring an uninterrupted
deep → shallow → sand → light sand → grass sequence and at least 1.5 tiles of
each sand material after noise. All 27 focused generation, frog/duck, lake and
lab tests pass. The frog animation/persistence test now explicitly starts one
animal in the shallows, retaining all four animation cycles and both media
without depending on a random crossing of the wider dry bank. Its separate
natural-placement test still requires grassy, clear spawn points.
The desktop/mobile lab checks pass again with identical inspector/GPU pixels.
Typechecks, focused lint, regenerated art/Workshop inventories, the Node 24
production build and `streaming:bench -- --assert-ready` pass for this update.

Next: owner play review of the wider shore. Further source-art or junction work
can use the existing fixtures if desired. Do not change all terrain
pairs or regenerate a promoted art bank based only on an attractive isolated
tile. Register exact candidates if/when changed artwork is offered for approval.
