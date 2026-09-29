# Interior wall solver and rapid visual review

Status: proposed architecture; review loop operating; first compact stress set added.
Date: 2026-09-28.

## Objective and working agreement

Compile varied indoor plans into coherent walls, junctions, and openings, including
thicker walls, while keeping human review fast enough to guide every increment.
A successful compile is not evidence that an image looks correct.

Keep the existing loop: one layout, Looks right / Wrong / Skip, optional note and
block pins, automatic persistence, pause after two failures. One useful failure
is enough to start work. The reviewer must never need to paint a replacement,
export a report, or finish a large batch before the next fix.

The user judges appearance. Agents turn that feedback into reproducible examples,
structural assertions where possible, fixes, and a short next review set. Agents
must not label their own generated images visually approved.

## Evidence from the current implementation

- `ApartmentArchitecture.ts` chooses axis, face, atlas column, and placement in
  overlapping conditionals. A junction gets a single axis even when it has
  multiple arms. Later branches reconstruct its other connections.
- `sideFace` now considers an entire connected column to avoid a mid-wall flip.
  That repairs real examples, but has no explicit account of junction boundaries,
  endpoint requirements, or the reason a choice propagated.
- The sketch's two-by-two atlas expansion mixes wall alignment, projected face
  height, and leftover floor. It is not an explicit physical-thickness model.
- Handed tiles and cropped trim are useful rendering primitives, but their seam
  requirements currently live in code branches rather than inspectable metadata.
- The existing cases exercise isolated motifs more than interactions between
  motifs. An apartment failure can therefore be the first example of two nearby
  junctions, an offset branch, or a change from exterior to shared wall.

Keep `ApartmentFloorPlan.ts` as the editable input and `LayeredInteriorMap.ts` as
an initial drawing backend. Introduce structure between them incrementally.

## Proposed compilation pipeline

### 1. Normalize intent and establish structure

Produce an intermediate representation with stable, source-linked identities:

- Regions: connected room areas and exterior, independent of floor palette.
  An enclosed unpainted area keeps today's inside semantics. A true courtyard
  requires an explicit future representation; do not reinterpret blank space.
- Segments: continuous straight wall sections between structural events.
- Nodes: ends, bends, T junctions, crosses, changes in thickness/alignment, and
  other events requiring a join. A node can own several incident directions.
- Openings: intervals attached to a segment, with clearance and room adjacency.
  A doorway interrupts visible wall coverage, not necessarily its alignment.
- Provenance: sketch coordinates, segment/node IDs, and affected render bounds.

Split at changes in adjacency or geometry, but record which resulting segments
must continue the same alignment. A door or an exterior/interior transition must
not silently reset that relationship. Do not use floor letters as room IDs.

The existing sketch is a topological scaffold. Its `#` cells are not proof that
every pixel in the expanded cell should be solid. First document the legacy
coordinate convention and reproduce it in this representation.

### 2. Establish geometry and viewing policy

Represent these separately:

- Physical footprint, wall thickness, centerline/face alignment, and opening width.
- Projected wall height and the fixed camera's visible face directions.
- Cutaway policy: which faces show full height versus shallow foreground trim.
- Surface style: atlas family, cap style, and any supported material transitions.

Derive choices that are fixed by geometry and viewing policy before searching.
Left/right facing cannot be an arbitrary local choice just because both sprites
exist. Explicit continuation constraints connect segments that share a rail.

Use integer geometry on a sufficiently fine grid; avoid rounded placement that
can introduce seams. Define the conversion from physical coordinates to the
legacy rendered grid before adding another thickness.

### 3. Describe atlas pieces by their connection requirements

Create a small curated catalog for the wall family already in use. A candidate
can be a multi-tile assembly, including existing intentional source crops.
Each assembly describes:

- Covered footprint, anchor, layers, opaque area, and allowed floor underlay.
- Connection ports: endpoint position, direction, rail offset, thickness,
  face/cutaway profile, and relevant style.
- Which directions it joins and which edges it deliberately terminates.
- Provenance for source tiles/crops and a focused visual fixture.

Do not infer all compatibility from pixel equality: a transparent taper over
floor can be a valid join. Explicit port geometry establishes compatibility;
pixel seam checks supplement it for well-defined rail sections.

### 4. Solve each connected constraint component before drawing

Variables select segment profiles, junction assemblies, and doorway assemblies.
Candidate domains come from geometry, viewing policy, and available catalog pieces.

