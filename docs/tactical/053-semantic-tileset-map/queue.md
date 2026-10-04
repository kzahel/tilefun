# Semantic mapping work queue

Updated: 2026-10-04. Source inventory, broad surveys and three pilots are reconciled; shared model and coverage ledger implemented; eight family sheets implemented; 191 source records / 164 proposal units normalized and independently audited.

The coordinator alone updates this queue. Record an owner/session, source revision
and artifact link when assigning work. Workers can finish their own packet without
editing this file. Reassign stale work explicitly after checking saved artifacts.

Allow up to four independent workers, within available session slots. Record
exclusive output paths in each assignment and keep reviewer artifacts separate
from active mapper files. Use fewer workers when useful independent work is scarce.

Packet states: queued → assigned → proposed → independently checked → reconciled
→ ready for owner review. A disputed or blocked packet records its next question
and dependency. Human approval/rejection lives in the exact review system, not in
an agent-written queue status.

| ID | Work | Depends on | State | Owner / evidence |
| --- | --- | --- | --- | --- |
| S01 | Freeze source manifest and reconcile existing index scope | — | Reconciled | [Manifest](source-manifest.json), [source evidence](notes/2026-10-04-source-inventory.md); coordinator full/committed-only checks passed |
| S02 | Survey both masters and Room Builder; map broad thematic regions | S01 | Reconciled with corrections | [Exteriors review](packets/S02-exteriors-review.md), [Interiors review](packets/S02-interiors-review.md); use coordinator corrections for E10/E15/E18/E45 |
| P01 | Trial: seasonal trees and family/variant structure | S01; S02 source window located | Reconciled | [Tree proposal](packets/P01-trees.md), [review](packets/P01-trees-review.md); 29 candidate dispositions, eight exact reconstructions; qualifications in coordinator note |
| P02 | Trial: suspected dumpyard area and object boundaries | S01; S02 source window located | Reconciled | [Scrapyard proposal](packets/P02-scrapyard.md), [review](packets/P02-scrapyard-review.md); 29 candidates, off-grid origins and weak subset-match limits retained |
| P03 | Trial: Interiors furniture and original-to-packed correspondence | S01; S02 source window located | Reconciled | [Cabinet proposal](packets/P03-cabinets.md), [review](packets/P03-cabinets-review.md); 27 records/nine concepts; evidence attribution correction in coordinator note |
| P04 | Audit trial results; add modular probe if needed; refine method and estimate | P01–P03 | Reconciled | [Method assessment](notes/2026-10-04-pilot-method-review.md), [reconciliation](notes/2026-10-04-pilot-reconciliation.md); modular probes covered, throughput estimate unsupported |
| V01 | Read-only normalized model, validator and deterministic evidence report | P04 | Independently checked | [Normalized model](semantic-model.json), [implementation](notes/2026-10-04-semantic-model.md), [adversarial review](notes/2026-10-04-semantic-model-review.md); 191 records / 164 proposal units, lineage, exact review scope and general cabinet/sofa chains; [sofa audit](notes/2026-10-04-sofa-model-review.md) |
| E01 | Outdoor benches, camping chairs and picnic tables | V01 contract; S02 | Reconciled and delivered | [27-export proposal](packets/E01-outdoor-seating.md); 25 direct master matches and two original-only exports; [independent review](packets/E01-outdoor-seating-review.md), [sheet delivery](notes/2026-10-04-outdoor-seating-delivery.md) |
| C01 | Full source-domain and region coverage ledger | S01, S02 | Implemented and checked | [Coverage ledger](coverage-ledger.json), [registry](mapping-registry.json), [evidence](notes/2026-10-04-coverage-ledger.md): 163 windows, all 18 source groups, separate evidence stages |
| I01 | Interiors sofa and upholstered-seat contrast | V01; S02 | Reconciled and delivered | [Proposal](packets/I01-interior-sofas.md), [review](packets/I01-interior-sofas-review.md); 20 records / 18 units, 15 assembly probes; [sheet delivery](notes/2026-10-04-sofa-delivery.md); four lower-seat roles remain unknown |
| RB01 | Room Builder path edges and arch assembly | S02-R11/R09 | Reconciled and delivered | [25-record packet](packets/RB01-room-builder-path-arch.md), [review](packets/RB01-room-builder-path-arch-review.md); fixed arch/shadow differences, weakened inset extension and open network windows retained |
| E03 | Playground crawl tubes | S02-exteriors/E10 | Reconciled and delivered | [25-record packet](packets/E03-playground-tubes.md), [review](packets/E03-playground-tubes-review.md); required continuation ports, finite assemblies, rounded/collared roles qualified |
| A01 | Small door-animation family | S01 animation inventory | Reconciled and delivered | [Nine-frame packet](packets/A01-animation.md), [review](packets/A01-animation-review.md); eight pixel states, exact GIF correspondence; game playback remains unknown |
| E02 | Reconcile supplemental art not represented by master surveys: unmatched singles, theme variants and animations | S01, V01 | Queued | Inventory group counts are available; these sources are not yet semantically surveyed |
| G01 | Global boundary, duplicate, gap and semantic consistency audit | E01, E02 | Bounded mapped-evidence audit; entire-pack semantic audit remains open | [Expansion audit](notes/2026-10-04-expansion-audit.md); inventory duplicates, mapped frames and coverage consistency; unsegmented art remains unassigned |
| R01 | Quiet themed contact sheets with compact metadata and lightweight review | V01 presentation adapter; candidate packets | Implemented and independently checked for all eight normalized packets | 131 cards / 191 records, variants, assemblies, selected-piece metadata and shared notes; eight proposed discovery candidates, no approval/promotion controls |
| R02 | Act on first owner comments: tree-base names/relations and forest repeat examples | R01 | Implemented and validated | [Feedback evidence](notes/2026-10-04-family-contact-sheets.md#first-owner-comments-and-tree-follow-up); cabinets/scrapyard have positive whole-sheet comments; F05 ground correction and three varied-offset examples accepted in chat; exact source/recipe recorded; boundaries remain unresolved |

Next action: expand to bounded unmapped themes and reconcile supplemental exports,
using the same independent review and quiet-sheet workflow. The
[expansion reconciliation](notes/2026-10-04-component-animation-expansion.md) is the
frozen research checkpoint; current delivery is recorded in the
[component family delivery](notes/2026-10-04-component-family-delivery.md).
Continue explicit supplemental reconciliation and whole-source
gap auditing without treating surveyed windows as completed semantics. R02 delivery
is recorded in the [integration note](notes/2026-10-04-tree-sheet-integration.md).
Read the [coordinator corrections](notes/2026-10-04-pilot-reconciliation.md)
alongside all frozen proposals. Worker models are GPT-6.1 Sol/high. The coordinator
alone commits checkpoints. Reconciled research does not mean human-approved or
ready in the Workshop; exact review delivery remains R01.

Keep future assignments bounded by theme rather than assigning the entire
remaining atlas to one worker.

## Integration ownership — 2026-10-04

- `expansion_model`: shared model/coverage scripts, tests and generated files;
  one bounded execution note. All three adapters integrated serially by that owner.
- `expansion_sheets`: new `build-family-expansion.py` module/tests and adapter note.
- `family_animation_ui`: family UI/types/art loader, styles and browser tests.
- Coordinator: source-strip copies/registration, main family adapter glue, queue,
  shared documentation, isolated verification, independent reviews and commits.

The independent model and presentation audits are linked from the delivery note.
Runtime/train/traffic changes from the other active user session are outside this
assignment. Worker models remain GPT-6.1 Sol/high; shared tests run in a source
snapshot with separate ports and storage to prevent contention.
