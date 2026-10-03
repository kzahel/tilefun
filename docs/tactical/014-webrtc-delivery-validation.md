# WebRTC delivery validation

Status: validation delivered, 2026-10-03. Five deterministic acceptance failures
are confirmed; real dedicated WebRTC reproduces lost spawn/deletion and stale
world delivery. Runtime protocol behavior is unchanged. Continuing owner:
[multiplayer networking](../topics/multiplayer-networking.md).

## Scope and reproduction

Exercise the actual GameServer → RealmReplicator → binary codec → RemoteStateView
path before changing recovery policy. Faults affect only entity frames, leaving
reliable input/sync/control intact. The existing general client network emulator
can drop reliable application messages too, so it is not used for this audit.

```sh
# Four passing controls and five explicitly expected acceptance failures:
npx vitest run src/server/ReplicationDelivery.test.ts

# Eighteen deterministic scenarios. Exits 1 if any replica fails to converge:
npx tsx scripts/instrumentation/replication-delivery.ts --output=/tmp/rtc-delivery.json
# For an intentional characterization run, add --expect-known-gaps.

# Actual dedicated server, binary RTC messages and two browser replicas:
npm run build
npx playwright test tests/webrtc-delivery.spec.ts --workers=1
```

The test harness pauses autonomous simulation and authors entity changes at the
server so packet delivery is the independent variable. It compares serialized
replica state against an unimpaired control fed every real encoded frame.
Mount/dismount uses the ordinary WorldAPI/PlayerHandle path. Ordered delivery,
100 ms ordered delay, mounting/dismounting and fresh reconnect are controls.

## Confirmed failures

The acceptance tests were first run as ordinary tests: five failed and three
initial controls passed. The mount/dismount control was added subsequently and
also passes. Five tests now use explicit `it.fails`: they describe the desired
unreliable-channel contract and will fail the suite if that assertion starts
passing, prompting removal of the expected-failure annotation. They are not
skipped tests and must not be reported as five successful recovery checks.

| Fault | Observed result after clean delivery resumes |
| --- | --- |
| Lose initial entity baseline | Later deltas cannot create the missing entity |
| Lose final position update, then stop | Client retains the old position |
| Lose entity exit | Deleted entity remains as a ghost |
| Reverse two position updates | Older position overwrites the newer one and persists |
| Deliver old baseline after realm clear | Old-world entity is accepted into the new replica |

The first four have a 120-clean-frame recovery deadline (2 simulated seconds).
The fifth isolates the transition reset and stale packet without inventing a
realm epoch absent from the protocol. Real browser tests also perform an actual
world transition and verify the stale entity survives 120 clean applied frames.

## Seeded schedules

[Recorded evidence](../benchmarks/014-webrtc-delivery.json) includes seeds 42,
2026 and 8675309, packet counts, missing/extra/mismatched entities, residual
position error and encoded bytes. Each run has 240 impaired ticks, 120 initial
clean ticks, drains delayed messages, then allows another 120 clean ticks.
The fixture spawns 40 chickens, changes metadata, moves an entity then stops it,
and deletes 20 chickens. All steps use real replication and codec output.

| Schedule | Converged runs |
| --- | --- |
| Ordered 100 ms delivery delay | 3 / 3 |
| Seeded 1% frame loss | 1 / 3 |
| Seeded 5% frame loss | 0 / 3 |
| Seeded 20% frame loss | 0 / 3 |
| Six-frame loss burst every 30 ticks | 0 / 3 |
| Seeded 0–200 ms delay with reordering | 0 / 3 |

A lost unchanged frame is harmless; the one successful 1% run does not prove
recovery. The other fourteen adverse runs retain state differences. Byte counts
include initial chunk/sync encoding and packets later discarded by the harness;
they are not delivered throughput or a production bandwidth benchmark.

## Real dedicated WebRTC evidence

The browser harness launches the production standalone server with isolated
filesystem data and two separate Playwright Chromium contexts. It asserts an
open ordered/reliable `sync` channel and an open unordered `entities` channel
with `maxRetransmits=0`, then intercepts only entity messages at the actual RTC
receive boundary before production decoding. An untouched second client
confirms spawn/deletion on the same world.

- Dropping one baseline causes a missing chicken after 120 applied clean frames.
- Closing `entities` demonstrably moves frames onto `sync`, but another 120 clean
  frames do not recreate the lost entity. A fresh page reconnect does recover it;
  subsequent deletion reaches both clients.
- Dropping one exit leaves the subject's chicken after the healthy client deletes it.
- Holding a real baseline, joining a new world, then releasing it inserts the old
  chicken into the destination. It remains after 120 clean applied frames.

The two browser tests intentionally assert the observed defects, named as
reproductions. Convert them to recovery assertions when fixing the protocol.
Receive/application counts are recorded in test attachments and the evidence JSON.
Waits count actual applications, not idle time or an instantaneously empty queue.
The server is terminated and its temporary data removed after the run.

## Repository verification

All three repository TypeScript configurations pass, and an additional strict
check covers the browser harness and diagnostic CLI. Unit results: 1,196 passes
and five explicit expected failures across 117 files. All 242 Playwright cases
pass, including the two defect-characterization browser cases. Production build
and inventory checks pass; Biome retains 122 existing warnings and 32 infos,
with no diagnostics in the added files. Test browser/server processes were reaped.

## Limits and recommended next slice

This is deterministic message-fault testing plus real RTC on loopback. It does
not inject OS-level UDP loss or claim WAN, NAT/TURN, congestion, mobile or
cross-browser coverage. Those lanes cannot establish protocol correctness while
single-message loss already fails these small cases.

Decide recovery policy before expanding network testing. A bounded first fix is
to keep dependent entity deltas on the same reliable ordered stream as lifecycle
messages. Retaining unreliable delivery instead requires recoverable baselines,
entity lifecycle/field state repair, ordering rules and a realm/session epoch;
merely rejecting old ticks does not repair lost fields. Add a bounded recovery
contract and make applicable acceptance tests pass; if unreliable frames are
retired, replace these cases with tests proving ordered routing and transitions.
Then validate latency/congestion and OS-level impairment on supported test hosts.
