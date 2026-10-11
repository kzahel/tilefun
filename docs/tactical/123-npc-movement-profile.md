# 123: NPC movement profile and fauna type lookup

Status: complete; measured type lookup delivered, slower overlap prototype rejected.
Date: 2026-10-11.
Owner: [performance](../topics/performance.md).

## Profile and selection

Follow [119](119-dense-ground-support.md) with remaining shared EntityManager NPC
movement work. Phone sources are frozen `69e5229`, excluding concurrent firetruck
work. Final integration freezes `ebd6dad`, whose fauna baseline is identical.
Four separate 1ms CPU captures cover setup, warmup, ticks, publication and close;
self rows corroborate hotspots, inclusive rows overlap and neither is retained-tick
attribution. Separate movement boundary/query counters add substantial overhead.

At 384 moving dogs over 180 retained ticks, movement calls `getEntityAABB` 625,446
times (about 3,475 per tick), reads collision flags 384,768 times and heights
246,528 times, and requests 69,120 prop ranges with zero prop candidates. Body-box
construction is a leading sampled row (6.3–9.4% of active sampled time across
motion/rest captures, including separation and other callers). These are function
calls, not measured surviving heap allocations or predicted savings.

A direct-overlap prototype preserves strict bounds and live geometry and passes
45 focused tests, but its matched dense moving phone means worsen from
11.182/11.592ms to 11.708/12.879ms (about 5–11%). It is reverted; fewer box
construction calls did not establish a faster tick. All sixteen shallow prototype
captures and its earlier single diagnostic lane remain in the evidence.

Another sampled hot path is the repeated `faunaProfile` scan/type comparison.
Separate counters record 414,720 lookups and 1,244,160 comparisons over 180 dense
moving ticks: 2,304 lookups and 6,912 comparisons per tick. Even this dog fixture
matches the third row of the definition table; later species scan farther.
Independent water-read and lookup desktop prototypes have large same-source
mean/tail drift; they are inconclusive timing prioritization and not speed claims.

## Delivered boundary

Pre-index the existing readonly profile table by entity type once at module
initialization, matching the static type-key lifecycle of `FAUNA_DEFS`. Return
the original live profile objects; species, coats, clips, dimensions, speeds and
other definitions remain unchanged. Missing and unrelated type names return
undefined. All profile IDs are distinct and every species/coat resolves to its
original object. Two focused registry checks enforce those boundaries alongside
existing land, shore, deep-water, body, persistence and motion coverage.

Game and ScenarioSession labs consume this same helper. No AI planning cadence,
physics query, stationary blocker reaction, waterline rule, index, player movement,
prediction, transport, publication or renderer policy changes. The losing direct
body-overlap and independent water-read prototypes remain temporary only.
The separate metadata census retains exactly the same 414,720 lookups and all
chunk/fine query/candidate counts, while repeated profile comparisons fall to zero.
Startup builds the type keys once; no runtime profile scan is retained.

## Matched phone result

Shallow timing keeps the original production Realm/ScenarioSession crowd fixture:
60 warmup/180 retained 1/60s ticks, verified native 0/88px motion, memory persistence,
flat grass/no props, separate replication. It excludes renderer, real IndexedDB,
network delivery and fresh planning. Index and other whole-tick work remain included.
First eight moving cases use before/lookup/lookup/before with reversed populations;
four additional 384-moving cases reverse to lookup/before/before/lookup.

| Dense moving repeat | Mean before | Mean lookup | p95 before | p95 lookup |
| --- | --- | --- | --- | --- |
| 0 | 11.088ms | 10.456ms | 14.5ms | 14.0ms |
| 1 | 13.171ms | 11.104ms | 15.9ms | 16.7ms |
| 2 | 12.163ms | 11.285ms | 17.4ms | 17.2ms |
| 3 | 13.404ms | 12.633ms | 20.5ms | 20.3ms |

