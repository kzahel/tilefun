# Prediction backlog and history-gap recovery

Status: complete, 2026-10-10.
Owners: [player prediction](../topics/player-prediction.md), [performance](../topics/performance.md).

The user authorized implementing and committing the long-stall recovery follow-up
to 088. The original 128-command buffer silently discarded unacknowledged input;
reconciliation then replayed an incomplete suffix and warped the player backward.

## Delivered contract

- Retain up to eight seconds of admitted input dt and at most 1,024 commands.
  Copy submitted movement, physics parameters and jump-latch state; preserve order.
  Trimming records the highest discarded sequence rather than hiding the gap.
- Game input sequences belong to the transport, survive Edit/Play scene
  replacement and cancellation, and seed from the known authority sequence.
  Scenario sequence resets remain paired with explicit authority/predictor reset.
- Reject regressing acknowledgements/server ticks. A snapshot before a missing
  prefix does not replace prediction. Allow 250ms for authority to acknowledge
  the lost prefix, then explicitly reset to authority if it cannot recover;
  a sequence fence prevents replay against another incomplete baseline.
- Ordinary short reconciliation remains synchronous. Larger histories replay in
  a separate scratch predictor, admitting at most 32 physics subdivisions per
  prediction tick across reconciliation and update. Scratch work also yields at
  a 2ms elapsed target between commands. An individual command/finalization is
  atomic, so this is not a hard CPU deadline or a per-render-frame guarantee.
- Live input and player/mount animation continue. Scratch replay incorporates new
  commands and commits only a complete pose, measuring correction against the
  live pose at completion. It never replays animation time. A sufficiently fresh
  acknowledgement replaces unfinished work; other snapshots coalesce without
  repeatedly restarting it. Entity baselines and collision trajectories are
  frozen for the scratch job; world/prop geometry remains current.
- Authority admits at most 32 input physics subdivisions per player per world
  tick and retains the ordered suffix. It acknowledges only consumed commands.
  Editor/storage/travel fences retain their existing queue-discard policies.
- Explicit world/pause/command resets, player identity changes, detected same-ack
  relocations and mount changes during recovery cancel scratch state. Game and
  `ScenarioClient` use the same predictor/Realm policies; no lab-only recovery.

This is bounded local-player recovery, not rollback of NPCs or terrain. New
collision/terrain information and legitimate relocations can still correct the
pose. Beyond the retained history, explicit resync can visibly relocate the
player; it does not reconstruct unknown inputs. A blocked main thread cannot draw.

## Evidence and checks

Deterministic regressions cover 150/420/480 commands, direction reversal, jump
edges during replay, grounded blocking/airborne motion, mount animation, real
correction, snapshot coalescing/fresh-ack cancellation, subdivision/time budgets,
missing-history acknowledgement recovery, explicit resync, zero-dt count bounds,
old snapshots and lifecycle resets, including preserving the acknowledged
fence through internal relocation resets. Transport sequence units and new
Canvas/GPU browser checks cover three successive Edit/Play replacements.
Native authority tests verify ordered backlog
admission/acknowledgement, large-input subdivisions and editor cancellation.

`desync-stalls.mjs --extended --assert-recovery` adds seven-/nine-second Worker
stalls, recovery diagnostics and budget/backward-step assertions. The probe now
supplies a valid complete flat descriptor and asserts the actual generator.
Earlier versions supplied only type/seed: the menu rejected that descriptor and
created its default regional world. Earlier animation/stall captures exercised
real prediction but were incorrectly described as flat; their positions can also
include changing/unavailable terrain. Preserve those historical results with this
fixture correction rather than treating them as flat-world parity evidence.

[Sanitized native captures](../benchmarks/089-prediction-backlog-recovery.json)
record nine cases on both Apple M4 Pro/bundled Chromium and Pixel 7a/Android
17/native Chrome: baseline; 350/750/2,500/7,000/9,000ms Worker stalls; 350ms main
stall; 750/2,500ms outgoing delay. The capture checkpoint is isolated from
unrelated checkout edits; the subsequent reset-fence/connection-sequence guards
receive their own final unit/browser checks. Both complete
`--extended --assert-recovery`; all replay input
subdivision peaks are <=32 and retained history <=8 seconds/1,024 commands.
The 2.5-/7-second flat Worker cases have <0.001px post-replay error and backward
steps on both devices. The 9-second controls observe history-gap recovery without
an incomplete replay; they do not guarantee recovery beyond the window in every
world. Ordinary walk columns continue; a main stall still holds the frame about
355ms on the phone. Battery temperature is 29.6→29.4°C in the final phone run;
this is functional stall evidence, not AI headroom, touch acceptance or a matched
historical A/B. The user's previous foreground app is restored, owned tabs/routes
removed and origin data isolated.

Final isolated task validation passes all three typechecks, 2,165 unit tests in
228 files, lint (118 existing warnings/34 infos), generated catalog/manifest
checks, build and `streaming:bench -- --assert-ready`. Streaming records no browser
errors, readiness failures or traversal terrain gaps. The regenerated manifest
retains all 761 candidate IDs and changes only 16 behavior fingerprints and the
input digest; historical source assets and approval snapshots remain untouched.

The full browser checkpoint ran 520 cases: 515 passed, one skipped, four failed.
Two tap-water respawn failures exposed the Edit/Play sequence reset; the
connection-owned numbering fixes that regression. The other two require absent
historical wildlife review archives (including fox `pilot-v1`), outside this
task. After the final guards, all 34 affected game/Worker/lab cases pass across
focused runs. These include driving/riding, scenario lifecycle/scheduling,
ordinary robin gameplay, tap movement and the new scene-replacement regression.
An intermediate tap run hit the nearby chicken instead of the intended ground;
the unchanged water/respawn case then passed three repetitions on each renderer.
The fullscreen control also passed on rerun; no existing assertion was weakened.

The previous 088 benchmark's descriptor metadata and JSON formatting are
corrected as part of this diagnostic follow-up; its recorded measurements remain
unchanged. Next: ordinary countryside/contact play on the phone, including the
user's saved world and refresh/background transitions, to measure remaining
natural hitches rather than just injected stalls.
