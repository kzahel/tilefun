# I01 sofa normalization and coverage

2026-10-04. Bounded integration of independently reviewed I01 into the existing
shared semantic model and source-assignment ledger. Original packets, source art,
packed atlas/index and runtime placement/geometry definitions remain untouched.

## Exact snapshot

| Artifact | Raw SHA-256 |
| --- | --- |
| scripts/semantic-map-model.py | `17ab2aa21a7400508cdadafcad68cf59246c02efe83c30e9b418324730fcf0b6` |
| scripts/semantic-map-model.test.py | `b9f01a62ff198507a87d29dea0eb8ce63ac1b5d98b0202892e0ba9dba6cdaa2f` |
| scripts/semantic-map-coverage.py | `61ffbfaaf0b496c7f0454b1712ece6eec4f8a64865c07330635c0128fc81a278` |
| scripts/semantic-map-coverage.test.py | `fdf91e1f0d1507a7f915788dc0f5635057ad9b258700006b97d06ae57b85d3ae` |
| docs/tactical/053-semantic-tileset-map/semantic-model.json | `c2a0ad9364cf99f0cc6d6e50f772335b6915c4c40187dab1a331608973b6f118` |
| docs/tactical/053-semantic-tileset-map/coverage-ledger.json | `69be5d6b8927773aec06b136cac97c4ac18c17fffdda5cf557ec618c8b5aacbf` |

Model revision: `7613a6d550e424de424ebf5cf16a32f87be781b778397efcb5536b47e3901c13`. Proposal/review pins:
`75b0910c5565e9bff3db9b819f76fe2cca0e5e268b6438a2ff7023a061a260df` /
`1b93f7b2b438eb4f74f3e01f898b746bd5f0f7a5a36eb48e4b23f7651cc256fb`.
Coverage pins the exact model bytes. A later registry-state change requires explicit
ledger regeneration and a new ledger hash; it does not change this snapshot's model.

## Contract and counting

The model now has **132 source records / 112 proposal units**. Prior pilot 85/67
and outdoor seating 27/27 counts are unchanged. I01 contributes **20 records / 18
normal-export proposal units**: cap-4 dark/shadowless records are explicit members
of the normal cap-4 proposal, not additional concepts. The four unknown lower-seat
roles remain proposals with unknown standalone eligibility. Two small closed-seat
records permit only proposed visual standalone use. Fourteen partial records
forbid standalone use; no geometry or human approval is granted.

Primary original-master lineage is 18 direct and two bounded counterpart-derived
records. The two counterparts have exact named/packed/theme identity without
invented original-master occurrences. All 28 exact named aliases and their 28 packed
aliases survive; master/theme occurrence counts remain 18/28. Additional equality
aliases of side pieces do not inflate proposal/record counts. Review scope pins all
268 declared sources, with 18 proposal dispositions and all 20 record dispositions.

`check_topology()` dispatches `closed-chain-topology-v1` alongside the existing
cabinet supplement contract. Rules specify start/end and middle roles, compatible
required ports, same palette/facing/render variant, cross dimension and per-role
advance. Front chains use 16px horizontal pieces at constant 32px height. Side chains
use a 32px top followed by zero or more 16px middles and a 16px bottom. Missing caps,
wrong order/internal ends, unknown roles, mismatched facing/palette/render sets and
wrong dimensions fail. Explicit compatible member IDs prevent selected render-only
caps from claiming neighbors absent from this packet. Unknown eligibility never
becomes permission. Arbitrarily long metadata-valid sequences retain
`visualStatus: not-evaluated` and unregistered human approval.

All 15 assembly probes are separate relationships: nine closed positive proposals,
four invalid chains and two unresolved-role probes. Validation replays source layers,
checks exact output hashes and join-alpha arrays, and compares the seven listed
assembly master occurrences when originals are available. The exact top/end/middle
source sampler remains invalid as a complete object. Original mapper render wording
is preserved beside the separately pinned independent per-probe disposition.
The three shadow-signature/delta checks use only observed shadow-token removal;
they do not import cabinet reflection handling or infer a pack-wide conversion.

Coverage accounts for 47 expanded records / 45 expanded proposal units, with explicit
I01 20/18 alongside E01 27/27. Counterpart region links are context only and never
enter the 18 exact Interiors master references. Survey windows remain 163, source
groups 18, and semantic completion unknown. Registration receives bounded explicit
adapter credit; region/family/PNG completion, accepted member semantics and gameplay
promotion remain unclaimed.

## Validation and limitations

```sh
python3 scripts/semantic-map-model.py --summary
python3 scripts/semantic-map-model.test.py
python3 scripts/semantic-map-coverage.py --check
python3 scripts/semantic-map-coverage.test.py
```

Full-source generation/validation passes; all **17 model regression checks** and
**14 coverage regression checks** pass. The model suite includes deterministic
read-only full checks, a fresh committed-only clone fixture, unchanged pilot/cabinet
behavior, unknown standalone refusal, missing joins, order/internal-end rejection,
mixed sets, unequal side dimensions, untested valid layouts, assembly hash/topology
and observed-token tampering, source drift and exact canonical review applicability.
It took approximately six minutes with full normalized source validation.

Committed-only mode generates the identical model and verifies all 20 I01 record
pixels plus 15 assembly output hashes from committed packed frames. It reports zero
I01 assembly master comparisons and an unchecked 240-file Basement counterpart
pool when originals are missing; it does not call these unavailable checks verified.
Present original hash drift still fails. Listed occurrence crops are checked, but
this adapter does not repeat every-origin absence/alias-corpus enumeration. The
coverage ledger uses pinned committed evidence without reading ignored original PNG
bytes. No shared npm/build/browser commands were run by this worker.

The separate [sofa sheet review](2026-10-04-sofa-sheet-review.md) checks root-owned
presentation integration. Independent review of this new model snapshot remains a
separate coordinator assignment; this note is the author's execution record.

Next: independently audit this frozen normalization, retain isolated application
validation, then investigate a bounded animation or Room Builder family.
