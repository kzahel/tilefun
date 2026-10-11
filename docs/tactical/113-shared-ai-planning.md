# 113: Shared AI planning admission

Status: delivered; desktop burst reduction validated, with a pre-existing GPU upload-test flake recorded.
Date: 2026-10-11.
Owner: [performance](../topics/performance.md), [entity activation](../topics/entity-activation.md),
[wildlife](../topics/wildlife.md), [embedded labs](../topics/embedded-engine-labs.md).

The user authorized extending 111's deer pilot across AI, measurement and commit.
The phone remains disconnected. Independent rendering/XR edits in the shared
checkout are excluded using an unregistered Git archive of 86712fe plus the
explicit scheduling source files. No branch or worktree is created.

## Shared contract

- Realm owns one AiPlanningScheduler for common fauna (all 21 profiles including
  pet coats), deer, rabbits, frogs, mallards, robins and generic ambient wander.
  Existing chase, following, route and scared-direction steering retain their
  admitted rates. Ridden input and native EntityManager motion retain ownership.
- Goal eligibility uses seeded simulation-time slots: 100ms within 192px of any
  active player, 300ms farther away. Distance classification is itself sampled at
  100ms; immediate species alarms still read live player positions every admitted
  update. Actual goals remain timer/motion gated, generally seconds apart.
- Per Realm AI step, all these brains share four goal/action admissions, 64
  evaluated candidates and 768 path-point credits. Native searches additionally
  have 24 candidates/256 points near, 12/128 far. Robins retain their tighter
  existing 8/64 near and 4/32 far search limits within the shared pool.
  Cheap action/recovery completion and immediate reactions remain outside this
  search pool. Physics substeps each own an AI step; this is not a wall-time budget.
- Complete native paths reserve credits before querying; rejected early paths
  conservatively retain their reservation. Robin work charges actual checked
  points after reserving capacity for a complete candidate as before. A candidate
  cannot be accepted with an unchecked suffix. Habitat footprint tiles can require
  several terrain queries per point; credits do not count every query or bound CPU
  time inside geometry/index owners.
- Quota/cadence denial happens before activity or new-goal RNG draws. Admitted
  bounded searches choose among fully validated candidates and can rest/recover
  when none succeeds; this deliberately changes candidate selection and goal timing.
  Each actor can claim only once per admitted step.
- Existing alarms take priority, then proximity. Pending quota waits of at least
  500ms admitted time precede ordinary urgency; stable rotating ties prevent a
  persistent urgent stream from starving far goals. Waiting does not guarantee a
  fixed latency under arbitrarily large populations. Priority sorting is only
  performed when a potential goal is due.
- Sleep adds no wall-clock debt, and no catch-up loop runs at a planning boundary.
  Transient cadence/age is weakly keyed to actor objects and is not persisted.
  Committed movement, RNG and semantic timers remain durable. Reload starts fresh
  admission phases through the same game/ScenarioSession Realm owner.
- Common fauna now checks live group alarms without allocating a cohort list
  every update. Cohesion lists are built only for admitted goal searches.
  Waterline checks, swim steering, flock separation and contact validity remain
  live at their existing rates. Robins discover crowns only on admitted ambient
  goals, on timed action/recovery completion, or for live nearby alarm checks.
  Queued idle ducks still refresh waterline/shadow and rest clips without a goal.
  Generic ambient movement/stop choices can wait for
  a slot; active movement integration, chase/follow and route steering do not.

## Desktop evidence

[Sanitized capture data](../benchmarks/113-shared-ai-planning.json) records source
hashes, five repeats of each synthetic condition, native work counts and matched
held-input captures. Host: M4 Pro/macOS, Node 26.7.0 for isolated AI; bundled full
headless Chromium 153, native Worker/Canvas/IndexedDB, 411×789 CSS viewport,
fresh thicket seed 2026, no CPU throttle. The phone is not attached.

The synchronized fixture creates 96 isolated actors spanning every fauna/pet
profile, all other native families and generic wandering, with expired timers.
It runs 180 AI steps. Committed motion is held: physics, terrain generation,
persistence and rendering are excluded. The near case supplies one player per
actor to exercise classification under intentionally extreme multiplayer input.
After warm-up, five repeats use fresh populations and deterministic state.

| Synthetic condition | Maximum AI step in first 30, before → after | Mean AI step, before → after |
| --- | --- | --- |
| Open, near | 7.46–8.12 → 0.44–0.53ms | 0.157–0.161 → 0.151–0.158ms |
| Open, far | 5.62–6.18 → 0.26–0.32ms | 0.081–0.087 → 0.061–0.066ms |
| Blocked, near | 5.66–5.88 → 0.38–0.48ms | 0.164–0.167 → 0.153–0.164ms |
| Blocked, far | 3.66–3.92 → 0.22–0.31ms | 0.075–0.081 → 0.057–0.063ms |

