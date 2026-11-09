# Roadmap

Direction as of 2026-10-04. This is a short project overview; the linked topics
own current status and next work. Ideas are not commitments: see the
[backlog](ideas.md), [playtester feedback](todo-from-playtesters.md) and
[long-term vision](VISION.md). [Tactical plans](tactical/README.md) preserve
implementation scope and evidence.

## Current work and next checkpoints

| Area | Delivered | Next checkpoint / owner |
| --- | --- | --- |
| Physics replacement | Shared 60Hz Rapier default, bounded prediction, gravity-only tuning and legacy deletion qualified on Worker/P2P/Chromebook | Playtest the simplified baseline and improve 96-NPC tail headroom; then fully oriented vehicle bodies; [205](tactical/205-physics-reset.md), [physics engine](topics/physics-engine.md) |
| Streaming and execution | Shared single-player Worker authority, terrain preparation, desktop and Pixel 7a traversal evidence | Bound offscreen raster work, improve cold entry and broaden device coverage; [performance](topics/performance.md) |
| Rendering and 3D exploration | GPU gameplay and live 3D vehicles under the fixed pixel-art camera; per-body isolated depth; WebGL2 is required (no Canvas renderer since [232](tactical/232-webgl2-only-renderer.md)) | Investigate shared scene depth and live character meshes for passengers/cargo; [160](tactical/160-live-3d-and-shared-depth-investigation.md), [rendering](topics/rendering-architecture.md#open-engine-checkpoints) |
| Entity persistence and unloading | Tick-aware NPC separation; target architecture researched and documented | Incremental entity saves first, then shared tickets/readiness, lazy residency and eviction; [entity activation](topics/entity-activation.md), [planned sequence](tactical/019-entity-streaming-and-persistence.md) |
| Regional cities | One current explorer/game generator, explicit same-seed recreation, approved dense neighborhood and v6 commercial streets | Review thirteen staged v7–v10 parking/park/architecture/pedestrian views; [city generation](topics/city-generation.md) |
| Road vehicles | Shared rolling driving, ordinary autonomous road traffic, seats, placement and durable poses; [209](tactical/209-car-driving-and-autonomous-traffic.md) | Owner play review of restored equipment and ambient traffic ([222](tactical/222-shared-physics-dump-bed.md), [224](tactical/224-shared-physics-towing-and-transporter.md), [225](tactical/225-speedway-racers-and-shopping-visits.md)); [vehicles](topics/vehicles.md) |
| Generated railways | Shared-physics services and station recall (218); regional network linking most neighbouring towns with hub platforms and road bridges in both orientations ([228](tactical/228-rail-network-loops-and-junctions.md) phase 1) | Owner play review, then city loops past the speedway and switchable junctions (228 phases 2–3); [trains](topics/trains.md) |
| World geometry | Accepted car/train grade proofs; generated road bridges with roof-passenger clearance | Consider underground station access; connected indoor levels remain open; [use cases and open decisions](topics/world-geometry.md) |
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
