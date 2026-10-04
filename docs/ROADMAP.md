# Roadmap

Direction as of 2026-10-04. This is a short project overview; the linked topics
own current status and next work. Ideas are not commitments: see the
[backlog](ideas.md), [playtester feedback](todo-from-playtesters.md) and
[long-term vision](VISION.md). [Tactical plans](tactical/README.md) preserve
implementation scope and evidence.

## Current work and next checkpoints

| Area | Delivered | Next checkpoint / owner |
| --- | --- | --- |
| Streaming and execution | Shared single-player Worker authority, terrain preparation, desktop and Pixel 7a traversal evidence | Bound offscreen raster work, improve cold entry and broaden device coverage; [performance](topics/performance.md) |
| Rendering and 3D exploration | Optional GPU gameplay renderer and shared diagnostic mesh-car presentation; Canvas stays default, top-view appearance remains unresolved | Improve car reconstruction and measured GPU submission costs; [3D assets](topics/3d-assets.md), [engine checkpoints](topics/rendering-architecture.md#open-engine-checkpoints) |
| Entity persistence and unloading | Tick-aware NPC separation; target architecture researched and documented | Incremental entity saves first, then shared tickets/readiness, lazy residency and eviction; [entity activation](topics/entity-activation.md), [planned sequence](tactical/019-entity-streaming-and-persistence.md) |
| Regional cities | One current explorer/game generator, explicit same-seed recreation, approved dense neighborhood and v6 commercial streets | Review thirteen staged v7–v10 parking/park/architecture/pedestrian views; [city generation](topics/city-generation.md) |
| Road vehicles | Approved 180-view bank, gentle generated-road traffic and roof riding in the current regional generator | Playtest the Traffic playground and current density/turning/jumps; [vehicles](topics/vehicles.md) |
| Generated railways | First horizontal two-town service with furnished platforms and a saved reversing train | Station information and boarding; review larger networks and structures before expansion; [trains](topics/trains.md) |
| World geometry | Accepted car grades; per-carriage train bridge/tunnel proof | Review train heights, clearance and horizontal-art joins; then select one generated structure crossing; connected indoor levels remain open; [use cases and open decisions](topics/world-geometry.md) |
| Workshop and source art | Unified review inbox, authenticated feedback, source catalog and outdoor metadata/scene annotations | Address exact recorded feedback and review candidate geometry; [art review](topics/art-review.md) |
| Play ideas | Public text/screenshot suggestions, hold-to-speak input, spoken proofreading and private Workshop management | Try recognition and readback on the child's device; [play ideas topic](topics/play-ideas.md) |
| Patterns and interiors | Shared semantic brushes, persistent gameplay room editing, furniture and static-layer caching | Review gameplay room editing and tree kit; explicit prefab import/promotion next; [patterns and interiors](topics/patterns-and-interiors.md) |

New regional worlds use regional-v13. Retired saves can be recreated with the same
seed; exact review scenes remain archived. City candidates require explicit approval
and promotion before current-generator inclusion. Read the live
Workshop inbox for decisions after the documented checkpoints.

## Continuing product direction

- After city candidate acceptance: farmers markets, then broader parks, frontage
  variety and richer street life. The [parent city plan](tactical/007-dense-city-districts-and-street-life-plan.md)
  records the sequence and deferred scope.
- Multiplayer already supports collaborative editing, browser-hosted P2P and
  dedicated servers. Dependent WebRTC updates now use reliable ordered delivery
  to prevent the audited missing/ghost/stale-world defects. Broader network
  investigation is [deferred](ideas.md#deferred-networking-investigation);
  connection/reconnection UX remains an opportunity. Public-server
  authentication remains separate from player profile identity; see
  [networking status](topics/multiplayer-networking.md).
- Build on the existing terrain, prop, furniture and room editors with curated
  content and simpler child-friendly interactions. Saved-world naming, switching
  and deletion confirmation exist; broader destructive-edit safety remains open.

Other gameplay, terrain, visual effects, asset protection and platform ideas live
in the [ideas index](ideas.md), with their original sources and caveats.
