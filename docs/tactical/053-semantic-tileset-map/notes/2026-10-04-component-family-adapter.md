# Component and animation family adapter — 2026-10-04

The explicit `scripts/build-family-expansion.py` adapter returns the three reviewed
research families through `build_expansion(adapter, images, sheets)`. It receives
the existing family-sheet helpers and committed source images; it does not import
the main adapter or read ignored original packs. Integration remains serial in
`build-family-sheets.py`.

## Displayed scope

Room Builder contains 25 cards / 25 records: 17 pale floor pieces, six fixed arch
body pieces and two optional ground-shadow strips. Six closed examples precede
an **Open path sections** section containing the supported L/T continuation
windows. Each window explicitly needs continuation beyond its boundary. The
weakened inset extensions, invalid joins and unresolved shorter arch remain in
the research packet. The arch uses a fixed 32×48 body, optionally 32×56 with its
16×8 shadow strips. Packed subfile pixels preserve the reviewed shadow difference
from the master; no exact master alias or arbitrary extension is inferred.

Playground tubes contain 19 cards / 25 records. The 19 ochre exports retain their
individual source identities, including the exact 2/6 duplicate and the distinct
4/8 and 9/10 shading. The crossing and two side entrances offer ochre/blue/red
variants; the other cards retain ochre. Five supported examples use native,
untrimmed frames and exact recorded offsets with explicit `blend: 'over'` layers.
The U-shaped example is a regression witness: RGBA replacement changes its pixels.
The straight/cross examples happen to match replacement, so those alone cannot
establish correct blending. Rounded ends versus obscured mouths, rim purpose,
arbitrary color mixing and gameplay traversal remain unknown.

Animated doors contain two source-strip cards / nine frame records, with eight
distinct pixel states. Card kind `frame` and `variantLabel: 'Frame'` distinguish
frame variants from spatial assembly pieces. The family selector has only its
representative `frame-1`; piece controls expose all five/four frames. The two
examples replay the companion GIF evidence through optional example metadata:
`animation: { frameDurationsMs: number[], loop: boolean }`. Opening uses
300/100/100/100/300 ms and closed movement 500/100/100/100 ms, both repeating.
These are source demonstrations only. Resetting to closed supplies no closing
sequence; game timing, triggers, placement permission and lock mechanics remain
unknown. Committed byte-identical PNG strips are sufficient for builds; GIFs need
not be committed or decoded during a build.

The slice adds 46 cards / 59 source records. All families remain Proposed; source
provenance and independent research review do not constitute human semantic or
gameplay approval.

## Deterministic checks

The adapter checks all six frozen proposal/review file hashes and each packet's
input pins, including indexes, source ledger and A01 matcher implementation. Used
committed image bytes, source-art fingerprints, dimensions and normalized RGBA
are pinned independently of the caller. Every member preserves exact native
bounds, normalized pixels and separate alpha-visible bounds.

Room Builder verifies every tile and whole-sheet-offset alias against packed
index source paths and source/destination coordinates, then checks all alias
pixels. Tubes verify legacy-index lineage and every listed committed master
occurrence. All positive assembly recipes reproduce the packet pixel hashes;
Room Builder uses RGBA replacement and tubes use source-over. Door strip frame
indexes, untrimmed rectangles, GIF/source frame correspondence, durations and
repeat evidence are checked from the frozen packet, without inventing a game
playback contract. Card record coverage is exact, once per source record.

`python3 scripts/build-family-expansion.test.py` passes 10 tests. Regressions cover
counts, roles, sections, arch bounds, restricted color variants, duplicate versus
shading distinctions, U-example blend behavior and GIF demonstration semantics.
Adversarial checks reject changed review pins, packed offsets, unclosed tube
examples, GIF order/duration/game-contract changes and committed source pixels.
A read-tracking test confirms that builds access no ignored original asset or GIF.
Application validation and independent audit are recorded by the coordinator in
the delivery record. No npm, build or browser task ran in this worker.

Next: verify the integrated browser rendering and exact note context, then pursue
bounded unresolved floor/tube questions or owner discussion without broadening
these frozen examples.
