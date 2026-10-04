# Terrain heights, slopes and stacked spaces

Topic: world-geometry
Status: first shared-engine ramp/deck/passage proof implemented; broader terrain and interior representation remains open.
Updated: 2026-10-04.

Owns the physical world model for terrain, ramps, stacked floors and passages.
[Physics](../3D-PHYSICS-DESIGN.md) documents existing movement;
[rendering](rendering-architecture.md) owns presentation;
[city generation](city-generation.md) and [trains](trains.md) are consumers.

## User direction

The 2026-10-04 discussion asks us to think beyond a special-purpose railway
tunnel before implementing structures. Record potential uses first, then choose
the smallest coherent model that supports them. This is design exploration,
not a commitment to implement all the examples below. The user subsequently
authorized the first bounded engine/lab slice and its commit.

- Keep the world strongly tile-based, including terrain generation and editing.
- Support actual terrain elevation and slopes: a generated mountain range should
  have traversable inclines where appropriate, not just tall scenery props.
- Support ramps into underground parking and onto above-ground parking levels.
  Several usable floors at the same map position may be necessary.
- Bridges and tunnels are early consumers of the broader model.
- Support underground cutaways and selecting which levels/sectors are rendered.
  The user also wants to explore seamless movement between indoor floors/levels;
  connected stacked spaces should serve interiors as well as outdoor structures.
- Avoid the full flexibility and authoring burden of a voxel or arbitrary solid
  modeling engine. The user suggested Doom/sector-style spaces as an analogy
  for a constrained model, not a requirement to reproduce a historical engine.
- Prefer authoring surfaces/floors/ceilings and connected spaces rather than
  requiring authors to define solid volumes. In the follow-up discussion, the
  user confirmed this as the intended direction; the exact representation and
  internal collision machinery remain open.

The earlier assistant suggestion to use solid volumes is a candidate, not a
settled decision. Drawing layers already exist, but drawing order alone does
not establish physical support, a ceiling, or which stacked space an actor is in.

## Potential use cases

These are capability probes, not a committed content roadmap. The final column
states proposed questions to use when comparing representations.

| Use case from the discussion | What the model should be able to express | Design question / useful proof |
| --- | --- | --- |
| Generated hills and mountain ranges | Tile-based elevations with sloping patches, flat areas and steep boundaries | Do neighboring slope tiles meet without gaps or unexpected steps? How are steep, impassable slopes distinguished? |
| Ramp down to underground parking | A continuous route from street level to a lower floor beneath usable ground | Can a car descend without terrain collision pushing it onto the surface above? Is overhead clearance checked along the ramp? |
| Above-ground parking garage | Ramps connecting several usable decks, including ground below an upper deck | Can actors share map coordinates on different floors without colliding or snapping between levels? |
| Road/rail bridge or underpass | Independent routes above and below a crossing, with usable approaches | Can cars, trains and pedestrians pass at their own elevations, with sufficient clearance? |
| Tunnel through raised terrain | An enclosed passage with entrances and connected floor/ceiling boundaries | How does a declared passage override the normal blocked space beneath terrain without arbitrary voxel carving? |
| Underground cutaway and level inspection | Reveal the occupied space beneath terrain/ceilings, with explicit level/sector selection for inspection | Can each observer see their relevant space without changing collision or hiding a connected ramp midway through traversal? |
| Seamless multi-level interiors | Connected indoor floors, stairs/ramps and openings in one continuous traversal | Can an actor move between levels while both remain visible where needed, without an abrupt floor switch or unrelated space appearing? |
| Town railway loop with several stops | Connected track, turns, stations and separated crossings of outgoing roads | Can each carriage follow the route's height and heading, including a grade transition? Turning artwork remains a separate concern. |

Derived checks for these examples include walking off a deck, jumping beneath
a ceiling, collision at exposed floor edges, and reaching the same level by a
different ramp. They are not requests for arbitrary caves, destructible solids,
free-form overhangs or unlimited stacked layers.

## Existing foundation and limits

- `Chunk.heightGrid` already stores terrain elevation per tile; elevation is not
  solely implemented with props. Current terrain sampling resolves one height
  per tile rather than a sloping surface or a stack of navigable spaces.
