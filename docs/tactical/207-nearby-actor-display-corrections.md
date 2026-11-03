# Nearby actor display corrections

Status: implementation/native checks complete; delivery qualification in progress.
Updated: 2026-11-03.

The owner observed cars and NPCs shifting/floating as player bounds approach.
Trace the shared authority/predictor and presentation before changing contact rules.
Preserve pushing, head support, jumps, ordinary Worker/P2P and authored ramps.

## Findings and change

PlayerPredictor selected actors within 24px for predicted presentation and applied
the player's complete XYZ correction to all of them. Proximity therefore moved
otherwise stationary actors before contact. A normal ScenarioSession regression
with several controls admitted together displayed a parked car at x=107.47 while
its authority/physics position remained x=100. A missed predicted jump also
transferred vertical correction to nearby actors.

Nearby actors still share predicted simulation time to avoid mismatched contact
timelines. Only the actual solved contact component shares display correction.
If that component contains fixed/floor support, vertical correction is zero:
visual smoothing cannot lift the entire supported stack away from the floor.
No motor, shape, friction, push or authority pose rule changes.

Snapshot restore previously cleared the contact graph, leaving presentation
without solved membership until another physics step. Numerical snapshots now
retain unique solved body pairs restricted to the captured body set. Restore
recreates those associations at the supplied tick without integrating or querying
all body pairs. The wire adds two bytes for pair count and eight per pair, bounded
by the existing 128-body cap. Frame tag is now 0x0d; matching endpoints are required.

Native regressions cover unconnected car/NPC corrections, a supported touching
player/car correction, contact capture/filter/restore without a hidden step, and
wire pair roundtrip/invalid identities. Existing native movement, support/jump,
delay/reversal, bridge/garage, snapshot and protocol checks remain green:
93 checks across seven files. All three TypeScript projects pass; focused lint
has only existing binary codec non-null assertion warnings.

## Separate terrain seam observation

A native flat-floor reproduction pushing a dog across coplanar section edges
still reaches about 0.59px of actual height bob. This is separate from the larger
proximity display transfer. Away from section seams the sampled cardinal and
glancing pushes stay essentially at floor height. Removing the rounded bevel
eliminates the bob but blocks flat-floor NPC traversal and the garage ramp.
Contact skin, smaller prediction distance and bevel changes did not provide a
regression-free replacement. These experiments were reverted; collision settings
and shapes remain unchanged. Follow up on internal terrain edge contacts rather
than masking height or introducing another collision resolver.

## Delivery

Production build/inventories, affected Worker/P2P/lab/car browser checks and
streaming readiness are pending. Mark development readiness only after they pass.
