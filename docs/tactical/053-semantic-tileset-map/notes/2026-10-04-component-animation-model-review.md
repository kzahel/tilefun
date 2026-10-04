# Independent component/animation model audit — 2026-10-04

This independent review covers the explicit RB01, E03 and A01 model adapters and
coverage integration, separately from the mapper's implementation and its
regression suite. It verifies source/evidence preservation and bounded adapter
behavior, without granting human semantic approval or runtime placement rights.

## Frozen inputs

| Artifact | SHA-256 |
| --- | --- |
| `scripts/semantic-map-model.py` | `91b15932b44e37ed9f87504cbf88a43038e4a302e7f42a653ef3aa21d468e374` |
| `scripts/semantic-map-model.test.py` | `a4408665f72c2ee75aa2fd222c0309e0f5c0df919b9fbc3eeca8c9669bca2e3d` |
| `scripts/semantic-map-coverage.py` | `b515a1c5a80add350d745390889b555b0b436af323060b76fb22f863ba03f9ed` |
| `scripts/semantic-map-coverage.test.py` | `b558cbab29ca561acffe4890bc1b9f87cf71b74917360fe462f0de3b4e5f795b` |
| `semantic-model.json` | `530352165c513d0731e1fe02a645b2a7a29a78fbdb1830f495e02b758fa31123` |
| `coverage-ledger.json` | `37cd11cb32a720587c08e5726ec926ee22bd03f480a0ece581ade79b75104427` |

The JSON paths are relative to this plan folder. Proposal/review raw hashes are
pinned in the adapter and checked against the frozen research files. The
coordinator will subsequently update the three registry states to reconciled and
regenerate coverage. That routing update does not change the audited model hash;
its later ledger hash and final application checks belong in the delivery record.

## Independent evidence

The final saved model rebuilt identically in a temporary fixture containing only
required committed files and input pins, with no ignored original pack or GIF
sources. Validation succeeded at 191 source records / 164 proposal units, with
zero human-approved proposal units. All 59 newly adapted source records had
available, verified pixels. The original 132 records, 112 proposals, 107
relationships, five reviews, five packet entries and every old source-file entry
remain exactly equal to the preceding committed model.

In that true missing-original fixture, validation replayed all 16 RB01 assembly
rasters, all eight frozen E03 assembly rasters, ten E03 pixel comparisons, seven
A01 adjacent-frame deltas and all five reviewer-only supplemental tube probes.
The supplemental probes remain a separate relation kind/counter and explicitly
grant no expansion of the frozen eight-probe tested-neighbor matrix. An additional
independent render parsed the five ordered placement rows directly from the
review Markdown and composed committed master crops on 64×80 canvases; every
native RGBA hash matched the review, without using the model renderer.

The coverage check reproduced the frozen ledger. Independent comparisons verified
that all 59 new ledger entries retain the exact source candidate evidence, pixel
pins and independent dispositions, with no owner-feedback or acceptance credit.
Room Builder's master receives 22 exact records and its subfiles 25. The three
subfile-only records A05/A07/A08 retain no exact master rectangles or region
links. A01 retains nine temporal source records / eight distinct pixel states /
two action-sequence proposal units. The PNG inventory denominator stays 29,449;
the two supporting GIFs remain outside inventory credit. Existing forest
acceptance scope is unchanged. Neither surveyed windows nor referenced PNGs gain
whole-domain semantic completion.

A full-mode check also passed during review, independently confirming the
available-original route before the final five supplemental relation refinement.
The mapper's final full-mode validation additionally replays those five relations
and retains the 176-pixel master/subfile alpha difference, nine decoded GIF frames
and source demonstration timing. The coordinator records the final full
regression-suite outcome separately; this review did not duplicate that suite.

## Adversarial checks and correction

Models with recomputed revisions were tested in the missing-original fixture.
Changing RB01-A07's typed original-alias crop is rejected by the packed-source
lineage check; changing E03-15's standalone eligibility or A01 game-loop contract
is rejected by canonical equality to the frozen adapter output; replacing the
U-shaped tube's source-over operation is rejected by operation validation.

The audit exposed a temporary guard that equated every packed alias's original
crop with the record's primary crop. That rejected legitimate secondary
occurrences: RB01-P03's identical alternate crop and repeated A07/A08 shadow
strips. The final implementation resolves each alias's original source path and
crop against the recorded occurrences, verifies tile or sheet-offset lineage,
and checks the original alias pixels when available. The final committed-only
validation accepts these exact alternate occurrences while the mutation check
rejects a shifted crop. The guard no longer conflates primary selection with
exact occurrence lineage.

## Limits and disposition

Committed-only validation explicitly reports the two original-only wall context
renders, three original source comparisons, master/subfile alpha comparison and
two GIF demonstrations as unavailable. It does not claim to have decoded missing
GIFs or newly verified missing originals. The eight preexisting unavailable tree
records retain their prior limitation; no new expansion record is unavailable.

This is a finite adapter/pixel/contract audit. It does not independently repeat
whole-domain absence searches, establish arbitrary floor/tube connectivity,
resolve rounded mouths or rim function, infer walkability/collision/arch height,
or turn source GIF demonstrations into a game state machine. Supplemental visual
coherence does not establish universal join compatibility. Metadata remains
Proposed and game playback/geometry remain unknown.

No outstanding implementation finding remains within this bounded review. Next:
finish coordinator integration and application checks, then seek bounded owner
feedback or additional research without widening these frozen evidence scopes.
