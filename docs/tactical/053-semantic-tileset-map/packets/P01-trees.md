# P01 — Rounded tree palette/trunk family and forest modules

## Assignment

- Owner: Exteriors survey worker. Date: 2026-10-04. Proposal revision: 1.
- State: candidate proposal and reproducible experiments complete; independent
  review pending. No human approvals or promotions.
- Scope: 12 named rounded-tree singles, eight original-master replacement
  strips, and nine small forest composition modules: **29 explicit candidates**.
  This does not segment the entire tree region or assign all four banks to seasons.
- Outputs: `P01-trees.md`, `P01-trees.json`,
  `scripts/semantic-map-tree-pilot.py`; temporary evidence only under
  `/tmp/tilefun-semantic-trees/`. No source or shared catalog changed.

## Source evidence and reproducibility

Original master:
`assets/exteriors/Modern_Exteriors_16x16/Modern_Exteriors_Complete_Tileset.png`,
2816 × 8224 RGBA, SHA-256
`1429a07733836963fc6f1bf703bba59e2e766152bea54a9e936a65089c2d0737`.
`public/assets/tilesets/me-complete.png` is byte-identical and uses the same
coordinates. Named singles below are from
`assets/exteriors/Modern_Exteriors_16x16/Modern_Exteriors_Complete_Singles_16x16/`
with prefix `ME_Singles_Camping_16x16_`. The [JSON packet](P01-trees.json)
pins each named-single SHA-256, its local rectangle, exact original-master
occurrences, field evidence/confidence and assembly relations.

Coordinates: `(x,y,w,h)` in original pixels, half-open. A named PNG's
`source_rect` is local to that PNG; only `master_anchor` or measured occurrences
are master coordinates. This distinction matters for the eight whole singles
that are reconstructable but absent as exact whole crops.

```sh
python3 scripts/semantic-map-tree-pilot.py --verify --out /tmp/tilefun-semantic-trees
```

The helper uses `scripts/semantic-map-match.py` to search **every** 16px-grid
position on the full master, including its tail; visible RGBA and alpha must
match exactly, and RGB is ignored only where alpha is zero. A second all-pixel-origin
search runs for every candidate and returns the same occurrence lists, ruling out
off-grid whole originals for the eight variants. It verifies every
pinned source hash, crop bounds, eight reconstructed singles and all saved
measurements. This is an exact search, not a fuzzy/silhouette search; “unmatched”
is not evidence of absent art.

Actual pixels inspected: S02's whole-sheet/tree-bank views; enlarged
[named tree variants](/tmp/tilefun-semantic-trees/tree-named-variants.png);
[master tree and lower strips](/tmp/tilefun-semantic-trees/master-tree-and-patches.png);
and [ordered/reversed forest assemblies](/tmp/tilefun-semantic-trees/forest-assembly.png).
Names and atlas-index coordinates were supporting evidence, not substitutes for
visual inspection. No human decisions are claimed for this new proposal.

## Explicit candidates

| ID | Named single or master component | Exact master occurrence / reconstruction | Proposed role |
| --- | --- | --- | --- |
| T01 | Tree_1 | (2464, 16, 64, 64) | whole named sprite; exact master whole occurrence |
| T02 | Tree_2 | No exact whole crop; T01 + B01 | whole named sprite; reconstructable from shared crown and lower patch |
| T03 | Tree_3 | No exact whole crop; T01 + B02 | whole named sprite; reconstructable from shared crown and lower patch |
| B01 | pale lower trunk/root/ground replacement strip | (2464, 80, 64, 16) | replacement bottom strip, not standalone whole tree |
| B02 | green-tinted lower trunk/root/ground replacement strip | (2464, 96, 64, 16) | replacement bottom strip, not standalone whole tree |
| T04 | Tree_4 | (2464, 448, 64, 64) | whole named sprite; exact master whole occurrence |
| T05 | Tree_5 | No exact whole crop; T04 + B03 | whole named sprite; reconstructable from shared crown and lower patch |
| T06 | Tree_6 | No exact whole crop; T04 + B04 | whole named sprite; reconstructable from shared crown and lower patch |
| B03 | pale lower trunk/root/ground replacement strip | (2464, 512, 64, 16) | replacement bottom strip, not standalone whole tree |
| B04 | green-tinted lower trunk/root/ground replacement strip | (2464, 528, 64, 16) | replacement bottom strip, not standalone whole tree |
| T07 | Tree_7 | (2464, 864, 64, 64) | whole named sprite; exact master whole occurrence |
| T08 | Tree_8 | No exact whole crop; T07 + B05 | whole named sprite; reconstructable from shared crown and lower patch |
| T09 | Tree_9 | No exact whole crop; T07 + B06 | whole named sprite; reconstructable from shared crown and lower patch |
| B05 | pale lower trunk/root/ground replacement strip | (2464, 928, 64, 16) | replacement bottom strip, not standalone whole tree |
| B06 | green-tinted lower trunk/root/ground replacement strip | (2464, 944, 64, 16) | replacement bottom strip, not standalone whole tree |
| T10 | Tree_10 | (2464, 1280, 64, 64) | whole named sprite; exact master whole occurrence |
| T11 | Tree_11 | No exact whole crop; T10 + B07 | whole named sprite; reconstructable from shared crown and lower patch |
| T12 | Tree_12 | No exact whole crop; T10 + B08 | whole named sprite; reconstructable from shared crown and lower patch |
| B07 | pale lower trunk/root/ground replacement strip | (2464, 1344, 64, 16) | replacement bottom strip, not standalone whole tree |
| B08 | green-tinted lower trunk/root/ground replacement strip | (2464, 1360, 64, 16) | replacement bottom strip, not standalone whole tree |
| F01 | Tree_Wall_Modular_1 | (2448, 1600, 48, 112) | left end fragment |
| F02 | Tree_Wall_Modular_2 | (2512, 1600, 128, 112) | central composition |
| F03 | Tree_Wall_Modular_3 | (2656, 1600, 32, 96) | right end fragment |
| F04 | Tree_Wall_Modular_4 | (2448, 1712, 48, 80) | left end fragment |
| F05 | Tree_Wall_Modular_5 | (2512, 1712, 128, 80) | central composition |
| F06 | Tree_Wall_Modular_6 | (2656, 1712, 32, 80) | right end fragment |
| F07 | Tree_Wall_Modular_7 | (2448, 1792, 48, 80) | left end fragment |
| F08 | Tree_Wall_Modular_8 | (2512, 1792, 112, 80) | central composition |
| F09 | Tree_Wall_Modular_9 | (2640, 1792, 32, 80) | right end fragment |

