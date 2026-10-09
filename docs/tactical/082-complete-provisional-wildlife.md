# Complete the existing provisional wildlife roster

Owner: [wildlife](../topics/wildlife.md). Started 2026-10-09.
Status: complete (2026-10-09). Owner authorized autonomous integration of all 17 remaining
existing sprite-sheet species, the same gameplay/validation procedure and commits
as delivery progresses. This is gameplay authorization, not new art production.

## Completion contract

All 22 existing species should be registered in the production game/Worker,
manual editor and shared in-memory inspection scenes. Each has suitable seeded
habitat, native animation cycles, baseline activities, harmless player/ball
reactions and durable individual state. No automatic player bounce, timed
respawns, offscreen catch-up or saved-chunk backfill. Seed/query order determines
initial populations; normal records own subsequent motion and tombstones.

Reuse committed native pixels and clip ranges unchanged. Faster escapes may use
existing motion with matched cadence; kangaroo hops require real timed push,
air and landing. Swim clips require water; amphibious animals change gait at
actual shores. Large bodies need larger clearances. Species-specific profiles
may share motion/persistence code, but retain different speeds, spacing, activity,
cohesion and habitat. Existing five species stay on their verified implementations.

Habitats use current terrain/trees and regional planning. Add wider dry clearings
and accessible sand/water refuges where necessary, without inventing art or
claiming a complete climate/biome system. Fish live in ponds; large marine animals
need broad deep-water refuges with clear shores. Keep infrastructure and solid
forest bands clear, planner dependencies acyclic, caches/populations bounded and
owner IDs stable. Existing draft motion holds/approval records remain untouched.

## Delivery sequence and tracker

| Slice | Animal | Habitat and baseline behavior | State | Commit / evidence |
| --- | --- | --- | --- | --- |
| A | Fox | Woodland edge; solitary roam, investigate pauses, tail flick, bounded escape | Complete | `518a18a`: 1,821 units, 411/413 full browser; four fox checks pass |
| B | Cat | Rural clearing; short walks, rests/action, cautious player interest | Complete | `2ae4b50`: 1,915 units, 439/441 full browser; 32 profile checks pass |
| B | Dog | Rural clearing; walks, rests/action, loose player interest | Complete | `2ae4b50`: 1,915 units, 439/441 full browser; 32 profile checks pass |
| B | Cow | Broad pasture; small groups, slow walks, tail swish | Complete | `2ae4b50`: 1,915 units, 439/441 full browser; 32 profile checks pass |
| B | Sheep | Pasture; tighter groups, walks, ear action | Complete | `2ae4b50`: 1,915 units, 439/441 full browser; 32 profile checks pass |
| B | Horse | Broad pasture; longer walks, rests, tail action | Complete | `2ae4b50`: 1,915 units, 439/441 full browser; 32 profile checks pass |
| B | Pig | Pasture edge; short walks, ear/tail action | Complete | `2ae4b50`: 1,915 units, 439/441 full browser; 32 profile checks pass |
| B | Goat | Dry meadow; loose groups, walks, ear/tail action | Complete | `2ae4b50`: 1,915 units, 439/441 full browser; 32 profile checks pass |
| C | Elephant | Wide open refuge; slow grouped walks, trunk action | Complete | `64fe198`: 1,983 units, 459/461 full browser; 20 new-profile checks pass |
| C | Giraffe | Wide woodland-edge refuge; slow grouped walks, ear/tail action | Complete | `64fe198`: 1,983 units, 459/461 full browser; 20 new-profile checks pass |
| C | Kangaroo | Open meadow; physical timed hops, rests/listening action | Complete | `64fe198`: 1,983 units, 459/461 full browser; 20 new-profile checks pass |
| C | King cobra | Dry woodland refuge; solitary slither, tongue action, harmless retreat | Complete | `64fe198`: 1,983 units, 459/461 full browser; 20 new-profile checks pass |
| C | Ant | Dry woodland floor; small colonies, crawls, antenna action | Complete | `64fe198`: 1,983 units, 459/461 full browser; 20 new-profile checks pass |
| D | Pond fish | Pond interior; swim, rest/action, dart away | Complete | `c4af030`: 2,031 units; 68 profile + four framing + six recovery checks pass |
| D | Penguin | Broad water refuge and accessible shore; waddle, swim, flipper action | Complete | `c4af030`: 2,031 units; 68 profile + four framing + six recovery checks pass |
| D | Harbor seal | Broad water refuge and sandy shore; haul, swim, action | Complete | `c4af030`: 2,031 units; 68 profile + four framing + six recovery checks pass |
| D | Manta ray | Broad deep-water refuge; swim loops, action, water-confined retreat | Complete | `c4af030`: 2,031 units; 68 profile + four framing + six recovery checks pass |
| E | Whole world | Habitat distribution, budgets, all-species game/lab parity and regressions | Complete | Four-seed habitats, all-22 residency, 2,031 units; 476/479 full browser, isolated train journey passes |

