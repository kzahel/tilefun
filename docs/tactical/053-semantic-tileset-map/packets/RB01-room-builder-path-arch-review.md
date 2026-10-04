# RB01 Room Builder path and arch — independent review

2026-10-04. Reviewer: playground mapper, separate from RB01 author.
Agent evidence review only; human approval and runtime promotion remain absent.

## Initial native-source observations before proposal comparison

I first inspected the full raw native16 Floor Paths and Arched Entryways subfiles,
with neutral backing and integer nearest-neighbor enlargement, before reading the
RB01 proposal or author helper. The brief named floor/arch questions and warned of
bounds/variant issues, so this is brief-informed observation rather than blinded
identification. Disposable source views are
[floor paths](/tmp/tilefun-RB01-independent/view-Room_Builder_Floor_Paths_16x16.png)
and [arched entryways](/tmp/tilefun-RB01-independent/view-Room_Builder_Arched_Entryways_16x16.png).

The floor sheet has repeated color/material-looking banks of outlined square
insets and L-shaped bands, some with layered light/dark edge strips. Their grid
adjacency suggests related boundary pieces, but a square outline does not establish
a walkable path or a single globally compatible autotile bank. Some banks have
patterned interiors while others are flat tinted shapes; straight continuations,
outer corners and inset boundaries need distinct source inspection.

The arch sheet starts with five rounded open doorway frames in contrasting stone,
white and warm palettes. Later rows contain rectangular wall-material samplers
with dark arched cutouts. These are visually door openings and frame/wall pieces,
not evidence of portal physics, precise world elevation or freestanding placement.
A dark opening/cutout is not another source object. Thin cast-shadow extensions
and body pieces need separate bounds. World heading, collision, movement clearance
and the meaning of numeric source captions remain unknown from these pixels.

## Frozen snapshot and bounded disposition

Reviewed proposal revision 1, exact SHA-256
`88f2ebcf7f7509e3da1337f9e1bd2dde087f6b342e245f478fb94ddc07b2b6c4`.
The hash was rechecked after the independent tests and unchanged. This review
applies to the explicit 25 records, 16 assembly probes and two contextual wall
comparisons only. No whole-region or whole-material completion is inferred.

**Supported with the mapper's bounded qualifications; no blocking inconsistency
found.** The plain-language identities, native bounds and fixed/limited recipes
fit the inspected pixels. Larger inset extension remains weakened, shortened-arch
assembly remains unresolved, and network windows remain explicitly open.

## Explicit record dispositions

| Record | Independent disposition | Qualification |
| --- | --- | --- |
| RB01-P01 | Supported fill module | Flat pale interior; open interior on four sides is kit metadata, not walkability or a whole prop. |
| RB01-P02 | Supported left outside strip | Interior starts at local x=10; compatible with the separately tested capped strip, not seamless with the x=6 inset corner. |
| RB01-P03 | Supported right outside strip | Opposed side contour and interior band; retain original pixels and the bounded cap-bank recipes. |
| RB01-P04 | Supported small inset upper-left | Right/bottom inner contour reaches the x=6 bank; fixed square motif supported, larger side-strip extension weakened. |
| RB01-P05 | Supported small inset upper-right | Complementary top-right contour; fixed 2×2 motif only, no universal corner substitution. |
| RB01-P06 | Supported upper straight edge | Horizontal inner border supported; matching edge names do not resolve the larger-rectangle contour change. |
| RB01-P07 | Supported small inset lower-left | Lower-left closure in the exact small motif; preserve narrower inset contour. |
| RB01-P08 | Supported small inset lower-right | Lower-right closure in the exact small motif; not a general floor-corner license. |
| RB01-P09 | Supported lower straight edge | Lower outlined band; explicit extension experiments remain visually weakened despite interior continuity. |
| RB01-P10 | Supported narrow horizontal continuation | Upper/lower outlined boundaries and left/right continuations; no complete standalone run or arbitrary network matrix. |
| RB01-P11 | Supported downward-junction left half | One member of a two-column stem; L/T continuation-window role supported, not a whole one-tile elbow. |
| RB01-P12 | Supported bend outer-right half | Turns the L's outer border down on its right; reversed-half negative breaks that role. |
| RB01-P13 | Supported downward-junction right half | Complements P11 in the T; only named paired-stem offsets supported. |
| RB01-P14 | Supported shaded upper-left cap | Top shaded band and left strip contour belong to the separate capped-strip test bank. |
| RB01-P15 | Supported shaded upper-right cap | Matching top shaded band/right closure; paired cap role supported at tested widths only. |
| RB01-P16 | Supported narrow lower-left cap | Closes tested vertical strip's lower-left border; no arbitrary wider cap recipe. |
| RB01-P17 | Supported narrow lower-right cap | Complementary lower-right closure despite different source-column location; bounded strip assembly verifies the pairing. |
| RB01-A01 | Supported fixed arch upper-left | Left part of crown with top padding; needs the exact complementary body cells. |
| RB01-A02 | Supported fixed arch upper-right | Crown complement; swapping with A01 reverses rim orientation and visibly breaks the arch. |
| RB01-A03 | Supported fixed arch middle-left | Curved rim transitions into left pier; dropping this row changes source shape/height. |
| RB01-A04 | Supported fixed arch middle-right | Opposed curved rim/pier transition; fixed row, not a repeatable straight middle. |
| RB01-A05 | Supported fixed arch lower-left | Left pier plus translucent shadow; no exact master occurrence because master shadow alpha differs. |
| RB01-A06 | Supported fixed arch lower-right | Fixed right pier; its exact master-cell link does not imply whole-arch equality. |
| RB01-A07 | Supported optional shadow companion | 16×8 native strip below matching arch body at y=48; cannot stand alone and is not a fourth body row. |
| RB01-A08 | Supported optional shadow companion | Opposed 16×8 spill; exact repeated subfile appearances are aliases, not additional arch concepts. |

