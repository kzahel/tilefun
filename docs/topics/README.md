# Topics

Focused, living records of continuing concerns live here, following the same
division as mclone: topics own current truth, architecture/reference docs own
durable system shape, and [tacticals](../tactical/README.md) own bounded delivery
slices and execution history.

Read the relevant topic before changing its behavior. Update status, contracts,
evidence and next work when they change. Create a sibling topic when concerns
can evolve independently; don't grow a nearby topic into a miscellaneous log.
Small standalone changes do not need a topic.

Start new topics with a clear scope, `Topic: <filename-slug>`, an honest status
and update date. Add only useful sections: current state, decisions/invariants,
code and doc pointers, validation, gaps or next work. Link detailed implementation
evidence instead of duplicating tactical histories. When a commit series uses
`Topic:` trailers, normally reuse the topic slug.

| Topic | Scope and next direction |
| --- | --- |
| [Play ideas](play-ideas.md) | Hold-to-speak gameplay suggestions, text readback, public submission and private Workshop inbox |
| [Voice agents](voice-agents.md) | Proposed companion NPC and child-directed builder sessions; live development and reload experience |
| [Gameplay scenarios](gameplay-scenarios.md) | Shared runtime recipes for interactive labs and integration tests |
| [Embedded engine labs](embedded-engine-labs.md) | Game/lab architectural alignment, shared presentation hosting and drift prevention |
| [Vehicles](vehicles.md) | Approved vehicle bank, generated traffic, roof riding and Workshop playground |
| [Trains](trains.md) | Proposed generated town railways, paired local/express tracks, stations, forks, bridges and tunnels |
| [World geometry](world-geometry.md) | First ramp/deck/passage engine lab; direction and open terrain/indoor decisions for connected stacked spaces |
| [Characters](characters.md) | Shared character definitions, Workshop motion/geometry validation, and future NPC/player integration |
| [Wildlife](wildlife.md) | Fresh high-effort animal campaign with supervised projection/motion pilots; prior campaign archived |
| [Art review](art-review.md) | Exact-source feedback, human approvals, Workshop authentication and outdoor metadata |
| [Semantic tileset map](semantic-tileset-map.md) | Whole-sheet thematic mapping, autonomous asset hypotheses and independent review for Modern Exteriors and Interiors |
| [City generation](city-generation.md) | Frozen revisions/banks, approved checkpoints and staged v7–v10 city reviews |
| [Multiplayer networking](multiplayer-networking.md) | Replication, channel routing, last-sent baselines and remaining loss/reconnect validation |
| [Rendering architecture](rendering-architecture.md) | Backend separation, resource ownership, frame lifetime and incremental renderer replacement |
| [3D assets](3d-assets.md) | Sprite reconstruction, physical/visual proxies, car investigation and model-assisted asset experiments |
| [Performance](performance.md) | Worker authority, traversal readiness, phone evidence and bounded terrain preparation |
| [Entity activation](entity-activation.md) | AI tick tiers, NPC/placed-entity unloading, inactive simulation costs and technical-debt backlog |
| [Patterns and interiors](patterns-and-interiors.md) | Shared semantic drawing, saved room edits, furniture and pending kit/import work |

For proposed work without an active implementation, start with
[ideas](../ideas.md). The [docs map](../README.md) routes the existing guides;
they do not need to move here merely to match the directory convention.