A introduces reusable profile-driven authority motion/state with one fully proven
species. B/C extend it only where behavior fits, with timed hops as a separate
movement mode. D adds water/shore profiles and habitat constraints. Each slice
updates this tracker and owning topics and commits after verification. Continue
through every row without waiting for optional human playtests.

## Verification per delivery slice

- Native asset identity/hash, dimensions, anchors and clip/cadence checks.
- Deterministic generation/query order/seams, full-body clearance, bounded caches.
- Real authority behavior, closed/edited paths, alarm recovery, no forced XY snaps.
- Saved RNG/targets/timers/phase, binary presentation, eviction/return, manual
  creation and deletion across reload. Ordinary support and explicit Jump.
- Ball body hits/ricochets versus high misses; animals remain alive and harmless.
- Production Worker inspection on Canvas/full-Chromium GPU, pause/reload and
  contact; normal-game editor creation/deletion and ball paths.
- Required `typecheck`, complete unit suite, `check`; `art:catalog` then
  `workshop:manifest`, build, complete browser suite, streaming readiness.
- Preserve all 27 exact wildlife review candidates and historical art assets.
  Record known archived fox-preview failures and intermittent train evidence;
  isolate unexpected failures without weakening checks or claiming fixes.

Use isolated test auth/data and bundled browsers, clean up test-owned processes.
No fabricated approvals/receipts. Persist progress before attempting the wildlife
status helper; its ignored campaign state is currently absent, so retain the
validated production table if ENOENT persists. The tracker owns gameplay progress.

## Execution record

Planning checkpoint: clean working tree at deer commit `3a5212b`; five species
integrated, 17 remaining. Native metadata inspected for all 17. No asset pixels,
art receipts or approval events changed. Next action: slice A, fox and shared
baseline, then continue B–E.


### Slice A checkpoint

Fox uses unchanged pilot-v2 drawing-03/motion-02, 48px cells, anchor 24,31,
125ms idle/walk/tail action; escape uses the native walk at 62.5ms and twice
speed. Solitary 112px homes, 22px/s routine motion, cautious investigation bias,
30px approach alarm, physical body 18×8×14 and bounded recovery. Shared `fauna`
state/profile owners supply registration, durable records, binary timed phases,
AI, collision-resolved travel and contact/ball dispatch. The five earlier animal
implementations remain intact. Fixed 17-species owner selection prevents adding
profiles from remapping earlier homes. Land homes/clearings and caches are bounded.

Inspection: seed 2026 at -598,-538 tiles, `fauna-home:-10:-9`. Native Canvas/GPU
captures inspected. 18 focused headless checks, all 1,821 unit tests, typechecks,
all four fox browser checks and build pass. Import organization diagnostics were
corrected; final lint/inventories/full-browser/streaming checks follow. Tests
cover ordinary standing/prediction, explicit Jump, harmless balls and high misses,
mid-motion alarm/edited obstacles, exact phase hydration/binary removal,
production Realm cycles, durable manual/seeded deletion and eviction/return.
[Focused browser log](/tmp/tilefun-fox-browser-focused.log),
[unit log](/tmp/tilefun-fox-unit.log),
[Canvas capture](/tmp/tilefun-fauna-fox-canvas.png),
[GPU capture](/tmp/tilefun-fauna-fox-gpu.png).


