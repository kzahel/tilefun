# Ambulance driving controls and sirens

Status: Delivered; owner playtest and exact-revision art review next.
Updated: 2026-10-11.
Owners: [vehicles](../topics/vehicles.md), [vehicle porting](../topics/vehicle-model-porting.md),
[touch movement](../topics/touch-movement.md), [embedded labs](../topics/embedded-engine-labs.md).

The owner requested integration of the newly retained ambulance plus always-visible
driving controls for sirens/styles and speed. Origin/main's ambulance v1/v2 work
was merged; tactical-index conflicts retained both 115 histories and the generated
Workshop manifest was rebuilt. Exact retained asset bytes remain unchanged.

GPU mesh mode selects ambulance v2 with its own ground-centered axes, native width,
112px enclosing radius, rigid wheel roll, silhouette pass and resource slot. It does
not inherit the compact's 1.3 lateral correction or allcars3d blue substitution.
Unavailable meshes use the approved four-view sprite; the shared raster draw adds
small alternating blue beacons. Tagged GLB lenses use VehicleEmergencyLights with
absolute state/time on every draw, including off. Host-supplied presentation time
keeps paused labs from running an independent light clock.

On-screen controls retain the touch triangle and work with mouse while driving.
Hold Fast/Shift boosts cars from 112 to 179.2px/s and trains from 192 to 288px/s;
normalized axes, acceleration/braking, substep body sweeps and passenger clearance
remain shared. Ambulance Siren/B toggles lights/audio. Style/Space cycles two-tone,
wail, quiet; the choice persists through off and save/reload. Jump and ball throwing
remain suppressed inside. Touch claims preserve movement arbitration, and seat/menu/
focus transitions release contacts. Other vehicles expose Fast only.

Emergency state is bit 0 enabled plus bits 1–2 quiet/two-tone/wail. The driver alone
can change it through Realm/VehicleControl; traffic records validate/save/restore it.
Baselines add one optional byte; delta change/null masks expand to u32 and cover
value/removal. Snapshot reuse compares state. Endpoints must run the same build.
Exiting leaves vehicle state unchanged so nearby co-op listeners can still hear it.

The local Kenney Impact Sounds inventory contains no siren. AudioManager synthesizes
and caches two four-second triangle wave loops, with eased two-tone transitions and
sweeping wail pitch. Per-entity sources use master gain/Idea ducking, distance gain,
pan and short start/stop fades. Off, quiet, unloading, out-of-range and input/menu/
focus cancellation stop voices; re-entering play can restart still-enabled vehicles.
These are stylized EU/US sounds, not recordings of jurisdiction-specific equipment.
Traffic playground selects Blue car/Ambulance and forwards emergency controls to
ordinary ScenarioSession authority; lab audio is not added.

## Validation

Focused authority/prediction, persistence, binary removal, snapshot reuse, model
selection/bounds, desktop mouse release and synthesized voice lifecycle checks pass.
Typechecks, all 2,502 units (256 files), lint (119 warnings/34 infos),
regenerated inventories, build and streaming readiness pass. All 763 Workshop
candidates verify in normal Chromium. All 180 approved vehicle identities and both
retained ambulance inspection identities are unchanged. Source-dependent identities
refresh for 152 landscape, 12 geometry and six character lab candidates; no human
decision is written or inferred.

All ten serial focused browser checks pass, including the two new ambulance
Canvas/GPU checks and every existing car/train driving variant. GPU screenshot
was inspected for own-model body/width/ground contact, wheels and beacons.
The first broad run exposed predicted mounts dropping the new field; cloning and
reconciliation now preserve/update/remove it, with a native regression. Earlier
headless input/host fixtures and the new conservative mesh-culling expectation
were corrected; all affected 73 regressions pass. The complete 551-check browser run passes 549 and misses two transient destination/
movement observations: Canvas first slow tap/fullscreen, and plain GPU car tap-to-drive.
Both pass all three serial repetitions (six passes) without further code changes;
the full ten-check serial driving run also passes. This is not a wholly green broad
run, and the timing-sensitive browser observations remain a suite limitation.

Evidence: [unit log](/tmp/tilefun-ambulance-unit-final.log),
[focused driving log](/tmp/tilefun-ambulance-browser-final-focused.log),
[full browser log](/tmp/tilefun-ambulance-browser-full.log),
[three-repeat follow-up](/tmp/tilefun-ambulance-browser-rerun.log),
[streaming readiness report](/tmp/tilefun-ambulance-streaming/report.json),
[GPU scene](/tmp/tilefun-ambulance-gpu-meshes.png).

Next: owner playtest of siren volume/styles, boost feel and exact v2 beacon appearance;
steering-clearance qualification and art promotion remain separate work.
