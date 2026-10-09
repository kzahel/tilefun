# Duck contact and startle flight

Status: complete and validated, 2026-10-09.
Owner: [Wildlife](../topics/wildlife.md).

The owner requested solid duck bodies, a small player bounce on landing, a
startled quack and short escape flight after landing contact or a ball hit, and
settling nearby with the same durable identity. Commit the completed work.

Use existing unchanged mallard frames; a looping flight clip reuses the flap.
Player body collision and landing bounce belong to shared movement physics,
including prediction and missing-input gravity. Authority owns the duck reaction,
bounded destination choice and collision-resolved arc. Persist the flight timeline
with the animal. Repeated hits during the escape/settling interval do not restart it.
If no safe destination exists, quack and settle in place.

Both ordinary game and embedded pond lab use the production Realm/Worker; audio
remains in the ordinary game's existing PlayScene audio path.

## Validation

Typechecks, all 1,760 unit tests in 210 files, lint (no new diagnostics), generated
catalog/manifest and build pass. All 641 Workshop candidates pass normal Chromium
retina identity verification; all 27 wildlife candidate records are identical to
HEAD. No source pixels, human art approvals or production receipts changed.

Nine focused interaction regressions cover shared landing/prediction, near misses
and ascending/elevated passes, binary alarm baselines/deltas, real Realm throws,
landing with/without input, flight save/reload, bounded targets and a newly blocked
flight path. Existing generation/residency/animation checks continue to pass.

All six wildlife browser checks pass through bundled full Chromium: ordinary-game
throw/alarm/quack/flight/settling, Canvas and GPU pond landing/bounce/flight plus
paused flight reload, normal five-cycle pond life and main-game durable manual
placement/deletion. Native [Canvas flight](/tmp/tilefun-duck-flight-canvas.png),
[GPU flight](/tmp/tilefun-duck-flight-gpu.png) and
[ball flight](/tmp/tilefun-duck-ball-flight.png) captures were inspected.

The Worker checks caught the omitted binary `scared` state (formerly falling back
to idle), now encoded in the existing state byte. Real throw coverage also caught
launch self-contact: balls temporarily exempt their thrower until their 3D body
clears it, after which normal collision applies. This exemption is transient;
duck home/target/flight progress/elevation remain durable.

Escape starts with a 0.64s quack pose, chooses a clear 48–96px destination inside
the home radius, and travels at 60px/s over a 34px arc using existing flap frames.
It retains ordinary collision, settles for two seconds and does not restart on
repeated hits during that interval. Safe-path sampling prevents planning through
walls/trees; this is a short local flight, not a general flying navigation system.

Full Playwright passed 389/393 checks. Two existing wildlife review checks fail on
the absent archived fox pilot-v1 `preview.gif`. The Canvas generated-city train
case failed initial boarding (player remained at ground height); it passed in
isolation without any train code change. One new ball check assumed an individually
aimed throw would hit despite existing angle/speed jitter. Its test now aims a
short volley at the current body and waits for actual contact. All six wildlife
checks plus the Canvas train check pass together with one worker (7/7).
The whole-suite result is preserved rather than described as entirely passing:
[full log and failures](/tmp/tilefun-duck-interaction-validation),
[focused rerun](/tmp/tilefun-duck-interaction-browser-rerun.log).

The subsequent isolated `streaming:bench -- --assert-ready` passes. Cold,
standing, walk, sprint, reverse and zoom-out finish with zero missing, incomplete
or stale terrain. The [report](/tmp/tilefun-duck-interaction-streaming/report.json)
records the headless Canvas lane; this is readiness evidence, not a cross-backend
performance claim. No other test workload ran concurrently with the benchmark.
The art production table helper still cannot run because the ignored
`data/wildlife-campaign-v2/progress.json` is absent; retain its last validated
snapshot rather than invent production progress.

## Next

Owner playtest the same pond link for contact, ball throws and landing bounces.
