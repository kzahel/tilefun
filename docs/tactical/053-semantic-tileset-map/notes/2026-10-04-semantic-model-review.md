# V01 semantic model — independent review, 2026-10-04

Reviewer: coverage-ledger worker, separate from V01 model author. Scope: frozen
P01/P02/P03 normalized model, source identity/lineage, review applicability,
composition replay, cabinet topology and explicit unavailable-original limits.
This is agent review, not human acceptance, runtime promotion or exhaustive art
segmentation. The initial assignment brief was known; this was not blinded review.

## Reviewed snapshot

The reviewed final pilot-only snapshot has these raw file SHA-256 pins:

| Artifact | SHA-256 |
| --- | --- |
| `scripts/semantic-map-model.py` | `e1236b83013d030754f5177abc85070bd792dd7e94ebed673500f1aa94783902` |
| `scripts/semantic-map-model.test.py` | `182f680b706982f5c90e516c547320e1403e739174a210613e2e398e3e5e6b47` |
| `semantic-model.json` | `8a4bb35159739cf521b61b138bdc35b64b2edf68096bac1b28b987bb0a2940fd` |

Model revision: `61534395ce59adefe1bb60747716d4a6f30ea48e807d40636fed0ff417900575`.
The model's pinned packet/review/source inventory and reconciliation inputs remain
unchanged. Review applies to these exact adapter/model bytes. Later E01 adapter
expansion requires a new scoped check; this review does not preapprove future
packets or changed normalization.

## Disposition and independent evidence

Supported for the explicit pilot-only contract, after the corrections below.
The normalized model preserves **85 source records / 67 proposal units**, with
58 direct, nine composed and 18 counterpart-derived primary master lineages.
An independently implemented coverage ledger agrees on all 85 classifications
and every direct occurrence count. These counts are neither unique assets nor
pack-wide semantic completion.

A separate raw-Pillow check read the ledger's original source references, without
importing the V01 adapter or its validation/render functions. It verified:

- 114 raw record-source references against the original PNG SHA-256 pins;
- all 58 listed direct original-master crops against their named source pixels;
- all nine composition targets: eight tree base replacements and cabinet normal 38;
- all 85 normalized pixel hashes against the model.

This independent check normalized only hidden RGB where alpha is zero and retained
translucent RGBA. Tree replacements copied pinned original base pixels, then
pasted the full pinned bottom-strip patch at the frozen local offset. Cabinet 38
used source `[112,480,32,16]` at `[0,0]` and `[144,496,32,32]` at `[0,16]`, compared
against its pinned normal single. It performed no new exhaustive search or absence
scan. Recorded off-grid piles, all found occurrences, composition constituent
support occurrences and negative-search limitations stay visible in the model.

The 18 shadow counterparts remain derived identities; they gain no invented
original-master whole-frame occurrences. Packed Interiors aliases retain their
separate coordinate space and exact source/catalog linkage. Normal 38/40/42's
opaque reflection changes remain raw evidence alongside the explicitly conditional
pilot normalization. Rounded-canopy trees retain unknown species/season/facing;
no global recolor or universal shadow-conversion rule is introduced.

An independent metadata truth table enumerated **16,383 sequences**, lengths 0–6
across all three shadow variants. It accepted exactly one left cap first, zero or
more middles and one right cap last, and rejected all other shapes plus a mixed
variant pair. Every result retained `visualStatus:not-evaluated` and
`humanApproval:unregistered`. This is validation of the declared topology; it does
not render or approve arbitrary repetitions. The API validates ordered concrete
member IDs using canonical untrimmed frame offsets; it does not evaluate an
arbitrary external positioned-layout object or gameplay collisions.

## Findings resolved before freeze

The initial CLI `--check` compared saved output with the canonical adapter and
was protected. The public `validate_model()` entry point, however, accepted
recomputed-revision mutations to otherwise source-valid models. Five independent
attacks demonstrated this: wrong cabinet offset `[15,1]`, removed independent
reviews, cleared review source scope, changed semantic identity under an unchanged
frozen proposal review, and an extra single-file “occurrence” on a derived cabinet.

The author added canonical-adapter equality at the end of the public validator,
after granular evidence checks, plus regressions. All five independent attacks now
fail with `Canonical packet adapter contract drift`. This makes direct API callers
follow the same immutable semantics/review/topology contract as CLI checks.

The initial `reviews[].sourcePins` contained only record references, omitting
supporting occurrence/composition masters. The author replaced that subset with
explicit full pin objects covering record references, occurrence/alias sources,
composition layers and the conditional counterpart corpus, and added `sourceScope`.
Global raw source validation was already present; the correction makes the review's
recorded source applicability faithful as well.

The initial test run also exposed the author's already identified committed-only
palette fallback issue. The corrected fallback requires identical alias pins and
dimensions; unavailable named originals still remain unavailable. Portable mode
reports eight tree recipes as replay-only, cabinet 38 unavailable, and its
122-file counterpart corpus unchecked. It never promotes those missing independent
target comparisons into full verification.

## Checks and limits

```sh
python3 scripts/semantic-map-model.py --check --summary
python3 scripts/semantic-map-model.test.py
```

The final full-source CLI check and 13 regression checks pass, including portable
mode, unchanged saved-output bytes, source corruption, coordinate/bounds errors,
unknown geometry, exact review/membership changes, compositions, raw variant
deltas, canonical mutation rejection and topology policies. The independent raw
pixel and 16,383-case topology checks described above also passed. File pins were
rechecked after completion.

No human semantic approvals or runtime promotions are inferred. Source crops and
recorded search evidence are checked; the validator does not redo all-origin
absence searches or prove whole-pack completeness. Existing full-frame body bounds
are art metadata, not gameplay geometry. End caps, seams of unrendered layouts,
unknown object roles and new packet semantics need their own evidence/review.

Next: adapt the separately frozen and independently reviewed E01 packet, preserving
pilot counts separately from expansion counts. Reconcile exact review/source scope
and coverage registration again before crediting its records.