Slice A complete: all 1,821 units, typechecks and lint pass (existing 118 warnings /
34 infos). Catalog: 221 sheets / 1,066 uses; manifest: 661 verified candidates.
Build passes. Full browser suite: **411/413** in 13.7m; all 26 wildlife gameplay
checks, both complete train journeys and the phone roof ride pass. Only the two
previous archived fox-preview review failures remain (`wildlife-review:14/:72`).
All 27 exact wildlife candidates remain unchanged. Streaming readiness exits 0,
all six phases finish with zero missing/incomplete/stale caches, errors/failures;
functional Canvas evidence, not a GPU frame-pacing claim.
[Full browser log](/tmp/tilefun-fox-browser-full.log),
[streaming report](/tmp/tilefun-fox-streaming/report.json).
Production-table checkpoint/completion refresh still reports ENOENT for ignored
campaign progress state; retain its validated art table. Gameplay progress is
persisted here first. Continue autonomously with slice B.


### Slice B checkpoint

Cat, dog, cow, sheep, horse, pig and goat profiles reuse unchanged draft-v1 pixels
and native walk/action ranges. Cat/dog native playback is 160ms; other pasture
walkers use 100ms. Matching doubled walk cadence supplies short escapes. Cats
and dogs have cautious player-interest steering within their home limits. Cow,
sheep, pig and goat groups have three members; horses have two; pets are solitary.
Sizes, body support heights, speeds, home radii, separation and cohesion differ
by species. Existing legacy Cow keeps its separate palette entry; new **Pasture
cow** names the durable provisional animal unambiguously.

Native inspection arrivals (seed 2026): cat 32,37; dog -25,102; cow 31,-98;
sheep -355,284; horse 105,290; pig -29,221; goat -30,297. Browser contexts run
independently with the repository's bounded two-worker concurrency. All 1,915
units, typechecks and lint pass (existing 118 warnings / 34 infos). All 32 profile
browser checks pass in 2.3m. Final capture rerun passes 16 Canvas/GPU pose/contact
checks in 1.4m; scrolling to the page top before capture prevents fixed navigation
from obscuring part of a herd. Both renderer contact sheets inspected at native
capture scale. Build passes; catalog 228 sheets / 1,073 uses, manifest 689 verified
candidates. Complete browser suite: **439/441** in 16.2m. All 32 profile checks, both
complete city-train journeys and phone roof ride pass; only the two known
archived fox-preview review failures remain. All 27 exact wildlife candidates
are unchanged. [Full browser log](/tmp/tilefun-pasture-browser-full.log).

Streaming readiness exits 0, all six phases have zero final missing/incomplete/
stale caches, errors and failures (functional Canvas evidence).
[Unit log](/tmp/tilefun-pasture-unit.log),
[focused browser log](/tmp/tilefun-pasture-browser-focused.log),
[final capture checks](/tmp/tilefun-pasture-browser-captures.log),
[Canvas captures](/tmp/tilefun-pasture-canvas-contact.png),
[GPU captures](/tmp/tilefun-pasture-gpu-contact.png),
[streaming report](/tmp/tilefun-pasture-streaming/report.json).
No art pixels, receipts or approval events changed. Checkpoint production-table
refresh still lacks ignored campaign state; preserve the validated art snapshot.


### Slice C checkpoint

Elephant, giraffe, kangaroo, king cobra and ant use unchanged native source cells,
anchors and idle/motion/action clips. Two-member elephant/giraffe/kangaroo groups,
solitary cobra and four-member ant colonies have distinct body sizes, clearances,
speeds and cohesion. Kangaroo uses its 1.6s native push (0–0.48s), flight
(0.48–1.44s) and landing; a 16px physical arc and collision-resolved XY share the
saved clock. A queued alarm preserves the committed hop, then uses a matched
0.8s escape. Edited trunks can block arrival; no player trampoline impulse.

