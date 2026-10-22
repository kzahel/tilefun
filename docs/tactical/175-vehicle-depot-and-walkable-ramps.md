# 175 — Vehicle depot and walkable ramps

Status: implemented and validated locally; owner playtest pending. Owner authorized the depot plus walkable ramps, with an
explicit requirement that the destination appears on the map.

Owners: [vehicles](../topics/vehicles.md), [city generation](../topics/city-generation.md).

Use the reserved racetrack infield for a road-connected vehicle playground.
Provide ordinary saved parked vehicles, a transporter loading lane, towing
practice and a small bridge. The shared overview and in-game map expose a named
depot marker and controller-accessible destination selection. Preserve the
existing track circuit, actor identities, natural ownership pools and retained art.

Walking on the transporter uses measured deck/dual-track ramp geometry through
shared authority, prediction, broad phase, support, moving passengers and local
render depth. Block stowing an occupied ramp. No separate lab physics or new art.

Validation: native planner/terrain/seam/identity/persistence tests; native walking,
jumping, carrying, layer and collision tests; focused normal-game map/arrival and
pedestrian rendering boundaries. Run required typecheck, unit, lint, catalog,
manifest, build, browser suite and streaming readiness. Record outcomes here.

## Validation checkpoint (2026-10-21)

The depot is a deterministic composition inside admitted speedway infields; seven
ordinary parked vehicles retain moved/deleted identities through durable reloads.
The generated sports car drives across the 48px practice bridge; the Beetle
passes below its 40px underside while the dump truck is rejected. The shared
driver slope check now tests actual intermediate foot poses rather than a
swept body held at the old foot height. Existing bridge/garage checks pass.

Pedestrians use the real 13px steel tracks, with the 19px central gap open, the
measured deck and conservative cab/guard solids. Native checks cover authority/
prediction agreement, diagonal carrying, ramp overhang indexing, airborne/side
entry, upper-floor separation, occupied-ramp stow rejection, and cardinal fallback
walker alignment. No retained vehicle art changed.

- Three typecheck targets and lint pass (121 existing warnings, 42 infos).
- Final focused native checks: 33/33; traffic journey fixture corrected for the
  actual transporter deck height, then both journey checks pass.
- Broad native run: 6,688 cases; 6,672 passed, six failed, ten skipped. One failure
  was that corrected fixture. Five Windows filesystem/SQLite failures remain,
  plus static-file symlink setup/cleanup errors; no green full-native claim.
- Node visual comparator: 1/1. Streaming readiness: six samples, no errors or
  assertion failures.
- Catalog/manifest/build refreshed. Manifest verifies 1,980 identities in normal
  Chromium at retina scale, with 136 compiler exclusions.
- Existing normal game/transporter/bridge/garage browser boundaries passed six
  cases. The new normal game map/travel, touch, actual walking, saves and Canvas
  path passed; final broad browser count and captures will be recorded below.

Ignored evidence: `data/vehicle-bake/depot-*`, `test-results/depot-*`, and the
review gallery `data/3d-investigation/vehicle-depot/index.html`.

## Final browser qualification

The frozen production build completed **830/833** browser checks in 39.8 minutes.
The two introduced map failures caught real label boxes obscuring the speedway
oval. Both labels now sit outside the oval; the orange truck stays in the infield.
The original red-pixel visibility threshold remains unchanged. The existing flat-
world Canvas dog-fetch case also failed in the broad run and passed unchanged
when rerun serially; its GPU counterpart passed in the broad run.

After the bounded MapRenderer correction, the rebuilt map checks on desktop and
phone, generated depot flow, Canvas dog-fetch and standalone review passed
**5/5** (52.5s). Thus every one of the 833 unique browser cases passed across the
broad and final runs, without weakening assertions or timeouts. The depot case
uses real map selection/travel, all seven generated cars, actual walking onto the
deck, save/reload, Canvas fallback and a phone map. Capture setup waits for both
authoritative teleport replicas and visible terrain/cache readiness.

All three typecheck targets, lint, catalog, manifest, build and migration inventory
pass after the correction. Final catalog: **719 sheets / 1,398 source uses**.
Manifest: **1,980 identities / 136 compiler exclusions**, verified in normal
Chromium at retina scale. Production source receipts confirm that only
`src/explorer/MapRenderer.ts` changed between the broad and final qualifications.
The five remaining Windows native environment failures stay explicitly recorded
above. No retained vehicle bank, owner approval or deployment was changed.

Final production captures and source/image hashes are in the ignored gallery's
`snapshot.json`. Test preview servers were reaped. No commit or push was made
for this slice. Next: owner playtest of map discovery and a two-player deck ride.
