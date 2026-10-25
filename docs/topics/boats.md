# Boats and wildlife lakes

Topic: boats
Status: implemented and validated; original appearance pending human review.
Updated: 2026-10-25.

Owner requested a working boat, naturally generated larger lakes, boats beside
shores and varied water creatures in [152](../tactical/152-explorer-boat-and-lakes.md).
The original open motorboat has a recessed hull, plank floor, benches, helm,
outboard and independently rotating propeller. The editable packed Blender
source, embedded-texture GLB and exact game-camera cardinal fallback are retained
under `art-source/vehicle-models/explorer-boat/v1/` and ordinary runtime assets.
Replay the frozen Blender builder with an absolute `--output` directory; its
packed image export is independent of repository caches. Its exact appearance
candidate is registered pending human review. Runtime authorization does not
imply appearance approval.

Use **Edit → Vehicles → Explorer motorboat** to place it on clear loaded water,
or find a natural boat at the quiet northern beach of a new large regional lake.
Stand beside it and press **E / Drive boat**. WASD/arrows, touch and controller
use ordinary vehicle inputs; R/Reverse backs up. The visible driver is parented
to the open seat. Return beside a clear dry shore to get out. Open-water exit
is refused. Boats stay parked, save their position/heading and occupied seat,
and retain deletion through normal streaming and reload.

Placement outlines are centered on the actual vehicle collision footprint. Boats
use the retained mesh's measured 72×35px body, with a continuously rotated hull
and a surrounding query rectangle. Water/shore, prop and body contacts use the
same swept oriented-body checks as road vehicles; empty query corners do not
block a hull. Authority, prediction, placement, saved-seat restoration and the
collision inspector share that geometry. Existing shore/body overlaps can retreat
without deepening penetration or entering new obstacles, so a bank edit or old
stranded save no longer rejects every attempt to move. New placements still require
clear loaded water. Natural moorings reserve the hull's full turning radius.

Boats offer **Drive boat** within 96px of the rotated hull, shared by the prompt
and authority, and allow boarding while standing on the 16px rim. The shore exit
search covers the same 96px gap and still requires clear dry ground. Cars and
trains retain their 32px boarding range. The original misplaced placement outline
and 32px boarding limit had already been corrected; the larger reach also keeps
older offshore placements reachable after replacing the oversized square.

The GPU loader omits the car-style ground-shadow oval for marked watercraft.
That oval projected beneath the raised sides of the open hull and gave a floating
appearance. The retained GLB, sprite fallback and exact art review snapshots are
unchanged. Drivers have no independent ground shadow while seated. Shared game
and lake-playground backends consume the same loader policy.

The shared authority/prediction driving step retains gentler acceleration and
braking and forward rolling turns. Swept bounds require loaded terrain. Boats
never use road routing, traffic model selection, pushing or roadkill. Road
catalogs remain road-only; the shared drivable/editor/asset catalog additionally
includes this one boat. No new wire fields or separate lab simulation are
introduced.

Validation on 2026-10-25: focused boat, placement, vehicle-control, driving,
pushing, mesh, scene-collection and collision-inspector native checks pass.
Regressions cover measured mesh containment, narrow channels, shore recovery,
dry enclosing-box corners, rim/shore boarding, and authority/prediction parity.
The saved-boat GameServer regression and all seven boat browser checks pass;
Canvas, GPU sprites and GPU meshes cover ordinary game and lake playground
boarding/driving/reload. Typechecks, focused lint, regenerated art/Workshop
inventories, production build and diff checks pass. The new gameplay mesh
capture was visually inspected for the removed oval. This is focused validation,
not a full-suite claim.

Large lakes have an independent bounded 512-tile owner bank. Their irregular
shorelines enclose deep interiors and shallow margins, with a straight open
boarding beach. Candidate admission preserves infrastructure and existing small
ponds/lagoons. Sizes vary around 108–140 by 76–108 tiles, before shore fringes.
Each admitted lake offers one natural boat, four fish schools, four other water
species and one aquatic hunter. Natural actors use existing habitat, food-web
and delayed natural-only meal replacement rules. Lake output is current-world
generation: recreate a development world, or explore newly generated territory;
saved terrain edits are not migrated or erased.

Natural boat identities are coordinate-owned. Their parked route anchors use
ordinary durable traffic records and origin receipts; revisiting a mooring does
not duplicate a moved, saved or deleted boat. Generated boats share the normal
1024-state vehicle residency budget and storage-pressure admission gate.

The World Geometry lab's **Large lake · motorboat & water wildlife** case uses
the same generator, boat, controls, persistence and Canvas/GPU renderers. Its
fixed seed-2026 beach is at approximately 813, −907 tiles. The boat source review
also links to this playground. Existing animal habitats and exact art remain
separate; the zebra showcase was moved to a current valid natural clearing.

Next: owner appearance/play review, then optional wake/rocking effects, a wider
wildlife-viewing camera and passenger seating. This first boat has one driver;
decorative benches do not yet provide extra controllable passenger seats.
