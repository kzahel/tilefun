# P02 — Scrapyard, wrecks and refuse components

State: proposed; independent review pending. Mapper: `source_inventory`.
Date: 2026-10-04. Proposal revision: 1.
Ownership: this packet, [machine-readable proposal](P02-scrapyard.json), and
[reproduction script](../../../../scripts/semantic-map-scrapyard-pilot.py).
The coordinator owns integration, shared vocabulary, queue and commits.

## Source evidence and scope

Pinned source: `public/assets/tilesets/me-complete.png`, 2816×8224, SHA-256
`1429a07733836963fc6f1bf703bba59e2e766152bea54a9e936a65089c2d0737`.
Coordinates below are original pixel `[x,y,width,height]` with top-left origin
and exclusive right/bottom. The committed master is byte-identical to the
original master, so existing Exteriors index coordinates need no conversion.

The first observation used the **raw source context** `[1280,2944,1216,400]`,
before reading object keys. The detailed pass used `[1728,3024,512,304]`.
The source visually groups deformed car cabins and stacks, overturned cars,
compact block-like debris, loose fragments and mixed rubbish mounds. It also
contains intact-looking tanks, container cabins, a corrugated shed, shipping
containers and fence fragments. A broad scrapyard/industrial-debris theme is
supported; membership of every nearby utility in that theme is not established.

Twenty-nine representative exports are proposed, with 29 exact occurrences in
the master and 58 named original-file occurrences (complete-single and
byte-identical theme-single copies). Each JSON record retains all exact matches,
source paths/hashes, full exported bounds and alpha-visible bounds separately.
This is a bounded trial, not exhaustive segmentation of either displayed region.

Temporary evidence, reproducible with the command below:

- [Raw context](/tmp/tilefun-semantic-P02/context.png)
- [Raw detailed view](/tmp/tilefun-semantic-P02/detail.png)
- [Selected singles and candidate IDs](/tmp/tilefun-semantic-P02/candidates.png)
- [One-body modular strip](/tmp/tilefun-semantic-P02/modular-strip-1.png)
- [Two-body modular strip](/tmp/tilefun-semantic-P02/modular-strip-2.png)
- [Reversed-cap control](/tmp/tilefun-semantic-P02/modular-strip-reversed-caps.png)

No evidence PNGs are committed. The JSON records reproducible normalized RGBA
hashes for sources and assembly probes rather than relying on those temporary
paths remaining available.

## Explicit candidates

The JSON owns separate confidence/evidence for identity, bounds, family, role,
facing and variant hypotheses. These coarse labels are proposals. Legacy
`ME_Singles_City_Props` keys are evidence, not human semantic approval.

