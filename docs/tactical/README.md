# Implementation tacticals

Bounded implementation plans and execution records live here. Use the next
unused zero-padded number (`NNN-short-name.md`), one
delivery slice per doc, and add it to this index. Parent sequencing plans are
allowed when labeled. Record scope, validation, delivered evidence and remaining
work; preserve history rather than repeatedly rewriting completed plans.

[Topics](../topics/README.md) own continuing status and direction. The summaries
below route records as of 2026-10-03; they do not certify fresh human approvals.
Several early plans contain original unchecked lists superseded by later work.

| Plan | Recorded state / continuing owner |
| --- | --- |
| [001 Modern interiors](001-modern-interiors-plan.md) | Original parent plan; later deliveries continue in 002/003/011 and [interiors topic](../topics/patterns-and-interiors.md) |
| [002 Wall solver](002-interior-wall-solver-plan.md) | Wall checkpoint stable, 233 approved cases; retain as execution history |
| [003 Furniture](003-interior-furniture-plan.md) | Catalog/motion/depth delivered; final record reopens two reviews; consult live inbox |
| [004 World explorer](004-world-explorer-and-regional-generation-plan.md) | Milestones 1–5 implemented; [explorer guide](../world-explorer.md) |
| [005 Generator profiles](005-generator-profiles-and-shared-tile-preview-plan.md) | Slices A–E implemented; phone evidence later recorded in 012 |
| [006 Art workbench](006-art-workbench-and-city-variety-plan.md) | Delivered; city progression continues in 007 and [city topic](../topics/city-generation.md) |
| [007 Dense cities](007-dense-city-districts-and-street-life-plan.md) | Parent city sequence; approved early checkpoints, later milestones still open |
| [008 Workshop](008-tilefun-workshop-plan.md) | Delivered; [art review topic](../topics/art-review.md) and [Workshop guide](../tilefun-workshop.md) |
| [009 City places](009-city-places-and-indoor-performance.md) | v7–v10 staged for human review; indoor caching delivered |
| [010 Outdoor assets](010-outdoor-asset-catalog-and-scene-review.md) | Catalog/metadata/scene feedback delivered for review; [art review topic](../topics/art-review.md) |
| [011 Patterns and rooms](011-shared-pattern-brushes-and-room-drawing.md) | Shared drawing and saved gameplay room edits delivered; review/import/promotion remain |
| [012 Streaming and Worker](012-streaming-performance-and-local-server-worker.md) | Delivered with desktop/Android evidence; raster scheduling follow-up in [performance topic](../topics/performance.md) |
| [013 Renderer and allocation audit](013-renderer-boundary-and-allocation-audit.md) | Audit and allocation slices complete through elevation descriptors; terrain resources/handles extracted; full frame/backend interface next; [performance topic](../topics/performance.md) |
| [014 WebRTC delivery validation](014-webrtc-delivery-validation.md) | Pre-fix audit; bounded fix delivered in 015; [networking topic](../topics/multiplayer-networking.md) |
| [015 WebRTC ordered delivery](015-webrtc-ordered-delivery.md) | Reliable routing fixes audited defects; broader investigation deferred; [networking topic](../topics/multiplayer-networking.md) |
| [016 Play ideas](016-play-ideas.md) | Delivered: hold-to-speak ideas, spoken proofreading, screenshots and private Workshop management; [play ideas topic](../topics/play-ideas.md) |
| [017 Generated traffic and roof riding](017-generated-road-traffic-and-roof-riding.md) | Delivered selectable v11 traffic, approved sprite bank and roof riding; [vehicles topic](../topics/vehicles.md) |
| [018 Tick-aware NPC separation](018-tick-aware-npc-separation.md) | Sleeping-crowd exclusion and reduced-rate separation; broader unloading remains in the [entity activation topic](../topics/entity-activation.md) |
| [019 Entity streaming and persistence](019-entity-streaming-and-persistence.md) | Active parent sequence, incremental persistence delivered: incremental records, SQLite/IndexedDB, shared tickets/readiness and lazy eviction; [entity activation topic](../topics/entity-activation.md) |
| [020 Shared record persistence](020-shared-record-persistence.md) | Phase A contract and deterministic fault tests complete; production adapters follow |
| [021 Incremental world records](021-incremental-world-records.md) | Delivered: shared coordinator, IndexedDB/SQLite, stable actor records and injected host composition; lazy residency follows |
| [022 Renderer backend decoupling](022-renderer-backend-decoupling.md) | Prepared parent sequence, awaiting start signal: five milestones, just-in-time children and end-to-end completion gates; [rendering architecture](../topics/rendering-architecture.md) |

| [024 Interest and residency](024-interest-and-residency.md) | Next: shared tickets/readiness, lazy indexed hydration, acknowledged eviction and complete activity coverage |

## Earlier plans

These predate the numbered convention. Their original bodies are preserved in
[the archive](../archive/README.md); their established URLs now route current
architecture or implementation status.

- [SpriteDef split — implemented](../SPRITEDEF-SPLIT-PLAN.md)
- [Slow-field protocol deltas — implemented/evolved](../WIRE-PROTOCOL-DELTA-PLAN.md)
- [Current physics architecture](../3D-PHYSICS-DESIGN.md)
- [Current spatial indexing/tick scheduling](../SPATIAL-OPTIMIZATION.md)
- [Current client/server boundaries](../client-server-architecture.md)
- [Current trusted scripting API](../SCRIPTING-API-DESIGN.md)
- [Archived physics drift plan](../archive/physics-sim-drift-reduction-plan.md)
