# Boats and wildlife lakes

Topic: boats
Status: implemented and validated; original appearance pending human review.
Updated: 2026-10-24.

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

Placement outlines are centered on the actual vehicle collision footprint. The
previous outline extended downward from the cursor, misleading south-shore
placement by 40px. Boats now offer **Drive boat** within 64px of their hull,
matching the maximum shore exit gap; the prompt and authority share that range.
This makes boats placed a short distance offshore reachable from dry land on
every side. Cars and trains retain their 32px boarding range. Boat water clearance
and safe dry-land exit checks still apply.

The shoreline correction passes native placement/overlay regressions and all
seven boat browser checks. The broader browser run was stopped at the owner's
request; it is not a completed full-suite result.

The shared authority/prediction driving step uses gentler acceleration and
braking, forward rolling turns and a conservative 80px square hull clearance
covering every heading. Swept bounds require loaded water and reject solid
terrain, props and other bodies. Boats never use road routing, traffic model
selection, pushing or roadkill. Road catalogs remain road-only; the shared
drivable/editor/asset catalog additionally includes this one boat. No new wire
fields or separate lab simulation are introduced.

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