Hard constraints include endpoint agreement, continuous rail alignment, compatible
thickness/profile, legal face orientation, intended wall coverage, no unintended
floor/void spill, and unobstructed openings with the required connectivity.

Algorithm:

1. Apply deterministic geometry/policy restrictions.
2. Put affected neighboring constraints on a work queue. Remove candidates that
   have no compatible support; propagate until no domain changes.
3. If choices remain, use deterministic bounded backtracking within that connected
   component. Choose a smallest remaining domain and use stable candidate ordering.
4. Prefer a consistent style and minimal unnecessary changes among valid solutions.
   Previous appearance is a preference, never permission to violate a hard rule.
5. Validate the complete assignment, then emit layers atomically. Drawing order
   must not decide the solution or hide a conflicting placement.

Start with simple typed domains and a work queue. Add search only when a concrete
fixture needs it. A general solver dependency is not a prerequisite.

Record why a candidate was removed and which neighboring requirement caused it.
An empty domain produces a reproducible conflict explanation with highlighted
segments, source cells, and candidate incompatibilities. Distinguish:

- Invalid input or geometry, with the violated rule.
- Unsupported by the current catalog/policy, with the missing combination.
- Search budget exhausted: unresolved, not evidence of impossibility.

Never silently fall back to a plausible-looking broken join. Keep the last
complete image visibly identified as an earlier version if a new solve fails.

### 5. Introduce thicker walls deliberately

Start with two supported thicknesses, not arbitrary widths. Specify how changing
width consumes space on either side of an aligned wall, how junction footprints
are formed, and how an opening cuts through the full solid band. Recheck corridor
clearance and connectivity against that footprint.

Build the wall footprint from the union of segment bands and explicit junction
geometry, then derive exposed faces. Adjacent thick cells must not each emit an
internal face. Keep physical width independent of camera height and cutaway trim.

Before implementation, choose the authoring rule for width changes: preserve an
explicit centerline or a selected face; do not move walls implicitly to make an
atlas piece fit. Preserve current sketches through a default legacy profile.
Explicit wall masses painted as blocks need a defined import rule; ambiguous
centerlines must not be guessed differently on successive compiles.

First thickness review: straight walls, inside/outside bends, each T orientation,
crosses, doors through thick walls, narrow passages, and thin-to-thick transitions.
If the atlas cannot express a join, record that gap and make a focused artwork
or composition decision before expanding the supported grammar.

## Counterexamples and coverage

Small cases are a primary workload, not a warm-up before apartments. Usually use
3–9 cells per side, growing only to expose a longer dependency. Keep a context
ring so the highlighted interaction has the same room/exterior relationships as
the original. Show a readable focused view with a small whole-plan overview.

| Family | Perturbations that earn a separate case |
| --- | --- |
| Wall ends and bends | One-cell returns, short stubs, inward/outward turns, stepped rails |
| Nearby junctions | T–T, T–cross, opposite/same-facing branches, separation 1/2/3 |
| Door interactions | Door one cell from a corner/junction, shortest legal return, multiple openings, door beside a thickness change |
| Exterior/shared transition | Room starts or ends beside a continuing wall; shift that transition by one cell |
| Tight geometry | One-cell necks, narrow parallel walls, shallow notches, paired concave corners |
| Cycles | Small loops of connected wall segments, successive offset turns, constraints arriving from both ends |
| Thickness | Thin/thick corners and junctions, short thick stubs, door reveals, narrow clearance |
| Distant influence | Keep a pinned neighborhood fixed, alter a connected remote branch, and separately alter a disconnected component |

Generate all distinct rotations and reflections of asymmetric motifs. Recompile
with the same camera; do not rotate rendered pixels or assume visual symmetry.
Collapse floor-only variants and exact structural duplicates. Keep orientation
variants when they exercise different visible faces.

Use three complementary sources:

1. Curated minimal examples derived from actual feedback and known rule boundaries.
2. Seeded mutations: move one wall/door, shorten a return, shift a branch, mirror,
   add/remove a branch, or change one supported width.
3. Bounded enumeration of small local wall/room neighborhoods with explicit boundary
   conditions. Begin with a 3×3 variable patch and a context ring. Classify inputs
   before solving; grow bounds only when measured coverage warrants it.

Track coverage by structural signature: node arms, incident profiles, nearby
feature types, separations, orientation, and solver decision path. Use pairwise
interaction coverage to choose representatives; a large case count alone is not
progress. Preserve seeds and parameters so failures reproduce exactly.

