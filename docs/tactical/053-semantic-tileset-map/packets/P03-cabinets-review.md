# P03 cabinets — independent review

Reviewer: Exteriors worker. Date: 2026-10-04.
State: independent review complete; proposal supported with qualifications.
The reviewer is independent of the author, but this is not a blinded study:
the coordinator briefing and previous S02 review supplied cabinet-family and
experiment context. No proposal labels were read during the initial visual pass.

## Initial independent visual observations

Inspected original Interiors rectangle `(80,448,176,160)` and all 27 PNGs from
normal, Black_Shadow and Shadowless Living_Room singles 37–45. Raw enlarged panels
were generated independently in `/tmp/tilefun-semantic-cabinets-review/`.

Numbers 37 and 38 are tall brown wooden storage fronts with two inset panels;
37 has brown panels and 38 has pale blue diagonal reflective panels. Numbers 39
and 40 are lower/wider-looking fronts with matching brown versus reflective panes.
The pane imagery supports reflective/mirrored or glazed panels but does not show
an open door or clear contents behind glass. Species/style/material semantics
beyond wooden-looking storage are not proved. Numbers 41–44 are narrow cropped
storage components:41 and 44 visibly preserve an outer border on opposing sides;
42 contains two reflective panel sections and 43 two brown panel sections, with
no outer cap at the cut edges. These are consistent with modular end/middle
pieces, not simply rotated whole cupboards. Number 45 is a smaller freestanding
wooden stand/cabinet with thin supports and colored contents; bedside table,
small display/book storage and other small stand identities remain plausible.

Across the three variants, body shape is closely related; normal sprites have
obvious gray backing/perimeter regions that appear removed or altered in the
other two variants. Initial thumbnails do not establish exact identity of visible
body pixels, offset normalization, shadow color/alpha or all exceptions. The master
context visibly combines storage fronts and narrow modules with nearby mirrors,
plants, worktops and purple/gold furniture; spatial proximity is not membership.
Exact master matches, packed aliases and reconstructed/assembled roles require
measurement before acceptance.

## Proposal comparison

Compared exact proposal `P03-cabinets.json`, revision 1, SHA-256
`c22f7b16e24816a231883bad04cd29e43eac2ce81f09f444d4bc5ffad7875254`.
This applies to that immutable snapshot only. The hash was checked before proposal
inspection and at the end, and remained unchanged. Source/master/packed/catalog
hashes are independently verified through reproduction plus separate byte checks.
The author’s proposal files were not edited.

**Overall disposition:** supported for all 27 exact source records and all 9 semantic
concepts, subject to the explicit unknowns below. No blocking identity, rectangle,
alias, reconstruction or counterpart error was found. The component interpretation
of 41–44 replaces the preliminary S02 side-view hypothesis and is supported by the
independent initial pixels and positive/negative assemblies.

### Semantic concept dispositions

Each row covers the explicit three-record set `P03-N-normal`, `P03-N-black-shadow`,
`P03-N-shadowless`, where N is the listed number. Identity approval and geometry are
not implied by these author-independent dispositions.

| Candidate | Disposition | Qualifications |
| --- | --- | --- |
| P03-C37 | Supported | Tall solid-front storage cabinet; wardrobe-specific use unknown; closed silhouette supports whole-object role |
| P03-C38 | Supported | Tall reflective cabinet; exact normal composite supported; mirror/glazing unresolved; no fictitious whole-master rectangle |
| P03-C39 | Supported | Shorter solid-front cabinet; no real-world height/usage inferred from frame |
| P03-C40 | Supported | Shorter reflective cabinet; mirror/glazing remains unknown |
| P03-C41 | Supported | Left end, not a standalone side view; continues to source right edge |
| P03-C42 | Supported | Reflective middle; repeat probes below support repeats; functional panel/door count unknown |
| P03-C43 | Supported | Solid middle; repeat probes below support repeats; functional panel/door count unknown |
| P03-C44 | Supported | Right end, not a standalone side view; continues to source left edge |
| P03-C45 | Supported with identity uncertainty | Separate small open-front furniture; shelf/side-table and exact contents unresolved; no wardrobe-kit inheritance |

### Explicit record dispositions

All rows have supported variant-to-concept correspondence and exact packed-frame
identity. `Derived` means correspondence through the normal counterpart; alternate
pixels do not appear as complete exact frames anywhere on the original master.
Each grid-free search checks every original pixel origin.

| Record | Original-master correspondence disposition | Packed `(x,y,w,h)` verified | Exact-identity exception retained |
| --- | --- | --- | --- |

