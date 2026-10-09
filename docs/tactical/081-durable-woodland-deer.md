# Durable woodland deer

Owner: [wildlife](../topics/wildlife.md). Started 2026-10-09.
Status: complete, with known archived-art failures and intermittent train evidence recorded.

The owner accepted the robin grove and authorized deer next. Reuse the existing
adult doe draft-v1 drawing-03 / walk-tailflag-01 unchanged, pending art approval.
Native 48px cells, anchor 24,36, idle, 12-frame grounded walk and eight-frame
alert action supply quiet rests, walking and ear/tail activity. Flee uses the same
walk twice as fast with matching speed; no new gallop or airborne gait is invented.

Admit wider dry woodland glades outside infrastructure, pond banks, rabbit homes
and solid forest bands. Scattered trunks leave room for 2–3-member durable groups.
Per-member seed/RNG and stable world/glade/member identity seed once; ordinary
persistence owns movement, phase, manual individuals and deletion. No respawns,
catch-up or saved-chunk backfills. Nearby group members share alarms and loosely
prefer each other's company. Player approach/contact and balls produce one short
bounded escape, then recovery; closed habitat settles in place. Standing on any
wildlife never adds a jump impulse. Normal collision resolves actual movement.

Shared game/Worker/lab registration, authority AI, grounded travel, binary timed
poses, manual creation and native glade inspection are in scope. Validate native
pixels/timing, deterministic habitat and ownership, real body support without
bounce, group behavior, obstacles, save/reload and durable residency, then run
required typechecks/unit/lint/build/full browser and streaming readiness checks.

No art production or human approval is part of this gameplay slice. Persist fresh
progress before refreshing the production table; the ignored campaign state is
currently absent, so retain the last validated table if the helper cannot run.

Implementation checkpoint: shared registration, movement/pose, prediction contact,
ball reactions, normal records and editor creation are delivered. Wider glades
reserve scattered trunks while retaining solid thickets and earlier rabbit homes.
Inspection is seed 2026 at -164,-460 tiles, beside deer-glade:-3:-8. The arrival is
slightly offset from the group so normal zoom frames them without an immediate
approach alarm. Existing native pixels and all prior exact wildlife review records
are unchanged; no art approval event was written.

Headless: 214 files / 1,808 unit tests pass; deer/arrival focused checks also pass.
Typechecks, lint (existing 118 warnings / 34 infos) and build pass. Catalog: 220
sheets / 1,065 uses. Manifest: 657 normal-Chromium-verified candidates, with all
27 exact wildlife review records unchanged. All 22 focused wildlife browser
checks pass, including both renderers, pause/reload walking phase, no-bounce
landing, ordinary balls and editor creation/deletion across world reopening.
The native arrival was adjusted after capture inspection and rebuilt. Its final
four browser checks pass in 35.8s; the full suite follows below. Both final
Canvas/GPU captures frame complete individuals and nearby tree edges. The final
required unit/type/lint rerun also passes (1,808 tests in 44.8s).

Isolated streaming readiness exits 0: cold, standing, walk, sprint, reverse and
zoom-out finish with zero missing/incomplete/stale caches, errors and failures.
Functional Canvas readiness evidence only, not a GPU frame-pacing claim.
[Streaming report](/tmp/tilefun-deer-streaming/report.json).
[Focused unit log](/tmp/tilefun-deer-unit-focused.log),
[unit log](/tmp/tilefun-deer-unit.log),
[focused browser log](/tmp/tilefun-deer-browser-focused.log),
[final arrival browser log](/tmp/tilefun-deer-browser-arrival.log),
[final unit log](/tmp/tilefun-deer-unit-final.log),
[Canvas glade capture](/tmp/tilefun-deer-woodland-canvas.png),
[GPU glade capture](/tmp/tilefun-deer-woodland-gpu.png).

Full browser validation passes **406/409** in 13.5 minutes. All 22 wildlife
checks pass, along with GPU city-train reopening/arrival, the phone roof ride,
shared movement and both train/vehicle grade checks. Two archived-art failures
remain in `wildlife-review.spec.ts:14` and `:72`: the missing fox pilot preview GIF
blocks readiness and masks the expected changed-playback alert. Exact records and
historical source artifacts are untouched. Canvas city-train riding fails on the
onward leg after reopening (`:107`, expected 44px, received 43.583168px). Preserve
this as intermittent roof-support evidence; no train physics or assertion changed.
Its isolated complete-journey rerun passes in 1.5 minutes, including mid-bend
reopening and alighting. This adds successful evidence without claiming the
intermittent support loss fixed.
[Full browser log](/tmp/tilefun-deer-browser-full.log),
[isolated Canvas train rerun](/tmp/tilefun-deer-train-rerun.log),
[train failure context](/tmp/tilefun-deer-train-failure/error-context.md),
[train failure capture](/tmp/tilefun-deer-train-failure/test-failed-1.png).

Art-table checkpoint and completion refresh attempts lack
`data/wildlife-campaign-v2/progress.json` (ENOENT). Fresh gameplay progress is
persisted here and in the topic; preserve the validated table, not fake receipts.
[Completion refresh log](/tmp/tilefun-deer-status-final.log).

Next: owner playtest the glade for group spacing, alert timing and accessible
cover before another provisional woodland animal. Art motion corrections remain
under the existing separate review hold.