Keep a separate invalid/unsupported corpus. Compiler errors become automatic
repros and coverage gaps, not dropped cases or human visual-review requests.
Visual batches should contain images the user can actually judge.

### Reducing a reported failure

A pin identifies a place to investigate, not necessarily the whole causal region.
Try removing unrelated rooms, shortening runs, and moving boundaries inward while
preserving topology and relevant endpoint constraints. Preserve the original
report and the chain of reductions.

If a structural assertion or solver conflict reproduces, reduction can be
automatic. For a purely visual defect, a smaller image is only a candidate repro:
ask for a quick judgment on one or two promising reductions. Do not assume that
cropping or a similar-looking seam preserves the failure. Large context may be
essential for a propagation bug.

## Keep the review cycle fast

Operating loop for each round:

1. Read the latest saved reports and confirm their fingerprints still match.
2. Reproduce one or two failures; classify topology, geometry, catalog, solver,
   compositing, or presentation as the likely source. Inspect saved pins directly.
3. Preserve originals and add minimal repros/nearby counterexamples. Add an
   executable invariant when one can express the failure faithfully.
4. Make one coherent change; run structural tests and render comparisons.
5. Publish a ready batch: changed reported cases first, then a few small nearby
   counterexamples from distinct signatures, then occasional broader integration.
6. Let the reviewer stop after one or two failures and repeat. Never require all
   variants to be reviewed before acting.

Target 4–8 candidate images per focused round, with a pause after two wrong votes.
Prioritize expected new information per judgment. Approved unchanged images stay
out of the default queue. Changed images expire their approval; historical reports
remain attached to the exact version they judged.

Retain the current one-tap controls, notes, numbered pins, offline retry, and live
page. Selecting an emoji block should reveal its rendered location. Pin metadata
should gain resolved segment/node IDs and solver provenance once available.

Add a focused crop and whole-plan locator for larger cases; preserve an option to
see the full plan. Show an optional previous/current comparison only when useful.
Do not put solver terminology in the ordinary review controls. Exact case links
and diagnostic overlays are agent/debug affordances.

Extend identity to include geometry plus explicit profile inputs without renaming
existing cases. Fingerprint final unannotated pixels, dimensions, and input intent;
store solver/catalog version as provenance, not a blanket reason to invalidate
unchanged images. Include pins in reports without including their paint in the
render fingerprint. Never carry a draft pin onto different geometry silently.

Saving a report currently does not start an agent turn. Keep the visible “say
ready in chat” instruction until a real trigger exists. Announce when a complete
batch is ready. Development reloads must not be confused with completed fixes;
preserve drafts and avoid publishing half-implemented solver states.

## Automated evidence and its limits

- Structural tests: segment/node connectivity, endpoint agreement, wall footprint,
  door clearance, room reachability, and explicit unsupported outcomes.
- Determinism: identical input/seed gives the same assignment and diagnostics;
  changing traversal order does not change the solution.
- Transform tests: rotated/reflected plans preserve appropriate topology and
  connectivity, while appearance follows the fixed camera policy.
- Locality tests: edits in disconnected components leave other components intact.
  Connected remote edits may propagate; record and explain the affected path.
- Approved regression renders: compare original pixels for unchanged fixtures.
  Expected changes get human review instead of silently replacing baselines.
- Browser tests: quick voting, pin placement, mobile focus/pan, persistence,
  fingerprint invalidation, and recovery from offline/failed compilation.

A structural pass or unchanged screenshot is not a general visual-quality oracle.
Turn recurring human feedback into narrower machine-checkable rules where possible.
Keep reporting coverage gaps, unresolved conflicts, and unreviewed changed renders.

## Delivery sequence and exit criteria

| Step | Deliverable | Exit evidence |
| --- | --- | --- |
| 0. Broaden the loop | Compact stress category using the current renderer; preserve IDs and controls | Existing cases intact; new varied small cases compile and can be voted on from a phone |
| 1. Extract structure | Plan-to-segment/node representation and optional diagnostic overlay | Stable topology and source mappings; legacy approved pixels unchanged |
| 2. Catalog the existing grammar | Named segment/junction/door assemblies with ports and profile metadata | Existing approved motifs reproducible; missing combinations listed explicitly |
| 3. Solve thin walls | Deterministic propagation, bounded search when required, conflict traces, layer emission | No drawing-order decisions; small interaction/cycle cases plus existing apartments reviewed |
| 4. Add two thicknesses | Explicit alignment/footprints, joins and full-depth openings | Clearance tests and focused thickness/transition review pass |
| 5. Expand adversarial coverage | Seeded mutation, bounded enumeration, reduction, and diverse queue scheduling | Reproducible novel failures with a bounded human review load |

