# Semantic mapping work queue

Updated: 2026-10-04. Source inventory and thematic reconnaissance are in progress.

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
| S02 | Survey both masters and Room Builder; map broad thematic regions | S01 | Proposed | [Exteriors](packets/S02-exteriors-survey.md), [Interiors](packets/S02-interiors-survey.md); source/coverage checks passed, independent semantic review pending |
| P01 | Trial: seasonal trees and family/variant structure | S01; S02 source window located | Assigned | `exteriors_survey`: P01 tree packet/JSON and capture helper; includes modular forest probe |
| P02 | Trial: suspected dumpyard area and object boundaries | S01; S02 source window located | Assigned | `source_inventory`: P02 scrapyard packet/JSON and capture helper; separate output paths |
| P03 | Trial: Interiors furniture and original-to-packed correspondence | S01; S02 source window located | Assigned | `interiors_survey`: P03 cabinet packet/JSON and capture helper; original/single/packed correspondence |
| P04 | Audit trial results; add modular probe if needed; refine method and estimate | P01–P03 | Queued | Unassigned |
| E01 | Expand theme packets across both tilesets | P04 | Queued | Unassigned |
| E02 | Reconcile supplemental art not represented by master surveys: unmatched singles, theme variants and animations | S01, P04 | Queued | Inventory group counts are available; these sources are not yet semantically surveyed |
| G01 | Global boundary, duplicate, gap and semantic consistency audit | E01, E02 | Queued | Unassigned |
| R01 | Deliver theme/family review surface and exact registered candidates | P04; candidate packets | Queued | Unassigned |

Next action: finish the three trial proposals, then rotate workers to independently
review a different packet and challenge the broad survey labels/boundaries. Worker
models are GPT-6.1 Sol/high. The coordinator alone commits checkpoints.

Keep rows bounded as the survey reveals themes; replace E01 with linked theme
assignments rather than assigning the entire remaining atlas to one worker.
