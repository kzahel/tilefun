# Protocol Fallback Instrumentation

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