Counterexample work continues during every step; step 5 automates and broadens it.
Use the existing renderer as a comparison during migration. The solver can be
introduced behind an internal switch, but a candidate must not quietly delegate
its hard cases to legacy rendering and claim solver coverage.

No big-bang rewrite, furniture work, or game integration is required to establish
this architecture. The next implementation step after the initial stress batch
is structural extraction with unchanged approved output and an agent-visible
segment/junction diagnostic view.

## Current implementation checkpoint

- Existing one-at-a-time review, two-failure pause, notes/pins, live page, and pixel
  fingerprints are implemented; see [the review guide](../interior-workbench.md).
- This increment adds 56 distinct small stress cases (142 total) to
  `ReviewCases.ts`, interleaving wall ends, short stepped dividers, and nearby
  junctions. Compact renders fit the phone viewport at native pixel scale. These are
  deliberately unapproved test inputs, not claims that the renderer handles them.
- Solver IR, port catalog, propagation/search, explicit thickness, automatic
  shrinking, and coverage-driven batch scheduling remain planned work.

### Pinned apartment follow-up, 2026-09-28

The next two reports marked joins in Strange floor plan and Offset rooms. Their
saved fingerprints matched the current render. The pins exposed three recurring
structural mistakes: treating a whole horizontal run as one surface despite a
room/exterior transition; dropping a vertical connection when both endpoint cells
were classified horizontal; and propagating facing through an exterior corner
instead of resolving the change at the actual junction. Cropped front trim also
carried an unused horizontal arm into adjacent floor/face pixels.

This increment extracts horizontal surface classification from tile placement
into `ApartmentWallSurfaces.ts`, preserves the short links, chooses visible faces
from the owning side section, and joins/crops trim according to incident arms.
This is a bounded correction toward the planned structure pass, not completion
of the segment graph or constraint solver. Pixel checks cover the marked gaps,
spurs, exterior tails, and upper corner. The approved Small and Large apartment
renders remain unchanged.

`ApartmentJoinFixtures.ts` records three candidate reductions: adjacent south
edges, a divider becoming exterior, and an exterior wall becoming shared. Their
six original/mirrored variants lead Small stress cases, ahead of the 56 broader
permutations. These reductions still require human visual judgment. The original
apartments also return for review because their pixels changed.

### Straight rail follow-up, 2026-09-28

The compact review isolated two remaining failures at facing transitions; the
mirrored adjacent-edge case and both divider/exterior cases were approved.
The defect was a 9px rail displacement between handed atlas faces. A connecting
cap made the pixels touch but did not preserve the wall's alignment.

`ApartmentWallAlignment.ts` now resolves a fixed rail position over each connected
vertical boundary, anchored to its first side section. A face can change handedness
without changing that position: its source assembly receives a pixel translation.
The compositor supports that translation independently of source cropping. Room
underlay is clipped to the owned side of the rail, and translated junction faces
are composed after the horizontal band so adjacent tiles cannot erase the join.
Continuous pixel-strip tests check both reduced failures, including the cap's
intentional outline. All currently approved renders stayed unchanged in this round.

This is the first explicit alignment constraint in the migration. The full node
and segment graph, conflicting endpoint constraints, and general solver remain
planned; anchoring a connected vertical boundary alone is not a global solution.

### Perspective constraints follow-up, 2026-09-28

The user rejected both aligned-rail candidates: the shaded face still reversed
orientation. This invalidates the earlier assumption that connected trim alone
was sufficient. `wallFacingConstraint` now derives requirements from actual
exterior exposures, including the quadrants of short endpoint connections. Shared
sections inherit the constrained facing instead of independently choosing their
room-facing sprite. Both reported small cases require west-facing walls throughout;
they do not require extra thickness to resolve that particular constraint.

The east branch of a west-facing wall now joins a straight face and top cap,
without drawing a false elbow toward the room on the west. Tests check the shaded
face for its full length as well as the rail. Door variants before/after these
transitions, with mirrors, are queued after the original six reduced cases.

