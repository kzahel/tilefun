# Retained replay-input compatibility evidence

These QA receipts document explicit historical renderer snapshot resolution.
They are evidence only, not constructor/runtime dependencies. Do not add them to
existing receipt input maps or change immutable receipts, exporters, catalog or
snapshot bytes to accommodate them.

- `source-offroad-jeep-replay.json`: fresh declared-input constructor reproduced
  exact model, atlas and recipe hashes through the registered historical input.
- `runtime-offroad-jeep-replay.json` and `runtime-semi-truck-replay.json`: actual
  retained v3 exporter reproduced exact model, sprite and receipt bytes plus the
  independently compared current selected catalog entry. Semi has six wheels.
- `all19-pin-resolution.json`: all 38 immutable source/runtime receipts across
  19 families resolve exact declared pins through the one registered snapshot.
- `controls-summary.json`: 37 completed focused controls (16 resolver, 11 runtime
  wrapper policy, 10 existing pipeline controls), Python compilation and a separate
  actual unchanged-v3 missing-declaration negative before outputs. The wrapper
  policy fixtures use a synthetic exporter; actual Blender/v3 evidence is separate.
- `evidence-index.json`: final evidence/tool SHA256 pins and snapshot identity.

Paths within JSON receipts are repository-relative unless they are evidence file
basenames. Temporary scratch roots, process/session information and machine
configuration are intentionally omitted. These are portable summaries of the
completed validation; this documentation task did not rerun tests.

The historical snapshot is the former CarMeshAsset.ts pin
`b0c162b99d077e816761e58b0d48db84e53f1992f9dd82897eee7af940b5611c`.
Current two/three-wheel loader and old car/boat pixel validation are separate
requirements; historical replay cannot qualify a later live engine. The current
engine continues to require its own tests and native-pixel checks. No motorcycle
normal activation, all-27 identity coverage, AI occupant or occupied fallback
claim follows from these receipts. Consult docs/vehicle-authoring-pipeline.md.
