# Protocol Instrumentation

Temporary scripts for auditing which messages still go through JSON fallback (`0xFF`) and roughly how large they are.

## Scripts

- `protocol-fallback-audit.ts`
  - Runs a controlled local `GameServer` simulation with two clients.
  - Reports measured JSON-fallback bytes/counts for client and server message types actually emitted in that scenario.

- `protocol-fallback-size-samples.ts`
  - Encodes representative payloads for each fallback message type.
  - Prints one-shot sample sizes (bytes) for quick comparisons.

## Run

From repo root:

```bash
npx -y tsx scripts/instrumentation/protocol-fallback-audit.ts
npx -y tsx scripts/instrumentation/protocol-fallback-size-samples.ts
```

## Notes

- These are intentionally ad hoc and easy to delete.
- They do not modify runtime behavior or production code paths.

## Replication delivery validation

`replication-delivery.ts` exercises the real server replicator, binary codec and
client replica under seeded entity-frame loss, delay, bursts and reordering.
Reliable traffic is unaffected. It is a repeatable diagnostic, independent of
the ad hoc JSON fallback audits above.

```sh
npx tsx scripts/instrumentation/replication-delivery.ts --output=/tmp/rtc-delivery.json
```

The default exit status is 1 when any scenario does not converge after its clean
recovery window. `--expect-known-gaps` permits a characterization run without
changing the recorded result. Current failures and real WebRTC browser checks
are documented in [Tactical 014](../../docs/tactical/014-webrtc-delivery-validation.md).
This models application-frame faults, not UDP/SCTP congestion or WAN behavior.
