# Matched physics tick prediction

Status: delivered and locally qualified; owner playtest next.
Updated: 2026-11-03.

Owner approved repairing [211's pacing investigation](211-movement-pacing-investigation.md).
Fix walking/running/car speed modulation while preserving contact anchors, replay
budgets, normal Worker/P2P and the single shared physics step.

## Implementation

Replay retains the last committed physics/input tick pair. It samples correction
at that same physics tick, then continues newly queued movement without counting
that movement as error. A bounded map stores only six JavaScript pose coordinates
per admitted body, once at the comparison point; no WASM world snapshot or extra
simulation pass is introduced. Player/driver sampling shares the publication helper.

A first input-tick-only prototype removed false correction in a favorable capture,
but another Worker/render phase still exposed zero/two-tick prediction advances as
acknowledgements repeated or jumped. The final horizon advances with local fixed
ticks from the committed physics clock, rather than with unacknowledged packet
count. Replay holds acknowledged motors and coalesces overdue local axes while
retaining jump edges. Pending inputs remain eligible when authority overtakes the
client. An acknowledgement covering an unpublished suffix is a recovery fence.

Only the existing eight-step/2ms replay loop integrates. There is no extra update,
packet-driven step or runtime mode. Held presentation remains private during sliced
replay. The 210 contact anchor uses matched body poses, including previous poses
for joining contacts. Genuine correction remains; diagnostic comparison tick fields
make an unavailable overlapping tick explicit rather than reporting catch-up travel
as an error. No network format or authority physics rule changes.

The pacing script now observes two fresh production sessions without monkeypatching
prediction. The old matched-replay control remains historical evidence in 211's
frozen capture/revision, not an optional maintained prediction path. Pixel-grid
camera translation is unchanged and remains a separate presentation decision.

## Native evidence

56 focused tests across shared prediction, remote presentation, shared physics,
Realm physics and control admission pass. New coverage checks walk/run/car steady
fractional movement under variable callback cost and deterministic zero/two packet
admission; matching physics ticks and near-zero false correction; sliced replay
with appended inputs and eight-step limits; and retained jump edges when authority
overtakes old local input. Existing history/overflow/recovery, delayed contacts,
reversal, jumps, NPC support and first-contact inward-snap checks remain green.

Two older correction tests sent every jump command to authority, whose admission
correctly retained the jump edge. Their large "error" was a comparison of different
times. They now stage a genuinely unreceived jump so they still prove that real
correction does not move unconnected bodies or lift supported contact groups.

The car pacing fixture uses the established clear (64,64) placement. An initial
(144,100) native placement stayed blocked before the fix as well; the original red
run had zero car travel. That separate native contact observation remains for
follow-up, rather than relaxing the pacing test's speed/correction tolerances.

## Production qualification

Implementation checkpoint: `ed28ae4e`. The [bounded pacing evidence](../benchmarks/212-matched-physics-tick-pacing.json)
records two fresh ordinary production sessions, with no predictor monkeypatches.
All six walk/run/car captures have 16.8ms frame p99 and no page errors. Steady
displayed speeds are 63.999–64.001, about 127.998 and about 112.002 world px/s in
both sessions; every sampled interval advances one predicted physics tick. False
same-tick correction is below 0.0002px. The previous one-tick error is eliminated.

All three TypeScript projects, focused lint and Node syntax check pass. Five
production full-Chromium boundaries pass: ordinary Worker NPC contacts/prediction,
delayed P2P convergence after reversal, two-session lab lifecycle, car ramp/seat
reload and traffic pause/reload/teardown. Production build and all 2,120 Workshop
identities pass. Art catalog is unchanged; Workshop changes only 1,024 runtime
fingerprints and input digest, with no new candidate identities or art pixels.

GPU/meshes streaming readiness with 4× CPU throttling also passes. Walk/sprint/
reverse retain 16.8ms frame p99 and zero final missing/incomplete/stale terrain.
Steady correction medians are near zero; genuine contact/input-transition corrections
remain, including the reversed-input boundary. These are desktop captures, not a
new physical-device qualification.

Next: owner Save and reload, then compare walking/running/driving on the original
desktop. The separate integer-camera grid wobble is subsequently addressed by
[213](213-continuous-camera-projection.md).
Commit evidence/inventories and mark development readiness last.