There is also a genuine conflicting run in Offset rooms (column 16, rows 0–23).
`CONFLICTING_WALL_FIXTURE` reduces opposing exterior exposures to an 8×7 sketch;
its diagnostic test requires both west and east and reports a conflict. The
legacy aligned preview remains for such runs during migration, explicitly not a
solved thin-wall assignment. A two-sided or wider profile is the next design task
for those conflicts. This fixture is an automatic repro, not another image the
user needs to reject before that work begins.

Current review pool: 152 cases, including ten Reported join cases at the front of
Small stress cases. As always, one or two failures are enough for a new round.

### Mirrored upper exterior follow-up, 2026-09-28

The previous two failures and three doorway variants received explicit approvals.
The next two reports isolated the mirrored upper exterior transition, with and
without a later doorway. These exposed two remaining independent errors: a lower
room moved the entire rail into the other atlas column, disconnecting the north
corner; and the west-branch junction required four room quadrants before it would
use a straight face, so an exterior quadrant incorrectly triggered an elbow.

Consistent runs now anchor their atlas column to the first side section as well
as propagating their facing. A west branch uses the continuing east-facing profile
and its actual atlas column, including when the upper west quadrant is exterior.
Conflicting runs retain their legacy alignment pending the wider profile work.
Regression checks cover both mirrored reductions from the upper corner through
the junction, sampling the rail and shaded face separately.

Across all 152 review renders, seven images changed: the two reports, four small
stepped-divider variants, and Offset rooms. No currently approved image changed.
The public review page reopens changed reported cases automatically. Next, review
these two candidates and continue the small stepped counterexamples; the explicit
opposing-exposure fixture remains the starting point for two-sided/wider walls.

### Short ends and stepped dividers, 2026-09-28

Both mirrored exterior-transition candidates were approved. The next two reports
marked a one-cell north-attached wall end and the two bends of a short stepped
divider. The end was classified as horizontal because room floor lay below it;
that rendering classification also erased its structural connection to the back
wall. The step additionally treated its first junction as an exterior anchor even
though the partition had no exterior-facing requirement.

`ApartmentWallTopology.ts` now exposes north/east/south/west connections separately
from tile orientation. North-attached free ends receive a closed end face, and the
back-wall intersection recognizes their connection even for a single-cell stub.
Unconstrained shared runs reserve their west floor column; constrained exterior
runs keep the previously approved upper anchor. The two east-facing bend assemblies
connect the north rail to the horizontal arm and that arm to the lower vertical
rail without a false eastward elbow. This is a bounded structural migration, not
the completed node graph, constraint search, or thicker-wall implementation.

Seven existing renders changed, including both reports and their longer/stepped
variants. No currently approved render changed. Three smaller candidate reductions
(a 5×4 wall end and a 6×5 step with its mirror) extend the review pool to 155 cases.
Structural tests cover the minimal connections; pixel tests cover the marked rail
paths, spare floor, and absence of the wrong-facing elbow. The changed reports
reopen first on the public page. Continue the same two-failure review cycle; wider
profiles remain the next solver milestone after these local node rules stabilize.

### Corner-facing constraints and side ends, 2026-09-28

The north-attached stub and nearby same-side T junctions were approved. The stepped
divider was rejected again at both bends; the next report marked the horizontal
free end extending from the east perimeter. The prior step correction connected
trim but still used incompatible corner faces. Rail continuity alone was an
insufficient acceptance check, and the previous east-facing bend assembly has
been removed.

Full-height corner ports now impose explicit facing requirements on their entire
vertical runs: N+W and S+E use east-facing pieces, while N+E and S+W use west-facing
pieces. Cutaway corners impose no such requirement. Constraint sources identify
whether they came from an exterior exposure or a corner, and contradictory
requirements remain visible as conflicts. Thus both runs of the reported step
choose west-facing walls before tile placement. The horizontal arm also owns the
spare atlas column at its corner, rather than incorrectly filling it with floor.

Horizontal free ends now use a flat face and closed edge, retaining the existing
T junction at their attachment. Tests cover all four corner requirements and
sample the shaded faces as well as complete rail paths and terminal outlines.
Seventeen of the 155 renders changed; none of the currently approved renders
changed. Existing mirrored and compact step cases exercise the same rule, so no
additional review workload is needed. The public page reopens the reported step
first. Next: review these candidates, then continue the pending small cases and
the explicit wider-wall conflict fixture.