Inspection arrivals, seed 2026: elephant 110,-89; giraffe 101,-150; kangaroo
-21,-22; cobra 31,-156; ant 167,-32. Elephant/giraffe use a 0.6 Roomy zoom so both
complete bodies fit; final four Canvas/GPU capture/contact checks pass in 28.3s.
All 20 new-profile browser checks pass in 1.7m, including ordinary balls and
manual creation/deletion across reopening. Native captures inspected. All 1,983
units pass in 110s after rerunning a concurrent-validation 5s forest timeout;
test behavior/assertions unchanged. Typechecks and lint pass (existing 118 warnings /
34 infos). Catalog: 233 sheets / 1,078 uses; manifest: 709 verified candidates.
All 27 exact wildlife objects are unchanged. Build and six-phase streaming
readiness pass, zero final missing/incomplete/stale caches and errors/failures.
Complete browser suite: **459/461** in 17.8m; all 52 profile checks, both complete
train journeys and the phone ride pass. Only the two known archived fox-preview
review failures remain. [Full log](/tmp/tilefun-refuge-browser-full.log).
No art bytes/receipts/approval events changed.
[Unit log](/tmp/tilefun-refuge-unit-final.log),
[new-profile checks](/tmp/tilefun-refuge-browser-focused.log),
[final wide captures](/tmp/tilefun-refuge-browser-captures.log),
[elephant Canvas](/tmp/tilefun-fauna-elephant-canvas.png),
[giraffe GPU](/tmp/tilefun-fauna-giraffe-gpu.png),
[kangaroo GPU](/tmp/tilefun-fauna-kangaroo-gpu.png),
[streaming report](/tmp/tilefun-refuge-streaming/report.json).


Water prototype checkpoint (isolated source copy; C production source remains
frozen during its full run): 26 focused water checks pass, including both actual
production shore gaits, footprint confinement, blocked recovery, native metadata,
durable phase/RNG and regional query-order/cache checks. NaturalStrategy must
realize admitted lagoons as well as ponds; the production-path test caught and
corrected the initial missing overlay in the prototype. The upstream dry-only
planner protects admitted land homes before deciding a broad water refuge;
there is no recursive call back into the water-enabled instance. Native activity
phase also gains a saved clock alongside travel phase. Continue D after C commit.


### Slice D checkpoint

All remaining existing profiles are active: pond fish, penguin, harbor seal and
manta ray. Native cells/anchors/clip ranges remain frozen. Fish/rays use full-body
water paths and ordinary aquatic collision; production Realm supplies deep terrain
to collision so rays also stop when a committed route is edited to shallows.
Penguins/seals use actual resolved shores to change native walk/haul and swim
clips, with species-specific swim speeds and paired escape cadence. Routine
shore steering favors the opposite medium; groups remain loosely cohesive.
Stationary action/alert phase now has a saved clock alongside motion phase.

Ponds seed three fish. Rare 256-tile owners admit 72×56-tile water areas plus banks, outside
infrastructure/existing ponds and protected admitted dry homes; sandy open rings
reserve trees/forest bands. A lazy upstream dry-only planner has independent
bounded caches and never calls back into water-enabled planning. Production
NaturalStrategy realizes the same pond/lagoon subgrid overlay as explorer/lab.
Marine refuges seed three penguins, two seals and a ray with stable member IDs.
No timer respawns, catch-up or backfill. Inspection seed 2026: fish 227,-183;
penguin -676,-2997; seal -637,-2997; ray -656,-2997, beside lagoon:-3:-12.

Typechecks and **118 focused headless checks** pass: 28 water/phase/depth checks,
68 common body/contact/ball checks for all 17 new profiles and eviction/return
checks for all 22 species. Existing land body tests moved unchanged into the
shared all-profile suite, with actual water setup for aquatic Realm fixtures.
Complete units, lint, inventories/build and profile browsers follow.
[Focused log](/tmp/tilefun-water-unit-focused.log). Prototype four-seed probes
(7,42,2026,98123) found all 13 dry-profile homes, ponds and broad water refuges;
final production probe and full regressions will supply E evidence. No art bytes,
receipts or approval events changed. Persist this checkpoint before table refresh.


D final verification checkpoint: **2,031 units**, typechecks/lint pass (existing
118 warnings / 34 infos). Catalog: 237 sheets / 1,082 source uses; manifest:
725 verified candidates. All 27 exact wildlife review objects are unchanged.
All **68 profile browser checks** pass in 5.1m. Final Canvas/GPU ray framing and
scene-switch checks pass 4/4 in 16.7s; native water captures inspected. The deep
inspection camera frames the player and ray together, with a full-cell visibility
assertion; changing scenes uses their native zoom presets. Actual water bounds
and no-shadow swim poses remain shared production behavior. Build passes.
Six-phase streaming readiness exits 0 with zero missing/incomplete/stale caches,
errors/failures (functional Canvas evidence). Complete browser run follows.
[Units](/tmp/tilefun-water-unit.log),
[profile browsers](/tmp/tilefun-water-browser-focused.log),
[final framing](/tmp/tilefun-water-browser-framing.log),
[fish Canvas](/tmp/tilefun-fauna-fish-canvas.png),
[penguin Canvas](/tmp/tilefun-fauna-penguin-canvas.png),
[seal GPU](/tmp/tilefun-fauna-harbor-seal-gpu.png),
[ray GPU](/tmp/tilefun-fauna-manta-ray-gpu.png),
[streaming report](/tmp/tilefun-water-streaming/report.json).

