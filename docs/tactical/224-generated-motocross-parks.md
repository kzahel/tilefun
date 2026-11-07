# Generated motocross parks

Status: delivered in the current regional generator; ready for owner/child play review.
Owner request, 2026-11-07: after the [223](223-jump-park-and-race-tunes.md) jump
lab, make a car motocross track a real world feature near towns, on the other
side from the speedway.
Owners: [city generation](../topics/city-generation.md), [vehicles](../topics/vehicles.md).

## Delivered

- **Placement.** `MotocrossSource` (`generation/regional/MotocrossPlanner.ts`) plans
  at most one park per city, on the side opposite its speedway (either side if the
  city has none), north of the town's centre line. The 218×61-tile venue must be
  dry, ≥12 tiles from intercity roads and railways, and clear of other settlements
  (the town's own reservation is wider than its built plan, so it is excluded).
  Seeds 2026/42/7/1/99 admit 27 parks for 39 cities.
- **Layout.** A dirt stadium loop (lane radius 20, 8 tiles wide; 166-tile
  straights). North straight, east-bound: sky lip then double. South straight,
  west-bound: curved kicker then tabletop. Infield practice lane: rollers. 20-tile
  run-ups after each turn. A paved pit row south of the loop holds five race-tuned
  cars; a rally hatchback waits on the north straight's start, facing the jumps.
  Eight benches with spectators, lamps, a picnic table and umbrella. An access
  road joins the town's centre-line road like the speedway's.
- **Shared jumps.** Profiles moved to `generation/regional/JumpProfiles.ts`. Every
  slab is an ordinary procedural prop `prop-mx-<jump>-<run>-<slab>-<e|w>` whose
  single planar surface derives from its type and position; slabs of a run share
  one space. The Workshop jump park now builds its lanes from the same props.
  Mirrored west-bound slabs keep exact profile heights. Surfaces draw dirt-brown.
- **Composition.** NaturalStrategy paints dirt/grass terrain, flattens height,
  paints pit and access asphalt, places slab/scenery props by footprint, adds the
  parked cars (`depotVehicles`) and spectators. NaturalLandscape and farmstead
  planning treat the park as reserved, like the speedway.
- **Map.** Overview returns `motocross`; the explorer and in-game map draw a brown
  loop with its access road and label. The in-game map lists each park under
  Racetracks; selecting one targets the pit row for **Travel**.
- **Workshop.** Natural case `nature-motocross` (seed 2026, city 0,0) starts beside
  the start-line car; the landscape page gains a touch **Boost** button.

Fixture change: the park west of seed 2026's central city displaced the only
nearby capuchin home, so the capuchin inspection moved to the nearest home valid
in both thicket and balanced compositions, (-986, 2280).

## Evidence

- `MotocrossPlanner.test.ts`: three seeds; opposite-side placement, no speedway
  or city overlap, slab props on dirt in eight connected spaces, exact mirrored
  kicker heights, pit cars on asphalt; regional chunk terrain/props/vehicles.
- `MotocrossPark.test.ts`: real seed-2026 world; the start-line rally hatchback
  boosts over the generated sky lip (peak >140px) and double, upright, in lane.
- Full unit suite passes (385 files). Browser: speedway/map spec including the
  motocross map entry and travel target; jump-park spec. Streaming benchmark
  passes `--assert-ready`.

## Next

1. Owner/child play review in a fresh world (saved terrain is not repainted).
2. Dirt road surface or art for the loop and ramps instead of schematic colours.
3. Optional AI riders once traffic can follow jump profiles.