### Adjacent bends and south-attached ends, 2026-09-28

The corrected stepped divider, east-attached free end, and another nearby-T
variant were approved. The next reports exposed the quarter-turned step, where
both bend cells are adjacent, and the south-attached one-cell stub. The corner
facing requirements were already correct; placement still discarded the vertical
connection when the neighboring bend used a horizontal assembly.

Two-arm bends now take north/south connections directly from structural ports,
including when no straight wall cell separates them. This uses the same facing
and corner assemblies as the approved longer joins. South-attached free ends use
the existing tapered wall-start piece over floor, followed by the straight face;
all four orientations of free ends now have dedicated placement paths.

Seven unapproved renders changed across the adjacent-bend and south-stub variants.
All currently approved renders remain identical, and the pool stays at 155 cases.
Tests cover the two adjacent nodes, their shared profile, the full connecting
rail and shaded face, and the south stub's capped start. The public review returns
to the changed step first. Next: continue the small permutations until the local
node rules settle, then address the recorded opposing-facing/wider-wall fixture.

### Recessed cutaway starts, 2026-09-28

The next review pass approved 54 cases, including the previously reported short
link and south stub. The two new reports marked mirrored recessed exterior
corners. Their low front rails were connected correctly, but the side faces
started as full rectangles at the rail height, hiding floor where the projected
wall start should taper.

At a cutaway corner with a downward connection and no northward continuation,
placement now uses the same tapered atlas start as the approved freestanding
vertical start, over the room floor. Continuing walls retain their straight face
and existing trim. Pixel checks cover both handed starts, including exposed floor
beside the bevel, the rail, and the shaded face below it.

Eight inset-room variants and Strange floor plan changed. No currently approved
render changed; the review pool remains 155 cases. The public page returns to
the two reported corners. Next: finish the remaining inset corners, then use the
larger plans and recorded conflicting-facing fixture to guide wider-wall work.

### First two-sided profile and thick surfaces, 2026-09-28

The inset corners and remaining small junctions were approved. The large-plan
reports now isolate three structural issues: the two-row mass between bedroom and
kitchen in Strange floor plan was rendered as unrelated thin strips with void
holes; its hall floor leaked into an exterior spare column; Offset rooms still
used the acknowledged contradictory thin-face preview.

`ApartmentWideWalls.ts` adds a deterministic two-sided candidate when the thin
profile requirements conflict. It keeps fixed west/east faces and a joined wider
top inside the existing 32px footprint, preserves openings, and crops shaded faces
away on exterior sides. This replaces the provisional thin assembly as a complete
pass before drawing. Solid 2×2 wall areas contribute their exposed-side constraints
and receive a continuous top surface above the front face. Uniform atlas strips
can stretch horizontally for these surfaces; detailed sprites are not stretched.
Spare floor is emitted only on its owning room side.

This is the first explicit wider profile, not the complete graph solver, general
thickness editor, or bounded search. The new assemblies still require visual
approval. Their constraints and coverage tests distinguish two-sided wall surfaces,
wall-mass area, room floor, and exterior, and verify that doorways stay open.

Six compact original/mirrored cases cover the thick join, opposing exterior faces,
and the opposing-face wall with a doorway. Each links to its source apartment.
On refresh, changed apartment reports now route to an unreviewed compact reduction
first, retaining the two-failure pause. All existing approved renders remain
unchanged; only the two large plans changed, and the pool is now 161 cases. Next:
review the six compact candidates (one or two failures suffice), then revisit the
larger plans before expanding the profile catalog.

### Separate incoming arm height from vertical facing, 2026-09-28

Both compact mass/partition mirrors were rejected as awkward overall. That is
not approval of the two-sided profile or the broad top treatment. Inspection
found a concrete error within these assemblies: a cutaway arm joining a continuing
vertical wall was treated as a full-height branch. Its diagonal face protruded
below the low rail into exterior space.

The two-sided pass now classifies each incoming horizontal arm independently.
A low arm contributes only six pixels of trim; the continuing vertical rail keeps
its position, and its exterior half receives neither floor nor a projected face.
Mirrored coverage and pixel checks guard that exterior region. All six wider-wall
candidates and their two source apartments change; previously approved images
remain pixel-identical. Refresh reopens the first changed compact report and keeps
the existing two-failure pause.

