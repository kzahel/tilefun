# City places and indoor performance

Accepted scope, 2026-10-02: implement all four proposed city milestones, commit
usable slices along the way, and investigate the indoor slowdown. This extends
[007](007-dense-city-districts-and-street-life-plan.md); farmers markets, moving
traffic and large multiblock parks remain later milestones.

## Delivery and review

1. **Parking lots (regional-v7):** shared lot place facts, native marked bays,
   seeded occupancy, driving entrance, pedestrian access and planted perimeter.
   Review the integrated commercial block and the lot/access details.
2. **Public spaces (regional-v8):** pocket park, neighborhood park and paved
   square. Reserve land and continuous through routes before placing furniture.
   Stage distinct views of each place and the whole district.
3. **Architecture variety (regional-v9):** larger residential compositions and
   commercial frontage variation, with audited source art and native facade
   closure. Stage building and block views; supported art faces south.
4. **Pedestrian destinations (regional-v10):** bounded trips between shops,
   public-space entrances and seating, with destination pauses. Admit street
   edges only at crossings; edited obstructions must pause/return without
   teleporting. Demonstrate this through ordinary gameplay simulation.

All previews, explorer detail and gameplay use the same generator, factories,
source-backed surface renderer and stable owner identities. Each revision is
pinned separately; v1–v6 and all existing exact review identities remain frozen.
New batches appear in Workshop's global inbox and Dense neighborhoods tool.
Each has its own queue and two-report pause. User approval is required for each
new composition; building subsequent candidate batches does not approve them.
Use the public deployment for review links. No new art source packs are required.

## Indoor investigation

The current gameplay path rebuilds room wall/floor draw commands and validates
furniture each frame. The first fix caches two native-pixel static shell layers
per active room and validates furniture only when placements change. Actors,
particles, moving/edited furniture and actor/furniture depth ordering stay live.
The cache includes the doorway below the room-review viewport and is rebuilt
when the room identity or atlas image changes.

`npm run interiors:bench -- --headed` uses bundled Chromium against the local
Vite server (`TILEFUN_DEV_URL` overrides the default localhost:5174/tilefun).
It compares uncached and cached rendering, including native/2x/3x pixel parity,
furniture deletion/movement and actor occlusion. Initial measured room draw
calls: 96 -> 5 per frame; headed command submission median approximately
0.3ms -> below 0.1ms, p95 6.1ms -> 0.1ms in this run. These measurements isolate
the rendering path, not network latency or whole-game FPS. Actual room entry,
movement, jump, edits and return must also pass browser checks before landing.

## Validation

For each slice: typechecks, unit tests, Biome and production build, targeted
browser checks, real native-pixel inspection and old review identity comparison.
Run the complete browser suite after integration. Verify door/path clearance,
unique feature identities, negative owners, seed stability, preview residency,
explorer/game parity and save/reopen behavior. Freeze generated signatures once
layouts are ready. Record completed slices and remaining scope here.
