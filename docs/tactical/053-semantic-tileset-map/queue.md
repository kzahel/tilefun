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
| S01 | Freeze source manifest and reconcile existing index scope | — | Assigned | `source_inventory`: inventory script, source manifest/file inventory and source-inventory note |
| S02 | Survey both masters and Room Builder; map broad thematic regions | S01 verification before integration | Assigned | `exteriors_survey` and `interiors_survey`: separate S02 packet/region files and capture helpers |
| P01 | Trial: seasonal trees and family/variant structure | S02 | Queued | Unassigned |
| P02 | Trial: suspected dumpyard area and object boundaries | S02 | Queued | Unassigned |
| P03 | Trial: Interiors furniture and original-to-packed correspondence | S02 | Queued | Unassigned |
| P04 | Audit trial results; add modular probe if needed; refine method and estimate | P01–P03 | Queued | Unassigned |
| E01 | Expand theme packets across both tilesets | P04 | Queued | Unassigned |
| G01 | Global boundary, duplicate, gap and semantic consistency audit | E01 | Queued | Unassigned |
| R01 | Deliver theme/family review surface and exact registered candidates | P04; candidate packets | Queued | Unassigned |

Next action: verify the source manifest and integrate the two independently owned
survey outputs against its hashes. Survey workers inspect individually hashed
sources while the full inventory runs; integration waits for source reconciliation.
Worker models are GPT-6.1 Sol/high. The coordinator alone commits checkpoints.

Keep rows bounded as the survey reveals themes; replace E01 with linked theme
assignments rather than assigning the entire remaining atlas to one worker.
