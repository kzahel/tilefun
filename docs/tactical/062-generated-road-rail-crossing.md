# 062 — First generated road-over-rail crossing

Status: implemented, validated and accepted in chat on 2026-10-04 (“All seems fine”).
Owners: [world geometry](../topics/world-geometry.md), [trains](../topics/trains.md),
[city generation](../topics/city-generation.md).

The user accepted the train grade lab, then authorized one real generated road
bridge above a railway. They explicitly waived a generator-version bump and
accepted disposable development worlds. Regional-v13 remains the current label;
no saved worlds are automatically deleted or historical output preserved.

## Review

- [Seed 100 — chunk seam](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=generated-100#/tool/world-geometry), bridge tile −627,−384.
- [Seed 42 — northern route](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=generated-42#/tool/world-geometry), bridge tile 3365,−3309.
- [Seed 3 — western route](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=generated-3#/tool/world-geometry), bridge tile −3442,−4441.

These are actual regional worlds using the current generator, generated props,
traffic network, railway controller, terrain, streaming and persistence. Only
initial player/car/train positions are staged near the crossing to avoid long
waits. Reset/opposite direction creates a fresh temporary world; save/reload
restores that world's records. The preview disables additional ambient traffic.
Ordinary fresh regional worlds generate the same crossing with ordinary service
starts and traffic population. Existing same-version saves may contain old terrain
and edits; use a fresh world or explicit recreation to inspect current generation.

## Contract

- Admit at most one north/south road crossing per straight railway line. Reject
  wet routes/approaches, station conflicts, bends too close to ramps, other roads
  intruding into the approach reservation and overlapping town blocks. Other
  unsupported conflicts still reject the line; never erase or reroute a town.
- Road footprint is 192px wide (128px carriageway plus sidewalks), with two
  256px ramps and a 128px central deck. Top is 64px, slab thickness 8px, leaving
  56px beneath for the unchanged 44px train. Ground rails remain continuous.
- Three ordinary definition-backed surface props have stable feature identities
  and world-position-derived surface connections. Discovery includes each part's
  footprint and anchor chunk. Collision, replication, draw ordering and observer
  cutaway use shared production code. No generated tunnel, earthwork format or
  custom bridge physics is added.
- Only road lanes crossing these bridges opt into surface following. Cars check
  full-body support and clearance. Cars cannot use the rail level below a road
  bridge; unsupported spawn positions are rejected. Required surface regions stop cars before a deleted or unready ramp/deck;
  they cannot fall back to the ground road. Train services remain one flat body, with existing stops and
  reversals; bridge-height pedestrians/cars do not block a train underneath.
- Generated traffic restoration resolves the graph at the saved car position,
  matching the graph used to choose its successor. The seam fixture caught the
  old lane-start lookup failing to recover a valid saved successor.
- The three Workshop candidates are registered engine experiments. Schematic
  slab/ramp drawing is retained from the accepted lab. No approved source pixels,
  bank, exact city snapshot or human verdict is modified. Finished bridge art,
  railings, supports and road markings on the raised surfaces remain future art
  work; do not represent these previews as a promoted bridge kit.

## Evidence

Focused tests cover all three seeds, both car directions,
flat train clearance, ramp reload, player traversal above/below, missing decks,
pedestrians at both heights, deterministic planning/chunk query order and durable
surface reconstruction. The existing railway suite remains in scope.

Validation on 2026-10-04: typecheck, lint and build passed; 1,541 unit tests
passed. Full Chromium coverage passed 345 browser tests with one skipped and
one strict Workshop manifest failure caused by concurrent additions through a
shared asset-directory link in the test snapshot. With tracked assets pinned,
that sole failed test passed unchanged (346 browser checks passed in total).
The committed-source build reverified all 566 candidate identities, identical to
those exercised in the browser run. New crossing checks passed for Canvas/GPU,
phone seed selection, traversal and slope reload; warm captures were inspected.
Streaming readiness reported no readiness failures or browser errors.

The commit contains only this work. Concurrent semantic mapping/animation work
and its generated asset inventory remain in the shared working tree.

## Next

Review generated placement, transitions and visibility before another structure.
A walkable underground station entrance is the next proposed slice; curved routes,
town loops, signals and boarding remain separate work.