Solver implication: a node must carry height/surface per incident arm as well as
face direction and footprint. A junction-wide "has horizontal branch" flag loses
information and cannot choose a valid assembly. The broad top treatment still
needs visual approval; if it remains awkward, isolate a straight thick strip and
one thick-to-thin corner before adding further compound arrangements.

### Outline continuity at wide joins, 2026-09-28

The next reports called the mass join improved but its outlines inconsistent,
marked the top corner of both opposing-face examples, and pinned the upper room's
boundary with the mass in Strange floor plan. The wider assembly retained atlas
outlines inside its joined white surface: a closed corner's lower stroke crossed
the wider rail, the seam filler repeated that stroke, and the arm's vertical
border divided connected top surfaces. Placement now uses the open corner pieces,
a seam with only the actual start boundary, and connected arm trim.

Mass boundaries also need subcell geometry. A `#` above a mass does not cover its
whole 32px width: its rail leaves room/face pixels beside it. The newly exposed
mass top now receives an outline up to the incoming rail. Pixel regressions cover
both handed top corners, the mass boundary, and the absence of internal strokes.

The separate Offset pin below a doorway is still an unresolved appearance report;
the outline repairs do not change that particular start. A new original/mirrored
reduction preserves a straight cell immediately below the opening. The earlier
doorway example had a low side branch there, so it could not isolate this report.
These bring the pool to 163 cases. Eight existing renders change, with every
currently approved render pixel-identical. The public refresh opens the compact
mass case and clears the stale pause. Next: review the repaired outlines, then use
the straight doorway reductions to settle the remaining end treatment.

### Remove internal mass outlines, 2026-09-29

The two new marks explicitly request removing the front rail's upper line and,
in the mirror, the horizontal and vertical lines inside the white mass. These
are connected top surfaces, so those strokes are internal rather than silhouettes.

The mass pass now removes the front rail's upper stroke wherever its top joins
the mass behind it, retaining the room-facing lower stroke and exterior corners.
It also restores the merged rail seam after replacing either half of a wider
wall. Previously the mirror discarded the seam stored in the replaced left half,
leaving the preserved right half's internal vertical border visible. North edges
remain outlined where they actually touch a room or exterior.

Pixel checks cover all three marked line segments plus their retained room and
exterior boundaries. Only the two reported compact renders and Strange floor
plan change; all prior approvals remain pixel-identical, and the pool stays at
163 cases. Next: review this connected mass surface, then continue the pending
opposing-face and straight-doorway candidates. Solver implication: outline
ownership belongs to the boundary of a joined surface, not each atlas piece or
each independently replaced half-cell.

### Approved baseline and first height sampler, 2026-09-29

The reviewer accepted the remaining mass, opposing-face, doorway, and apartment
cases and then confirmed the complete set. Commit `f802863` preserves the completed
wall/review work. `tests/fixtures/interior-approved` saves all 163 rendered PNGs
and their exact review fingerprints. A browser test traverses those cases without
posting feedback and checks every fingerprint. Baselines require human approval
to change; the new candidates are not added to them.

The new **Wall heights & arches** stage contains 12 candidates: the same isolated
partition at three heights, a native stone arch, and handed height steps, bends,
T junctions, and openings beside height changes. The direct review URL accepts
`?stage=7`. The two-failure pause, optional pins/notes, and pixel-based verdict
invalidation remain in use. Check for updates is also available outside the pause.

`ApartmentWallProfiles.ts` is an opt-in interior sampler, separate from the
approved legacy compiler. It introduces an explicit 8px wall footprint grid and
8/24/40px elevations. Connected bands form a union; exposed top/south/east faces
are emitted with atlas-sampled gray materials. Coplanar face edges cancel before
integer scan conversion, avoiding internal tile outlines and antialiasing seams.
The camera projection and footprint remain fixed when height changes. The native
arch frame is used at its authored size. Profile specifications travel with saved
feedback, so a report reproduces height choices as well as the emoji sketch.

Scope: these are appearance candidates for isolated interior partitions. They
are not a replacement for approved apartment rendering, a general collision
footprint implementation, an arbitrary-width wall editor, or a finished constraint
solver. Legacy semantic wall cells remain conservative. Exterior height changes,
attachment to legacy walls, thick profiles, and additional arch orientations need
explicit coverage after the profile appearance is accepted. No candidate is
visually approved by automated tests.

Next: use the quick review loop on the sampler, settle the projection/end treatment,
then add thin-to-thick joins and legacy-wall attachment using the accepted profiles.