Each of the 21 matched candidates has **exactly one** exact occurrence (both
16px-grid and all-pixel-origin searches)
on this master. The eight unmatched candidates T02/T03/T05/T06/T08/T09/T11/T12
are whole named PNGs, not inferred objects: they have exact reconstruction
relationships to visible master components. Occurrence lists remain explicit
in JSON even when they contain only one rectangle.

## Interpretation by field

**Identity/family, high confidence:** T01–T12 depict one rounded broadleaf tree
form, with four crown palettes and three lower-trunk/root/ground treatments per
palette. The crown outline and shading structure are close enough to support a
shared form family, with the one-pixel exception recorded below. “Broadleaf”
describes the visible rounded canopy; species remains unknown. No apple/oak/maple
assignment is supported by this probe.

**Palette, high confidence:** green T01–03; orange/red T04–06; blue-green T07–09;
ochre/yellow T10–12. These are visible-color labels. Orange and ochre are autumn-like
but no four-season ordering is established. In particular, blue-green has no snow
or other winter-specific marker. Three forest compositions mix palette colors,
which further weakens a strict one-bank-per-season interpretation.

**Trunk treatment, high confidence:** brown first variant, pale second variant,
green-tinted third variant. These labels describe pixels. Bark species, lighting,
shadow, alternate game state or intended depth treatment are unresolved. Do not
interpret green-tinted roots as a cut stump or approve any gameplay effect.

**Segmentation/component role, high confidence for B01–08:** the lower repeats
are 64 × 16 **replacement strips**, including trunk/root/ground and some foliage
fringe pixels. They are not whole trees and are not established standalone stumps.
Each replaces local `[0,48,64,16]` on its corresponding first whole tree using
**RGBA overwrite, including transparent pixels**, rather than source-over alpha
compositing. The replacement operation is explicit in JSON.
Eight exact normalized-RGBA reconstructions match the named whole variants.
Geometry, collision, height, walkability and facing remain unknown for all candidates.

**Forest identity, high; component role, medium:** F01–09 are three mixed-tree
forest composition rows, each divided into proposed left/main/right segments.
F01/04/07 are left end fragments; F02/05/08 are central compositions;
F03/06/09 are right end fragments. The roles are supported by the rendered ordering,
not independently reviewed. Corner use and indefinitely repeatable centers are
not established. Do not call them corner tiles from vendor “Modular” naming alone.

## Alternatives and experiments

### Whole tree versus component repeats

Initial plausible reading: every vertically repeated crown/root shape is a
standalone full tree. Test: compare all named singles to every exact master crop,
then replace only their bottom 16px using the visible lower master strips. Both
16px-grid and every-pixel-origin exact searches were run.

Observed: T01/T04/T07/T10 match whole 64 × 64 master crops; eight alternate
trunk singles do not at any pixel origin. All eight source lower strips match exact master crops,
and inserting them at local y48 reconstructs T02/T03/T05/T06/T08/T09/T11/T12
**pixel-for-pixel** after transparent-RGB normalization. This refutes the full-tree
interpretation of the lower repeats and demonstrates that no-match can reflect
component packing rather than missing art. The named whole PNGs themselves remain
whole-tree identities. The experiment does not extrapolate to every other family.

