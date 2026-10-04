# 036 — First generated railway

Date: 2026-10-04. Owner: [trains](../topics/trains.md).

## Authorization and scope

The user accepted the prepared previews in chat (“It all looks fine to me. Nice
job”), then authorized proceeding and committing the first generated two-town
service. This slice uses the native horizontal blue train, straight rails and
basic outdoor platforms. The source atlas and train bank hashes are pinned in
`src/railway/rail-local-v1.json`. Workshop verdict records were not rewritten.

This delivers one train reversing on one track. Passenger boarding, station
buildings/signage, vertical routes, paired tracks, crossovers, bridges, tunnels
and express services remain subsequent slices of parent plan 023.

## Implementation

- `RailwayPlanner`: canonical disjoint east/west owner pairs, bounded independent
  queries, dry route admission and road-crossing rejection. Platforms sit south
  of existing town blocks, with paths joining the center street. No retired
  generator branch; current generation is now regional-v13.
- `RailwayStrategy`: native two-row straight track, paved platforms/access and
  stable-ID platform furniture composed over the current district/traffic strategy.
- `Train`: committed native three-section horizontal sprite, one long collision
  body. Reverse direction changes movement without mirroring native pixels.
- `RailwaySystem`: shared authority, acceleration/braking, eight-second stops,
  whole-body swept collision and ready-terrain checks. At most four services;
  dependency tickets cover the body plus braking distance, not the whole line.
- Save one semantic service record (position, target, dwell, deletion) through
  the existing shared persistence coordinator. Freeze and acknowledge a finite
  save before retiring. Restore the same service from either station. Never
  duplicate it in ordinary entity records. Dormant time does not advance trains.
- Long colliders participate in adjacent-cell spatial queries even when their
  origin lies outside the query, covering collision and replication.

New worlds search bounded nearby owners for a station start and otherwise keep
normal town spawn. Seed 2026 starts at 2543,-2662, north of the west stop; the east
stop is at 3422,-2658. Existing worlds need explicit same-seed recreation.

## Validation

Recorded after completion below. The browser evidence exercises actual Worker
simulation and native rendering, not a Workshop mockup. Unit scenarios cover
both termini, obstacles, ready-terrain pauses, changed track, persistence and
single-service restoration. The general streaming benchmark remains the town
traversal scenario; it is not evidence of high-speed rail or mobile train travel.

- `npm run typecheck`: passed for browser, server and Worker.
- `npm test`: 160 files / 1,427 tests passed, including failed-save retention and
  restoration through a fresh service controller.
- `npm run check`: passed; existing repository warnings/info remain.
- `npm run art:catalog`, `npm run workshop:manifest`, `npm run build`: passed.
  All 32 railway candidate identities remain unchanged; no review verdicts added.
- Full 286-case Playwright run plus focused reruns cover all cases. Initial
  failures exposed old town-spawn assumptions and doorway fixtures that toggled
  out of play mode or did not clear the arrival latch. Traffic now requests its
  town explicitly; archived-review handoff tests the new station start. Door
  tests wait for ready play state and walk away before a fresh approach. The
  corrected fixtures and native railway preview checks pass.
- The actual Worker-world railway test passes: furnished station, one replicated
  horizontal train, dwell then movement on the correct rail row with no mirroring.
  [Screenshot inspected](/tmp/tilefun-railway-station.png).
- `npm run streaming:bench -- --assert-ready`: passed. Cold, standing, walking,
  sprinting, reversing and zoom-out each reported zero missing-data and incomplete
  cache frames, with no browser errors. Local report:
  [streaming report](/tmp/tilefun-railway-streaming/report.json).

Next: passenger boarding/alighting and station destination information, followed
by separately reviewed network/structure extensions. No high-speed or device
rail-travel performance claim is made by this slice.
