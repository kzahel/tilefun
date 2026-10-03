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
| [Art review](art-review.md) | Exact-source feedback, human approvals, Workshop authentication and outdoor metadata |
| [City generation](city-generation.md) | Frozen revisions/banks, approved checkpoints and staged v7–v10 city reviews |
| [Performance](performance.md) | Worker authority, traversal readiness, phone evidence and bounded terrain preparation |
| [Patterns and interiors](patterns-and-interiors.md) | Shared semantic drawing, saved room edits, furniture and pending kit/import work |

For proposed work without an active implementation, start with
[ideas](../ideas.md). The [docs map](../README.md) routes the existing guides;
they do not need to move here merely to match the directory convention.
