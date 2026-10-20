# Foraging and lookouts

Owner authorized rabbit, robin and meerkat behaviors, action animation, ordinary
world/manual integration and Animal Browser demonstrations on 2026-10-20.
Commit and push after verification. The [behavior topic](../topics/wildlife-behaviors.md)
and canonical ledger own ongoing progress.

The retained review batch remains `wildlife-v2-behaviors-157`. Concurrent browser
audit 157 and migration 158 reached main during verification, so this execution
record uses 159. The original [authorization path](157-foraging-and-lookouts.md)
remains as a compatibility link; immutable art, receipts and review IDs are unchanged.

## Scope and acceptance

- Rabbit: approach a finite edible plant with native hops, nibble actual units,
  pause alertly between bites and abandon the meal when threatened.
- Robin: descend from a real native tree perch, peck finite ground food, consume
  it once, and return to a currently supported canopy. Tree removal cancels the
  return; no floating perch or teleporting.
- Meerkat: rotate lookout duty among nearby group members, rear and scan,
  detect an actual edible-prey predator at extended range and give a visible
  alarm; group members interrupt activity and escape away from the threat.

Use shared Realm authority, native collision-resolved motion and durable animal
work/resource records. Natural food is finite, editor food is placeable and
manual animals get no hidden resource spawning. Preserve natural-only delayed
distant prey replacement and companion/player protections. Changed animation gets
new retained source/review identities; existing banks remain immutable.

## Verification plan

Production scenarios cover trigger/action/outcome, target facing, interruptions,
contention, readiness, changed tree support and save/reload. Canvas/GPU browser
cases cover displayed action and persistence. Run standard typecheck, full units,
lint, inventories, build, affected browser cases and streaming readiness. Record
actual results and keep human approval separate from automated verification.

## Execution

Baseline audit: the existing rabbit action was an ear alert; robin action was
a song. Feeding poses and meerkat upright scan required new clips while native
travel could be retained. Workshop inbox and art notes had no pending requests.


Implementation checkpoint: all ten new production authority tests pass, including
mid-bite reload, finite plant stages, competing rabbits, deleted animals, blocked
and unready goals, removed canopies before/during return, harmless-animal sensing,
following protection and natural-resource query-order invariance. A cold affected
run passes 68 tests across work, native motion and scenario authority. Typecheck
and lint pass (existing warnings).

All 231 earlier wildlife review objects remain exact. Four new pending identities
retain 123 pinned artifacts. Isolated minimal-input replays reproduce 37 public
artifacts byte-identically. Bundled full Chromium verifies all 524 animal poses
at native and 3x sizes (1,048 exact crops) and review controls. Independent saved
Blender audits check unchanged local mesh geometry and 684 meerkat fixed-length
endpoints with maximum gap below 0.000001 world units, plus planted hind feet.
The unpublished gallery page encoding/labels were corrected before the commit;
all 19 raster artifacts remained unchanged. No human approval is inferred.

Final validation is recorded below and in [the evidence summary](159-foraging-and-lookouts/validation.json).


Integration corrections: a consumed resource could remain visible because the
physics tick still held its pre-AI actor list and reinserted a despawned actor
into the spatial index. EntityManager now discards stale admitted entries before
physics. A production test failed on the actual spatial ghost before this fix
and passes after it. This also protects other same-tick consumptions.

Dense native robin groves made six new food actors per bird excessive: initial
record pressure could pause authority and prevent generated predators hunting.
An initial correction tried bounded dry sites and stopped after one finite
patch per forager; the final shared robin-patch rule is recorded below. Original
crow/squirrel stocks remain unchanged. The
natural-food test enforces that population bound; generated predator hunting is
rechecked rather than increasing persistence or planning budgets. Browser reload
assertions compare saved poses independently of reassigned numeric runtime IDs.

Loose food also exposed an acquisition issue: inert resources occupied slots in
the existing bounded predator sample. Shared AI now excludes WorkItem materials
from hunt candidates while preserving the 24-candidate planning quota and every
creature/player food-web protection. The added production regression compares
an actual spider hunt with zero versus 64 loose seed actors and requires the
same hunt trajectory and meal.

All seven new Canvas/GPU browser checks pass after the indexing correction:
feeding, plant removal, real perch return, lookout alarm, group escape, saved
poses and six Animal Browser demonstration links.


