# P01 independent tree review

Reviewer: `source_inventory`. Date: 2026-10-04.
State: independently checked; accepted with bounded qualifications below.
Ownership: this review artifact and temporary evidence only. No author/shared
artifacts or human approval records are edited.

## Initial reading before opening the proposal

Viewed raw pinned master `public/assets/tilesets/me-complete.png` in original
region `[2336,0,448,1888]`, rounded groups at X2464 with Y16/448/864/1280
(each 64×96), and forest region `[2448,1600,240,272]`.

- Four broad palette bands repeat several deciduous-looking rounded/flattened
  crowns, tall trunks, small narrow trees and cone-shaped conifers. The bands
  appear green, orange/red, blue-green/teal and ochre/yellow. “Seasonal variants”
  is plausible; assigning spring/summer/autumn/winter or a fixed order is not
  justified by these colors alone. The fourth band remains leaf-covered.
- The four rounded 64×96 crops contain a canopy/trunk with one ground/root base,
  followed by two separate ground/root strips below. Those strips appear to
  alter the exposed ground/trunk palette. They are not three independent full
  tree silhouettes. No species identification follows from rounded crowns.
- Green bands include some rounded forms with small red dots among foliage.
  These could be fruit/berries; neither species nor fruit type is established.
  Bare branching forms appear near the upper green region but are not repeated
  visibly as a uniform fourth-band leafless winter set.
- The forest region shows three stacked crowded-tree motifs with a green ground
  strip and separate side fragments. The upper and lower motifs mix green/teal
  foliage with ochre/orange trees. Thus a forest motif is a composition, not
  evidence that every member belongs to one palette/season. A stump is visible
  in the middle motif. End fragments may serve as caps, but repetition and joins
  require a rendered check; source proximity alone does not establish ordering.
- Canopy boundaries and base strips support visual assembly hypotheses, not
  collision, walkability or trunk footprints.

Evidence captured before proposal read:
[raw context](/tmp/tilefun-semantic-tree-review/context-raw.png),
[four rounded groups](/tmp/tilefun-semantic-tree-review/rounded-four-raw.png),
[forest raw crop](/tmp/tilefun-semantic-tree-review/forest-raw.png).

This was an author-independent first pass, not a fully blind experiment: the
coordinator brief supplied the target coordinates and questions about rounded
groups, replacements and forest pieces. The full mapper proposal was opened
only after recording the observations above.

## Reviewed revision and independent checks

Reviewed [P01 proposal](P01-trees.md) and [JSON](P01-trees.json), revision 1.
The exact proposal JSON SHA-256 is
`3df0e42f9012644afe5cd1233f604b5dd74ec05c4c4f26253834dc2a05281ff6`.
The original and committed master bytes have SHA-256
`1429a07733836963fc6f1bf703bba59e2e766152bea54a9e936a65089c2d0737`.
All candidate file hashes and bounds were checked against this proposal.

Independent measurements used a separate temporary
[review program](/tmp/tilefun-semantic-tree-review/review.py), with
[measured results](/tmp/tilefun-semantic-tree-review/independent-results.json).
It does not import the mapper helper or shared matcher:

1. For all 29 candidates, zero RGB under zero alpha, choose the candidate's
   least frequent visible RGBA color in the full master, stream matching bytes,
   reject non-RGBA-aligned offsets/out-of-bounds origins and compare the entire
   candidate at every inferred origin. This independently agrees with every
   saved arbitrary-pixel occurrence list: 21 candidates each have one exact
   master crop, and eight whole named variants have none. All eight no-match
   outcomes were checked, not extrapolated from a sample.
2. For all eight replacement recipes, write the patch RGBA bytes directly into
   each row of the base's local `[0,48,64,16]` rectangle. All reconstructed
   normalized RGBA bytes equal the named result. The unchanged upper 48 rows
   were separately checked. A source-over control also ran for all eight.
3. Recompute alpha differences and the complete visible-source-color →
   destination-color relation for T01 versus T04/T07/T10. The reported one-pixel
   exceptions and non-single-valued color mappings agree exactly.
4. Independently crop/paste all nine forest parts in ordered and reversed rows,
   recompute edge-alpha counts, and render each over gray and its row-specific
   sampled ground color at uniform 4× scale. Visually inspect the three ordered
   rows, the reversed controls and matching-ground backgrounds.

The mapper's own helper additionally passes:

```sh
python3 scripts/semantic-map-tree-pilot.py --verify --out /tmp/tilefun-semantic-tree-review/author-helper
python3 /tmp/tilefun-semantic-tree-review/review.py
```

The second command uses the temporary independent program linked above; its
methods and complete durable measured conclusions are recorded here. Temporary
binary/program files are not committed. Source images and proposal files stayed
unchanged.

## Explicit candidate dispositions

“Accept” below means agreement with the bounded agent proposal for this pinned
revision. It does not create human approval, promotion or known geometry.

| Candidate | Independent disposition | Scope of agreement / qualification |
| --- | --- | --- |
| T01 | Accept | Rounded-canopy green tree; brown lower section; exact whole occurrence |
| T02 | Accept | Same green form; pale lower section; no exact whole occurrence, exact B01 reconstruction |
| T03 | Accept | Same green form; cool green-tinted lower section; exact B02 reconstruction |
| T04 | Accept | Orange/red rounded form; brown lower section; exact whole occurrence |
| T05 | Accept | Orange/red form; pale lower section; exact B03 reconstruction |
| T06 | Accept | Orange/red form; cool green-tinted lower section; exact B04 reconstruction |
| T07 | Accept | Blue-green form; brown lower section; exact whole occurrence and one-pixel mask exception |
| T08 | Accept | Blue-green form; pale lower section; exact B05 reconstruction |
| T09 | Accept | Blue-green form; cool green-tinted lower section; exact B06 reconstruction |
| T10 | Accept | Ochre/yellow form; brown lower section; exact whole occurrence and one-pixel mask exception |
| T11 | Accept | Ochre/yellow form; pale lower section; exact B07 reconstruction |
| T12 | Accept | Ochre/yellow form; cool green-tinted lower section; exact B08 reconstruction |
| B01 | Accept | Pale 64×16 lower-section replacement for T01 → T02 |
| B02 | Accept | Cool green-tinted replacement for T01 → T03 |
| B03 | Accept | Pale replacement for T04 → T05 |
| B04 | Accept | Cool green-tinted replacement for T04 → T06 |
| B05 | Accept | Pale replacement for T07 → T08 |
| B06 | Accept | Cool green-tinted replacement for T07 → T09 |
| B07 | Accept | Pale replacement for T10 → T11 |
| B08 | Accept | Cool green-tinted replacement for T10 → T12 |
| F01 | Accept with qualification | Row 1 left-end fragment; plausible ordering, incomplete ground closure on contrasting terrain |
| F02 | Accept with qualification | Row 1 mixed-palette center; row-specific ground background, repetition/corners untested |
| F03 | Accept with qualification | Row 1 right-end fragment; shorter 96px height retained rather than padded semantic bounds |
| F04 | Accept with qualification | Row 2 left-end fragment; ordering supported, ground compatibility limited |
| F05 | Accept with qualification | Row 2 center with stump; different sampled ground color from rows 1/3 |
| F06 | Accept with qualification | Row 2 right-end fragment; no corner or repeating-edge proof |
| F07 | Accept with qualification | Row 3 left-end fragment; ordered ground/crown connection strongest of three rows |
| F08 | Accept with qualification | Row 3 mixed-palette center; 112px width distinct from other centers; repetition unknown |
| F09 | Accept with qualification | Row 3 right-end fragment; one-row edge-alpha mismatch retained |

All 29 identities/roles have an explicit review disposition. The twelve whole
trees and eight patches are accepted on their stated coarse semantic and exact
assembly evidence. The nine forest pieces retain **medium** role/assembly
confidence. Their dense-tree identity is clear, while a universal modular
compiler, corner behavior or seamless repeat is not established.

Species, season, facing and gameplay geometry remain unknown for every applicable
candidate. “Broadleaf” is accepted only as the proposal's descriptive rounded
leafy crown form, not a botanical determination. Prefer “rounded-canopy tree” in
future user-facing vocabulary if that distinction could be lost.

## Eight replacement relations and operation clarification

| Recipe | Direct RGBA overwrite | Changed full-sprite pixels | Source-over control mismatch pixels |
| --- | --- | ---: | ---: |
| T01 + B01 → T02 | Exact; accepted | 141 | 0 |
| T01 + B02 → T03 | Exact; accepted | 141 | 0 |
| T04 + B03 → T05 | Exact; accepted | 141 | 0 |
| T04 + B04 → T06 | Exact; accepted | 141 | 0 |
| T07 + B05 → T08 | Exact; accepted | 141 | 0 |
| T07 + B06 → T09 | Exact; accepted | 141 | 0 |
| T10 + B07 → T11 | Exact; accepted | 141 | 0 |
| T10 + B08 → T12 | Exact; accepted | 141 | 0 |