All 25 are explicitly proposed partial assembly modules with forbidden standalone
prop eligibility. For floor fills and runs this is a catalog distinction: a tile
may participate in a floor editor while remaining unsuitable as a whole prop.
Required/closed edge names alone are insufficient compatibility evidence, as the
proposal states; only named recipes establish tested neighbor use. No automatic
join validator, generator/editor enforcement or gameplay geometry is delivered.

The source caption reads “3 tiles arched entryways,” but its intended dimensional
convention remains tentative. The recorded body crop independently consists of
six 16×16 cells at two columns × three rows, making a 32×48 untrimmed frame. The
visible rim starts below top padding. Two optional 16×8 strips at y=48 extend the
canvas to 32×56 including shadows; they do not make another body row or establish
portal clearance, collision height or a repeatable arch.

## Explicit assembly dispositions

I inspected the complete member/assembly captures after the initial raw-source
reading, and independently replayed every recipe from source pixels. Each result
below applies to its exact source IDs, rectangles, offsets, overwrite operation
and hashes. “Supported” is agent evidence, not owner acceptance.

| Probe | Independent disposition | Evidence and remaining limit |
| --- | --- | --- |
| inset-square-native | Supported bounded closed motif | Four corners exactly reproduce source `[48,0,32,32]`; fixed 2×2 only. |
| inset-extension-3x3 | Supported weakened hypothesis | Inner field continues, but inset-to-side contour width steps by 4px; do not treat as seamless nine-slice. |
| inset-extension-5x4 | Supported weakened hypothesis | Same defect persists at larger dimensions; repetition does not resolve it. |
| shaded-vertical-0-middle-rows | Supported bounded capped strip | Paired shaded top and narrow bottom caps directly close the two-column strip. |
| shaded-vertical-1-middle-rows | Supported bounded capped strip | One paired P02/P03 row aligns with these cap contours. |
| shaded-vertical-2-middle-rows | Supported bounded capped strip | Two paired middle rows retain closure; unlimited length/width remains untested. |
| L-continuation-window | Supported declared open window | P11/P12 bend into a two-column stem; left/bottom continuations explicitly remain open. |
| T-continuation-window | Supported declared open window | P11/P13 stem plus horizontal arms; left/right/bottom boundaries are continuations, not a complete prop. |
| L-reversed-junction-halves | Rejected as compatible join | Outer-right corner replaces the stem's left half and produces visible border discontinuity. |
| side-strip-without-caps | Rejected as complete standalone | Interior crosses both outer ends; could be an explicitly declared continuation window, not a closed object. |
| wrong-inset-corners | Rejected as compatible join | Reversed closures turn borders into the interior and expose displaced contours. |
| stone-arch-body-three-rows | Supported fixed body | Exactly reproduces subfile `[0,0,32,48]`; no height/width substitution. |
| stone-arch-with-shadow | Supported fixed body with companions | Exactly reproduces subfile `[0,0,32,56]`; shadows optional in these two recorded visual probes only. |
| stone-arch-upper-halves-swapped | Rejected intact rim | Crown/outer rim reverse, forming broken upper curves. |
| stone-arch-middle-row-omitted | Supported unresolved alternative | A shorter image is renderable, but curve/pier shape changes; source establishes no optional-height rule. |
| stone-arch-shadow-only | Rejected as standalone arch | Translucent patches have no rim/pier body. |