The full 1,731-case browser sweep found shared resource thumbnails missing at
desktop and phone sizes. EditorPanel treated entity types as sheet keys and
always sampled column zero; forage definitions share an atlas with distinct
initial columns. It now resolves the definition's sheet key and initial clip
frame. After 601 successful cases the sweep was checkpointed to apply both
corrections, then resumed using Playwright's exact completed-test exclusion
list (1,130 remaining cases). Final exhaustive picker results are recorded below.

Two additional residency regressions reproduced stale unparented food claims
after independent resource/claimant eviction. A ready loose resource is now
reclaimable when its claimant is absent or has cancelled that task; returning
actors revalidate ownership before consumption. Both regressions failed before
the correction and pass afterward. All 13 MeadowWork tests and 35 related
work/lifecycle checks pass. Carried/parented inventory retains its existing
group ownership. Final source typecheck and lint pass; the regenerated manifest
verifies all 1,856 candidates in normal retina Chromium and the build passes.

Capture review also caught an over-tight common camera: the robin's return
perch sat above the viewport, and the rabbit's food approached the bottom edge.
Each new demonstration now has its own framing. The robin view includes canopy
and ground together; the meerkat view includes the initial group with room for
the approaching predator. Original dog/crow/squirrel zoom is retained. Browser
assertions require complete initial animal sprite bounds, the feeding pose and
the robin's returned perch to remain visible in both renderers.

The broad browser run also reproduced the exact explorer adapter's 128-actor
cap in two dense forest footprints (167/159 actors with one seed per robin,
86/85 without new food). A measured sparse correction shares one finite seed
patch per occupied chunk, retaining every animal and the original query cap.
The same footprints then contain 124/127 actors. Both production adapter tests
failed before the correction and now pass. All 132 final authority checks pass,
including the 15 MeadowWork cases, carrying/lifetime and generated hunting.
The actor, persistence and planning caps remain unchanged.


## Final validation

All 132 final authority checks pass, including 15 new MeadowWork cases. The full
unit run recorded 6,063 passes, seven failures and ten skips: five are the known
Windows symlink/SIGKILL limitations. The aquatic saved-queue comparison was
corrected to compare durable identities (85 cold checks pass); the Workshop
service timeout passes all 13 cases cold. No introduced unit failure remains.

The 1,731-case browser sweep completed across exact resumed-test lists: 1,725
passed, five failed and one optional atlas-capture test skipped before the final
rechecks. Three explorer failures reproduced the now-corrected forest actor cap;
one forced P2P-close send counter and one flatbed boarding case passed cold
without production changes. All ten final explorer/reconnect/flatbed browser
checks pass. The final coverage record includes those rechecks and the completed
six-entry Game/lab verified filter. New demo/picker coverage passes 18 cases,
including Canvas/GPU framing, reload and all desktop/phone thumbnails.

Final types, lint (existing warnings), build, normal-retina 1,856-candidate
manifest and streaming readiness pass. All 231 prior review objects and 123 new
receipt pins remain exact; 16 candidates were added and none removed. Six
signature mechanics are automation verified in the ledger; human review stays
pending. Next logical slice: a bounded climbing-and-fruit pilot after reviewing
these demonstrations.


## Rebased integration

Rebased onto e98bd2cc, preserving the concurrent browser-test migration. Its
shared-sheet editor correction is equivalent to this batch's fix. The current
collection is 815 browser cases; all 403 audit decisions remain intact. Seven
focused new browser cases retain the Worker/renderer/DOM boundaries, while 15
new authority cases own the portable semantics. The original 1,730-pass browser
coverage above is historical evidence from before that test-only migration.

On the combined source, typecheck/lint/build and the normal-retina 1,856-candidate
manifest pass. All 26 affected browser cases, three real HTTP/WebSocket cases
and the browser-free image comparator pass. The full native run has 6,389 passes,
six failures and ten skips across 6,405 tests (578.47 seconds). Five failures are
the known Windows limitations. The sixth is an intermittent existing junction
queue assertion: its entire seven-test file passes cold; focused runs pass
three times then fail on both this branch and an isolated, unmodified e98bd2cc
source snapshot. No vehicle production change was made for that baseline issue.

All 123 retained artifact pins and 231 prior wildlife review objects remain
exact after rebase. The three concurrent vehicle documents were restored
byte-identically. Original source/review batch identity 157 and its authorization
link remain intact; canonical execution/evidence now use 159.


Final integration also includes 0a3201ec from main: test-only waits for local
boot completion and bounded junction completion. The updated seven-test traffic
file and real P2P-menu browser case pass, and the 815-case inventory verifies.
This corrects the parent junction fixture noted above; production code and all
retained art remain unchanged. The raw full-suite record is preserved rather
than relabelled as a newer full run.
