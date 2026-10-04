# 063 — Curved train routes and town loops

Status: implemented for human review; validation recorded below.
Owner: [trains](../topics/trains.md).

The user requested trains that turn corners, circle towns and take curved routes
between towns, and authorized implementation and a commit. Their earlier requirement
to review new railway motion/layouts before overworld integration still applies.
The generated crossing was accepted in chat (“All seems fine”). No Workshop verdict
has been manufactured.

## Delivered slice

- Shared `RailwaySystem` accepts a world-pixel alignment made from tangent-connected
  straight segments and circular arcs. Radius is at least 192px. One service has
  exclusive use of each alignment; this does not introduce switches or signalling.
- Three rigid carriages each follow the chord between their own two bogies. Their
  reference distances stay 112px apart. The service progresses by arc length,
  wraps closed routes without teleporting and reverses only at open-route termini.
- Named distance-based stops brake, dwell eight seconds and depart. Through stops
  preserve direction; a loop circulates through every stop in either direction.
- Each body uses a heading-dependent conservative AABB and 40px height. All bodies
  must pass swept collision, flat-ground/readiness and wheel-track checks before
  any move. Children, props and deleted rail cells stop the entire service.
- One service record stores distance, next stop, direction, speed, dwell, deletion
  and exact route identity. Restoration derives all body poses before publication;
  retirement and deletion remain atomic. Dependency tickets extend in both axes.
- Orientation uses the existing replicated sprite orientation row (256 heading
  frames). Authority, snapshots and delta replicas reconstruct the same collider;
  stopped trains retain their heading. No wire-protocol version change is needed.
- Both Canvas and GPU use the same procedural geometric train representation.
  Bodies are 96×28px, with 16px inter-car gaps and small couplers. These are
  deliberately schematic bodies, not distorted/rotated horizontal source sprites.
  The immutable native train bank and old preview renderer are untouched.
- The World geometry lab hosts both fixtures through production Realm/Worker,
  streaming, replication, persistence and shared presentation. Its static diagram
  draws rails, sleepers, platform markers and a town layout placeholder. It does
  not simulate motion. Both new candidates are registered as engine experiments.

## Review

- [Town loop with four stops](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=train-loop#/tool/world-geometry)
- [Winding inter-town route](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=train-winding#/tool/world-geometry)

Use Whole route / Follow train, pause, opposite direction and save/reload mid-bend.
Mobile controls retain long-press suppression. Review the bend radius, train scale,
carriage spacing and schematic representation before choosing the production art.
Platforms are layout markers, not finished station buildings or boarding logic.

## Boundaries

Curved services currently run on level ground. Combining curves with the existing
train grades, route search around terrain, road crossings along loops, branching,
multiple services on one track, boarding and curved-route world generation are
subsequent slices. Existing generated horizontal services and generation output
are unchanged; no generator version bump or world deletion is involved.
The current route adapter retains legacy start/end/y fields for straight routes;
curved motion/querying uses the explicit alignment and its bounds.

## Evidence

- Typechecks pass. All **1,549 unit tests in 184 files** pass with two workers.
  The initial unrestricted run timed out in an existing furniture test while
  other validation was running; the complete bounded-concurrency rerun passed.
- Full bundled-Chromium suite: **363 passed, 1 skipped** in 10.1 minutes.
  The three new checks cover actual Worker motion, pause/reload in a bend,
  reverse starts, both layouts, Canvas/GPU and phone controls/cleanup.
- `streaming:bench -- --assert-ready` passes for the current generator, with
  no errors or readiness failures. This is a game-streaming regression check,
  not a performance claim for future generated curved networks.
- Art catalog regenerated, then all **574 Workshop candidate identities**
  verified in normal Chromium at retina scale. Production build passes.
- All 22 changed TypeScript/test files pass scoped lint with no diagnostics.
  Repository-wide lint has one pre-existing formatting error in
  `docs/tactical/053-semantic-tileset-map/mapping-registry.json`, also reproduced
  from its unchanged HEAD blob (plus the existing 117 warnings/32 infos).
  That unrelated generated registry is untouched.
- Screenshots of diagonal carriages, both full-route layouts and the phone view
  were inspected. Train bodies remain geometric proposals; no native asset bank
  was rewritten and no human art approval was inferred.
- Final browser/build validation used a frozen tracked-source and asset copy
  with isolated test auth/data and ports, because another task was editing the
  shared worktree. The copy uses the exact train changes; harness port changes
  are not part of the commit.

Unit tests cover tangent continuity, invalid geometry, continuous loop seams,
both directions and complete circuits, every station, through-stop behavior,
mid-bend reload, collision, missing track, readiness, retirement/deletion, and
replicated stopped orientation/collider reconstruction. Browser pause/reload
checks wait for queued Worker ticks to settle before comparing poses.

Next: human review of both motion fixtures, then bounded curved-route generation
with road/rail clearance planning and an explicit rolling-stock art choice.