These are eight supported bounded positive probes, five negative probes, two
weakened extension hypotheses and one unresolved shortened-height alternative.
No unrecorded topology-valid image inherits visual support from those probes.

The two context-only wall probes are separately supported at their scope.
Matching coral filler/cutout seams differ only at rows 27–31, where the opening
removes lower trim. Wrong wood filler differs at rows 6–31 on both sides. Neither
is another semantic member; the 32×32 cutout has two native rows, so it cannot
inherit the stone frame's three-row body contract. Texture proximity and seam
occupancy alone do not license mixed materials.

## Independent checks and master/subfile exception

A separate [read-only helper](/tmp/tilefun-RB01-independent-review.py), importing
neither the mapper helper nor `Matcher`, verified:

- all 11 declared raw PNG sources, dimensions and normalized full-image hashes,
  plus pinned ledger/catalog bytes;
- every one of the **3,485** indexed native16 Room Builder tile/sheet lineages,
  comparing original source rectangles to exact committed packed rectangles;
- all 25 selected hashes and alpha-visible bounds;
- an independent exhaustive **grid16**, source-origin-anchored occurrence scan
  reproducing all **57** crops across the master and nine subfiles, including
  **23** master links;
- all **24** packed tile aliases and **34** packed sheet-offset aliases, including
  exact catalog entry linkage and translated bounds;
- all **16** candidate assembly and **two** contextual wall rasters, canonical
  recipe hashes, original-source comparisons and source-edge seam diagnostics;
- native source samples showing white interior begins at x=6 in P04's lower
  edge, versus x=10 in P02's top edge, independently confirming the 4px mismatch;
- the whole 32×56 stone arch's master/subfile variant: exactly **176** pixels
  change from `[0,0,0,25]` to `[0,0,0,48]`, in `[0,32,32,55]`, with the recorded
  changed-mask hash and both normalized full-raster hashes.

A05 and the shadow companions therefore gain no fabricated exact master aliases.
The five other exact body-cell master links remain valid. Shadows retain their
actual translucent alpha; no conditional token removal or blanket normalization
is introduced to force equality.

Occurrence search verifies all fitting grid16 origins, including the 16×8 strips;
it deliberately does not claim every integer pixel origin. Transparent hidden
RGB alone is zeroed, while all visible RGBA/alpha is preserved. Excluded source
domains, partial/occluded art and absent full-frame matches remain outside this
review. Counts represent crop occurrences and alias links, not unique objects.

The mapper's unchanged deterministic check also passed independently:

```sh
python3 scripts/semantic-map-room-builder.py --check
python3 /tmp/tilefun-RB01-independent-review.py
```

The [independent report](/tmp/tilefun-RB01-independent-report.json) records the
counts. The separate helper also creates unscaled transparent native probe PNGs
under [/tmp/tilefun-RB01-independent](/tmp/tilefun-RB01-independent), including
[native inset](/tmp/tilefun-RB01-independent/inset-square-native-native.png),
[native L](/tmp/tilefun-RB01-independent/L-continuation-window-native.png),
[native fixed arch](/tmp/tilefun-RB01-independent/stone-arch-body-three-rows-native.png)
and [native wrong rim](/tmp/tilefun-RB01-independent/stone-arch-upper-halves-swapped-native.png).
No shared npm/browser/build commands or source/proposal/helper edits were made.

Disposition: all 25 records and 18 bounded probes are reviewed at the scope above.
Partial/unknown distinctions and negative evidence remain visible; human approvals
and runtime promotions remain zero. Next: register this exact proposal/review
snapshot, then expose only supported bounded floor/arch recipes in future catalog
work while retaining weakened/unresolved alternatives.
