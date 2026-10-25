# P2P Worker authority

Status: in progress, 2026-10-25.
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
- [ ] Bridge PeerJS to Worker authority and integrate browser lifecycle/diagnostics.
- [ ] Qualify native P2P/Worker boundaries, record measurements and update owners.

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
- Before P2P integration, short regional-seed-2026 desktop samples record 241
  render callbacks and 241 ticks in each four-second sample, frame p95 about
  17.4–17.8ms. This warm scene does not reproduce the reported hosting lag.

## Evidence and remaining work

Pending implementation and focused validation. Measurements will distinguish
ordinary pacing from controlled stall evidence; no WAN/mobile claim is intended.