E production habitat probe passes for seeds 7,42,2026,98123: all 13 new dry
species have admitted homes, plus existing ponds and broad marine refuges for the
four water/shore species. Search stops at owner-ring radii 12,30,12,35 respectively;
this is availability evidence, not a claim that every animal is near every start.
Cache counts remain at existing hard bounds. Broad per-species clearance, actual
spawn-chunk ownership, query-order/native body checks and all-22 residency are
covered by the unit suite. [Production habitat report](/tmp/tilefun-roster-distribution.json).
Final full browser result and clean incremental commits will close D/E.


D implementation complete: first full run **476/479** in 19.0m. All 70 profile/
scene-switch checks, both train journeys and phone ride pass. Besides the two
known archived-art failures, the GPU duck recovery probe loses its replica at
close 1.3 zoom; its `not scared` poll wrongly accepts absence before the final
height assertion. The unchanged probe passes three isolated reruns. The corrected
probe observes the whole pond at 0.4 and requires the same duck to be present,
grounded and recovered; all six repeated Canvas/GPU checks pass. Duck physics,
landing/height assertions and native art remain unchanged. Preserve the original
failure and result; E reruns the full suite against the strengthened probe.
[First full log](/tmp/tilefun-water-browser-full.log),
[failure capture](/tmp/tilefun-water-duck-failure/test-failed-1.png),
[unchanged reproduction](/tmp/tilefun-water-duck-repro.log),
[corrected recovery checks](/tmp/tilefun-water-duck-fixed.log).


### Slice E completion

All **17 remaining existing-sheet species** are delivered in slices A–D, giving
**22 durable provisional species** in the production game/Worker, entity editor
and shared inspection scenes. Zero animals remain in this authorized roster.
Stable seeded identities, suitable habitats, saved individual activity/motion,
native cycles, harmless approach/contact/ball reactions and ordinary player
support apply. Manual creation persists; deletion stays deleted. No timed
replacement, offscreen catch-up, saved-chunk backfill or new art was introduced.

Final complete browser run: **476/479** in 18.4m. All 70 added-profile/scene-switch
checks and original five-species gameplay regressions pass, including strengthened
Canvas/GPU duck recovery. GPU complete train journey and phone roof ride pass.
The two known archived fox-preview review failures remain. Canvas train riding
loses roof support on the onward post-reopen leg (`city-train-riding:107`, expected
44px, received 0); its unchanged isolated complete journey passes in 1.5m.
Preserve this intermittent evidence without claiming a train fix. Earlier D full
run passed both journeys; the train topic tracks the continuing constraint.
[Final full browser log](/tmp/tilefun-roster-browser-final.log),
[isolated train journey](/tmp/tilefun-roster-train-rerun.log),
[train failure context](/tmp/tilefun-roster-train-failure/error-context.md),
[train failure capture](/tmp/tilefun-roster-train-failure/test-failed-1.png).

Final validation includes **2,031 units in 218 files**, client/server/Worker
typechecks, lint, generated inventories, build and six-phase streaming readiness.
Four production seeds admit all added dry species and water refuges; planner
caches remain bounded. The expanded generated Workshop manifest crossed Biome's
1 MiB default; a file-specific 2 MiB ceiling keeps it checked, without changing
formatter ownership or game behavior. All 27 exact wildlife review objects match
the pre-integration baseline; frozen asset pixels, receipts and approval events
are unchanged. Production-table refresh still reports ENOENT for absent ignored
campaign state, so retain the last validated art table. Gameplay progress is
persisted here and in the wildlife topic before refresh and final handoff.

Next logical work: owner playtesting of population density, habitat placement and
activity variety across ordinary exploration. Existing draft art quality holds
remain separate; further species/art expansion needs new scope.
