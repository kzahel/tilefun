# Truck bed gameplay

Owner authorization: take the reviewed level-bed proof end to end into the game.
Status: implemented and locally validated; public deployment not verified.

Deliver normal dump-truck hollow beds, visible independent bed riders, safe
boarding/exit and loading/unloading existing loose toys and forage items. Preserve
real actor identities, shared authority/prediction, saves and renderer fallback.
Normal editor placements, generated traffic and restored dump trucks use the same
profile. No new art or inferred human approval is involved.

Use the production vehicle request path and touch-accessible vehicle panel. The
playground must exercise these same gameplay commands. Qualify ordinary placement,
two independent players, driven turning/braking, cargo support/wall contacts,
save/reload, removal and denied unsafe requests below the browser. One browser
boundary checks actual Worker commands, depth and normal controls.

Tipping remains a subsequent articulated-equipment revision: the reviewed v1 GLB
combines the bed and cab into one rigid mesh. This activation must not rotate the
entire truck or claim loose bed occupants are passenger seats.


## Delivered

- Canonical dump-truck creation and old-record restoration enable the existing
  qualified hollow profile. Road admission remains the retained broad body.
- The game vehicle panel and embedded host share safe boarding, exit and cargo
  actions through ordinary request acknowledgments. Checked destinations, rim
  clearance, stopped motion, proximity and claimed-resource guards fail atomically.
- Loose balls/food retain actor identity and remain unparented. Moving support
  carries them with people through real driving/turning/braking. Balls land on
  the floor, rebound from walls and fall when support disappears. Active truck
  and cargo neighborhoods share bounded dependency tickets across chunk edges.
- The shared collector groups loose contents and people before truck depth
  composition. Canvas/loading/failed meshes retain physical-profile clipping.
  Normal game collision debug also draws the shared bed and cargo/player bodies.
- The playground includes loose objects and the existing game panel, rather than
  a separate UI/physics implementation. Its explicit diagnostic teleports remain
  labeled. Pausing locks ordinary gameplay controls.

## Current validation evidence

Typechecks, repository lint (121 existing warnings/39 infos), production build,
art catalog (695 sheets/1,393 source uses), Workshop manifest (1,899 candidate
identities verified in normal Chromium at retina scale), and the Node comparator
pass. The final focused native check passes 277 cases across 11 files. Production GameServer request
coverage passes; two real sessions qualify a driver plus independent bed rider
and cargo under turning/braking. Reload retains cargo identity/floor support.

The final built app passes three full-Chromium cases (14.5s): bed Worker/game
controls/fallback/backend lifecycle, existing atomic mesh fallback, and standalone
review freshness. The full browser run completed 823/824 passing in 37.8 minutes;
its standalone review case correctly disabled voting because code/manifest inputs
changed during that long run. It passes after the final frozen-input regeneration
and rebuild. No test was weakened. The final bed/GPU boundaries were rerun against
that same final build. The browser inventory remains 824 existing cases, with no
new fleet-wide matrix.

The broad native run completed 6,463 cases in 792.57s: 6,445 passed, 8 failed,
10 skipped. Three failures were stale whole-roof assumptions for the newly hollow
truck: TrafficJourney and OriginalVehicles pass their focused rerun (2 cases),
and collectScene passes all 168 cases after locating the bed-group child. The
remaining five failures are Windows symlink permission/process-death fixtures in
FsSecurity, privateDataPlugin and SqliteRecordStore; staticFiles also fails its
symlink setup/cleanup hooks and skips ten cases. No unrelated tests were waived
or changed. The final GPU/mesh streaming readiness check also passes with no
errors/failures; it measures ordinary game traversal, not a loaded-bed mobile budget.

## Review and repeatability

Generated screenshots/galleries, browser output and private test state stay in
ignored `data/` or `test-results/`. The visual model and existing sprites remain
byte-identical; this changes no human art approval.

- `npx tsx scripts/instrumentation/truck-bed-playground.ts
  --output=data/3d-investigation/truck-bed-gameplay --game` creates a self-contained
  ten-state gallery, physical/sprite debug overlays, loaded Canvas view and actual
  desktop/phone gameplay captures through one owned isolated server.
- `npx tsx scripts/instrumentation/truck-bed-game.ts --base-url=http://localhost:PORT`
  borrows an isolated server and creates its own temporary browser/context. It
  selects Construction dump truck in the actual editor, places it through normal
  pointer input, stages loose fruit using the ordinary editor command, loads and
  boards through the game panel, then walks in the bed with normal keyboard input.
  It writes `main-game.png` and `main-game.json` and closes its browser. It never
  uses the user's installed browser/profile or edits a user world.

The reusable [bed guide](../vehicle-bed-prototype.md) owns usage and geometry
extension. Next is a new articulated bed/tailgate revision, tilted support and
sliding/discharge; crates and enclosed passenger seats remain separate additions.


A late native negative exposed an actual moving-bed bug: airborne riders and
bouncing cargo could meet the old whole-body crossing/push proxy and stop the
truck. Both autonomous and driven reproductions stopped completely before the
fix. The shared narrow phase now recognizes free hollow volume for lookahead and
pushes while testing the actual committed walls against airborne bodies. It does
not carry airborne people or change their world momentum. Both cruise/jump cases
and a negative where the moving front wall must stop pass. These cases join the
277-case final native check. The final build and browser boundaries pass after
this correction.

Routed diagonal turns exposed a second transform issue: the old cardinal support
heading could differ from the moving mesh's continuous yaw. Qualified dump trucks
now retain a shared, replicated heading through movement, stopping and restoration.
A diagonal/stopped/reloaded scenario passes, and all admitted vehicle families
still complete the existing generated-road turning test. Road admission policy
remains unchanged; this is not a new general vehicle-body collision solver.

Portable checkpoint/source hashes are in
[validation.json](165-truck-bed-gameplay/validation.json). All diagnostic captures
and private browser/server data are ignored; the model and sprites stay unchanged.

## Commit integration checkpoint

The 2026-10-20 commit integrates upstream `585a6651` (oriented car body sweeps).
The overlapping Driving/VehiclePush imports retain both the oriented narrow phase
and hollow-bed occupant checks. The JSON source hashes above describe the prior
validation snapshot; those two files now also include the upstream collision work.
The combined tree passes typechecks, lint (the same 121 warnings/39 infos), 476
native cases across 12 files, regenerated catalog/manifest with all 1,899 raster
identities verified, production build, and the three full-Chromium bed, atomic
mesh fallback and standalone review cases (12.2s). The broad suites were not
repeated for this integration; their earlier results and limitations remain above.
