# P02 — Independent scrapyard review

Date: 2026-10-04. Reviewer: Interiors survey/cabinet worker, separate from mapper.
Review state: all 29 candidates reviewed with retained uncertainty; agent review
only. No human approval, promotion or geometry decision is created.

## Reviewed snapshot and observation order

Reviewed [proposal](P02-scrapyard.json), revision 1, exact SHA-256
`429d796ec87adb007a4febc267fabff14c1032cd197dc47ed50d729f65073957`.
Original and public master: 2816 × 8224, SHA-256
`1429a07733836963fc6f1bf703bba59e2e766152bea54a9e936a65089c2d0737`.
The original/public coordinate systems are byte-identical; no repacking or
coordinate transform was inferred. This review applies to that frozen proposal,
not an unspecified later revision.

Before reading the full proposal or candidate labels, I inspected original
context `[1280,2944,1216,400]` and enlarged raw source windows for cars
`[1712,3040,512,128]`, tower/fence `[1472,3136,512,144]`, and mixed piles
`[1984,3152,208,160]`. Initial notes were saved locally before proposal comparison.
This is author-independent, brief-informed review, not formally blinded review.

Initial interpretation: distorted/crushed cars and vertically overlapping car
stacks; overturned underbodies; cargo containers; loose tires/rings and drums;
hazard symbols and spills; stepped blocks and irregular mixed-debris mounds;
a cylindrical tower with independent ring/rail variants; chain-link components;
and intact industrial buildings adjacent to the refuse. The triangular
log/pipe-like stock pile visible in the context was not assigned a final identity
or added to the trial. Spatial adjacency does not make all these objects waste.
No ground bounds, collision, anchor or walkable surface was visually established.

After recording this interpretation, I inspected all 29 pinned source sprites
in the contact sheet, the raw surroundings and all three modular probe renders.

## Candidate dispositions

“Supported” means the bounded semantic proposal is consistent with this review;
it does not mean every finer noun/material/facing field is resolved. Every row
also retains the packet's whole-export versus visible-bounds distinction,
unknown compass convention, exact source occurrence and unknown gameplay geometry.

| Candidate | Disposition | Independent finding / retained uncertainty |
| --- | --- | --- |
| P02-01 | supported at proposed scope | Bent teal cabin/car shell supported; direction and whether damage is a crush process remain unproven. |
| P02-02 | supported at proposed scope | Bent pale-gray cabin/car shell supported; related to P02-01, but no pure-recolor inheritance verified. |
| P02-03 | supported at proposed scope | Two overlapping car silhouettes, gray above orange, form one baked export; no exact loose-car recipe proven. |
| P02-04 | supported at proposed scope | Three overlapping shells supported, orange/gray/teal from top to bottom; count does not define three independent exported objects. |
| P02-05 | supported at proposed scope | Four wheels and exposed dark underside support overturned car; keep lower-row identifier, not compass direction. |
| P02-06 | supported at proposed scope | Overturned underbody supported; upper-row outline differs from P02-05, with front/rear ordering unresolved. |
| P02-07 | supported with retained identity uncertainty | Hollow rust/beige ring supported; tire versus coupling/pipe cannot be resolved from this tiny view. |
| P02-08 | supported with retained identity uncertainty | Curved stacked metal-looking bands supported; bumper versus general panel material/usage unresolved. |
| P02-09 | supported with retained identity uncertainty | Brown slatted two-rail frame supported; pallet/grating remain uncertain. A short ladder-like frame is also visually plausible, not a final replacement noun. |
| P02-10 | supported with retained identity uncertainty | Compact gray/orange block supported; material and compaction process remain hypotheses. |
| P02-11 | supported with retained identity uncertainty | Taller green/orange compact block supported; do not infer scaled copies of P02-10/P02-12. |
| P02-12 | supported with retained identity uncertainty | Small green/orange compact block supported; distinct exact source identity retained. |
| P02-13 | supported with retained identity uncertainty | Small pale/highlighted compact block supported; exact metal composition unproven. |
| P02-14 | supported with retained identity uncertainty | Tall mixed-color compact block supported; distinguish from P02-11 despite related palette. |
| P02-15 | supported at proposed scope | Stepped collection of rectangular bundles supported as baked composition; no component-to-pile exact assembly verified. |
| P02-16 | supported at proposed scope | Mixed irregular refuse mound supported; no specific material or reuse recipe inferred. |
| P02-17 | supported at proposed scope | Mixed mound with directional blue sign supported; exact visible sign subset independently verified. |
| P02-18 | supported at proposed scope | Mixed mound with warning triangle supported; full loose-sign equivalence is unresolved, not established by the shared shape. |
| P02-19 | supported at proposed scope | Mixed mound with dark round item supported; exact nongrid exported origin y=3165 independently confirmed. |
| P02-20 | supported at proposed scope | Mixed mound with tall white item supported; exact nongrid origin y=3164 and visible-item subset independently confirmed; refrigerator identity unresolved. |
| P02-21 | supported at proposed scope | Left taper/right cut supports left-cap role, also confirmed by positive and reversed-order renders. |
| P02-22 | supported with retained identity uncertainty | Rectangular middle strip supports repeat-body proposal; repeated debris remains visible, and seam occupancy is not proof of invisible texture seams. |
| P02-23 | supported at proposed scope | Left cut/right taper supports right-cap role; correct orientation closes outer end. |
| P02-24 | supported at proposed scope | Blue sign with right arrow supported; exact visible subset is 117/117 at [25,9], without proof of paint order or unique assembly. |
| P02-25 | supported with unresolved component relation | Warning triangle on tilted support supported; full-fit subset fails at 40/174. Two tied best offsets exist: [38,0] and [39,0]. Occlusion/clipping/change remain unresolved. |
| P02-26 | supported with retained identity uncertainty | Tall white divided box supported; exact visible subset 237/237 at [12,5] does not establish appliance versus cabinet/bin identity. |
| P02-27 | supported with retained identity uncertainty | Elevated cylindrical tank/utility supported; contents, water-specific use and footprints unknown; not classified as debris. |
| P02-28 | supported at proposed scope | Corrugated door/window cabin with rooftop fans supported as neighboring intact building, not a refuse component. |
| P02-29 | supported at proposed scope | Corrugated-roof shed/shack supported as neighboring intact building; junk-themed legacy name does not establish damage or waste status. |

