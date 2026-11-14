# Split-screen player movement starvation

Investigation: 2026-11-14. The owner reported that, after playing split screen on
a Chromebook, player movement appeared to fall to roughly 1 Hz while NPCs stayed
smooth. A deterministic native control reproduced player-only freezing. The
original Chromebook session, elapsed-time trigger and exact 1 Hz cadence have
not been captured. The shared predictor now fixes this starvation mechanism;
device confirmation remains.

## Deterministic reproduction

Run `npx tsx scripts/reproduce-split-prediction.ts`. It uses the production
GameServer, binary device input/replication, DeviceSession, PlayerPredictor and
RemoteStateView presentation with two local seats and one walking chicken.
All persistence is in memory. No browser or real-time scheduling is needed.

The diagnostic charges each ordinary private physics step 3 ms on the predictor's
injected budget clock; this is simulated CPU cost, not measured device timing.
It delays outgoing input by four authority ticks (about 67 ms), while continuing
to deliver authoritative frames each tick. Physics arithmetic is unchanged.

- Slow steps with no input delay keep advancing normally.
- Delayed inputs with unrestricted replay keep advancing normally.
- Before the fix, combining the two held both predicted players at their committed poses for
  all 300 updates. Authority moves each player about 319 px during the window.
  The chicken's presented position changes on all 299 consecutive intervals.
  Only five inputs remain unacknowledged: this is not history overflow.
- Removing the simulated step cost recovers within ten updates, with the input
  delay still present.

The original failure is retained in the receipt's `native` entry. The CLI now
asserts forward progress for both seats, bounded display lag, at most one replay
step per slow update, uninterrupted NPC movement, and the separate controls.
[Compact receipts](../benchmarks/split-screen-prediction-starvation.json) retain
the controls, frozen poses, recovery and browser summaries.

## Mechanism

Before the fix, `PlayerPredictor.storeInput` appended new input to an active replay,
and `replayTarget` advanced its finish tick with every new input. `drainReplay`
allows at least one physics step, then checks a 2 ms elapsed budget. When only
one step fits per update, replay advances one tick while its target also advances
one tick; existing debt never closes. The diagnostic's replay acknowledgement
remains 116 even as fresh frames arrive and ordinary retained history stays small.
The latest queued snapshot waits for the active replay to finish; cancellation
requires authority to acknowledge the replay's continually extended input suffix.

While replay is incomplete, `presentEntities` retains the last committed local
presentation. Both seats share it. Unrelated NPCs continue using buffered
authoritative presentation. This explains how player-only stalling can coexist
with smooth NPC movement. It is a confirmed mechanism, not yet attribution of
the original Chromebook event.

## Browser controls and limits

`node scripts/instrumentation/split-screen-pacing.mjs --regional --split-only
--turn-seconds=3 --seconds=30 --rates=16,1` runs the ordinary Worker game in
isolated bundled Chromium, with keyboard split screen and a short out-and-back
route. An ephemeral Vite server, browser, data and caches are cleaned up.
The raw report records both seats' authority/predicted poses, sampled presented
actors, acknowledgements, replay horizon and frame cadence.

On this desktop, the 16× page CPU throttle produced 20.27 predicted-pose
publications/s with a 251.6 ms maximum publication gap, versus about 37.8 drawn
frames/s. Returning to 1× restored 60 publications/s. Authority stayed near 60 Hz.
A separate 67 ms outbound-delay control at 8× produced 47.61 publications/s and
an 118.6 ms maximum gap; 1× restored 60/s with the delay still enabled. No page
errors occurred. Publication counts describe committed physics poses, not
guaranteed visible movement or input responsiveness on every frame.

These desktop controls did not reproduce the reported sustained 1 Hz cadence.
The page CPU throttle leaves the authority Worker unthrottled and is not
Chromebook emulation. Earlier straight regional traversal eventually hit an
obstacle; its stationary tail is excluded from movement evidence. An initial
flat solo control used an incompatible key spelling and is also excluded from
movement evidence.

## Delivered fix

An incomplete replay freezes its input cutoff after its first budgeted slice.
New commands remain in bounded input history instead of extending that replay.
Only a completed prefix publishes; scratch poses remain private. A new snapshot
whose acknowledgement covers the fixed prefix can supersede it normally.

The committed input tick is the prefix's tick, rather than the latest submitted
tick. Horizon planning advances unpublished local time once and uses authority
time as a lower bound; adding unpublished time again on top of a fresh snapshot
would turn this fix into growing lag. Without a new snapshot, subsequent forward
steps consume pending commands in order, preserving a jump pressed and released
after the cutoff. Complete same-tick comparison and contact-group presentation
remain shared across local seats. `PredictionReplay.ts` owns replay records and
the horizon calculation; PlayerPredictor retains stepping and publication.

The 2 ms elapsed target and eight-step cap are unchanged. This guarantees a
finite replay endpoint, not 60 Hz prediction on hardware unable to afford it.
Under the diagnostic's one-step budget, both seats move about 319 px over 300
updates, with 150 primary position changes and no unchanged run over one update.
NPC presentation changes on all 299 consecutive intervals. Returning to a fast
budget recovers ordinary immediate prediction with input delay still present.

A real Worker/Chromium control uses `--minimum-step-ms=3 --tx-latency=67
--turn-seconds=3 --regional --split-only --seconds=15 --rates=1`. The private
physics step deliberately burns at least 3 ms of actual main-thread CPU; the
authority Worker is unmodified. Prediction publishes 19.98 times/s, with a
66.9 ms maximum gap, while rendering and authority remain near 60 Hz. This is
artificial load, not measured Chromebook performance. The receipt's `fixed`
entry retains the native and browser results.

Native regression coverage exercises sustained delayed input under a one-step
budget on the actual multi-seat device path, including bounded authority/display
separation. The existing long sliced-replay case now checks the finite prefix,
same-tick comparison, retained jump and continued physics clock without fresh
authority frames. Existing walk/run/car and cooperative prediction cases pass.

Validation: 568 client/scenario native tests passed; the final 41 prediction tests
passed again after separating the replay records/horizon helper and slice/commit
methods. All four typecheck configurations, focused Biome checks and knip pass.
Nine production Chromium checks cover keyboard/controller split screen, save and
reload, edit/play prediction recovery, shared two-pane vehicle physics, lab
lifecycle and scheduling. Streaming readiness passes. Art catalog, Workshop
manifest and production build pass using installed Node 24.22.1; the default
Node 27 alpha fails the existing pngjs inflater before building. The generated
Workshop change is its input digest only.

The code-health ratchet has no new violation in this change: PlayerPredictor is
950 lines, below its 963-line baseline, with no complexity growth. The aggregate
check still fails on unchanged baseline violations in GameClient, PhysicsScene,
PlayScene and MainMenu. No baseline was raised.

## Next work

Confirm ordinary split-screen play on the Chromebook with the owner's input
devices and elapsed-time pattern after Save and reload. Desktop forced-load
controls establish the fixed mechanism, not the original thermal/load trigger.