| P03-37-normal | Supported exact whole frame (112, 480, 32, 48) | (928, 4014, 32, 48) | Normal opaque ground pixels retained |
| P03-37-black-shadow | Supported derived correspondence; whole frame absent | (512, 3582, 32, 48) | Translucent (58,58,80,100) shadow; body equals shadowless |
| P03-37-shadowless | Supported derived correspondence; whole frame absent | (1408, 4446, 32, 48) | Body reference; no shadow implied |
| P03-38-normal | Supported exact two-strip composition; whole frame absent | (960, 4014, 32, 48) | Normal ground + 32 reflection pixels 248→255 when matching bodies |
| P03-38-black-shadow | Supported derived correspondence; whole frame absent | (544, 3582, 32, 48) | Translucent (58,58,80,100) shadow; body equals shadowless |
| P03-38-shadowless | Supported derived correspondence; whole frame absent | (1440, 4446, 32, 48) | Body reference; no shadow implied |
| P03-39-normal | Supported exact whole frame (208, 480, 32, 48) | (992, 4014, 32, 48) | Normal opaque ground pixels retained |
| P03-39-black-shadow | Supported derived correspondence; whole frame absent | (576, 3582, 32, 48) | Translucent (58,58,80,100) shadow; body equals shadowless |
| P03-39-shadowless | Supported derived correspondence; whole frame absent | (1472, 4446, 32, 48) | Body reference; no shadow implied |
| P03-40-normal | Supported exact whole frame (176, 480, 32, 48) | (1024, 4014, 32, 48) | Normal ground + 16 reflection pixels 248→255 when matching bodies |
| P03-40-black-shadow | Supported derived correspondence; whole frame absent | (608, 3582, 32, 48) | Translucent (58,58,80,100) shadow; body equals shadowless |
| P03-40-shadowless | Supported derived correspondence; whole frame absent | (1504, 4446, 32, 48) | Body reference; no shadow implied |
| P03-41-normal | Supported exact whole frame (112, 528, 16, 48) | (512, 4926, 16, 48) | Normal opaque ground pixels retained |
| P03-41-black-shadow | Supported derived correspondence; whole frame absent | (592, 4734, 16, 48) | Translucent (58,58,80,100) shadow; body equals shadowless |
| P03-41-shadowless | Supported derived correspondence; whole frame absent | (384, 5118, 16, 48) | Body reference; no shadow implied |
| P03-42-normal | Supported exact whole frame (144, 528, 16, 48) | (528, 4926, 16, 48) | Normal ground + 32 reflection pixels 248→255 when matching bodies |
| P03-42-black-shadow | Supported derived correspondence; whole frame absent | (608, 4734, 16, 48) | Translucent (58,58,80,100) shadow; body equals shadowless |
| P03-42-shadowless | Supported derived correspondence; whole frame absent | (400, 5118, 16, 48) | Body reference; no shadow implied |
| P03-43-normal | Supported exact whole frame (160, 528, 16, 48) | (544, 4926, 16, 48) | Normal opaque ground pixels retained |
| P03-43-black-shadow | Supported derived correspondence; whole frame absent | (624, 4734, 16, 48) | Translucent (58,58,80,100) shadow; body equals shadowless |
| P03-43-shadowless | Supported derived correspondence; whole frame absent | (416, 5118, 16, 48) | Body reference; no shadow implied |
| P03-44-normal | Supported exact whole frame (128, 528, 16, 48) | (560, 4926, 16, 48) | Normal opaque ground pixels retained |
| P03-44-black-shadow | Supported derived correspondence; whole frame absent | (640, 4734, 16, 48) | Translucent (58,58,80,100) shadow; body equals shadowless |
| P03-44-shadowless | Supported derived correspondence; whole frame absent | (432, 5118, 16, 48) | Body reference; no shadow implied |
| P03-45-normal | Supported exact whole frame (176, 528, 16, 32) | (112, 7214, 16, 32) | Normal opaque ground pixels retained |
| P03-45-black-shadow | Supported derived correspondence; whole frame absent | (1968, 6734, 16, 32) | Translucent (58,58,80,100) shadow; body equals shadowless |
| P03-45-shadowless | Supported derived correspondence; whole frame absent | (128, 7662, 16, 32) | Body reference; no shadow implied |

## Independent checks and experiment dispositions

Author helper passed without mutation:

```sh
python3 scripts/semantic-map-cabinet-pilot.py --verify-proposal --out /tmp/tilefun-semantic-cabinets-review/reproduction
```

Beyond replaying the author’s saved measurements, I separately loaded all 27
PNG sources and checked source SHA-256, frames, normalized visible-pixel hashes,
exact packed crop bytes, catalog key→source path/rectangle lineage, positive original
crops and all 9 alpha-tight shadowless bounds. The bounds match every concept’s
`objectBodyRectLocal`. These are rendered-body bounds, not colliders.

I independently compared raw pixels of both other variants against shadowless.
Every normal difference outside body is `(167,151,150,255)` becoming transparent;
every black-shadow outside-body difference is `(58,58,80,100)` becoming transparent.
Black-shadow foreground is identical for all 9 concepts. The only normal on-body
changes occur in 38/40/42: 32/16/32 opaque reflection pixels from 248 to 255.
No unaccounted delta remains. I also implemented the pilot transformation separately
as full per-pixel arrays, then compared all 27 records against all 122 shadowless
living-room files: each uniquely matches its same-suffix counterpart. This strengthens
same-identity lineage but is explicitly conditional on the measured normalization;
it is not raw equivalence of all variants or a universal pack rule.

