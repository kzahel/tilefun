# V01 — Shared semantic model and read-only pilot validation

2026-10-04. Bounded implementation over the three frozen pilots; no source art,
proposal JSON, runtime bank or owner review event changed. The
[model](../semantic-model.json) is deterministic adapter output, not a promoted
catalog. The [adapter](../../../../scripts/semantic-map-model.py) and
[regression tests](../../../../scripts/semantic-map-model.test.py) require Python
3 and Pillow.

## Model ownership and counts

Four views separate the pilot's **85 source records** from its **67 proposal
units**, relationships and independent reviews. Source-file identities pin raw
PNG SHA-256 and dimensions; record identities pin normalized RGBA and full frame
size. Every recorded named alias, master occurrence, packed alias and relevant
counterpart corpus file survives. P01 record IDs are namespaced `P01:T01` etc.;
P02 and P03 retain their already namespaced identities. Proposal membership
covers each record once, including the three P03 shadow records per concept.

| Packet | Source records | Proposal units | Direct | Composed | Derived |
| --- | ---: | ---: | ---: | ---: | ---: |
| P01 | 29 | 29 | 21 | 8 | 0 |
| P02 | 29 | 29 | 29 | 0 | 0 |
| P03 | 27 | 9 | 8 | 1 | 18 |
| Total | 85 | 67 | 58 | 9 | 18 |

These are proposal/lineage counts, not unique-object counts, whole-pack coverage,
semantic accuracy or human approval. All 67 pilot proposal units remain Proposed;
registered human approvals and runtime promotions are zero. Later bounded owner
acceptance of particular forest recipes is owned by the
[family-sheet record](2026-10-04-family-contact-sheets.md#owner-acceptance-varied-offset-forest-compositions);
it does not retroactively approve this frozen pilot schema or its gameplay data.

Fields expose identity, family, component role, facing and variant with original
confidence/evidence and explicit alternatives/dispositions. All gameplay anchors,
footprints, collision, walkability and heights remain unknown. Frozen source
wording survives in `originalEvidence`; adapter fields adopt rounded-canopy tree
wording, the ladder-like alternative for P02-09, and the qualification that whole
cabinet roles rest on their own contours, rather than the modular negative probe.
Raw review text preserves initial observations, briefing limits, explicit member
dispositions and qualifications. Review applicability requires the exact frozen
proposal hash and member list; changed identities cannot inherit review.

## Verification behavior

```sh
python3 scripts/semantic-map-model.py --check
python3 scripts/semantic-map-model.py --check --summary
python3 scripts/semantic-map-model.py --check --committed-only
python3 scripts/semantic-map-model.test.py
```

`--check` never writes. It verifies frozen packet/review/reconciliation/inventory
pins, reconstructs the expected adapter output, compares the saved model, checks
all available raw file hashes/dimensions, validates typed half-open bounds and
coordinate spaces, and checks recorded crop pixels and packed catalog lineage.
The exported validator also compares the complete model to the canonical adapter; recomputing a model revision cannot bypass source, semantic, topology or review-scope invariants. The stable JSON report contains no timestamps, elapsed timings or machine paths.
Ordinary invocation regenerates only the model, after validation succeeds.

All nine composed-lineage recipes specify ordered RGBA overwrite inputs, source
rectangles, target offsets, canvas dimensions, expected record identity and
normalized output hash. Full validation independently compares reconstruction
to pinned target PNG pixels. The cabinet shared upper strip retains and verifies
all three occurrences, including off-grid origins; its lower strip also retains
its recorded occurrence. The eight tree replacements are explicit overwrite
recipes; the recorded successful alpha-over controls are preserved, without a
claim that overwrite is uniquely necessary for those eight examples.

Full validation also checks the P01 alpha-mask/color-mapping exceptions, all 27
P03 raw deltas and pilot-normalized body hashes, and uniqueness against all 122
pinned shadowless living-room sources. Normal 38/40/42 preserve their 32/16/32
on-body reflection differences. The normalization remains a measured pilot
hypothesis, not a pack-wide conversion rule. P02's duplicated exports remain 58
source-file references for 29 records; origins Y3165/Y3164 remain arbitrary-pixel
coordinates. The warning-triangle relation retains both tied 40/174 offsets and
unknown identity/occlusion. Forest and refuse assembly/negative-probe evidence
and unresolved repetition/ground/seam limits remain recorded.

The validator checks every **listed** exact occurrence; it does not claim to
rerun exhaustive absence searches. Those search algorithms, domains, original
results and limitations remain source evidence. The original pilot verification
helpers and independent review records provide reproducible exhaustive checks.
This distinction prevents a successful bounds/crop check from becoming a new
claim that every possible occurrence was independently found.

## Cabinet topology

The reusable `check_topology(topology, member_ids)` function accepts concrete
variant record IDs and evaluates declared start/end/middle roles, reciprocal
edge compatibility, required joins, forbidden internal closed ends, minimum
middle count and the conservative same-variant rule. It permits left + zero or
more middles + right, including repeated/reordered middle kinds. Standalone
partials, missing caps, reversed ends, internal caps, unknown IDs and mixed
variants are rejected. Mixed variants are outside the evidence scope, rather
than a proven visual failure. All 12 explicit member records are checked against
proposal membership and frame/variant metadata. Owner clarification forbids
standalone pieces 41–44 in every variant; it does not approve every assembly.

Topology validity, tested rendering and human approval remain separate. The
report checks 21 recorded positive topology sequences across variants and all
recorded invalid examples. It does not render or approve every topology-valid
length or combination; components stay assembly-editor-only metadata and
runtime placement enforcement remains pending.

## Original-pack limitations and extension contract

Full mode fails when any pinned source reference is absent or changed.
`--committed-only` permits absent ignored `assets/` originals, with their paths
and unchecked obligations listed explicitly; committed input absence and any
**present** file hash drift still fail. Adapter output is identical in both
modes. In a fresh-copy regression fixture without original packs, the eight tree
recipes replay against the committed master but cannot independently compare
named target PNGs; the Interiors master recipe is unavailable, and 122-file
counterpart uniqueness is not rechecked. None is reported as a completed check.

Future packets need a versioned adapter with explicit pin/revision/member and
accounting contracts. Unsupported packets fail visibly rather than entering
counts through guessed field names. Extend `build_model`, `PILOT_ACCOUNTING`
(or a subsequent versioned registry), and the packet-specific evidence checks
with named sources, typed bounds, searches/limits, recipes/variants and per-field
unknowns. Add independent tamper fixtures before admitting a new packet. Keep
record, proposal, occurrence, tested-assembly and human-approval accounting
separate; agent agreement and proposed labels must never become approval totals.
No mutable family-sheet presentation artifact is an input pin.

The pilots were not clocked; no throughput/accuracy/completion-time estimate
follows. Future packets should record examined units, changed/unresolved fields,
elapsed effort and owner effort as the method-review acceptance criteria require.

## Bounded validation checkpoint

Local originals were available. Full model generation and `--check` verified all
85 records / 67 units, nine exact composition target comparisons, 27 raw variant
deltas and the 122-file counterpart corpus. The 13-test regression suite covers
repeatable read-only JSON output, committed-only limits, source and reference
drift, coordinate-space/bounds violations, composition-offset tampering, raw
variant-delta tampering, review applicability, aliases/exceptions and topology
positive/negative cases. The coordinator owns integrated repository typechecks,
unit tests, lint and the separate family-sheet rendering checks.

Next: independently review this adapter and admit the next bounded theme packet
through an explicit source/review contract; keep exact owner metadata approval as
a separate later decision.
