# P2P Worker authority

Status: implemented and focused validation complete, 2026-10-25.
Owner: [multiplayer networking](../topics/multiplayer-networking.md), with
[performance](../topics/performance.md) owning measurement limits.

## Scope and acceptance

Move browser P2P authority onto the existing GameServer Worker. Keep prediction,
rendering and PeerJS on the main thread; forward owned binary buffers rather than
decoding and re-encoding guest traffic there. Preserve the guest wire protocol.

- Host and guests use the same Worker authority, including before guests join.
- Independent bounded guest links preserve ordered delta dependencies. A blocked
  local replica or guest does not stop publication to other ready recipients.
- Hiding the host suppresses its ordinary replica publication and keeps authority
  and guest delivery running. Single player retains hidden-tab pause/resume.
- Replaced connections cannot deliver stale commands or disconnect replacements.
- Save, shutdown, navigation, failure diagnostics and reconnect remain usable.
- Existing embedded scenario hosts retain their shared simulation and channel.

## Commit slices

- [x] Generalize the Worker host with isolated peer links, connection lifecycle,
  per-recipient readiness and explicit multiplayer visibility policy.
- [x] Bridge PeerJS to Worker authority and integrate browser lifecycle/diagnostics.
- [x] Qualify native P2P/Worker boundaries, record measurements and update owners.

## Validation budget

The user explicitly requested focused checks instead of the repository's full
gates. Run affected runtime/transport/replication Vitest files, affected TypeScript
projects and changed-file lint. Use selected real Chromium cases for host/join,
fragmentation/reconnect, background hosting, save/reopen and thread independence.
Capture a short matched single-player/host-only/one-guest comparison before and
after. Build once near completion to check production Worker bundling. Do not run
the full unit/browser suites, broad streaming matrix or unrelated asset generation.
Expand only to investigate a specific failure or newly changed boundary.

## Execution record

- Initial inspection: P2P constructs GameServer in main.ts, while single player
  uses LocalServerRuntime. The latter hardcodes one local connection and pauses
  on visibility changes. OrderedWorkerChannel already bounds binary transfer.
- Planned implementation uses one ordered MessagePort per guest, leaving local
  replica consumption independent from network delivery. Per-client publication
  checks must happen before RealmReplicator advances its last-sent baselines.
- Slice 1: implemented independent ordered ports, host-assigned connection epochs,
  addressed delivery, guest-only failure isolation and per-recipient publication
  readiness. Hidden multiplayer authority continues and suppresses the host's
  ordinary replication; single player keeps pause/resume.
- Slice 1 checks: 30 focused tests pass (WorkerClientTransport,
  OrderedWorkerChannel, GameServer); browser TypeScript project passes. Changed
  runtime-file lint passes with two existing Realm non-null assertion warnings.
- Initial captures left the menu open and recorded idle play; these are not
  walking evidence and are superseded by the movement-checked captures below.
- Slice 2: P2P now uses the same Worker launcher, local transport, save/navigation
  fences and watchdog as single player. PeerJS forwards owned binary buffers;
  guest decode, GameServer simulation and replication encoding live in the Worker.
  Native/PeerJS congestion checks withhold per-link credit between messages.
- Slice 2 checks: 35 focused tests pass across transport, server, diagnostics and
  embedded ScenarioWorkerHost. Browser TypeScript passes. Five selected production
  browser checks pass: menu host/join/leave, large fragmented transfers/reconnect,
  retry exhaustion, single-player save/reopen and physics/visibility lifecycle.
- The new P2P Worker boundary check passes: actual authority ticks advance inside
  a 350ms main-thread stall; render callbacks continue inside a 350ms Worker stall;
  a hidden host with its render loop stopped serves over 120 guest ticks without
  unbounded local buffering; Stop hosting saves an elevation edit for local reopen.
- Bundling passes. The first build check found six art-catalog source line
  references shifted by the Realm publication guard; refreshed metadata only.
  Workshop digest regeneration is required because it includes transport sources.

## Final evidence

[Retained comparison](../benchmarks/188-p2p-worker.json): regional v13 seed 2026,
1280×720, full bundled headless Chromium on Apple M4 Pro. Each case warms for two
seconds and walks right for four seconds with collision enabled. The runner checks
both movement and advancing input acknowledgments, moves away from the shared spawn
before adding a guest, uses isolated origins/contexts and reaps its servers/browser.
The baseline injects only main.ts and PeerHostTransport.ts from 1093c70c onto the
current engine, isolating the hosting split without another checkout. Both captures
use engine revision d5b6ffdb with documentation/test files uncommitted.

| Mode | Before frame p95 | Worker frame p95 | Before main-thread server tick p95 |
| --- | ---: | ---: | ---: |
| Single player | 17.0ms | 18.3ms | Already in Worker |
| Host, no guests | 17.5ms | 17.1ms | 1.4ms |
| Host, one guest | 17.0ms | 18.3ms | 1.7ms |

All six samples run about 60 FPS and advance 240–241 authority ticks and 239–241
input acknowledgments. They move about 294–296 pixels. The Worker host has no
main-thread server tick samples; that work now runs on authority's thread.
These short desktop samples do not reproduce the user's lag or establish a
sustained FPS improvement. One after/one-guest interval reaches 25.5ms; this is
not a universal frame-pacing qualification.

The production-browser Worker test records **19 actual authority ticks during a
350ms main-thread stall**, **20 render callbacks during a 350ms authority stall**,
and **181 authority ticks with host rendering stopped/visibility hidden** while
guests continue receiving frames. The hidden local replica retains one pending
message. A guest edits elevation during this period; the host receives it on
resume and Stop hosting saves it for local reopen. This deterministic visibility
test does not measure OS timer throttling, mobile suspension or WAN performance.

Reproduce the bounded comparison:

```sh
node scripts/benchmark-p2p-worker.mjs --baseline-ref=1093c70c --output=/tmp/p2p-before.json
node scripts/benchmark-p2p-worker.mjs --output=/tmp/p2p-after.json
```

Final checks: 35 tests in the five affected Vitest files pass; browser and server
TypeScript projects pass; lint on 17 changed code/test files passes with only two
existing Realm warnings. Six distinct selected browser cases pass. The final run
rechecks native large-transfer/reconnect plus the completed P2P Worker lifecycle
test after extracting their common local signaling fixture (2/2 pass in 27.3s).
The production build passes, including all committed-inventory checks and Worker
bundling. No full unit/browser suite or broad streaming matrix was run.

Inventory refresh: six source line references change in art-catalog.json. Workshop
regeneration verifies all 2,118 candidates in normal Chromium at retina scale;
1,031 geometry/character source-dependent fingerprints and the input digest change,
with all other candidate fields preserved. Static pixel review identities remain
unchanged; no approvals or review events are synthesized. An initial manifest run
was superseded after detecting in-progress source edits; only the stable result
is retained.

## Next work

Play the usual parent/kid session on the devices where hosting felt slow. If lag
persists, capture that scene/device and distinguish Worker tick debt, main-thread
network/replica work and GPU work. WAN/NAT/mobile/background policy matrices and
unreliable protocol redesign remain deferred; no further broad optimization is
justified by the short desktop capture alone.