## Checks, corrections and limits

Ran the author helper without modifying the proposal:

```sh
python3 scripts/semantic-map-scrapyard-pilot.py --check --capture-dir /tmp/tilefun-semantic-exteriors-review/P02-captures
```

It verified all 29 candidates and 29 all-origin master occurrences. Independently,
I recomputed hashes for all 58 named original-file aliases, normalized visible-RGBA
hashes and alpha bounds for every candidate, and compared all 29 claimed master
frames directly against the originals. Two file-copy locations per candidate
remain aliases rather than two independent semantic objects.

An independent streamed byte-row search, without importing the author's matcher,
confirmed that P02-19 has only `[2112,3165,64,48]` and P02-20 only
`[2048,3164,64,48]` in the entire master. The scope of this independent all-origin
rerun is these two padding cases; the supplied helper performed the global
all-origin search for all 29. Nongrid origins are preserved rather than rounded.

I independently recomputed the three bounded full-fit component comparisons:
blue sign 117/117 at `[25,9]`; white box 237/237 at `[12,5]`; warning triangle 40/174
with tied best offsets `[38,0]` and `[39,0]`. The author's single reported best
`[39,0]` is valid, but must not be interpreted as unique. Recommend preserving
both ties if these experiment results become a runtime schema. No clipped/occluded
follow-up was performed in this review; the failed full-fit comparison cannot
refute partial reuse, nor does visual similarity prove it.

The rendered one-body 96×32 and two-body 160×32 strips support complementary caps
and a repeatable middle at this tested scope. The reversed-cap 96×32 control has
visible inward taper/gaps and cut outer ends. Seam row occupancy measures source
continuity, not semantic correctness, seamless texture quality, geometry or an
approved recipe. The repeated middle has visible repeated debris pattern.

No mandatory coarse-identity correction is needed. Preserve the medium-confidence
material/function alternatives for small junk, blocks, the white box and utility
contents. P02-09 may additionally carry a ladder-like frame alternative. The
warning-sign relation remains explicitly unresolved. Larger car/scrap stacks
remain baked compositions until an occlusion-aware exact recipe is tested.
The packet's explicit unexamined object-level leftovers are appropriate; this
review does not add the surrounding barrels, containers, fences or utility variants
as completed candidates.

Local reproducible evidence includes
[raw context](/tmp/tilefun-semantic-exteriors-review/scrapyard-raw-context.png),
[candidate sheet](/tmp/tilefun-semantic-exteriors-review/P02-captures/candidates.png),
[initial pre-proposal notes](/tmp/tilefun-semantic-exteriors-review/initial-observations.txt),
and [independent measured checks](/tmp/tilefun-semantic-exteriors-review/independent-checks.json).
The core helper reproduces its captures from pinned sources. The temporary
independent-check script is an audit aid, not a new committed runtime dependency.

Disposition: 29/29 candidates independently reviewed at this proposal scope,
with the uncertainties above retained; zero human approvals. All candidate
geometry records retain null anchor/footprint/collision/walkable fields and
explicit unknown status. No source art, author packet or shared catalog changed.
Next: preserve component-match ties and route the bounded warning/identity
uncertainties to later investigation or owner review without synthesizing approval.
