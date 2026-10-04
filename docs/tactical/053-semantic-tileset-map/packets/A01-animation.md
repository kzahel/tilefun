# A01 — Brown inset door animation

2026-10-04. Mapper: sofa model/animation worker. Bounded native16 Interiors
animation investigation; proposal only, with separate independent review required.
No source image, packed entry, game playback definition or approval was changed.

## Exact source and initial observation

Proposal revision 1: [A01-animation.json](A01-animation.json), SHA-256
`f0e5f627c4e8fe27c5de9c83c5b2ba98d60f273fd7361be07a914563a49e9f0c`. Helper [semantic-map-animation.py](../../../../scripts/semantic-map-animation.py)
SHA-256 `3d38cba0d97590d4697f1bf3c39bf527aa6a824176c28a7e1ed94d5a1d4a73a3`. The proposal pins its source inventory, packed index and matcher
implementation. Its 84 source pins comprise 82 PNG inputs in the inventory plus
**two explicitly supplemental GIFs outside the original PNG denominator**.
The full source provenance remains distinct from coverage/semantic assignments.

I first viewed an unlabeled enlarged raster of the two strips, before detailed
metadata comparisons. The first row shows a brown handled panel with a rectangular
upper inset. It progressively turns/narrows from a closed rectangle into a thin
edge at image left while retaining the dark doorway border. The second row stays
closed, with small inset/handle/body-edge shifts. Pixels support a hinged opening
and a closed-door perturbation; the filename supplies the locked-attempt context,
which is not evidence for game lock mechanics. Both source strips have 11px of
transparent top margin in their 32px frame; these untrimmed animation bounds do
not establish world height, collision, anchor or independent placement.

Source strips:

| Action proposal | Original native16 PNG | Source layout |
| --- | --- | --- |
| Door opening progression | `3_Animated_objects/16x16/spritesheets/animated_door_1.png` | 80×32, five 16×32 frames left to right |
| Closed-panel perturbation / locked-attempt demonstration | `3_Animated_objects/16x16/spritesheets/animated_door_1_locked.png` | 64×32, four 16×32 frames left to right |

Paths above are relative to `assets/interiors/`. Inspect the
[exact frames](/tmp/tilefun-semantic-A01/frames.png) and
[static master context](/tmp/tilefun-semantic-A01/static-context.png). Captures are
temporary diagnostic output; the packet and source/recipe pins are durable.

## Records, temporal order and static correspondence

Nine source-frame records represent **eight distinct normalized pixel states**.
A01-01 (opening frame 0) and A01-06 (perturbation frame 0) are exact duplicates,
retained as two temporal source occurrences. They share one physical static master
rectangle `[16,3440,16,32]`, and `[16,640,16,32]` on all three Generic theme sheets
(normal, black-shadow and shadowless). Record-occurrence totals are two master and
six theme links; the duplicate treatment yields **four unique static source
rectangles**, not eight distinct static assets. The three render labels do not
create different frame pixels in these matched static samples.

A01-02…05 and A01-07…09 have no exact full-frame appearance in the declared static
sheet or packed domains, and remain animation-original-only within that bounded
search. This does not mean missing art. A source frame is a temporal state rather
than a spatial component to concatenate. The logical door family, two action
proposals, source-record occurrences, unique pixel states, static counterpart and
playback parameters all remain separately represented.

The helper searched every fitting integer-pixel origin in 79 static sheet domains:
the Interiors and Room Builder masters and all inventoried native16 normal,
black-shadow and shadowless Interiors theme sheets. It also scanned the committed
packed atlas at every fitting origin. No exact untrimmed packed occurrence or
same-size named export was found among **5,368 examined 16×32 indexed singles**
from the 15,964-single index.

A discriminating padding check then compared exact normalized **alpha-tight bodies**
against all 15,964 indexed singles, keeping original export/body coordinates and
packed-body linkage separate in the schema. It also found no counterpart. Neither
negative establishes absence from differently clipped, occluded, recolored,
resized or otherwise unsearched states. The alias-corpus raw source pins were
verified against the source inventory while reading; sorted corpus fingerprints
retain the exact examined domains without crediting their unrelated art as mapped.

## Companion GIF demonstration evidence

Both native16 companion GIFs decode to exact normalized RGBA equality with their
same-index PNG strip frames; all nine per-frame changed-pixel/alpha counts are zero.
GIF transparency/palette differences were checked rather than assumed equal. GIF
source pins and decoded hashes remain explicit alongside source-frame IDs/deltas.

| Demonstration | Decoded order | Durations in milliseconds | One source cycle | GIF loop extension |
| --- | --- | --- | --- | --- |
| Opening | A01-01→02→03→04→05 | 300, 100, 100, 100, 300 | 900ms | 0: indefinite repetition |
| Closed perturbation | A01-06→07→08→09 | 500, 100, 100, 100 | 800ms | 0: indefinite repetition |

These are **source demonstration parameters**, not game behavior. In particular,
the looping opening GIF resets from its final narrow/open view to the first closed
view; it supplies no separate closing frames or a claim that reverse playback is
correct. Game frame durations, loop policy, activation/lock conditions, collision
transitions, reverse closing and world placement remain unknown. No runtime
animation has been proposed for automatic activation or promoted by this packet.

## Reproduction, challenges and limits

```sh
python3 scripts/semantic-map-animation.py --check
python3 scripts/semantic-map-animation.py --check --capture-dir /tmp/tilefun-semantic-A01
```

Full replay/check passes with original sources and Pillow. It verifies raw PNG
inventory hashes/dimensions, full normalized images, all static/packed frame searches,
indexed whole-frame and alpha-tight alias corpora, source-frame duplicates,
GIF decoded hashes/order/durations and adjacent source-frame deltas. `--check`
compares exact saved proposal bytes without writing; captures are optional temporary
artifacts. The helper refuses to overwrite an existing proposal during normal
writing. Source assets and packed data are never outputs.

The initial opening interpretation competes with an arbitrary per-frame pose bank;
monotone leaf narrowing plus exact companion-GIF source order support progression.
Closed-panel shifts could be a shake or failed-opening attempt; the pixels remain
closed, and the locked filename/GIF supply demonstration context without resolving
mechanics. The full-frame-versus-padding alternative was tested by the separately
recorded alpha-tight corpus; its zero exact matches does not erase the known static
master/theme counterpart.

Original sources are required for this offline research replay. The helper performs
no source normalization/promotion into the shared model or coverage ledger and
creates no fresh-clone rendering asset. Agent review, human approval and gameplay
geometry remain pending/unknown. Registration must retain exact proposal/review
pins and must not credit this new schema before an explicit adapter is implemented.

Next: independently check this exact frozen packet, register its bounded evidence,
and choose whether a proposed owner-facing animation demonstration should expose
source order separately from gameplay playback choices.