Peak open occupancy queries fall from 14,878 to 675 near, 14,849 to 457 far.
Blocked peaks fall from 1,936 to 64 near and 1,932 to 48 far. Every actor receives an
initial planning admission by step 60; 93/96 near actors are admitted by step 30, all 96 far
actors by step 30. These results establish spread/bounded work rather than
skipping an unserved tail. Near average ranges mostly overlap: the main benefit
is peak headroom, not a large reduction in aggregate AI time.

The initial prototype classified distance and sorted every tick; extreme near
input increased average AI cost. The delivered version samples classification at
10Hz and only sorts potential due work. Intermediate measurements are excluded.
A final robin boundary regression also ensures denied ambient goals do not
discover crowns, while nearby-player crown/alarm checks stay live.

15-second native idle work counts:

| Lane | Fauna routines before → after | Cohesion list builds before → after | Fauna searches before → after |
| --- | --- | --- | --- |
| Cow | 2,715 → 2,715 | 2,715 → 11 | 10 → 11 |
| Pond | 2,715 → 2,715 | 2,715 → 8 | 10 → 8 |

Robin/rabbit/frog/mallard search counts continue to progress; finite-window totals
differ intentionally with cadence and bounded candidate selection. The baseline
idle census overlapped some initial validation: its counters are useful, while
its contextual timings are not an isolated timing comparison.

Before the final waterline-only correction, two matched 15-second held-Right
robin-grove captures each stop after 21px at an
obstacle. Their whole tick means are 1.152–1.265ms before and 1.082–1.107ms after;
p95 1.5–2.0ms before and 1.4ms after. AI means 0.104–0.117ms before versus
0.102–0.104ms after. Both versions stay near 60Hz, frame p95 16.7–16.8ms, no page
errors, and at most 0.000230px reconciliation error. These are obstacle-limited
held-input captures, not continuous walking or proof of a stutter cure.

Final 15-second dog-field captures travel 625px but trajectory sampling reveals
the last ~5.2 seconds are stationary against an obstacle. The primary final
moving comparison therefore uses two eight-second repeats: 512–513px travel,
no stationary update interval, authority 60Hz, frame p95 16.7–16.8ms, and no page
errors. Whole-tick mean 1.439–1.802ms before versus 1.376–1.967ms after, p95
3.2–4.0ms before versus 2.6–4.1ms after. AI means 0.121–0.151ms before versus
0.119–0.172ms after. Those ranges overlap; no general desktop tick/p95 improvement
or phone result is established. Budgeted burst reduction and cohort work removal
are stronger evidence than ordinary-play timing in these samples.

## Validation and inventory

Final combined-checkout typechecks, all 2,428 units in 250 files and lint pass.
The root suite includes independent XR tests; owned runtime sources match the
frozen delivery. Frozen typechecks/lint/build also pass. Lint retains the baseline
118 warnings/34 infos with no new diagnostics. All six streaming readiness cases
pass with no final missing, incomplete or stale data. Full browser suite before the final queued-duck waterline correction:
545 pass, one skip, one GPU terrain upload-stability assertion fails in 22.3
minutes. Its terrain rows and surface bytes are stable, but the global GPU upload
counter increases. Optimized repeats pass four/fail one; the original 86712fe
passes five repeats, then passes 19/fails one in twenty at the same two-worker
concurrency, reproducing the exact assertion. GpuRasterSurface's counter covers
all raster texture pages, not solely terrain. A late texture upload is consistent
with the counter, but its particular source/root cause is not traced. No renderer
code or test assertion is changed. Final optimized serial reruns all five pass.

Static review also found that a quota-denied idle duck returned before refreshing
its waterline shadow after a terrain edit/teleport. The final fast path refreshes
noShadow and the rest clip without spending goal RNG. The added boundary case
passes, all 2,428 units/typechecks/lint pass, build/inventories refresh, all six
affected Canvas/GPU duck browser checks pass, and final six-case streaming
readiness passes. Other full-suite cases exercise unchanged scheduling logic;
the final three-line waterline correction uses these focused affected checks.

Ten new shared scheduler regressions plus the four migrated deer cases cover
every wildlife profile, deterministic mixed wakes, bounded samples, quota denial
without RNG/activity changes, complete-path safety, aged admission under sustained
urgency, live herd/player alarms between distance slots, generic cadence, fast
following/chase/route steering, sleep/no catch-up and 60Hz native committed motion.
Existing native species/ScenarioSession tests retain contact and saved-phase checks.

Catalog and Workshop inventories regenerate. All 761 candidate identities verify
in full Chromium at retina scale. The six character identities renew because
their contract hashes raw Realm source; all other candidate records and every
source fingerprint are unchanged. Historical approvals, art banks and frozen
review pixels are preserved. The wildlife status refresh was attempted after
persisting progress; ignored campaign progress is absent, so its validated table
is retained.

## Next

Profile dense collision/ground and nearby-actor queries after these bounded bursts.
Compare the remaining work before adding compute workers or reducing publication.
Measure the same native game on the phone when it is attached.
