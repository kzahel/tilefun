# Bounded mapping consistency and gap audit — 2026-10-04

This audit covers source-inventory accounting, registered evidence, and the
normalized P01/P02/P03 plus E01 model. It does not claim that all original art is
correctly segmented, interpreted, usable, independently reviewed or approved.
No exhaustive semantic/object denominator exists.

Pinned normalized model SHA-256:
`2f612b7fd2e2b9d07bd9c00bbf02cd4955210959b4a8a411857b0c6da93bbc26`.
Source inventory SHA-256:
`c98c9174f84c7cc8f38011a7b02f87b00f6891a416d0627b31ba7f2a223d2bda`.
Included original-source revision:
`5d85c3fa77f0273a21e1625ae3a4497087ad5d2133624c3a338b61042bf04ea2`.
[Coverage ledger](../coverage-ledger.json) and its generator own detailed ranges,
source/review pins, assignments and separate evidence stages. The
[V01 independent review](2026-10-04-semantic-model-review.md) owns validator findings
and the baseline pilot model freeze; its later E01 addendum pins and checks the
current expanded freeze above. [I01 review](../packets/I01-interior-sofas-review.md)
owns that later packet's independent dispositions.

## Accounting and duplicate checks

Every saved inventory path is unique and belongs to one of the 18 declared groups.
The ledger reproduces all 29,449 original paths plus two baseline committed
references through pinned inventory selectors. Three masters have 163 retained
navigation/search/residual/annotation windows; all windows preserve original
source coordinates and their independent survey-resolution evidence. Generator
checks all group counts/fingerprints and anchor/source bounds. No inventory domain
is silently dropped because it is not in a packed atlas or current pilot.

Across original inventory paths, direct grouping by raw PNG SHA-256 yields:

| Byte-level accounting | Count |
| --- | ---: |
| Original PNG paths | 29,449 |
| Distinct raw PNG hashes | 21,488 |
| Hash groups containing multiple original paths | 7,286 |
| Paths within those repeated-byte groups | 15,247 |
| Repeated path occurrences beyond one per raw hash | 7,961 |

These are exact byte identities, not semantic objects, family members or source
occupancy. Different PNG hashes may still encode the same pixels; different
rectangles may contain related components. The known 6,224 same-name Exteriors
theme/complete single pairs are a subset of this byte-duplicate accounting.
They keep separate provenance and earn no inherited semantic/approval credit.

The normalized selected model has **112 distinct (frame dimensions, normalized
RGBA hash) pairs** across 112 source records; no selected full-frame collision was
found. This proves only exact selected-frame distinctness under the declared
hidden-RGB normalization. It does not establish 112 unique objects: variants,
components, patches and baked compositions remain distinct source records.

## Mapped evidence consistency

Pilot counts stay **85 records / 67 proposal units**, primary master lineage
58 direct / nine composed / 18 counterpart-derived. E01 separately adds **27
records / 27 proposal units**, primary master lineage 25 direct / two original-only.
Aggregate normalization is **112 records / 94 proposal units**. All 27 E01 member
IDs and raw candidate evidence match the exact registered/frozen packet, and the
ledger accepts only the explicitly pinned E01 model adapter.

E01 has 54 named export references, 25 committed/original master occurrences and
25 exact theme occurrences across three theme PNGs. Theme occurrences are
supplemental correspondence, not additional primary master lineage records.
The original and byte-identical committed master references describe the same
25 crops, counted once; both source-group contexts remain visible. Two committed
integration copies of Bench 5/6 preserve exact pinned original-export bytes.
They remain original-only with no master occurrence, recipe or exact-region link.
A displayed exact copy is not a reconstruction or a new original source domain.

All pilot/expanded source rectangles remain bounds-checked against the source
inventory; packed aliases use their own coordinate space. Record links use exact
source lineage/intersection, not thematic filename matching. E01's exact region
links account for all 25 direct records: two in E01, two in E05, 20 in E03 and one
in E35. Search windows may overlap or clip a frame; neither effect duplicates the
record denominator or implies an entire region is mapped.

Four frozen Exteriors hypotheses are superseded in the ledger: E10's chairs are
playground tubes/tunnels, E15's delivery vans are ambulances, E18's ambulance claim
is medical beds/stretchers, and E45 no longer asserts abandonment. Cabinet 41–44
remain assembly-only partials. Reflective-panel interpretation, arbitrary assembly
rendering and all gameplay geometry remain unresolved. Historical raw evidence is
retained alongside corrected current interpretation rather than overwritten.

## Remaining gaps and review boundaries

Every master window retains further unsegmented/unknown semantic work. Forty
Exteriors residual windows remain explicitly unresolved. Room Builder annotation
rectangles can overlap art; only residual-alpha caption/arrow pixels were excluded
from art accounting. Neither whole-source viewing nor zero residual alpha is an
individual-object completion metric.

Eight supplemental groups have no normalized investigation: Exteriors animations
and autotiles; Interiors animations, home examples, Room Builder subfiles, and
normal/black-shadow/shadowless theme sheets. Six supplemental groups have partial
normalized record evidence; none is semantically complete. Exact copies, indexed
references and matching search-domain membership do not confer that completion.

I01's 20 records and 15 source-only probes have independent review, including four
unknown long-seat roles and 14 forbidden standalone components. Its source sampler
27→29→28 is exact original art yet invalid as a complete sofa chain. I01 is
registered review-ready and earns **zero normalization credit** in this checkpoint;
its next adapter must preserve those distinctions. The total remains 112, not 132.
The ready sofa descriptor now points to that existing registration. Room Builder,
playground tubes and bounded animation tasks remain unassigned.

Owner discussion stays distinct from acceptance. Only the three previously depicted
varied-offset forest interior-fill examples have bounded acceptance in this ledger.
Positive pilot sheet comments do not approve every record; E01 and I01 have no
inherited owner acceptance, gameplay geometry or runtime promotion.

## Verification

```sh
python3 scripts/semantic-map-coverage.py --check
python3 scripts/semantic-map-coverage.test.py
python3 scripts/semantic-map-model.py --check --summary
```

Coverage regeneration/check and 12 adversarial regression checks pass. The final
normalized-model check passes; the author reports 14 full regression checks plus
its final E01 source-scope/lineage check passed at the pinned freeze. Independent
pilot pixel/topology evidence and I01 source/assembly evidence are recorded in
their reviews. The ledger itself verifies committed evidence and portable pins;
it does not rehash all ignored original pixels or rerun complete semantic searches.

No unresolved contradiction was found within these bounded accounting/source/
review contracts after the documented corrections. This statement applies to the
mapped evidence and declared domains, not all uninvestigated art. Next: versioned
I01 normalization and conservative presentation in a separate checkpoint; preserve
unknown roles and tested-layout limits instead of adding more themes here.
