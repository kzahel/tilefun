# City generation and promotion

Topic: city-generation
Status: one evolving regional generator; same-seed recreation for retired saves.
Updated: 2026-10-09.

## Current generation policy

The user approved dropping historical playable generator compatibility during active
development. `CURRENT_REGIONAL_VERSION` in `GenerationDescriptor.ts` is the single
regional creation/runtime version, currently **regional-v13**. It composes connected dense neighborhoods, gentle road
traffic and [rideable two-city railways](trains.md): eligible broad curves, shared
pixel tracks, platforms and straight road crossings. Natural cover now adds
spatially varied trees, solid patterned forests and ponds on eligible land.
It does not automatically promote the v7–v10 review candidates. Classic, Island and
Flat remain distinct simple presets, not historical regional revisions.

Build new features by composing the current planners, terrain, placements and actors.
During the current greenfield phase, the user explicitly allows output changes
without version bumps (2026-10-04); development worlds are disposable. Keep the
current behavior tests, deterministic replay, query-order independence, seam/geometry
checks and stable IDs for the current implementation. Old same-version terrain/edits
are not migrated: use a fresh world or explicit recreation to inspect new output.
This change does not automatically erase any saved worlds. Do not retain runtime
branches or old world-output hashes to reproduce retired versions. The version
in a save detects retired descriptors, not output drift within the active
greenfield version; it is not a promise that the old algorithm remains available.

Old worlds remain listed with a compatibility reason. **Recreate with same seed**
creates a new save ID using the current generator; it copies no edits, characters,
interiors or player positions. The original stays available for explicit deletion.
The server rejects entering incompatible worlds and skips them during automatic
resume. Both browser and dedicated-server paths use the shared compatibility policy.
The same seed identifies the input, not an identical landscape across revisions.

See [Tactical 035](../tactical/035-current-world-generation.md) for implementation
and validation; [world explorer](../world-explorer.md) for navigation and handoff.

## Exact review scenes and asset banks

Review approval remains tied to exact candidate identities. The twenty existing city
views (3 dense, 4 commercial, 3 parking, 4 parks, 3 architecture, 3 pedestrians) are
finite snapshots in `src/art/city-review-snapshots-v1.json`: plans, props, initial actor
poses and bounded terrain with a neighbor halo. `CityReviewArchive.ts` reads them
without invoking historical generators. The old descriptors are provenance labels.
The lab uses the normal renderer; the explorer can inspect the archived area, but
its handoff explicitly creates a **current world with this seed**, without carrying
an archived arrival. Outside the finite area, it asks for Current regional.
The coarse geographic background uses current geography, not a historical emulator.

Never regenerate these snapshots during builds or silently replace their pixels.
New review output needs a new candidate identity and human review. Commercial and
city-place composition experiments live in `src/art/studies/`; their geometry tests
support future authoring, without preserving historical saved-world output.

The promoted `dense-city-assets-v1.json` and `commercial-city-assets-v1.json` banks
remain immutable, with bank hash checks. The architecture bank is a candidate bank,
not an approval promotion. Builds consume committed assets. Candidate approval,
asset promotion and inclusion in the current generator are separate decisions.

## Recorded review checkpoints

- Street starter: six furniture scenes, `run=streets`; road foundations: nine approved
  source-backed scenes, `run=surfaces`. The divider is reviewed art for future use.
- Road geometry: four approved scenes, `run=road-geometry`; their commercial surface
  bank pins source cells and road IDs. Commercial streets: four approved scenes,
  `run=commercial`, originally regional-v6 seed 2026 near tile 300,519.
- Dense neighborhood: three approved views, `run=districts`, originally regional-v5
  seed 2026 near tile 300,519. Door thresholds, including secondary entrances, connect
  to the sidewalk. [Tactical 007](../tactical/007-dense-city-districts-and-street-life-plan.md)
  records the checkpoint.
- Thirteen city-place views await recorded human review: parking (v7), parks (v8),
  varied architecture (v9), people and destinations (v10). Preview people are initial
  poses; historical prompts about live movement are provenance, not a promise of
  playable old revisions. [Tactical 009](../tactical/009-city-places-and-indoor-performance.md)
  preserves their delivery history. Consult the live Workshop inbox for later decisions.

## Connected countryside and larger settlements

On 2026-10-09 the owner requested farmhouses and smaller dirt roads branching
from inter-town roads, larger denser cities, and cats/dogs in towns and cities,
then authorized proceeding. [083](../tactical/083-farms-town-pets-and-larger-cities.md)
tracks delivery and whole-world validation. Current composition now includes
connected farmsteads and durable settlement pets. Cities use a seeded 4×4 or 6×4
grid (184×168 or 272×168 tiles), connected outer boulevards, shopping bands, taller central homes, lower
residential edges and two greens; villages retain compact 2×2 grids. Additional
city rows grow northward, retaining the established +44-tile southern street
edge and keeping native southern stations and rail approaches clear. Native
promoted facades retain their threshold-to-sidewalk connections. Each block has
a pedestrian route and each green has one cat and one dog with a saved safe home
boundary. Frozen authoring layouts, promoted asset banks and archived review
records remain unchanged. Existing development worlds are disposable; inspect
new generation in a fresh world or an in-memory lab.

The [city center](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-city-center&landscape=thicket#/tool/world-geometry),
[village pets](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-village-pets&landscape=thicket#/tool/world-geometry)
and [farmstead](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-farmstead&landscape=thicket#/tool/world-geometry)
use the same production generator, shared Worker authority and persistence.
Their local traffic is suppressed to focus inspection; ordinary game traffic
remains enabled. Use the regional planning link for settlement-scale geometry.

## Next work

[Natural landscapes](natural-landscapes.md) now supplies the default regional
composition, including patterned forests, scattered trees and ponds. The owner
explicitly requested default integration on 2026-10-07. The explorer/lab retains
profile comparisons; [Tactical 068](../tactical/068-natural-landscape-preview.md)
records the initial preview delivery. Next: ordinary-world composition feedback.

[Generated railways](trains.md) now admit one isolated road bridge per eligible
line. [Tactical 062](../tactical/062-generated-road-rail-crossing.md) records the
current greenfield integration and three seeded previews. Regional-v13 remains
the descriptor by explicit user direction. No promoted art bank changed.

Continue reviewing the thirteen city-place views before promotion. Later city work
includes farmers markets, connected parks, frontage variety and richer schedules.
Performance evidence lives under [performance](performance.md); feedback rules live
under [art review](art-review.md).


The [083 completion](../tactical/083-farms-town-pets-and-larger-cities.md#completion)
records 2,048 passing units and 485/487 browser checks; the remaining two are
recorded immutable wildlife-preview failures. Native farms/pets/cities, exact
actor tombstones, both complete train journeys and streaming readiness pass.
Next: playtest farm spacing, lane approaches and city density in a fresh world.