Paired dense means improve 5.7–15.7%; their aggregate mean falls from 12.457ms
to 11.369ms (8.7%, about 1.09ms). P95 is mixed and overlaps; delivered maxima
26.7–76.1ms remain over budget. This is a warmed dense-workload mean saving,
not stable whole-game 60Hz or a stutter/desync cure. At 96 moving dogs means are
3.409/3.490ms before versus 2.896/3.812ms after, with mixed p95 too; no uniform
small-population gain is established. Publication remains separate.

Thermal protocol: the initial <=29°C diagnostic gate times out with zero cases.
CPU/deep diagnostics then use <=31°C/status zero and observe 30.2–30.6°C. The
box prototype comparison uses <=33°C/status zero and observes 31.6–32.3°C; an
earlier single <=31°C prototype lane is separate, with its next cooldown aborted.
The first <=33°C lookup entry attempt also times out without retaining cases.
All twelve accepted lookup timing cases use the same <=34°C/status-zero entry
gate for both sources and record **33.0–33.3°C/status zero at entry and end**.
Charging is unchanged. Keep these matched warmed controls separate from 119's
cooler measurements. Raw results retain all outliers and aborted entry attempts.

## State and ordinary play checks

Four desktop wire/durable parity pairs (96/384 × rest/travel) match all 180 frames
each: 720 paired frames. Each full snapshot/record frame has its own SHA-256,
then the ordered digests are hashed; persistent identifiers are omitted and
crypto awaits occur outside measurement timers. All four baseline phone digests
also match desktop. The retained candidate 96-rest phone pair matches its baseline
and desktop over 180 frames. Remaining phone parity and planned candidate CPU are not captured after
thermal status becomes 1; no further cases are admitted. Partial captures and their
readings remain in evidence. This is not full candidate phone parity or CPU-after
acceptance. Task-owned tabs/Workers/servers/routes are removed, original routes
verified and the prior foreground app restored.

Four separate desktop real-game Canvas/Worker/IndexedDB keyboard walks use native
AI and streaming, ABBA sources and existing authority/ground diagnostic timers.
Means overlap at 1.471–1.883ms before versus 1.359–2.447ms after; p95 overlaps
at 2.5–4.7ms versus 2.4–4.6ms. All walks travel continuously 512–513px near 60Hz,
frame p95 is 16.7–16.8ms and maximum resimulation error is below 0.000016px.
There are no page errors or demonstrated ordinary-play speedup. These controls
are desktop Canvas/keyboard, not actual phone GPU/touch symptom acceptance.
[Sanitized evidence](../benchmarks/123-npc-movement-profile.json) owns source/probe
hashes, all measurements, rejected prototypes, parity, thermal/order limits and
validation scope. Raw private controller/browser state remains temporary.

## Validation and next work

Current checkout: three typecheck configurations, 2,520 unit tests in 257 files,
and lint pass (119 warnings / 34 infos, no errors). Latest committed firetruck plus
the lookup passes a frozen build after regenerating only the Workshop source
digest; all 767 current review identities verify unchanged in normal Chromium at
retina scale. All 100 affected native Canvas/GPU fauna, wildlife and settlement checks pass
(7.4 minutes). Frozen streaming readiness passes cold, standing, walk, sprint,
reverse and zoom-out, with zero missing terrain, incomplete caches, readiness
failures or page errors. Browser coverage is affected-consumer validation, not a
full browser-suite claim.

Next bounded server candidate: measure the staged water-read prototype on a cool
phone. Land fauna and fully aquatic profiles ignore the supplied water boolean,
while shore profiles must still sample before/after movement to preserve swimming
clips and shadows. Retain stationary collision and all 60Hz contact/input work;
check land/pond/deep/shore parity and actual waterline transitions before delivery.
Actual GPU/touch stutter and acknowledgement tracing remain separate: these crowd
results do not reproduce or explain the original symptom.
