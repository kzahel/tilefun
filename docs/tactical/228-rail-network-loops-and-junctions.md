# Rail network, city loops and switchable junctions

Status: parent plan; phase 1 (regional network and general road bridges) delivered for owner play review; phases 2–4 not started.
Owner request, 2026-11-07: more train connections between cities, more varied
procedural track, trains that can take different directions at junctions (with
the player able to choose), and loop lines around big towns that pass the
speedway for scenery. Grade separation should prefer raising roads over the
track rather than tunnels. The owner accepted the four-phase proposal below and
authorized implementing and committing phase 1.
Owners: [trains](../topics/trains.md), [city generation](../topics/city-generation.md),
[vehicles](../topics/vehicles.md) (road traffic over bridges).

## Starting point (measured 2026-11-07)

Every generated line is a single-track, two-town east/west shuttle owned by an
even-numbered region column. Over a 16×16-region window:

| Seed | Towns | Towns with a station | Pairs blocked by roads | Odd pairs never considered |
|---|---|---|---|---|
| 2026 | 139 | 10 | 18 / 43 | 47 |
| 42 | ~100 | 10 | 12 / 27 | 28 |
| 7 | 110 | 16 | 14 / 30 | 36 |

Rejections: the even-column pairing; any road within 15 tiles of a curved
route; more than one (straight, north/south) road crossing; vertical offsets
above 256 tiles; wet corridors. Closed loops and multiple stops already exist in
`RailPath` and the Town-loop lab, but the generator never emits them. Tracks are
analytic pixels, so turnouts need no sprite art. Trains are flat after reset 205;
rail grades/tunnels would need that work restored, so roads go over rail.

## Phases

### 1. Regional network and general road bridges (this slice)

- Every east-neighbour town pair is a candidate link (no even-column rule).
  Each link remains an independent single-track shuttle with its own train.
- Towns get two fixed station slots on the southern station band
  (`center.y + 60`): the west-facing slot at `center.x − 32` serves the link to
  the west neighbour, the east-facing slot at `center.x + 32` the link east.
  A hub town shows both platforms with the shared town access path and a paved
  concourse between them. Track ends 16 tiles inside each slot, leaving the
  town's own north/south road free through the gap.
- One route fitter: horizontal station approaches joined by a tangent S-curve
  (radius 512 or 768px) of any vertical offset, with a vertical straight where
  the offset exceeds two radii. Pivot candidates are tried deterministically.
- Road conflicts become bridges instead of rejections. A crossing is admitted
  when the road segment is straight for the whole ramp footprint, the rail is a
  perpendicular straight under the deck, no other road or town core touches the
  footprint, and the ground is dry. North/south roads cross horizontal track
  (existing bridge); east/west roads cross the S-curve's vertical straight using
  a rotated variant of the same 96px deck and 384px ramps. Any other approach of
  a road within 15 tiles still rejects the candidate.
- Both bridge orientations draw as an asphalt road deck with edge and centre
  lines; generated traffic follows the surfaces on vertical and horizontal lanes.
- Routes avoid every town core (district grid plus margin).

Acceptance: deterministic planning from either owner; at least ~3× the towns
served on the three measured seeds; bridges discovered and realized across chunk
seams; services restore and run on new lines; explorer/map shows the network;
game screenshots of hub stations, both bridge orientations and a long S-curve.

#### Phase 1 delivered (2026-11-07)

- **Planner.** `RailwayPlanner.owner(cx, cy)` is the link from that town to its
  east neighbour (`rail:cx:cy`); lines always carry a `path`. Station slots are
  `STATION_SLOT` 32 tiles either side of the town centre on the `STATION_BAND`
  (+60) row; track ends 16 tiles (`STATION_APPROACH`) inside each platform, so the
  stop distance is 256px. Platform bounds include the concourse back to the
  access path. Station paving never overwrites an existing road cell.
- **Route fitter** (`railway/RailRouteFitter.ts`, replaces `CurvedRailPlanner`).
  Tangent S-bend, radius 512/768px in seeded order, bend centre at 0.5, 0.35, 0.65,
  0.25 or 0.75 of the gap, ≥32 tiles of straight beyond each stop. Rejects any
  sample inside a grown town core (`townCore`: grid, northern shopping, margin),
  wet ground (±8 tiles at 2-tile spacing) or a road approach that is not an
  admissible crossing. A crossing needs ≥8 tiles of perpendicular straight track
  each side of the deck, the road straight for 36 tiles each side, tile-aligned,
  dry, ≥4 tiles from town cores, ≥14 tiles from unrelated roads and other bridges.
  A road corridor shared by two connections yields one bridge.
