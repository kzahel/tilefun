# Component and animation model integration — 2026-10-04

Explicit versioned adapters now normalize the exact independently reviewed RB01,
E03 and A01 proposals. The model contains **191 source records / 164 proposal
units**, adding 59 records / 52 units to the earlier 132 / 112 slice. Source,
proposal, assembly, unique pixels, named aliases and approval remain separate
counts. No source member is human-approved or promoted by this integration.

## Counting and semantic scope

| Packet | New source records | Proposal units | Meaning of a unit |
| --- | ---: | ---: | --- |
| RB01 | 25 | 25 | A frozen component crop: 17 floor pieces, six fixed arch body cells and two partial-height shadow companions. |
| E03 | 25 | 25 | A frozen named component export; exact duplicate 02/06 retain separate names and source records. Presentation grouping does not change this unit count. |
| A01 | 9 | 2 | The two proposed action sequences, containing nine temporal occurrences / eight distinct pixel states. Frames are not spatial components. |

RB01 has 22 exact original-master records and three **subfile-only** records:
A05, A07 and A08. The latter retain exact subfile and packed correspondences
without gaining nonexistent master aliases. The full arch's 176 changed pixels
remain alpha 25 in the subfile versus 48 in the master; no shadow normalization
makes them equal. Packed tile references and whole-sheet offset references keep
separate atlas coordinates and exact original crop coordinates, including P03's
second source occurrence and A07/A08's repeated shadow aliases.

The 16 RB assembly dispositions retain their individual distinctions: fixed
closed motif, bounded capped strips, explicit open L/T continuation windows,
weakened larger inset hypotheses, invalid layouts and the unresolved shortened
arch. Two wall/context probes remain outside the semantic member count. RGBA
replacement renders and edge diagnostics do not establish a universal join,
repeatability, walkability, portal clearance or height rule.

E03 keeps image-axis continuation-cut ports separate from exterior mouths/ends.
The eight frozen probes use ordered source-over composition, with measured body
band origins and profiles rather than padded export widths. Five reviewer
challenges are individual supplemental relations with exact recipes, native pixel
receipts and retained qualifications; they do not expand the frozen compatible
neighbor matrix. Exact 02/06 identity, the 11-pixel 04/08 shading difference and
the 10-pixel 09/10 difference remain distinct. Rounded states, collar purpose,
world orientation, gameplay traversal and arbitrary color mixing stay unknown.

A01 source frame order, static correspondence and demonstration playback are
separate views. Both closed temporal occurrences link to the same four physical
static rectangles; seven other frame records have no exact static counterpart in
the frozen search domains. Two byte-identical committed PNG strips supply all
nine frames on machines without original packs. The 82 declared PNG sources
remain separate from two supporting GIFs outside the PNG inventory denominator.
The opening GIF's 300/100/100/100/300 ms and perturbation GIF's
500/100/100/100 ms cycles (900/800 ms) are source demonstrations only. Gameplay
frame durations, looping, triggers, reverse closing and lock mechanics remain
null; normalized gameplay geometry remains unknown.

## Reproduction and limitations

The exact proposals/reviews are pinned independently of their filenames. Each
adapter checks its declared schema and proposal revision, preserves original
mapper evidence, and records each reviewed member's qualified disposition. The
old 132-record slice's source records, proposal units, relationships, reviews and
packet metadata remain exactly unchanged; regression fingerprints protect all
five collections. All eight normalized packets retain zero human-approved and
zero runtime-promoted proposal units.

The full model validation passes with the originals present: 710 source-file
pins; 16 RB assemblies plus two context rasters; three exact RB source recipe
comparisons; the 176-pixel master/subfile alpha difference; eight frozen E03
rasters, five supplemental reviewer rasters and ten E03 pixel comparisons;
nine decoded GIF/PNG frame correspondences and seven adjacent temporal deltas.

The committed-only regression fixture contains no ignored `assets/` files. It
still renders all 59 new records, all 16 RB assemblies, all eight frozen and five
supplemental E03 probes, all ten E03 comparisons and all seven A01 temporal
deltas. It reports the two RB context rasters, three original-source recipe
comparisons, master/subfile alpha comparison and two GIF demonstrations as
unavailable. Missing originals do not excuse hash drift in present files, and
missing committed strips remain errors. Listed crop/alias replay is not a new
exhaustive absence, corpus fingerprint or arbitrary assembly scan; exact source
helper and independent source-review evidence remains pinned separately.

The portable coverage ledger credits explicit normalized records and exact
review scope, while retaining all 163 survey windows / 18 source groups as
incomplete. Its source inventory still contains 29,449 original PNG paths plus
two committed references. It distinguishes 170 expansion source-crop references
from 136 named-export references; Room Builder crops and animation strip frames
are not mislabeled as named whole exports. Source-group investigation is partial,
including Interiors animations and Room Builder; Exteriors animations remain
uninvestigated. Supporting GIFs carry no PNG inventory credit. Existing bounded
forest composition acceptance is unchanged and does not propagate to new members.

Commands for this slice:

```sh
python3 scripts/semantic-map-model.py --check
python3 scripts/semantic-map-model.py --check --committed-only
python3 scripts/semantic-map-model.test.py
python3 scripts/semantic-map-coverage.py --check
python3 scripts/semantic-map-coverage.test.py
```

Coverage regressions: **16 passed** at the frozen slice. The separate
[independent adapter audit](2026-10-04-component-animation-model-review.md) passes
the final model hash, true missing-original reconstruction and adversarial checks.
**Full model regressions: 22 passed** (516.295 seconds), including deterministic
read-only saved-output checks, source/hash/alias/operation/port/timing mutations,
prior-slice fingerprints and the true missing-original fixture. Shared
npm/build/browser validation belongs to the coordinator's isolated integration
run; this worker did not start those jobs.

## Adapter review freeze

| Artifact | SHA-256 |
| --- | --- |
| `semantic-model.json` | `530352165c513d0731e1fe02a645b2a7a29a78fbdb1830f495e02b758fa31123` |
| `scripts/semantic-map-model.py` | `91b15932b44e37ed9f87504cbf88a43038e4a302e7f42a653ef3aa21d468e374` |
| `scripts/semantic-map-model.test.py` | `a4408665f72c2ee75aa2fd222c0309e0f5c0df919b9fbc3eeca8c9669bca2e3d` |
| `coverage-ledger.json` | `cc118717bed32f1a0c5e7105ef4518d796a3df5472c4dbe4768245e9852e6616` |
| `scripts/semantic-map-coverage.py` | `b34b5c658d3f931c2fe6f70efc06475affe84a9f79e4711f5b67704c741b3334` |
| `scripts/semantic-map-coverage.test.py` | `be566047d42f0483caae4d54ac82e1c0f96a28a6597d7813c3edd50fc00ebc1f` |

Coverage ledger bytes above pin the registry at adapter-review time. A subsequent
coordinator registry status update requires explicit coverage regeneration; it
does not change model evidence or earn whole-domain completion.

Next: keep quiet source sheets and supported finite recipes aligned with these
adapters. Further corner-extension, rounded/collared tube or gameplay hypotheses
need separate bounded evidence; they do not acquire answers from normalization.