- Entity `wz`, shared height-overlap checks, finite-height prop colliders and
  walkable tops already support parts of this problem. Preserve the shared
  authority/prediction path rather than starting a separate tunnel simulation.
- Current terrain support treats ground beneath a footprint as a blocking base.
  Merely adding a lower floor does not make a usable underground passage.
- Optional mesh presentation can help show orientation and inspect geometry.
  Choosing a GPU renderer does not itself add ramps, stacked support or tunnels.

## Agreed direction; implementation to investigate

The 2026-10-04 follow-up confirmed directional alignment with this approach:

- Keep ordinary landscape simple: one ground surface per tile, with constrained
  slopes for hills and mountains.
- Add bounded extra surfaces or connected floor/ceiling spaces where bridges,
  tunnels and buildings need them. Complexity should be local to those features.
- Connect levels continuously with ramps and explicit entrances; retain enough
  identity/connectivity to distinguish actors occupying different stacked spaces.
- Support several floors rather than hard-coding a ground/underground pair.
  Arbitrary geometry and unlimited layers are not goals.

A bounded stack of tile-aligned surface patches or connected sectors is the
starting design to investigate within that direction. A patch could describe a
flat or sloping floor; an enclosed space could also supply a ceiling and boundary
connections. Decide whether sector footprints must follow whole tiles or may
use a small set of sub-tile shapes.

This could let authors specify floors, ramps, ceilings and openings while the
engine derives the collision boundaries or slab thickness it needs. Derived
physical geometry is different from requiring users to model solid volumes.
No particular internal collision representation is selected yet. "Floating
surfaces" describes a possible authoring model, not permission to omit underside
collision, walls, headroom or the distinction between solid terrain and a passage.
Connectivity, collision and visibility remain real design work even with a
constrained representation. The first engine proof is authorized; world-generation
integration and the broader capability list remain future work.

## First engine proof

[World geometry lab](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/world-geometry)
contains a tile-aligned ramp, a 48px raised deck and a ground-level passage below.
[Tactical 051](../tactical/051-world-geometry-proof.md) owns the slice and validation.
It uses production Realm/Worker replication, prediction and the shared embedded
presentation host. Schematic geometry is registered as an experiment, not approved
art. Normal worlds and generation output are unchanged.

- `SurfacePatch` describes a rectangular planar top, constant vertical slab
  thickness, surface/space identities and neighboring patch IDs. An optional
  `PropCollider.surface` carries it through current spatial queries, replication
  and definition-backed persistence. This is a storage adapter for the proof,
  not a decision to represent all future terrain as decorative props.
- Shared queries evaluate exact plane extrema across the actor footprint.
  Movement checks support and headroom together; landing accepts only a top
  descended through; upward jumps stop at the slab underside. Tests cover ramp
  ascent/descent, deck edges, lower passage, clearance, prediction and reload.
- Player saves now preserve absolute height, support height and vertical velocity.
  Explicit realm arrivals clear airborne state; older saves remain readable.
- Shared surface presentation supplies automatic observer-local cutaway and
  manual lower/upper/all inspection through the existing Canvas/GPU overlay path.
  Game outdoor rendering and scenario hosting consume the same implementation.
  Hiding a slab never modifies physics. The first reveal hides a whole patch;
  it is not a general portal/occlusion algorithm or a polished terrain cutout.
- Space identity is attached to static surfaces and support is derived from
  footprint/height. Neighbor IDs describe intended joins; they do not yet enforce
  portal traversal, navigation or persistent actor sector membership.

Limits: flat ordinary terrain remains the blocking base, and legacy tile
solid/water flags still apply. This proves a raised passage, not excavation
beneath terrain or a complete bridge-over-water system. The fixture exercises player locomotion;
NPC navigation, train grades, projectile slab collision, arbitrary stacked-actor
draw ordering and the separate 3D debug renderer need their own integration.
Existing indoor realms are unchanged. The first diagnostic renderer uses the
fixed game projection; a free camera is not delivered.

## Prior art informing the direction