- **Bridges.** `RailBridge.axis` is `south` (north/south road, existing parts
  `prop-road-rail-{north,deck,south}`) or `east` (east/west road,
  `prop-road-rail-x-{west,deck,east}`); same 96px deck, 384px ramps, 192px width.
  Traffic lanes on either axis follow the bridge surfaces.
- **Presentation.** `rendering/RoadDeckPresentation.ts` draws road-rail and
  depot decks as asphalt with edge/centre lines and heavier guard rails. Road-rail
  asphalt lightens with height; north/south decks draw rows (their rise is along
  the projection axis) and cast a ground shadow east of the deck so the raised
  road reads over the track. This replaces the accepted tan/blue schematic and is
  new presentation for review.
- **Services.** A fresh service starts at the stop nearest the requesting range.
  Only lines with track or a station near the range are wanted (an S-bend bounding
  box is not interest). Train terrain demand now covers carriage colliders (224px
  halo) and a 384px lookahead toward the next stop: previously a train far from
  players stopped forever at the first chunk edge, because `plan` waits for the
  next poses' chunks while demand covered only the current footprint.
- **Cost.** Lines are cached per seed in one bounded module cache (every
  generation planner constructs its own `RailwayPlanner`); a first fit costs
  ~5ms. Scenario creation returns to HEAD timings after warm-up.
- **Map.** In-game stop lists show one button per town (hub towns have two
  platforms); the map list buttons share one helper.
- **Fallout fixed.** `AnimalWorkSystem` cancelled every site-less animal task
  whenever an entity without `persistentId` (a train carriage) was destroyed,
  because `undefined === undefined`. It now ignores id-less removals. Eight
  wildlife inspection points moved off new rail corridors (see the wildlife
  topic). `MotocrossPark.test.ts` disposes distant rail services: that boosted
  jump is chaotic (a 0.05px start offset already rolls the car), and distant
  bodies only change shared-solver floating-point order. The fragile jump itself
  belongs to the motocross owner.

Measured coverage (16×16 regions; towns with a station): seed 2026 10 → 84 of
139, seed 42 10 → 64 of 93, seed 7 16 → 62 of 110. Bridges per seed: 32, 16, 14
(north/south 10/4/5, east/west 22/12/9).

Validation: all 4,676 unit tests and node integration; typecheck; Biome on
changed files; code-health ratchet (baseline only lowered); `art:catalog`,
`workshop:manifest`, build; 22 rail/map/explorer/crossing/train browser specs;
`streaming:bench -- --assert-ready` (six scenarios ready, exit 0). Game captures
(preview build, isolated data, GPU + meshes): hub with both trains, a train under
an east/west bridge, a north/south bridge with deck shading and shadow, the S-bend
and its vertical straight, and the world atlas network.

Review: Workshop crossing fixtures are now `generated-2026-ns`,
`generated-2026-ew` and `generated-100` (new candidate ids; 42/3 removed). New
bridge orientation, deck styling, hub platforms and buffer ends await owner
review; nothing here is a Workshop verdict.

Follow-ups: buffer-stop art at track ends (ends are rounded ballast); a road may
pass between hub platforms at grade with no crossing treatment; south-neighbour
links (north/south lines) are not attempted; hub platforms do not yet connect.

### 2. City loops past the speedway

Large cities get a closed loop line with 2–3 stops (city station, speedway,
optionally motocross/park), planned together with the speedway so it passes the
spectator side. Outbound roads cross on phase-1 bridges. One or two trains
circulate continuously (closed-path services already exist in the lab).

### 3. Junctions and player-controlled switches

A rail graph (nodes, edges, turnouts) replaces the single-path service model
where lines meet: intercity lines join city loops so some services take the loop.
Switch state is world-scoped and saved, shown by a sign at the junction. Players
change it with a lever (**E / Interact / controller A**) and, while roof riding,
a **Switch ahead ← / →** button as the train approaches. Shared track needs
simple block reservation so trains never meet head-on. Inside driving (deferred
by 205) is not required.

### 4. Track variety and scenery

Double track on busy trunks, regional ballast/sleeper styles, embankments, and
level crossings with gates where traffic yields (new art, needs review). Tunnels
wait for restored rail grades and portal/underground presentation in
[world geometry](../topics/world-geometry.md).

## Review

New bridge orientation, bridge deck styling and station layouts are changed
pixels: they return to review. Chat acceptance of this plan is not a Workshop
verdict.
