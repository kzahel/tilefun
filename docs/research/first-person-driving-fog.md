# First-person driving fog

Investigation checkpoint, 2026-11-16. Owner: [renderer unification](../topics/renderer-unification.md).
The initial checkpoint reproduces progressive visibility loss with Far selected, but
does not reproduce the reported approximately one-metre visibility or confirm
recovery on returning to the original spawn. The owner's subsequent fog policy
change is recorded below. The separate terrain resend defect was subsequently
fixed and traced through real zoom changes in
[terrain holes after zoom](terrain-holes-on-zoom.md).

## Browser evidence

Three isolated runs used the real single-player Worker, bundled Playwright
Chromium in headless mode, a 1280 × 800 viewport and Node 24.22.1 on macOS.
The starting source was `bb12a0d6`. [Sanitized samples](../benchmarks/first-person-driving-fog.json)
retain positions, fog distance and missing-chunk coordinates.

| Run | Input | Observed fog end, world pixels |
| --- | --- | --- |
| Flat grass control | Forward 30 s, stop 5 s, reverse 60 s | 1572 minimum; 1600 again at the origin |
| Regional seed 2026, town | Forward 40 s, stop 5 s, reverse 40 s | 1600 outbound; progressively 1326 → 887 → 644 → 418 on return |
| Same town, longer repeat | Forward 40 s, stop 5 s, reverse 100 s, stop 10 s | 1600 outbound; minimum 992; still 1451 after stopping |

Town arrival is tile `(300, 519)`, with a compact car spawned at world pixels
`(4848, 8304)`, heading east. Far is selected before boarding. Driving uses
ordinary W/S input and ordinary contacts. Traffic pushes change the heading and
route, so reversal does not retrace the outbound path and timings do not define
a deterministic route. The runs had no page errors. The longer run's final
authority diagnostics showed no residency failures, shed chunks or paused/
failed storage; missing client terrain and reduced fog persisted nonetheless.

The longer repeat repeatedly reports the same missing chunk row (`cy=34`)
while approaching it. At this checkpoint the renderer's fog tracked the nearest missing terrain,
so it closes across the whole view even if the missing chunk is off to one side.
The camera and player positions remain together; the streaming camera is not
left at spawn in these runs.

`node scripts/first-person/fog-traversal.mjs` repeats the town workload and writes
screenshots, sampled state and a report under the printed temporary directory.
`--flat` selects the control, `--headed` shows bundled Chromium, and
`--out-steps=1 --back-steps=1` provides a short runner check. Each step is 2.5 s;
defaults are 16 outward and 40 reverse. The flat control above used the original
probe at the origin, rather than the retained runner's town coordinates.

## Initial resend defect checkpoint

An independent native probe through `interestChunks` confirms this sequence
with an unchanged streaming interest and an unedited chunk:

1. Load `(0,0)`: the client receives its key and one terrain snapshot.
2. Remove `(0,0)` from the authority: the client receives an empty loaded list
   and removes its terrain.
3. Reload `(0,0)` at the same revision: its key returns, but **zero terrain
   snapshots** are sent. The client cannot reconstruct it.

`ReplicationInterest.ts` prunes remembered revisions only outside terrain
interest. It retains the revision of an absent authority chunk that is still
inside that interest. `ClientStateView.applySyncChunks` has already removed
that chunk, so the retained revision suppresses a necessary resend. Terrain
replication also has a two-chunk buffer while observer residency has a one-chunk
buffer, allowing authority eviction within terrain replication interest.

At this checkpoint the separate follow-up was a native eviction/reload regression
and message-level tracing. [The zoom investigation](terrain-holes-on-zoom.md)
now records that failing native case, a real Worker trace proving omitted
snapshots for nine client holes, and the validated resend fix.

## Fixed fog distance, 2026-11-16

Owner instruction: keep fog at the selected fixed distance and handle terrain
holes separately. `FirstPersonView` now uses the frame's draw radius directly;
the missing-chunk contraction, minimum and reopening interpolation are removed.
Near/Medium/Far retain their 400/800/1600 world-pixel ends and 45% fade start.
Both first-person walking and driving use this rule, as does immersive XR after
conversion to metres. Streaming, residency, replication and chunk resend logic
are unchanged. Missing terrain can therefore be visible inside the fog range.

The native view regression renders with no loaded terrain, then with arriving
terrain, moves the eye into missing terrain and switches Near → Far. Every frame
must use the selected fog start/end immediately. Existing room, tabletop,
top-down and headset checks cover the other camera modes.

Validation: all 49 focused camera/view/interior/play tests and all typechecks
pass, as do focused lint and diff checks. The post-change town run drove forward
40 s, stopped 5 s, reversed 40 s and stopped 10 s: all 35 sampled frames retained
Far's 1600-pixel fog end, including missing terrain about 898 pixels from the eye.
No page errors occurred. Art catalog and Workshop manifest regeneration pass
(2130 candidate identities verified in normal Chromium). The sanitized evidence
includes this fixed-fog run; it does not claim to repair the terrain holes.
