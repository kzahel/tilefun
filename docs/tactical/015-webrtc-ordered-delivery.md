# WebRTC ordered delivery

Status: bounded correctness fix delivered, 2026-10-03.
Owner: [multiplayer networking](../topics/multiplayer-networking.md).
Pre-fix evidence: [delivery audit 014](014-webrtc-delivery-validation.md).

## Decision and scope

Send every server gameplay message over reliable ordered `sync`, including
entity baselines, dependent field deltas, exits and world/realm resets. Client
input already uses sync. The optional legacy `entities` channel remains
negotiated/accepted for compatibility, but the current server never selects it.
HUD/debug descriptions now reflect ordered sync instead of dual-channel routing.

This prevents all five audited failure paths: missing spawns, stale final
positions, ghost deletions, reversed updates and late old-world baselines. It
uses the existing WebRTC reliability and fragmentation path. There is no new
snapshot acknowledgement, recovery protocol, epoch or wire schema.

The tradeoff is waiting behind retransmission or larger reliable messages.
Keep that correctness-first policy until measured gameplay latency justifies
more complexity. Existing sessions already corrupted by the old routing need a
reconnect to rebuild baselines. Update the server/host; a client-only update
cannot fix an old server's unreliable routing.

## Regression evidence

The former five expected failures are now ordinary passing regression cases.
The harness uses the production channel selector and models reliable loss as
30 ticks of extra delay, preserving FIFO for all messages on that channel.
Unreliable messages still drop/reorder, so switching frames back to the old
policy breaks the regressions. World-reset ordering is checked on the same queue.
Four original controls cover ordinary edits/deletes, bounded delay,
mount/dismount through the codec and reconnect baseline repair.

[Seeded results](../benchmarks/015-webrtc-ordered-delivery.json): all 18 runs
converge with zero missing, extra or mismatched entities and zero residual
position error. Profiles include bounded delay, 1/5/20% loss attempts,
six-frame bursts and 0–200 ms jitter. Sync defers rather than drops or reorders.
The report records the parent commit and dirty working-tree state during this
fix; it exercises the code committed with this document.

The diagnostic retains an explicit legacy mode for comparison. Replaying it
still reproduces 14 divergent adverse runs out of 15, plus three converging
ordered controls. These are application/channel models, not SCTP throughput,
UDP impairment or a claim about latency on real networks.

Two real dedicated-server WebRTC browser regressions pass:

- Two independent clients agree on spawns and deletes while receive-side loss
  hooks are armed on `entities`. Both channels are open, but zero entity frames
  arrive on the unreliable one; reliable sync carries the frames.
- Closing the optional channel preserves updates; reconnect retains convergence.
- Holding the entire reliable receive stream queues a real old-world baseline,
  followed by the actual server's realm transition response. Releasing in order
  clears the old-world entity; it does not remain after 120 applied frames.

The fixture pauses autonomous movement and uses isolated server data, local
signaling and bundled Playwright Chromium. Browser/server processes are reaped.

## Reproduction and repository checks

```sh
npm run typecheck
npm test
npm run check
npx tsx scripts/instrumentation/replication-delivery.ts --output=/tmp/rtc-ordered.json
# Optional historical comparison (not the production delivery policy):
npx tsx scripts/instrumentation/replication-delivery.ts --legacy-unreliable --expect-known-gaps
npm run build
npx playwright test
```

All three repository TypeScript configurations and a strict standalone check
of the browser harness/diagnostic pass. Unit suite: 1,207 tests in 118 files,
with no expected failures in delivery tests. Build and inventory checks pass.
Biome reports the same 122 existing warnings and 32 infos, with no new diagnostics.
The build's broad Workshop input hash includes transport sources, so the
manifest was regenerated: only its input digest changed; all 327 candidate
identities stayed identical. All 243 Playwright cases pass, including both real
WebRTC regressions; the complete browser run took 4.9 minutes.

## Deferred work

The [backlog](../ideas.md#deferred-networking-investigation) owns a future
networking investigation: WAN/NAT/TURN, OS UDP impairment, congestion/large
transfer latency, mobile/cross-browser testing and any recoverable unreliable
protocol. These are explicitly outside this bug-fix slice. Next useful product
step: deploy the updated host and reconnect clients, then judge ordinary co-op
play before selecting further networking work.
