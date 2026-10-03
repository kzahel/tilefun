# Roadmap

Direction as of 2026-10-03. This is a short project overview; the linked topics
own current status and next work. Ideas are not commitments: see the
[backlog](ideas.md), [playtester feedback](todo-from-playtesters.md) and
[long-term vision](VISION.md). [Tactical plans](tactical/README.md) preserve
implementation scope and evidence.

## Current work and next checkpoints

| Area | Delivered | Next checkpoint / owner |
| --- | --- | --- |
| Streaming and execution | Shared single-player Worker authority, terrain preparation, desktop and Pixel 7a traversal evidence | Bound offscreen raster work, improve cold entry and broaden device coverage; [performance](topics/performance.md) |
| Regional cities | Shared versioned explorer/game generation, approved dense neighborhood and v6 commercial streets | Review thirteen staged v7–v10 parking/park/architecture/pedestrian views; [city generation](topics/city-generation.md) |
| Workshop and source art | Unified review inbox, authenticated feedback, source catalog and outdoor metadata/scene annotations | Address exact recorded feedback and review candidate geometry; [art review](topics/art-review.md) |
| Play ideas | Public text/screenshot suggestions, hold-to-speak input, spoken proofreading and private Workshop management | Try recognition and readback on the child's device; [play ideas topic](topics/play-ideas.md) |
| Patterns and interiors | Shared semantic brushes, persistent gameplay room editing, furniture and static-layer caching | Review gameplay room editing and tree kit; explicit prefab import/promotion next; [patterns and interiors](topics/patterns-and-interiors.md) |

New worlds still default to regional-v4. Later city revisions are selectable
candidates; delivering them does not imply approval or promotion. Read the live
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