| ID | Legacy key | Master rectangle | Proposed identity / role |
| --- | --- | --- | --- |
| P02-01 | Car_Wreck_1 | [1776,3104,64,48] | Teal bent car shell; standalone |
| P02-02 | Car_Wreck_2 | [1712,3104,64,48] | Pale-gray bent car shell; standalone |
| P02-03 | Car_Wreck_4 | [1968,3088,64,64] | Gray-over-orange two-car stack; baked composition |
| P02-04 | Car_Wreck_7 | [1904,3072,64,80] | Orange/gray/teal three-car stack; baked composition |
| P02-05 | Car_Wreck_8 | [2032,3104,64,48] | Teal overturned car; lower-row variant |
| P02-06 | Car_Wreck_13 | [2032,3056,64,48] | Teal overturned car; upper-row variant |
| P02-07 | Junk_2 | [1504,3072,16,16] | Hollow rusty ring; tire/pipe identity unresolved |
| P02-08 | Junk_6 | [1488,3136,32,16] | Stack of curved metal bands; bumpers/panels unresolved |
| P02-09 | Junk_7 | [1472,3072,32,32] | Slatted frame; wood pallet/metal grating unresolved |
| P02-10 | Scrap_Metal_1 | [2000,3296,16,16] | Compact gray/orange scrap block |
| P02-11 | Scrap_Metal_2 | [2000,3280,16,16] | Tall green/orange scrap block |
| P02-12 | Scrap_Metal_3 | [2032,3296,16,16] | Small green/orange scrap block |
| P02-13 | Scrap_Metal_4 | [2032,3280,16,16] | Small pale metallic-looking scrap block |
| P02-14 | Scrap_Metal_7 | [2048,3296,16,16] | Tall mixed-color scrap block |
| P02-15 | Scrap_Metal_Pile_1 | [1984,3232,80,48] | Stepped mound of compact blocks; baked composition |
| P02-16 | Trash_Pile_1 | [2112,3280,64,32] | Plain mixed-refuse mound |
| P02-17 | Trash_Pile_2 | [2112,3248,64,32] | Mixed mound with blue directional sign |
| P02-18 | Trash_Pile_3 | [2112,3216,64,32] | Mixed mound with warning triangle |
| P02-19 | Trash_Pile_4 | [2112,3165,64,48] | Mixed mound with dark round item; nongrid exported origin |
| P02-20 | Trash_Pile_5 | [2048,3164,64,48] | Mixed mound with tall white discarded item; nongrid exported origin |
| P02-21 | Trash_Pile_Modular_1 | [1872,3280,16,32] | Refuse strip left cap |
| P02-22 | Trash_Pile_Modular_2 | [1904,3280,64,32] | Refuse strip middle; repetition tested |
| P02-23 | Trash_Pile_Modular_3 | [1984,3280,16,32] | Refuse strip right cap |
| P02-24 | Trash_Pile_Props_7 | [2064,3264,16,16] | Blue sign with white right arrow; potential mound component |
| P02-25 | Trash_Pile_Props_15 | [2064,3280,16,32] | Warning triangle on support; potential mound component |
| P02-26 | Trash_Pile_Props_16 | [2080,3216,16,32] | Tall white rectangular discarded item; potential mound component |
| P02-27 | Water_Tower_1 | [1648,3152,48,112] | Elevated cylindrical tank; neighboring utility |
| P02-28 | Container_House_1 | [1920,3152,80,80] | Corrugated cabin with door/windows/rooftop fans; neighboring building |
| P02-29 | Junk_Shack_1 | [2176,3216,96,96] | Corrugated shed/shack; neighboring building |

Bent cars, overturned cars and compact bundles should remain distinct families.
The overturned exports visibly show four wheels and an underside. They should
not inherit the identity “crushed block” merely because they are arranged beside
crumpled side/cabin views. Upper/lower rows have distinct outlines; north/south
or front/rear ordering is unproven. Stack counts are visible, but no exact
reconstruction from separately exported car singles has been established.

The compact rectangular debris could be pressed metal recycling bales or mixed
bundled rubbish. “Scrap block” captures the observed coarse identity with medium
confidence; exact material and compaction process remain hypotheses. The stepped
pile is visibly composed of multiple blocks, but matching individual components
into that baked export needs a separate occlusion-aware check.

## Alternatives and experiments

### Nongrid padding refutes the missing-art interpretation

`Trash_Pile_4` and `Trash_Pile_5` have no exact 16px-grid match and no existing
index entry. Their original 64×48 exports include 13px/12px of blank space above
their alpha bounding boxes. An arbitrary-pixel whole-export search finds exact
normalized RGBA matches at `[2112,3165,64,48]` and `[2048,3164,64,48]` respectively.

The shared matcher uses a visible row as an anchor. An independent scan in this
pilot chooses a rare visible RGBA color, streams its positions in the normalized
master bytes, infers each possible origin and verifies the entire export. Both
algorithms agree for these two cases. The shared arbitrary-pixel scan covers all
29 selected candidates; each has exactly one whole-export occurrence. File-copy
aliases remain separately retained.

This supports **padding/alignment**, and refutes “these two singles are absent
from the master.” It does not establish the disposition of the other 1,406
historically unindexed singles. Nongrid full-export origins must coexist with
exact visible bounds; do not round the Y coordinates or silently remove padding.

### Modular cap/body assembly

