# Ambulance beacons and emergency-light asset tags

Status: v2 authored for owner inspection; game integration/control pending.
Updated: 2026-10-11.
Owners: [vehicle model porting](../topics/vehicle-model-porting.md),
[3D assets](../topics/3d-assets.md), [rendering](../topics/rendering-architecture.md).

## Owner feedback and retained shape

The owner likes the ambulance overall and requested source-matched tapered roof
beacons, especially the front pair. They want switchable flashing lights without
rotating hardware. This is feedback on v1, not formal production approval.

V1 remains immutable. V2 replaces its ten rectangular bar surfaces with twelve
objects: two thin bevelled bar lenses, four tapered beacon lenses and six fixed
bases. Body, windows, wheels, their UVs and source cameras keep the v1 shape/UV/
hierarchy hash. Non-light atlas regions keep exact RGBA pixels. V2 has 56 meshes
and 1,388 triangles; wheel radius and physics are unchanged.

The [source bundle](../../art-source/vehicle-models/ambulance/v2/),
[GLB](../../public/assets/models/vehicles/ambulance-v2.glb),
[4×2](../../public/assets/models/vehicles/review/ambulance-v2/comparison.png)
and [flash preview](../../public/assets/models/vehicles/review/ambulance-v2/lights.gif)
retain exact source/export/captures. `beacon-audit.json` pins unchanged geometry;
`lights.json` records lenses, channel, phases and pattern. Observed blue clusters/
strips supply paint; their transfer, hidden surfaces, supports and rear placement
are explicit inferences. V1's roof/cab contradictions and steering limits remain.

## Reusable engine contract

Blender lens custom properties export as GLB node `extras`:

```json
{
  "tilefun_effect_schema": 1,
  "tilefun_role": "emergency-light",
  "tilefun_channel": "emergencyLights",
  "tilefun_group": "front-left",
  "tilefun_phase": 0
}
```

Names help inspection; typed tags drive behavior. Fixed bases have no emitter
tag. The export keeps its embedded atlas and emissive texture paint intact.
`VehicleEmergencyLights` clones only tagged lens materials, borrowing their
texture. Standard emissive intensity or unlit gain receives an absolute enabled/
time input. Disposal restores original materials without disposing borrowed
geometry, textures or body materials.

The one-second pattern uses two 120 ms flashes separated by 80 ms, alternating
groups half a cycle later. Shared presentation supplies time; there is no local
renderer clock, per-frame network animation or geometry rotation. Every draw sets
the enabled/time state, including off, so cached assets cannot retain another
entity's flash. Shared engine ownership governs pause/clock policy.

Future authoritative state owns the on/off flag; input, replication and persistence
need a separate integration slice. Manual switching is recommended pending owner
preference. Siren audio is separate. This helper does not wire a game control or
load the ambulance in place of its sprite. Nearby light spill/bloom can be a later
appearance feature. Canvas fallback needs matching authored flash frames/overlay
if the gameplay feature is enabled there.

## Evidence and validation

Full Chromium GLB loading preserves six typed tags. Off/A/B renders differ;
off-after-on is pixel-identical to initial off. Body/housing material identity,
color and emission stay unchanged. Four unit tests cover phases, material isolation,
off reset, borrowed-resource disposal, malformed tags and imported emissive paint.
Bundle validation rejects altered exported lens phases. The frozen GIF uses those
actual GLB frames, not painted animation frames.

An index-only checkout contains no ignored templates, scratch galleries or local
dependencies. Its retained v2 scene reproduces all eight native/novel render
hashes. All five packed source revisions and exported wheel rigs pass; the actual
v2 GLB passes the light probe from that checkout. Its production build, bundle
verifier and all 22 Python tests pass. All four earlier bundle records and all
762 prior Workshop candidate records remain unchanged; only v2's inspection
identity is added.

Typecheck, lint, art catalog, Workshop manifest and production build pass. The
Windows unit run reports 2,469 passes, five failures and ten skipped tests. The
failures are existing Windows symlink/SIGKILL checks; the static-file suite cannot
create its symlink fixture. All four new light tests pass.

The full Chromium suite finishes in 24.7 minutes with 543 passes, five failures
and one skip. Both retained ambulance revisions pass desktop/phone review; tool
destinations, model loading and both mesh-driving variants pass. The failures are
the previously recorded building/hotel phone layouts, landscape-phone editor
placement, and plain Canvas/GPU car movement. A single-worker rerun passes editor
placement and Canvas driving; plain GPU driving still fails its movement-distance
assertion, as recorded in 115. No game movement code changed in this revision;
these broader failures remain separate follow-up work, not a fully green suite.

The reusable light probe reads the declared lens count/groups/phases rather than
assuming every emergency vehicle has six lights. Its final tracked-checkout run
passes and retains the same off/A/B pixels. Constructor/effect source hashes use
pinned LF checkout rules; all retained source/export/review bytes remain exact.

## Next work

Review v2 beacon shape in four source views and novel angles. Then integrate its
own asset/registration and authoritative switch through shared game/lab presentation.
Blue `allcars3d` substitution and this offline preview do not qualify integration.
