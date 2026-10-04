# Pilot reconciliation — 2026-10-04

Coordinator record. The source inventory, whole-sheet surveys and three contrasting
pilots are checkpointed. This is the first investigation cycle, not completion of
either tileset. Source art, runtime definitions and human approvals are unchanged.

## Accounting and review identity

The pilots contain 85 source records and 67 proposal units, including variants,
patches and modular components. Their primary master lineage is 58 direct exact
crops, nine exact compositions and 18 counterpart-derived records. Neither count
is a unique-object total or a pack-wide accuracy/coverage metric.

Keep the proposals frozen and their reviews separate. Review applicability is tied
to these exact JSON SHA-256 values, not merely a filename or current queue state:

| Proposal | SHA-256 |
| --- | --- |
| P01 trees | `3df0e42f9012644afe5cd1233f604b5dd74ec05c4c4f26253834dc2a05281ff6` |
| P02 scrapyard | `429d796ec87adb007a4febc267fabff14c1032cd197dc47ed50d729f65073957` |
| P03 cabinets | `c22f7b16e24816a231883bad04cd29e43eac2ce81f09f444d4bc5ffad7875254` |
| S02 Exteriors | `dea87c451f573270590135211f43a2d0a9cf27cf5f56b8c90227c44dec07b771` |
| S02 Interiors | `f4f6d6d5f35677a96102e62b1a5a83fc8975d1c2938c1fc1551274fb9fc942a1` |

## Integrated qualifications

- **Trees:** [independent review](../packets/P01-trees-review.md) dispositions all
  29 candidates and reproduces all eight replacement recipes. RGBA overwrite is
  an explicit sufficient operation; alpha-over also matches these eight samples,
  so the experiment does not establish overwrite as uniquely necessary. Prefer
  “rounded-canopy tree”; species and season remain unknown. Forest ground colors
  are row-specific, not arbitrary terrain compatibility. Repetition and corners
  remain untested. The coordinator fixed the helper's contact-sheet distortion
  to uniform 3× scaling and reran verification; proposal data/pixels are unchanged.
- **Scrapyard:** [independent review](../packets/P02-scrapyard-review.md) checks
  all 29 master frames and 58 named-file hashes, including independent all-origin
  scans for the two off-grid piles. The failed warning-triangle subset test has
  tied best offsets `[38,0]` and `[39,0]`, both matching only 40/174 visible pixels;
  the saved best offset is one maximizer, not a unique match. Identity/occlusion
  remains unresolved. Add a ladder-like frame to P02-09's pallet/grating
  alternatives, without choosing a final function. Continuous occupied edges
  do not prove seamless texture.
- **Cabinets:** source-frame identity is distinct from normalized counterpart
  identity. Preserve the reflection-color exceptions in normal 38/40/42. The
  41–44 assembly experiment is evidence for component roles only; whole-object
  roles for 37–40 and 45 rest on their own contours, frames and body bounds.
  Future normalized evidence must apply that distinction rather than propagating
  the duplicated `assemblyRole.evidence` text to all concepts. Reflective material
  and the small unit's purpose remain unresolved; gameplay geometry is unknown.
  [Independent review](../packets/P03-cabinets-review.md) dispositions all 27
  records/nine concepts and additionally supports three specific repeat/reorder
  assemblies in each render variant; this is not proof of arbitrary combinations.
- **Surveys:** whole-source viewing and alpha accounting establish navigational
  coverage, not exhaustive object segmentation. Caption search windows may overlap
  art; only their residual annotation pixels are excluded from art accounting.
  Supplemental singles, theme variants and animations need their own accounting.

### Corrections to the frozen Exteriors survey

These coordinator-adopted corrections supersede the named fields in revision 1.
The snapshot remains unchanged so its review hash is reproducible. Any adapter,
new packet assignment or human-facing map must apply these corrections; copying
the original labels alone would knowingly reintroduce refuted hypotheses.

| Region | Fields | Current interpretation |
| --- | --- | --- |
| E10 | `evidence`, `families` | Replace “many colored chairs” / “chairs” with modular playground tubes/tunnels. Park/playground theme remains supported. |
| E15 | `name`, `evidence`, `families` | Ambulances and streets/roundabouts; white/red ambulances with cross and 112 markings, not delivery vans. |
| E18 | `name`, `evidence`, `families` | Hospital, helipad and medical beds/stretchers; replace the ambulances claim with blue medical beds/stretchers and patient figures. Preserve the separate hospital/helipad/helicopter evidence. |
| E45 | `name` | Mansion and gothic-style architecture tail; condition/abandonment unknown. |

These are semantic corrections, not new rectangle boundaries or changed pixels.
Their independent review and exact source crops are recorded in
[S02 Exteriors review](../packets/S02-exteriors-review.md).
The coordinator also inspected the enlarged tube, ambulance and bed crops and
agrees with these identity corrections. All 95 Exteriors and 68 Interiors survey
windows have review dispositions at broad-map resolution, not object resolution.

## Validation and next slice

Coordinator reruns passed full and committed-only inventory checks, both survey
helpers and all three pilot verification helpers. The exact matcher passed seven
synthetic cases plus a separate exhaustive comparison on 80 seeded small images
at three search strides. Repository typechecks and all 1,475 tests passed; lint
passed with the existing 114 warnings and 32 informational diagnostics. No runtime
rendering/integration inputs changed, so build/Playwright were not needed here.

The [method assessment](2026-10-04-pilot-method-review.md) records the requirements
learned from the pilots. Its review-status paragraph is a historical snapshot
before all reviewer handoffs; the queue owns current state.

Next implement a read-only adapter/validator over these saved trials: explicit
source/occurrence/composition/variant relationships, per-field evidence and unknowns,
and review applicability by proposal hash. Account for all 85 records/67 units,
all nine compositions and the 18 derived records without rewriting source art or
the original proposals. Then expand bounded theme packets and build the exact
human review surface. No pilot approvals are registered or inherited. Throughput
and completion dates remain unestimated; selected, unclocked trials do not support
an honest extrapolation.
