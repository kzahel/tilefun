# Semantic mapping investigation notes

Store dated notes here as `YYYY-MM-DD-short-subject.md`. Each note should state
the question, source/packet references, observed evidence, conclusion or remaining
uncertainty, and next action. Keep historical experiment outcomes; update the topic
and queue for current decisions rather than asking readers to infer them from logs.

Keep durable, appropriately sized evidence with its packet when needed. Large
generated crops and contact sheets can use ignored local output, with reproducible
capture commands and source hashes recorded here. Temporary file links alone are
not durable evidence. Do not commit original downloaded packs or private review logs.

## Planning checkpoint — 2026-10-04

Current implementation records: [shared model](2026-10-04-semantic-model.md),
[independent model audit](2026-10-04-semantic-model-review.md),
[full-source coverage ledger](2026-10-04-coverage-ledger.md), and
[tree-sheet integration](2026-10-04-tree-sheet-integration.md), and
[outdoor seating delivery](2026-10-04-outdoor-seating-delivery.md), and
[bounded expansion audit](2026-10-04-expansion-audit.md),
[sofa normalization](2026-10-04-sofa-model.md),
[independent sofa model audit](2026-10-04-sofa-model-review.md), and
[sofa delivery](2026-10-04-sofa-delivery.md) with its
[independent presentation review](2026-10-04-sofa-sheet-review.md), and
[component/animation expansion](2026-10-04-component-animation-expansion.md).

Later execution records: [source inventory](2026-10-04-source-inventory.md),
[pilot method assessment](2026-10-04-pilot-method-review.md), and
[coordinator reconciliation](2026-10-04-pilot-reconciliation.md).
The planning/model/concurrency notes below preserve their original checkpoints.

The owner agreed to one coordinator, limited worker concurrency, whole-sheet
thematic categorization before detailed identification, and contrasting theme
trials. Seasonal trees and a dumpyard area are owner-suggested reconnaissance
targets; their exact regions and interpretation have not yet been visually audited.

Read-only planning established these baseline limitations:

- The committed Outdoor catalog records 4,624 rectangles, 56,647 occupied cells
  and 16,970 gap cells. Rectangle coverage does not prove semantic identification;
  the gap runs are not object boundaries.
- `scripts/index-atlas.py` returns the first exact occurrence of a single.
  Unindexed appearances can include duplicates, not just unidentified objects.
- The Interiors index has 19,493 packed entries: 15,964 singles, 3,476 Room Builder
  tiles, nine Room Builder sheets and 44 home-design layers. These are not a
  coverage audit of the original Interiors master.
- Local originals include `Interiors_16x16.png`, `Room_Builder_16x16.png` and the
  Exteriors master. Hashes and complete scope still need to be recorded in S01.

Sources: `public/data/outdoor-catalog.json`,
`public/data/modern-interiors-atlas.json`, `scripts/build-outdoor-catalog.ts`,
`scripts/index-interiors-atlas.mjs`, and
[setup and local data](../../../setup-and-local-data.md).
Recompute baselines when inputs change; these numbers are a dated checkpoint.

## Model correction — 2026-10-04

The owner clarified the requested model allocation: GPT-6 Astra/high for the
coordinating session, and GPT-6.1 Sol/high for every other agent session, including
reviewers. This supersedes the earlier GPT-6 Sol/high worker selection. The limit
of two concurrent workers remains unchanged. The earlier read-only planning
critique used GPT-6 Sol/high; future assignments use the corrected model.

## Concurrency clarification — 2026-10-04

The owner is comfortable with roughly four concurrent workers. The concern is
file contention and coordination overhead, not parallel investigation itself.
This supersedes the earlier two-worker limit: allow up to four when session slots
and independent work permit, with exclusive packet/review output paths and one
coordinator integrating shared files. Model assignments remain unchanged.