- [OpenTTD's landscape implementation](https://docs.openttd.org/source/d0/d94/landscape_8cpp)
  provides a close terrain/transport precedent: tile slopes and height queries
  that distinguish ground from vehicle travel height at bridge/tunnel entrances.
  This is not a complete model for walkable multi-storey interiors.
- [EDuke32's true room-over-room mapping guide](https://wiki.eduke32.com/wiki/True_Room_Over_Room_Mapping_Guide)
  describes physically stacked sectors, linked floors/ceilings and slopes with
  restrictions. It is a closer reference for connected stacked rooms than simply
  copying the original Doom model.

These establish precedents for the ingredients, not a ready-made Tilefun schema.
Use them to inform constrained authoring and geometry semantics without adopting
historical renderer restrictions as requirements.

## Open representation questions

Resolve these questions before choosing a schema:

1. How are slopes stored: corner heights, a limited ramp vocabulary, or local
   planes? How do joins, diagonal slopes and terrain cliffs work?
2. How are stacked spaces connected and identified? A bare list of heights must
   not cause an actor to select an unrelated floor above it.
3. Which surface faces block movement, and how are walls, undersides, exposed
   edges and headroom expressed or derived? Floating floors alone leave these
   semantics unspecified.
4. What is the default space beneath ordinary terrain, and how does an authored
   garage or tunnel declare a passage through it?
5. What limits keep editing, chunk queries and streaming predictable? Parking
   garages need more than a hard-coded surface/underground pair, but unlimited
   overlap is not a requirement.
6. How do terrain, roads, tracks, buildings and actors share the same geometry?
   Keep support/collision, navigation and visual occlusion distinct consumers.
7. What space identity and connection data does presentation need for cutaways,
   selected-level views and seamless indoor transitions? A global height cutoff
   alone may hide connected ramps or mishandle overlapping spaces.

## Visibility and seamless interiors

The intended direction includes automatic cutaways for an underground/interior
observer and explicit level/sector visibility selection. The World geometry lab
now demonstrates whole-patch reveal and lower/upper selection. General sector
selection, clipping/fading and gameplay controls remain design choices.

Geometry owns physical surfaces, space identity and connections. Shared
presentation uses those facts plus the observer/camera to decide what to reveal;
renderer backends draw that result. Hiding a ceiling or upper floor must not
remove its collision, unload actors or change authoritative space membership.
Different players may need different cutaways of the same simulated structure.

Do not assume exactly one whole level is visible at a time: a ramp/stair transition
or opening between floors may need parts of both spaces visible together. Test
stable transitions and readable actor occlusion in the normal game view as well
as manual isolation of levels/sectors for inspection.

Seamless indoor traversal is a future capability, not a claim about existing
interiors. [Patterns and interiors](patterns-and-interiors.md) owns the current
per-building/floor realm and door-transition contracts; how to reconcile those
with continuous connected spaces remains open. No realm migration is selected.

## Next step and evaluation

Review the first lab's walking, headroom and cutaway behavior. Next, design how
a declared underground space replaces normally solid terrain, using the garage
exercise below; do not infer excavation support from the raised-deck fixture.
Sketch connected indoor levels against existing realm boundaries before choosing
a durable terrain/space schema.

Compare a constrained surface stack with a connected floor/ceiling-sector model
against the same small examples: a tiled hillside, a garage ramp with two decks,
and a road/rail crossing with a short covered passage. Document which properties
are authored and which are derived, including awkward edges and clearance cases.
Choose a bounded design before expanding the shared-runtime proof or generation.
The next combined design exercise should be a small two-storey parking garage
with a ramp and a passage underneath: it tests slopes, stacked support, headroom
and visibility together, rather than validating only an isolated flat tunnel.
Include automatic underground reveal, manual level/sector selection and movement
between connected indoor levels in this exercise. Extend the World geometry lab
with fixtures and inspection controls over shared engine behavior.

Further prototypes should use the existing [scenario runtime](gameplay-scenarios.md)
and respect [embedded engine lab alignment](embedded-engine-labs.md). Exercise
shared collision and prediction, save/reload on ramps and below decks, chunk
seams/readiness, two observers on different levels, and the normal fixed game
view alongside geometry inspection. Maintain one current generator; do not
change saved-world compatibility or promote new art during this design record.
