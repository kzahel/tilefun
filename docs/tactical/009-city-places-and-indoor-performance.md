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

## Completed slices

- `d4bc9f4`: indoor static-layer caching and this delivery plan. All 1,132 unit
  tests and 19 targeted browser tests passed, including room entry/return,
  movement/jump and approved interior visuals; 27 cache parity checks passed.
- Parking lot candidate: regional-v7 has three Workshop views, six native spaces,
  seeded occupancy, perimeter planting, six-tile driving access and a separate
  clear walking entrance. The southwest building lots are reserved for this
  place; approved v6 stays unchanged. Uses existing surface IDs 15–75 and art.

- `eaba2f6`: parking-lot slice committed; 1,134 unit tests and three targeted
  browser checks passed. All 309 previous candidate identities are unchanged.
- Public spaces candidate: regional-v8 reserves a pocket park beside one native
  apartment, a neighborhood park with connected loop paths, seating and play
  area, and a paved square. Four independent views are in Workshop batch `parks`.
  The square's central cross and open market reserve stay clear. The parking
  demo remains separately visitable in frozen v7. Native props and surface IDs
  are reused. Clear paths/doors and all actor routes are checked against actual
  collider geometry at positive/negative owners and two seeds.

- `388f22b`: public-space slice committed; 1,135 unit tests and five targeted
  browser checks passed. All 312 earlier candidates retained their identities.
- Architecture candidate: regional-v9 / Workshop batch `architecture` has three
  views. Wider three/five-level bay-front apartments use the audited native
  closed module chain; a three/four-level office/services building uses native
  glass lobby, matching flat roof/caps and brick floors/caps. Two shop families
  accompany it, with seeded heights and spacing computed from native widths.
  `city-architecture-assets-v1.json` pins four candidate recipes and doorway
  facts; it contains no invented approvals. Source-use catalogue entries label
  these as candidate generation assets. Geometry and native pixels were inspected;
  office and residential interiors both pass entry/return browser checks.

- `580cfb5`: architecture slice committed; 1,136 unit tests passed. Nine relevant
  GPU/review/handoff/entry checks passed across the slice's verification runs.
  All 316 earlier review identities remained unchanged.
- Destination candidate: regional-v10 / Workshop batch `pedestrians` adds three
  views and a bounded walk graph. Four block walkers accompany eight visitors
  taking trips between housing and park seating or shops and square seating.
  Door and seating destinations pause for four to ten seconds; intermediate
  waypoints continue immediately. Only the two reviewed north/south crossings
  admit street trips. East/west trips across the central vertical street await
  audited crossing art. Graph search occurs at planning time (64-node/96-edge
  cap), not per tick. Edited obstructions use the existing bounded pause/return
  behavior. No schedules, traffic AI or trading mechanics are implied.
  Park/square views' Explore links focus their actual public space; geometry
  marks destination anchors and reserved approaches. Preview people remain
  initial poses; gameplay runs the production movement and collision system.

Final integration validation: all three TypeScript configurations pass, all
1,142 unit tests and 216 browser tests pass, and the production build succeeds.
Biome reports only existing warnings. The 81 interior pixel comparisons pass;
the live deployment's manifest matches the checkout. All 319 candidates present
before the destination slice retain their exact identities, and all earlier
human approvals remain intact. Browser checks cover each new batch's feedback,
explorer/game handoff, saved edits, architecture interior entry/return, and
destination visitor movement and deletion persistence. No original source packs
or new untracked art are needed for these additions.

## Performance verification

The final static-shell diagnostic passes 81 exact pixel comparisons across home,
shop and apartment rooms, at three integer scales, with edited/deleted furniture
and actors crossing furniture depth. Draw calls remain 96 -> 5 for the measured
home. `npm run gameplay:bench -- --headed` checks a live v10 office entry,
indoor movement and return in an isolated bundled Chromium profile. In the
measured run, both outside and inside had 8.3ms median frame intervals and
about 10.3ms p95; whole-scene render submission medians were 0.6ms outside and
0.2ms inside (p95 0.8ms and 0.3ms respectively). No browser errors occurred.
This fixes demonstrated repeated rendering work; the user's device still needs
confirmation. Fresh entry asset upload and network conditions are not excluded
by these steady-state measurements. Door prompts now use recipe kind, so the
new office/services building is labeled as a shop rather than an apartment.

## Next human checkpoint

All four accepted implementation milestones are staged together: 13 new
unchecked views in four independent Workshop batches. Existing approvals are
intact; no human approvals were manufactured. Review parking, then public spaces,
architecture and destination activity. Saved v7–v10 layouts and candidate asset
bank signatures are frozen independently. Candidate revisions remain explicitly
selectable, while new-world default v4 is unchanged pending human review.

After acceptance, the next place milestone is a farmers market using the square's
reserved center and clear access routes. A connected multiblock park, additional
frontage orientations, east/west crossing art, richer rerouting/schedules and
moving traffic remain the roadmap's later work.
