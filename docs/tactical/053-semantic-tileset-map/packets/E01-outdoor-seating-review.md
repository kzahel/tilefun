# E01 — Independent outdoor seating review

2026-10-04. Reviewer: semantic-model worker, separate from the seating mapper.
State: all 27 records/proposal units supported at their bounded proposed scope,
with the original-only and interpretation qualifications below. Agent review
only; no human approval, runtime promotion or gameplay geometry decision.

## Exact review identity and observation limits

Reviewed frozen [proposal](E01-outdoor-seating.json), revision 1, SHA-256
`9562c3956611af40245966284ad5614bbff9a7c11a07fac78c9b9a6a5c5bd62b`.
This review applies to those exact bytes and the 27 explicit members E01-01–27.
The original/committed Exteriors master is 2816×8224, PNG SHA-256
`1429a07733836963fc6f1bf703bba59e2e766152bea54a9e936a65089c2d0737`.
The proposal also pins all named aliases, 24 theme sheets, source inventory and
legacy index. Source or proposal changes require new applicability.

First I viewed the source-only contact sheet, before opening the proposal JSON.
The coordinator brief named the seating groups and singled out Bench 5/6 and
mirror relationships; contact-sheet labels were visible. I then read the mapper
note, viewed all three raw context crops, and inspected the JSON. This is
independent, brief-informed review, not blinded discovery. No source art or
mapper files were changed.

Initial visual observations: the first two images have slatted raised backs,
lower seats and dark end supports; one is wider. Four narrow forms depict the
same slatted bench structure with opposite raised-rail sides and different
lengths. The seventh bench has a distinct brown palette and support detail.
The chairs have enclosed seat/back panels and frames, with checked/woven-looking
panels; broad views show four panel colors and two frame colors, while narrow
views place the raised back on opposite sides. The last four exports contain
planked table surfaces and lower bench-like sitting planks, with two plain and
two decorated layouts. The larger decorated export retains extra upper rows.
Visible form supports the coarse furniture identities, not compass headings,
precise materials, folding mechanics, attached-bench physics or walkability.

Raw civic context confirms proximity to streets, bins, trees, lights and gates;
that does not make furniture part of those structures. Camping context supports
the chair/table group but also contains excluded cots, equipment and other art.
The brown bench occurs near building windows and air conditioning, independent
of the City Props naming of its single. No exposed connector cut visibly
requires caps or neighboring pieces for these 27 exported forms. Standalone
visual eligibility is supported at metadata scope, with gameplay unknown.

## Explicit member dispositions

| Member | Independent disposition | Scope and retained qualifications |
| --- | --- | --- |
| E01-01 | Supported | Short golden slatted bench with complete seat/back/support silhouette; materials and compass heading unknown. |
| E01-02 | Supported | Wider golden slatted bench; distinct exact export, not a generated stretch or repeated-middle recipe. |
| E01-03 | Supported with mirror qualification | Narrow bench with raised rail at image right; full source retained, exact horizontal-mirror equivalence to 04 refuted by 20 alpha changes. |
| E01-04 | Supported with mirror qualification | Opposite raised-rail side; 20 one-column mirror differences remain part of this exact identity. |
| E01-05 | Supported original-only master lineage | Long narrow bench with raised rail at image right; two exact original export aliases, no whole-frame crop on master or 24 themes. Do not substitute shorter bench or force a reconstruction. |
| E01-06 | Supported original-only master lineage | Opposite-side long bench; both aliases supported, zero whole-sheet occurrences. Exact mirror to 05 refuted by 32 alpha differences. |
| E01-07 | Supported with theme qualification | Brown slatted bench; exact occurrence in Generic Buildings, despite City Props filename. Shared structure supports bench family, not pure recolor inheritance. |
| E01-08 | Supported | Green checked-panel chair, brown frame in broad view; folding mechanics and panel material unknown. |
| E01-09 | Supported | Blue panel counterpart in broad view; color correspondence supported, no universal recolor rule. |
| E01-10 | Supported | Ochre panel counterpart in broad view; original bounds/pixels retained. |
| E01-11 | Supported | Gray panel counterpart in broad view; differences include panel shading rather than assumed one-color replacement. |
| E01-12 | Supported | Green panel and gray-frame counterpart; 40 visible changes and unchanged alpha versus 08. |
| E01-13 | Supported | Blue panel and gray frame; 40 visible changes and unchanged alpha versus 09. |
| E01-14 | Supported | Ochre panel and gray frame; 40 visible changes and unchanged alpha versus 10. |
| E01-15 | Supported | Gray panel and gray frame; 40 visible changes and unchanged alpha versus 11. |
| E01-16 | Supported | Blue narrow chair view, tall back at image left; exact mirror correspondence with 20, no compass assignment. |
| E01-17 | Supported | Gray narrow chair with tall back at image left; exact mirror correspondence with 21. |
| E01-18 | Supported | Green narrow chair with tall back at image left; exact mirror correspondence with 22. |
| E01-19 | Supported | Ochre narrow chair with tall back at image left; exact mirror correspondence with 23. |
| E01-20 | Supported | Blue narrow chair with tall back at image right; exact horizontal reflection of 16 at these pinned pixels only. |
| E01-21 | Supported | Gray narrow chair with tall back at image right; exact reflection of 17. |
| E01-22 | Supported | Green narrow chair with tall back at image right; exact reflection of 18. |
| E01-23 | Supported | Ochre narrow chair with tall back at image right; exact reflection of 19. |
| E01-24 | Supported baked composition | Small plain planked table/bench image; constituent exports or physical attachment not established. |
| E01-25 | Supported baked composition | Small decorated counterpart; 126 RGBA changes, no alpha changes; food/drink-like additions, exact item types unknown. |
| E01-26 | Supported baked composition | Wide plain table/bench; full 48×32 export retained, no scaling/repeat or attachment inference. |
| E01-27 | Supported baked composition with frame exception | Wide decorated table/bench in a 48×48 frame; upper rows retained. Aligned lower crop changes 404 visible pixels without alpha change, precise cookware and attachment unknown. |