### Uniform recolor versus near-variant family

Compare T01's alpha and per-pixel color mapping to the three other first variants:

| Comparison | Alpha difference | Exact visible-RGBA equality | One global source→destination color map? |
| --- | --- | --- | --- |
| T01 → T04 | None | No | No: one source color maps differently by context |
| T01 → T07 | One pixel at local (16,47): 255 → 0 | No | No, including the transparent-pixel exception |
| T01 → T10 | One pixel at local (16,47): 255 → 0 | No | No, including the transparent-pixel exception |

T01→T04's exceptional source color `(58,58,80,255)` maps mostly to itself but
also to `(55,133,78,255)`. In T07/T10, the same source color becomes transparent
at `(16,47)` while remaining visible elsewhere. Exact palette comparisons and
all exceptions are saved in JSON. These are closely related palette variants,
**not identical sprites and not pure global recolors**. Family inheritance must
preserve each source identity and exceptions. The removed pixel is observable;
its artistic intent is unknown.

### Forest assembly ordering and seams

Experiment A: remove the 16px source gaps and paste each row left–main–right,
top-aligned, at cumulative widths. No pixels are resized in the composition;
nearest-neighbor enlargement is only for inspection.

| Assembly | Members | Offsets | Canvas | Observed result |
| --- | --- | --- | --- | --- |
| Row 1 | F01,F02,F03 | (0,0),(48,0),(176,0) | 208 × 112 | Crowns connect plausibly; center retains rectangular ground background and right end is shorter |
| Row 2 | F04,F05,F06 | (0,0),(48,0),(176,0) | 208 × 80 | Crowns connect plausibly; rectangular ground background remains visible |
| Row 3 | F07,F08,F09 | (0,0),(48,0),(160,0) | 192 × 80 | Crown and ground silhouette connect most closely; minor edge mismatch remains |

Experiment B: reverse each row to right–main–left with the same top alignment.
Observed: disconnected trees appear at the outer edges and abrupt vertical cuts
appear beside the center, weakening the swapped-end interpretation.

Edge-alpha diagnostics count rows with differing alpha between adjacent edge
columns, **not seam quality or pixel identity**: correct-order rows have 33/35,
15/15 and 1/1 mismatches at the two joins; reversed rows have 109/97, 68/68 and
78/79. The rendered evidence establishes plausible ordering but does not prove
seamless tiling. Experiment C renders each ordered row over a solid background
sampled from its center segment’s bottom ground pixel. The first two rectangular
ground boundaries disappear on matching green ground; thus they are not unavoidable
seams, but a background-compatibility limitation. The
[matching-ground row 1](/tmp/tilefun-semantic-trees/forest-row1-matching-ground.png)
was visually inspected. No source pixels were altered. A real terrain-backed scene
and repeat-middle/corner probe remain useful follow-ups; neither successful corner
use nor middle repetition is claimed.

Existing kit evidence: `src/patterns/FencedTrees.ts` audits a **different** source
family at `(1568,0,48,96)`, `(1632,0,80,96)`, `(1728,0,48,96)`, using caps and
16px repeat columns. Its source hash matches this master but its rectangles do not
match F01–09. This supports consulting actual piece-specific assembly rules, not
transferring its collider, cap overlap or repeat scheme to these forest fragments.
The owning `docs/topics/patterns-and-interiors.md` and Tactical 011 record its five
review cases as unchecked; this is implementation evidence, not human approval.

## Independent review

Pending: the reviewer should first interpret the master context, named singles
and forest pixels without adopting this proposal. Required dispositions include
all 29 candidates, the eight replacement relationships, the single-pixel palette
exception and ground-seam limits. Agent confidence is not human approval.

## Reconciliation and handoff

- Strong proposal: one rounded broadleaf form with four visible palettes and
  three lower-section treatments; species/season meanings remain unknown.
- Strong measured relationship: eight compressed master lower strips reconstruct
  eight unmatched named whole trees exactly.
- Medium proposal: three forest left/main/right compositions; document gray-background
  ground boundaries and their disappearance on matching green terrain, with corners,
  center repetition and gameplay geometry unknown.
- Coverage: 29 candidate identities, 21 exact whole/part master occurrences and eight
  reconstructed variants; no claim of complete tree-bank segmentation.
- Independent review: 0/29. Human approval: 0/29. Correction rate and owner review
  effort are unavailable until review occurs; elapsed effort was not instrumented.
- Validation: pinned sources/alias, all bounds, grid16 and all-pixel exact occurrence matching,
  eight exact reconstruction assertions and saved-measurement verification passed.
  The coordinating session owns repository typecheck/unit/lint checks. No runtime
  render/recipe/catalog inputs changed.

Next logical step: independently review this packet, then test forest middle
repetition and terrain-backed seams before extending the family across other forms.