All eight patch alpha masks equal the corresponding base-bottom mask and contain
only alpha 0/255. That explains why source-over and overwrite produce identical
normalized pixels **for these eight current examples**. Overwrite remains a
sufficient, deterministic and explicit recipe contract, including transparent
pixels. The present tests do **not** demonstrate that source-over would fail.

Concrete reconciliation wording: “RGBA overwrite reconstructs all eight named
variants exactly. Current alpha masks also make source-over equivalent; retain
overwrite as the declared operation rather than asserting its necessity from
these examples.” No author recipe needs to change. Do not generalize this
equivalence to other masks, partial alpha or new families.

The lower repeats are demonstrably replacement material for whole trees; they
cannot be treated as full-tree identities or proven standalone stumps. The eight
unmatched named sprites remain whole-tree exports with demonstrated compressed
component relationships, not missing-art findings.

## Palette and forest limits

T01→T04 has identical alpha, but the visible source color `(58,58,80,255)` maps
both to itself and to `(55,133,78,255)`. T01→T07 and T01→T10 each remove precisely
the local `(16,47)` pixel (alpha 255→0), while the same source color remains
visible elsewhere. No compared **whole exported sprite** has one global exact
source→destination color mapping. This agrees with the proposal's exception
handling and refutes a blanket pure-recolor assertion. The check is about the
whole export; it does not independently prove or disprove a segmented canopy-only
palette transform. Preserve exact source identities and masks regardless.

The three forest ordering probes independently reproduce:

| Row / members | Ordered edge-alpha mismatches | Reversed mismatches | Disposition |
| --- | --- | --- | --- |
| F01,F02,F03 | 33 / 35 | 109 / 97 | Plausible left/main/right order; ground limits remain |
| F04,F05,F06 | 15 / 15 | 68 / 68 | Plausible order; matching darker ground hides the center rectangle |
| F07,F08,F09 | 1 / 1 | 78 / 79 | Strongest visual closure; still not identical join pixels |

The independently rendered
[forest comparison](/tmp/tilefun-semantic-tree-review/independent-forest-comparison.png)
shows continuous-looking ordered crowns, disconnected/truncated reversed ends,
and the matching-ground effect. The counts describe adjacent alpha-column
disagreement; they are **not** texture-seam, art-quality or geometry scores.
Top-aligned order is a supported proposal, not the sole possible valid layout.
Overlap or different ground treatment might be useful, but was not tested and
must not be declared an established alternative recipe.

Concrete background qualification: rows 1 and 3 use sampled `(71,151,87,255)`,
while row 2 uses `(55,133,78,255)`. One common flat background does not match all
three ground treatments simultaneously. The rectangular center-ground boundary
is hidden by each **row-specific matching solid color**, not by arbitrary grass
or real textured terrain. This is already consistent with the proposal's saved
values; keep that qualifier visible during integration. The exact remaining
canopy/ground mismatches, shorter F03 and distinct F08 width must stay explicit.

The mapper helper's forest contact sheet enlarges width by 3× and height by 2×.
That does not change its source/composition measurements, and its individual
forest files use uniform 4× scale. For future evidence, use uniform scale in
the contact sheet too; the independent comparison above preserves aspect ratio.

The different `FencedTrees` kit cannot authorize collider, overlap, corner or
repeat behavior for F01–F09. No such transfer is made here. Real terrain-backed
seams, middle repetition and corners remain bounded follow-ups, not review
completion requirements for these qualified coarse identities.

## Reconciliation result

Independent disposition coverage is **29/29** for the pinned proposal, with
**8/8** replacement relations independently verified. The source-occurrence,
palette and seam measurements agree; no incorrect bounds, hashes, occurrence
lists or recipe result were found. The evidence correction is that overwrite
is sufficient and declared, while source-over is also equivalent in these
eight samples. Vocabulary, aspect-ratio capture and row-specific background
qualifications should remain visible in the coordinator's reconciliation.

No human approvals are created or inherited, no runtime geometry is inferred,
and no author/shared artifact was edited. Stop this bounded review here.
Next: coordinator reconciliation, then retain forest terrain/repeat/corner
questions for a separately scoped probe rather than expanding this review.