## Independent verification

The mapper helper passed unchanged:

```sh
python3 scripts/semantic-map-outdoor-seating.py --check --capture-dir /tmp/tilefun-semantic-E01-review/reproduction
```

I separately wrote an [independent checker](/tmp/tilefun-semantic-E01-review/independent-check.py),
with [results](/tmp/tilefun-semantic-E01-review/independent-results.json). It imports
neither the mapper helper nor the shared matcher. It verifies:

- All **80** source file SHA-256 pins, dimensions and normalized RGBA hashes.
- All **27** primary full exports, alpha-visible rectangles and pixel hashes;
  all **54** listed named aliases equal their primary full frames.
- All **50** listed sheet occurrences, split 25 master and 25 theme crops,
  including exact alpha-bound translation and Generic Buildings bench 7.
- A new exhaustive all-integer-origin search for every export over all **25**
  declared domains (master plus 24 themes). A whole candidate row is used as a
  byte anchor; every matching full frame must contain that row. Byte-aligned
  hits are translated to candidate origins, bounded, then checked row by row
  against the complete normalized frame. Every result agrees with the proposal;
  Bench 5/6 each have zero hits across the entire declared domain.
- All **18** variant-delta experiments, including transformed input hashes,
  RGBA/alpha change counts, XYXY change bounds, binary mask hashes and exactness.
  Masks use 255 for changed pixels and zero otherwise. Four side-chair pairs
  are exact mirrors; both bench mirror shortcuts are refuted.
- Both long-bench partial comparisons and the complete short/long row sets:
  upper/lower correspondence is exact, but long 5 has 12 rows and long 6 six
  rows absent from every full short row. Whole-row repetition alone cannot
  reconstruct either long export.

The independent check covers the 54 **listed** named aliases. The mapper helper
reran its complete 12,448-file named-domain scan, including 4,028 fitting-size
files; I did not independently repeat that broader named-file scan. This limit
does not affect the independent exhaustive master/theme searches above. A
negative exact whole-frame search is evidence about the pinned domains and
normalization, not proof of absent art, semantic identity or every possible
partial/composed representation.

## Reconciliation and handoff

No blocking semantic or pixel correction was found. Preserve Bench 5/6 as
explicit original-export source identities with original-only **master** lineage;
the absence of a master crop must remain distinct from absence of a source. Their
exact PNG hashes are
`a20540ddc069f247d4ea6550deba55d4e69a44d3e57a0636d04b155ad08c33fa` and
`a009c6d2666cf55b4f05a1b8307f84d147f3434aba2ccfc956ce7a46ee63f74f`.
Serial integration can expose exact copied PNGs as committed review sources;
that does not approve metadata, geometry or runtime placement.

Keep bench mirror exceptions, chair color/view member order, the Generic
Buildings occurrence, decorated-table baked-composition status and all unknown
materials/mechanics. The furniture silhouettes support complete visual-proposal
roles; no height, collision, footprint, anchor or walkable surface follows.

Accounting: **27/27 source records and proposal units dispositioned**, 25 direct
master correspondences and two original-only master records. Human approvals:
**0**. No mapper JSON, art source, inventory, runtime catalog or review event was
changed. Next: admit the packet through an explicit hash-pinned model adapter,
then offer exact-source Proposed sheet browsing for the owner's later review.