`P02-21 → P02-22 → P02-23` produces a 96×32 mound strip. Repeating the middle
produces a 160×32 strip. The joins have occupied pixels on both sides through
25 shared rows; the wider strip has a third occupied join through 26 shared
rows. Visual inspection shows closed tapered outer ends and a continuous lower
band, with the expected repeated debris pattern in the wider composition.
This supports left cap, body and right cap roles and a usable repeat-body
proposal. It is not a claim of an invisible texture seam or a gameplay recipe.

The reversed-cap control places `3 → 2 → 1`. Its tapered faces point inward,
creating conspicuous breaks at the joins and vertical cuts at the outer ends.
That rendered failure weakens the reversed assignment. All probes use original
pixels, nearest-neighbor display and no painted fixes.

### Loose components versus full piles

A full transparent-export match is too strict for a component placed over an
opaque pile. The bounded probe instead compares every visible component pixel
at every offset where its full export fits within the pile image:

| Component → pile | Best local offset | Exact visible pixels | Result |
| --- | --- | --- | --- |
| P02-24 blue sign → P02-17 | [25,9] | 117 / 117 | Exact visible subset |
| P02-26 white item → P02-20 | [12,5] | 237 / 237 | Exact visible subset |
| P02-25 warning triangle → P02-18 | [39,0] | 40 / 174 | Full-fit component hypothesis fails |

The first two results support component reuse. They do not prove paint order,
whether a source component was copied by the vendor, or a unique assembly recipe.
The warning shape is visually related, but the full-fit test fails. Clipping,
occlusion, a shifted origin outside the full-fit search, and a genuinely changed
component remain plausible. Preserve that relation at medium confidence and
test visible portions/alternate offsets later rather than claiming exact reuse.

### Specific names deliberately unresolved

The hollow ring can be a tire or pipe coupling; compare other tires/couplings and
cross-section shading before naming it. The curved bands could be bumpers or
general bent panels; compare intact vehicle parts. The slatted brown frame needs
wood-grain/metal-edge evidence and related pallet forms. The tall white discarded
item could be an appliance, refrigerator, cabinet or bin; its source pixels
match a pile component, but that says nothing about which specific noun is right.
The tank's coarse structure is clear while its contents are unproven. These
questions remain explicit in the JSON instead of being resolved from filenames.

## Review and handoff

Every candidate remains pending independent review. Reviewer first observes the
raw context and selected singles, then compares this proposal. Review should
challenge family membership, variant order, exported versus visible bounds,
the pile-component failure and repeat-body quality. Geometry is unknown for all
29 candidates: no collision, footprint, anchor or walkable-surface proposal.

The supplied current art-note snapshot was read by matching source rectangles.
Some broad scene-review envelopes intersect this band, including the approved
`street-v1-bins` scene (thread `79e09019-013f-4539-8016-e6865305bde2`). That decision
pins two bin props and a bakery scene, not these semantic proposals. No existing
human approval is applied here, and no feedback/approval records were written.

Remaining source regions are explicitly unexamined at object level: other seven
car wreck exports, remaining loose junk/scrap items, most of the sixteen trash
props, barrel piles, fence pieces, shipping containers, utility variants and the
small trash piles around Y3984–4112 outside this pilot. The observation of broad
context does not count those objects as understood. Sources represented by
larger sheets are not counted as additional independent objects.

```sh
python3 scripts/semantic-map-scrapyard-pilot.py
python3 scripts/semantic-map-scrapyard-pilot.py --check
python3 scripts/semantic-map-scrapyard-pilot.py --check --capture-dir /tmp/tilefun-semantic-P02
```

The script pins the master and each selected original's hash from S01, records
all arbitrary-pixel exact occurrences, and deterministically reproduces JSON.
The two unindexed-pile cases also use an independent exact-search algorithm.
`--check` leaves the proposal JSON unchanged; optional captures only write into
the supplied temporary directory. Original packs and Pillow are required.
The coordinator handles repository-wide validation and review registration.

Next: independent review, then a focused clipped/occluded warning-triangle probe
if the relation remains disputed. This packet is an agent proposal, not approval
or runtime promotion.
