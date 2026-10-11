# Firetruck gameplay integration

Status: Delivered.
Owner: [vehicles](../topics/vehicles.md), [vehicle model porting](../topics/vehicle-model-porting.md).
Date: 2026-10-11.

The owner requested committing/pushing local work, syncing remote firetruck assets,
and integrating the firetruck into the main game. Existing local commits were
rebased onto remote vehicle authoring and pushed, including ambulance driving.
Remote also supplies police and garbage-truck bundles; this gameplay slice uses
the corrected stowed firetruck v2 only.

## Delivered contract

- Default game GPU mesh mode, Traffic playground and shared scene consumers load
  the truck's own `fire-truck-ladder-1-v2.glb`. The allcars3d override preserves it.
- Shared axis registration retains native width, grounded independently rolling
  wheels and the stowed ladder. A 144px conservative sphere is shared by culling
  and the body target. Complete approved sprites remain the fallback.
- Two tagged blue lenses use absolute enabled/presentation time every draw. The
  resource joins frame-stable readiness and normal disposal/context recovery.
  Sprite fallback places the truck beacon 64px forward in its native cardinal
  view, at the sprite's 28px roof offset; it follows the displayed facing.
- Main-game desktop/touch driving reuses Siren/B, Style/Space and Fast/Shift.
  EU two-tone, US wail and lights-only use the existing synthesized audio owner.
  Only the inside driver changes state; binary replicas, prediction and durable
  traffic preserve it across reload. Style remains selected while switched off.
- Traffic selector adds Firetruck; commands use ordinary ScenarioSession/Realm.
  Generated broad streets already admit the stowed truck and retain their existing
  placement, collision, route and roof rules. Raised ladder remains sprite-only
  and excluded from generated traffic. No equipment articulation is introduced.

## Validation

Typechecks, all 2,518 unit tests (257 files), lint (119 warnings/34 infos),
production build and streaming readiness pass. All four focused real-Worker
Canvas/GPU ambulance/firetruck checks pass, including own-model part counts,
style switching, boost and exit. The GPU capture was visually inspected for
body registration, floor/wheel placement and stowed equipment. All 767 Workshop
candidates verify in full Chromium; all 180 approved vehicle records and six
retained authored-model records are unchanged.

The broad browser run on the initial integration build passes 554/557 checks
(23.5 minutes). It misses GPU first slow tap/fullscreen destination, gesture/resize
tap destination, and standalone Workshop teardown timeout. The subsequent sprite
beacon placement correction is checked against a fresh final build below; broad
coverage is not repeated for that cosmetic change. An isolated final checkout passes typechecks, all 2,518 units, lint, inventories
and build. Its seven focused browser checks pass six: all four emergency-vehicle
checks plus gesture/resize input and standalone Workshop. GPU first slow tap still
misses the second destination after focus returns, at tap-movement.spec.ts:171;
this fixture has no emergency vehicle and that on-foot input path is unchanged
by this slice. The suite is not wholly green. The last sprite flash-height
adjustment is covered by a fresh build and four emergency-vehicle browser checks.

Concurrent NPC investigation edits appeared in the main workspace during final
validation. A detached temporary checkout contains only this slice and owns the
final generated artifacts/build, keeping the continuing investigation intact. Exact GLBs, source bundle and approved sprites remain unchanged.
Human model-art approval and ladder/steering clearance remain separate follow-up.

Evidence: [unit log](/tmp/tilefun-fire-isolated-unit.log),
[isolated follow-up](/tmp/tilefun-fire-isolated-browser.log),
[full browser log](/tmp/tilefun-fire-browser-full.log),
[streaming report](/tmp/tilefun-fire-streaming/report.json),
[GPU capture](/tmp/tilefun-fire-truck-ladder-1-gpu-meshes.png).

Next: owner playtest of firetruck wheel/body appearance, beacon placement and
siren volume. Exact art review and articulated ladder clearance remain open.
