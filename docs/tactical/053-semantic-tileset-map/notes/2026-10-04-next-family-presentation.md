# Plants, bedroom and fences: committed presentation adapters

Date: 2026-10-04. State: adapter implemented and focused verification passed;
coordinator owns serial catalog/UI integration and application validation.
All three families remain Proposed. No human approval, art promotion, new pixels,
placement enforcement or gameplay geometry is implied.

This worker owns only [build-family-next.py](../../../../scripts/build-family-next.py),
[its focused tests](../../../../scripts/build-family-next.test.py) and this note.
The coordinator owns the main builder, types/UI/browser checks, generated catalog,
registry, model and commits. The adapter never modifies an existing family.

## Reviewed inputs and public API

`build_next(a, images, sheets)` follows the existing expansion adapter API:
`a` supplies the main family-sheet helpers; `images` contains committed RGBA
sheets; `sheets` contains art-catalog source records. The result is exactly three
family objects in order `plants-planters`, `bedroom`, `fences-gates`, for the
caller to append to the eight existing families. No source image addition is
required: only the existing `me-complete` and `modern-interiors` sheets are used.
Typed sprites retain native `size`, source `rect`, destination `at` and optional
`blend: over`; no new browsing-schema field is introduced.

Reviewed inputs are the exact frozen E04, I02 and E05 proposals, their independent
reviews, and source reproduction helpers. Adapter `PINS` stores all six
proposal/review digests, while `HELPER_PINS` stores the three mapper helpers.
Each packet's dependency pins are checked before building. E04 review SHA-256 is
`7815d8d76dfa2543f5ee43f10d9da5ff375a02043574a8bcd2474e7a508ea961`;
I02 review is `fb62ea277d4c053acf5ba752dd2da54963c55e30a8920425c1cb050e5f0efc88`;
E05 review is `3395feed2cfe2f9e505c9ca375b2792b22519c95f078d0ab58d92bb0663191e8`.
These are agent review receipts, not human decisions.

The adapter verifies committed raw PNG bytes, normalized whole-sheet pixels and
dimensions against the frozen source records and art catalog, then checks exact
candidate/alias pixels, native bounds, topology limits and finite recipe hashes.
Original source metadata is retained as frozen provenance; source packs and
research helpers are never opened/executed during the build. Missing-original
browsing/build mode therefore does not weaken the committed source checks.

## Plants and planters

E04 exposes **seven whole-object cards / 19 source records**. Per-card selectors
use ordinary labels and stable member IDs, with the mapper's default original
member placed first. Existing first-variant fallback handles the single global
Original appearance. Selector captions describe tree bases, flower colors and
plant appearance. Bare/grass/rounded/square trees are complete baked source
variants; no detachable base recipe is offered.

E04-03 and E04-04 reconstruct transparent **32×64** native frames by copying the
32×52 or 32×53 measured master crop at **[0,11]**. E04-15 reconstructs a **16×16**
frame from its 14×13 crop at **[1,2]**. These layer copies use replacement RGBA,
without an alpha mask, background fill, scaling or trimming. The adapter requires
explicit alpha-visible occurrence lineage and the absence of a whole-frame master
match for these three records; it never inherits full-frame lineage from a crop.
All 19 rendered full-frame hashes and alpha bounds agree with the proposals.
Null legacy index navigation aliases remain null, while measured committed crops
provide rendering.

Card facts retain planter-versus-ground uncertainty and unknown species/material.
The upright potted-plant selector explicitly labels the tan plant's shorter leaves;
its card explains that foliage changes as well as pot color. Arching foliage stays
identical within its bounded pair. The small unboxed bush keeps the shrub versus
flower-clump alternative. No plant assembly is invented.

## Side beds and blankets

I02 exposes **six cards / 18 source records**: four complete-bed cards and two
blanket components, all under a global Normal / Dark shadow / No shadow selector.
Every member has all three exact render IDs, so the global choice needs no fallback
onto an unrelated style. The adapter checks the actual black-shadow counterparts
**424,425,486,487,480,542**, rather than substituting normal vendor numbers.
Original-to-packed paths/rectangles and every named alias are verified from the
frozen packed index. The related master bed crops are never used as exact aliases.

Four assembled examples each retain three shadow variants. Every example is a
transparent **48×48** native canvas, complete bed at **[0,0]**, then matching
48×32 blanket at **[0,16]**, both source-over. Exact recipe pixels reproduce all
12 reviewed positive overlays. Required underlay membership, side/end pairing,
layer order and native full-frame crops are checked; a blanket remains forbidden
as a complete standalone prop in this kit, while its decorative cloth/rug
alternative is stated. Beds do not require the optional blanket. Blankets are
pixel-identical across render labels, so same-render pairing is identity
bookkeeping rather than a physical color requirement. Negative/misaligned recipes
are research evidence and never become presentation examples.

## Low fences and garden gates

E05 exposes **25 cards / 27 source records**: 22 picket components, two gate cards
with cool/warm frame selectors, and one whole outlined shrub. Every native frame
is an exact committed master crop; duplicate named corner exports remain separate
record/card identities. Gate cards use **unknown** kind because standalone use and
outer hedge completion are unresolved. Gate variants preserve linework/edge changes;
they are not presented as exact recolors. Pickets cannot stand alone and explain
which neighboring cuts need continuation. The two kits' compatibility stays unknown.

Seven finite closed examples and one separately headed **Open fence sections**
example are exposed. Ordered source-over layers, native offsets, recipe hashes,
pixel hashes and bounded topology dispositions are checked. Closed recipes need
zero unmatched ports; the open upper run retains its two downward cuts and explains
that continuing side posts are required. Diagonal pairs advance vertically by
16 pixels with **zero horizontal advance**. Neither unresolved hedge-extension
trial, shifted/reversed negative probe nor arbitrary longer fence graph is offered.
The shrub remains a whole visual form, not a proven repeating gate-side module.

## Counts and verification

The adapter adds **38 cards / 64 source records**. With the eight earlier families
appended by the coordinator, expected inventory is **11 families / 169 cards /
255 source records**. Existing family content/revisions are not rewritten by this
module; source pins are derived only from used sheets. All objects, components,
unknown gate forms and examples retain Proposed status and unknown game geometry.

```sh
python3 scripts/build-family-next.test.py
```

The focused suite passed **10 tests**, covering card/record/revision counts,
original defaults, E04 padding restoration, I02 three-shadow counterpart mapping
and required underlays, source-over versus replacement behavior, E05 duplicate
records/unknown gates/open sections/diagonal offsets, and committed-source/pin
mutation rejection. It rejects changed native/alpha bounds, invented gameplay
geometry, component-to-whole presentation changes, altered overlay offsets,
wrong black-shadow vendor IDs, stale packed aliases, newly unmatched closed fence
cuts, changed recipe hashes and unsupported hedge examples. Missing-original replay
records every build read and rejects paths beneath ignored `assets/`; mapper
helpers are read only for pins. Tests perform no expensive absence search.

After the coordinator generated the catalog, the main builder's strict read-only
`--check` passed with **11 families / 169 cards / 255 records**. Shared typecheck, unit tests, lint,
render/build/browser tests and Workshop inventory generation remain coordinator
work. No shared npm jobs or commits were run by this adapter worker.

Next: coordinator generation and isolated browser inspection should verify all
six bed cards share the global shadow choice, the three plants' padding is intact,
gate standalone status stays unknown, and the open fence section is visually
separate. Whole-sheet and selected-variant note pins must keep existing review
contracts; discussion does not approve or promote these proposals.
