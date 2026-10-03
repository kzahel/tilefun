# Road vehicles: source audit and proposed approach

Checked 2026-10-03. Advice and source preparation only; driving implementation
has not started. Original Workshop request: `a582d1ba-a290-4e2a-9473-99191dac6d38`
(“cars”), selection `[0,1152,208,384]` on `me-complete`.

## What is ready

All four cardinal views exist in the committed source pixels for the six compact
cars in the original request, the six adjacent buses, and all complete vehicles
in the six follow-up selections. These are static direction views, not wheel/turn animations.
The index misses some views; missing index entries do not mean missing artwork.

[Machine-readable source inventory](vehicle-source-audit.json) records 180 source
rectangles in 45 four-direction sets, matching index keys where available and
explicit manual selections otherwise. It pins the exact PNG hash from the note.
The sets include two ladder states of the same fire truck, rather than counting
these as distinct vehicle models. Each follow-up note maps to its exact selection
and vehicle IDs. Three related fire-station/building pieces are tracked separately.
Rectangles use native pixels `[x,y,width,height]`; compact side selections retain
their transparent padding. Every vehicle view also records computed nontransparent
`visualBounds` relative to its crop, including shadows/equipment; these are not
ground footprints. This is an audit, not a registered gameplay bank or
a new composed review batch. No art has been repainted, promoted or approved.

| Family | Variants audited | North/south source size | East/west source size | Runtime readiness |
| --- | --- | --- | --- | --- |
| Compact cars in the note | 1–6 | 32×64 | 64×64 padded selections | Source only |
| Adjacent buses | 1–6 | 48×112 | 112×64 | Source only |
| Large car bank (including existing sedan 12) | 7–26 | 48×64 or 48×80 | 80×48 | Only sedan 12 E/W static props exist |
| Unindexed sedans near the gas-price digits | 7 colors | 32×80 | 80×48 | Source only |
| Police car | 1 | 32×80 | 80×48 | Source only |
| Ambulance | 1 complete vehicle | 48×112 | 128×80 | Source only |
| Garbage trucks | Green, orange | 48×128 | 128×80 | Source only |
| Fire truck | Ladder states 1 and 2 | 64×160 | 144×80 | Source only; raised ladder needs separate clearance review |

Workshop source selections (native pixels; use Zoom for close inspection):

- [Six compact cars](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/art?sheet=me-complete&rect=0,1152,208,384).
- [Six buses](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/art?sheet=me-complete&rect=208,1136,416,384).
- [Existing sedan, all four directions](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/art?sheet=me-complete&rect=512,5504,176,96).
- [Twenty large cars](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/art?sheet=me-complete&rect=512,5504,704,480).
- [Seven unindexed sedans](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/art?sheet=me-complete&rect=848,1552,576,192).
- [Police car](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/art?sheet=me-complete&rect=1712,1744,224,80).
- [Ambulance and related pieces](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/art?sheet=me-complete&rect=0,1792,448,112).
- [Green and orange garbage trucks](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/art?sheet=me-complete&rect=1280,4128,448,160).
- [Fire station and truck equipment states](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/art?sheet=me-complete&rect=2160,4000,528,336).

Named-index gaps in this shortlist: all twelve compact side views, all six bus
north views, bus 6 south/west, all 28 views of the seven additional sedans, and
the west views of cars 14, 21 and 24. All 51 are visually present in the source.
Keep these manual bounds explicit until a separately reviewed indexing change.
Bus sides contain asymmetric doors; use their actual left/right art, not flips.

The ambulance's four complete views have inconsistent vendor suffixes
(`Down_2`, `Up_1`, `Left_1`, `Right_1`); these form one vehicle. Neighboring
body/roof pieces do not establish a second complete ambulance. Police car
numeric names map to west/east/south/north as 1/2/3/4. Fire-truck ladder state 1
is the stowed traffic candidate; state 2 shows raised side ladders and remains a
stationary equipment candidate until clearance is reviewed. The station building
and truck backs in garage openings are source pieces, not driving frames or a
prepared enterable building. The fire-station request therefore remains open.

The isolated-crop check also exposes thin neighboring-source fragments at the
top of the indexed police west view and both ambulance side views. These frames
carry `preparationIssue` markers: review tighter clipping before rendering them.
Their index rectangles and source pixels are preserved, not silently cleaned.

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

Audit validation: inspected all six new annotated source regions as well as the
original compact/bus and sedan regions; verified the PNG hash/dimensions, all
180 nonempty in-bounds vehicle rectangles, 129 exact vehicle index references,
three related indexed pieces and per-view alpha bounds. Existing 52 direction
rectangles remain unchanged. `npm run typecheck`, all 1,216 unit tests and
`npm run check` pass (lint retains existing warnings). No runtime, render or
recipe inputs changed, so no review identities or promotion banks were rebuilt.

Next step: choose the first car and long-vehicle families, then stage a separate
four-direction/turning art candidate with ground anchors before gameplay work.
