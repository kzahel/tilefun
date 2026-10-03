# Road vehicles: source audit and proposed approach

Checked 2026-10-03. Advice and source preparation only; driving implementation
has not started. Original Workshop request: `a582d1ba-a290-4e2a-9473-99191dac6d38`
(“cars”), selection `[0,1152,208,384]` on `me-complete`.

## What is ready

All four cardinal views exist in the committed source pixels for the six compact
cars in the request, the six adjacent buses, and the beige sedan already used
for parked cars. These are static direction views, not wheel/turn animations.
The index misses some views; missing index entries do not mean missing artwork.

[Machine-readable source inventory](vehicle-source-audit.json) records 52 source
rectangles in 13 four-direction sets, matching index keys where available and
explicit manual selections otherwise. It pins the exact PNG hash from the note.
Rectangles use native pixels `[x,y,width,height]`; compact side selections retain
their transparent padding. This is an audit, not a registered gameplay bank or
a new composed review batch. No art has been repainted, promoted or approved.

| Family | Variants audited | North/south source size | East/west source size | Runtime readiness |
| --- | --- | --- | --- | --- |
| Compact cars in the note | 1–6 | 32×64 | 64×64 padded selections | Source only |
| Adjacent buses | 1–6 | 48×112 | 112×64 | Source only |
| Existing beige sedan | 12 | 48×80 | 80×48 | East/west static props only |

Workshop source selections (native pixels; use Zoom for close inspection):

- [Six compact cars](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/art?sheet=me-complete&rect=0,1152,208,384).
- [Six buses](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/art?sheet=me-complete&rect=208,1136,416,384).
- [Existing sedan, all four directions](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/art?sheet=me-complete&rect=512,5504,176,96).

Named-index gaps in this shortlist: all twelve compact side views, all six bus
north views, and bus 6 south/west. They are visually present in the source.
Keep these manual bounds explicit until a separately reviewed indexing change.
Bus sides contain asymmetric doors; use their actual left/right art, not flips.

Still needed before runtime use: ground anchors per direction, actual ground
footprints, height and depth sorting, direction-dependent collision, and a
source-backed review of turns and road scale. Image bounds include roof/body
projection and transparent padding; they are not collision bounds. In particular,
the 112px bus length needs wider turns than a compact car. Do not shrink buses
automatically to fit a lane or assume every existing road can carry them.

## Recommended implementation, when requested

Start with ambient, slow traffic. Recommend cars yielding to children, players
and animals, with no damage, and right-hand travel as an initial convention.
Those are proposed product choices, not implemented behavior. Riding/driving a
car and boarding a bus should follow after autonomous traffic is reliable.

1. **One bounded driving loop.** Use one compact car family with four directions
   and a few cars on a sufficiently wide test block. Represent each vehicle as
   a normal replicated entity with server-owned traffic state: lane ID, distance
   along lane, speed, next turn and waiting reason. A dedicated traffic update
   owns lane following, acceleration and braking. Keep steering on the shared
   server (`Realm`, including the single-player Worker); interpolate on clients.
2. **A directed lane graph.** Compile centerlines and legal turns from semantic
   street/place plans, including width, crossings, refuge islands and reserved
   parking. Rendering tiles alone do not establish legal connectivity. Use
   distance along straight/curved paths so speed stays constant through turns;
   switch native cardinal views at deliberate facing thresholds. A four-view
   turn will have a visible pose switch: review that before commissioning
   diagonal art. Keep a stable ground anchor across direction changes.
3. **Safe spacing and junctions.** Track lead vehicles by lane; brake for their
   rear footprint, obstacles and occupied crossings. Reserve a conflicting
   intersection movement before entering and require exit space. Start with
   simple yielding, then add signals from the separately noted traffic-light
   art. Use swept ground footprints through turns, especially for long buses.
   An obstructed car waits; it must not reverse into another lane or teleport.
4. **Bounded world integration.** Admit only routes whose geometry is supported
   and whose required chunks are resident. Define stable vehicle identities,
   active-area limits, route lookahead and offscreen retire/respawn policy.
   Road/prop edits invalidate affected routes; stop safely and replan. Preserve
   existing saves and parked props. New generated traffic/output needs a new
   explicit generation revision; do not alter frozen regional-v4–v10 banks.
5. **Buses on the same system.** Give buses larger turning envelopes and a route
   of designated stops, with dwell time and a clear boarding side. Start on the
   wider avenue; validate stop access and crossing clearance before passengers.
   Parking maneuvers, ownership and player driving are later slices.

## Existing code worth reusing or extending

- `src/generation/regional/DenseDistrictPlanner.ts`: semantic streets and widths.
- `src/generation/regional/CommercialDistrictPlanner.ts`: crossings, islands,
  bays and walkways; parking is distinct from the travel lane.
- `src/generation/regional/CityWalkGraph.ts`: precedent for deriving bounded
  routes from place facts, but pedestrian connectivity is not vehicle lanes.
- `src/entities/routeAI.ts`: useful movement precedent, but its pause/reverse
  fallback and pedestrian wander component are unsuitable as the traffic policy.
- `src/generation/ProceduralActors.ts`: stable identities and residency precedent;
  currently assumes bounded waypoint routes, not a connected traffic network.
- `src/entities/Entity.ts`: current direction rows and fixed sprite dimensions
  will need a deliberate vehicle frame/anchor mapping (or padded frame bank).
- `src/generation/regional/StreetRecipes.ts`: current parked sedan E/W art;
  its promoted counterparts remain immutable.

Future acceptance should cover four-view anchor/occlusion review, no sidewalk
or island clipping, following/braking, two conflicting turns, a pedestrian on a
crossing, blocked exits, road edits, chunk-boundary traversal and unload/reload,
and two clients observing the same vehicle. Use the repository's unit, browser
and streaming checks when that implementation starts.

Audit validation: inspected the compact/bus source region and sedan source crop;
verified the PNG hash/dimensions, all 52 nonempty in-bounds rectangles and all
32 exact index references. `npm run typecheck`, all 1,216 unit tests and
`npm run check` pass (lint retains existing warnings). No runtime, render or
recipe inputs changed, so no review identities or promotion banks were rebuilt.

Next step: review the three linked source families and choose the first vehicle;
then stage a separate four-direction/turning art candidate before gameplay work.