| Experiment | Independent disposition |
| --- | --- |
| P03-E01 packed aliases | Supported 27/27 exact complete normalized frames; rectangle bounds and catalog source lineage verified |
| P03-E02 off-grid explanation | Refuted for normal 38 by all-pixel whole-master search; 8 normal whole occurrences, 0 alternate whole occurrences reproduced |
| P03-E03 padding-only explanation | Refuted by saved and regenerated alpha-trimmed search; no whole trimmed original match |
| P03-E04 shared-top reconstruction | Supported; independent overwrite into fresh 32×48 canvas exactly matches normal 38; helper’s alpha-overlay result also exact |
| P03-E05 shadow-only change | Same-number identity supported; pure-shadow-only claim refuted for 38/40/42; explicit reflection changes retained |
| P03-E06 complete side-view claim | Refuted for 41–44; continuous capped assemblies and negative end-order control support component roles |
| P03-E07 same-kit 45 | Weakened; small complete unit has different proportions/content/rails and remains its own uncertain furniture identity |

The two-strip reconstruction separately uses master `(112,480,32,16)` at target
`(0,0,32,16)` and `(144,496,32,32)` at target `(0,16,32,32)` on a fresh RGBA
canvas. Copy is **RGBA overwrite**, including transparent pixels. The helper additionally
proves alpha-overlay succeeds for this particular compatible source layout; that
does not establish interchangeability of overlay/replacement for other composites.
All 3 upper-strip occurrences, including off-grid origins 177/485 and 209/485, and the
single lower-strip occurrence are retained. The composition does not establish that
18 alternate-shadow whole frames exist on the original source.

I separately concatenated the four author positive sequences in each shadow set
and the negative `[44,42,41]` control. Positives have 0 internal alpha-gap rows among
y=4–41; the negative has gaps on all 38 body rows for each set. Rendered evidence
shows uncapped outer edges and internally capped gaps in the reversed sequence.
The contiguous original `[42,43]` sampler is therefore not a complete-object count.

Additional independent challenge: repeated middles and alternate middle order.
Rendered `[41,42,42,44]`, `[41,43,43,44]`, and `[41,43,42,44]` in all 3 variants.
All 9 assemblies retain capped outer silhouettes, continuous rails and no internal
alpha gaps in body rows 4–41. Actual rendered panels were viewed; no seams or
unclosed ends were apparent at the joins. This supports the repeatable-middle
hypothesis beyond the author’s one-per-middle mixtures, while arbitrary lengths
and every combination remain untested. Reproduce from the exact pinned single PNGs:
concatenate their full frames left-to-right at 16px x offsets, using RGBA copy into
a transparent 64×48 canvas; inspect the render and occupied x intervals for y=4…41.
The independent test image is
[repeat/control probe](/tmp/tilefun-semantic-cabinets-review/independent-repeat-probe.png).

## Corrections and retained uncertainty

No semantic value or measured rectangle needs a blocking correction. One evidence
wording refinement is recommended: `assemblyRole.evidence` is copied across all 9
concepts, but its end-order/gap experiment specifically proves 41–44 roles. For
P03-C37–C40 and P03-C45, cite their own closed contours/source frames and body bounds
for whole-object roles rather than using the 41–44 negative control as direct proof.
The proposed roles remain supported by independent visual inspection.

Keep reflective material unresolved in P03-C38/C40/C42; diagonal pale highlights do
not discriminate mirrors versus glazing. Keep P03-C45 purpose/contents at medium
confidence. Front-facing depiction is a reasonable medium-confidence visual
reading, with compass facing unknown. Preserve each exact variant’s identity,
including reflection-color differences; the normalized counterpart relationship
must not erase those pixels from durable source identities. All footprint,
collision, height and walkability fields remain unknown.

The absence conclusions apply only to these full frames on the pinned original
master, including alpha. They do not establish missing art elsewhere, absent
semantic identities, or an exact alternate occurrence from a counterpart match.
The normalized shadowless bounds do not prove intended gameplay ownership of
translucent shadow pixels or geometry.

## Evidence and handoff

[Independent raw master crop](/tmp/tilefun-semantic-cabinets-review/raw-master-context.png),
[normal singles](/tmp/tilefun-semantic-cabinets-review/raw-normal.png),
[black-shadow singles](/tmp/tilefun-semantic-cabinets-review/raw-black.png),
[shadowless singles](/tmp/tilefun-semantic-cabinets-review/raw-shadowless.png),
[reproduced composite](/tmp/tilefun-semantic-cabinets-review/reproduction/38-reconstruction.png),
[author assemblies](/tmp/tilefun-semantic-cabinets-review/reproduction/assemblies.png), and
[shadow backgrounds](/tmp/tilefun-semantic-cabinets-review/reproduction/shadow-backgrounds.png).
These are disposable crops/render experiments; no art or screenshots committed.

Review counts: 27/27 source records and 9/9 semantic concepts dispositioned; all 7
challenge groups and the explicit component family supported/refuted as above.
Human approvals: 0. No source, packed inventories, author files, gameplay data or
review events changed. The coordinator owns integrated repository checks. Next
step: narrow the duplicated evidence wording, then present reflective-material and
small-unit uncertainty alongside the exact member sets for owner review.
