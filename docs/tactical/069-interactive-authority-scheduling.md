# Interactive authority scheduling

Status: delivered and validated, 2026-10-07.
Owner: [Embedded engine labs](../topics/embedded-engine-labs.md).

The owner authorized aligning interactive previews with production scheduling
after the landscape checkpoint (`e1e5b23`). Interactive authority must advance
independently of render/input delivery using the production `ServerLoop`, with
the same bounded Worker channel and Realm streaming/replication paths. Preserve
temporary memory persistence, recipes and deterministic manual headless steps.

Implementation boundaries:

- Separate binary player input admission from world ticks; real-time ticks must
  not await all visible chunks before advancing. Shared Realm admission owns
  support readiness. Snapshots are unsolicited, ordered and backpressured.
- Keep pause/hidden/pose inspection, asynchronous commands, reset/reload and
  teardown as explicit clock fences. Restart without accumulated hidden time;
  reject simultaneous automatic and manual stepping.
- Use production channel credits and bounded client decode, including automatic
  pumping during startup, pause and control operations. Do not drop dependent
  deltas or stop authority merely because the main thread is slow.
- Exercise independent input/tick cadence, output pressure, lifecycle races,
  client render stalls, real train travel and every embedded consumer. Refresh
  behavior fingerprints without changing frozen art or human decisions.

Validation: typechecks, all unit tests, lint, generated inventories/build, full
browser suite and the real-game streaming readiness benchmark. Record timing
limits and any unrelated existing failures explicitly.

## Delivered behavior

`ScenarioWorkerHost` owns the existing `ServerLoop`; the browser client explicitly
opens real-time mode and starts it after presentation is ready. Binary inputs
enter `Realm.handleMessage` without advancing time. Timed `ScenarioSession.tick`
calls normal Realm streaming and broadcasting; output pressure suppresses replica
construction, preserving delta dependencies while simulation continues.
`ScenarioSession.step` and the default manual Worker host remain timer-free.

Both endpoints use `OrderedWorkerChannel`. Individual binary packets count toward
its existing byte/count bounds and transfer lists; response fences follow their
frames. Startup/reset headers clear replicas before a new baseline. Client decode
is pumped at update boundaries with the production budget; startup, pause/hidden
and pending controls also pump without RAF so lifecycle receipts cannot deadlock.

Clock intent is independent of temporary client busy state, avoiding a start/stop
feedback loop while waiting for acknowledgments. Pause clears pending authority
input and resets prediction against its acknowledged snapshot. Async controls
stop the timer throughout awaited work. Reload/reset failures stop authority and
terminate the client instead of ticking a partially replaced Realm. A closed
manual host can explicitly open fresh memory again.

All gameplay consumers inherit this through ScenarioPresentationHost: Traffic,
Outdoor Geometry, Character, furniture playtest, World Geometry and natural
landscapes. Full GameServer world/profile management, periodic save policy,
multiplayer hosting and game UI remain outside this temporary host. This change
aligns scheduling/transport/streaming admission, not those application features.

## Validation checkpoint

- All **1,741 unit tests**, typechecks, lint and build pass. Lint retains its
  existing 118 warnings and 34 informational diagnostics.
- Four new native cases cover autonomous ticks without input, batched input
  admission, deferred output, no per-tick readiness await, manual/live exclusion,
  awaited-command fences, pause/resume, close and failed reload.
- All **15 focused browser checks** pass on bundled full Chromium: affected
  embedded consumers, forest/train scenes, replacement/disposal and the new clock
  regression. A deliberate 650ms main-thread stall leaves authority at least ten
  ticks ahead of capped client catch-up input, on both Canvas and GPU. This proves
  independent scheduling; it does not measure device frame pacing.
- Visibility tests invoke the real handler with a synthetic hidden state; they
  prove clock/lifecycle behavior, not OS background-tab timer policy. Existing
  native ServerLoop tests cover bounded late wakes and fresh resume deadlines.
- Catalog and all 641 candidate identities verify in normal Chromium at retina
  scale. Exactly 65 live identities change: 36 natural, 12 World Geometry, six
  Character and eleven furniture motion. The latter use presentation version 2;
  live source fingerprints include the clock/transport/host sources. Static art
  identities, frozen banks and human decisions are unchanged.

The final full browser run passed **382/384** in 12.3 minutes, including both
complete game city-train journeys, all embedded consumers, client-stall/visibility
regressions, traffic retention, train/vehicle grades and underground reloads.
The two failures are the existing wildlife-review cases blocked by the absent
archived `demos/wildlife-v2/fox/pilot-v1/preview.gif`. No wildlife archive was
changed or approval synthesized. The final Workshop inbox reports a current
manifest and preserves the historical reviews for the changed motion identities.

The isolated production `streaming:bench -- --assert-ready` also passes after
the browser suite stops, with zero missing or incomplete visible terrain frames
during walk, sprint and reverse. [Recorded readiness](../benchmarks/069-interactive-scheduling-readiness.json)
identifies the host/device and scope. These are functional readiness results,
not matched lab/game frame-pacing measurements.

Next: human train-ride/movement review in the aligned live previews, followed by
matched scene profiling if a pacing difference remains. The landscape composition
review and eventual default-world integration continue under their own topic.
