# Semantic mapping work queue

Updated: 2026-10-04. Source inventory, broad surveys and three pilots are reconciled; shared validator next.

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
| V01 | Read-only adapter/validator and deterministic report for the three trials | P04 | Presentation adapter implemented; broader schema pending | `scripts/build-family-sheets.py` checks all 85 records and sources; full [acceptance criteria](notes/2026-10-04-pilot-method-review.md#minimal-next-implementation-slice) still include normalized lineage/review views and general topology validation |
| E01 | Expand theme packets across both tilesets | V01 | Queued | Unassigned |
| E02 | Reconcile supplemental art not represented by master surveys: unmatched singles, theme variants and animations | S01, V01 | Queued | Inventory group counts are available; these sources are not yet semantically surveyed |
| G01 | Global boundary, duplicate, gap and semantic consistency audit | E01, E02 | Queued | Unassigned |
| R01 | Quiet themed contact sheets with compact metadata and lightweight review | V01 presentation adapter; candidate packets | Implemented and validated for all three pilots | 52 cards / 85 records, variants, assemblies, selected-piece metadata and shared notes; three proposed discovery candidates, no approval/promotion controls |

Next action: discuss the three contact sheets with the owner, then complete V01's broader schema before scaling theme
assignments. Read the [coordinator corrections](notes/2026-10-04-pilot-reconciliation.md)
alongside all frozen proposals. Worker models are GPT-6.1 Sol/high. The coordinator
alone commits checkpoints. Reconciled research does not mean human-approved or
ready in the Workshop; exact review delivery remains R01.

Keep rows bounded as the survey reveals themes; replace E01 with linked theme
assignments rather than assigning the entire remaining atlas to one worker.
