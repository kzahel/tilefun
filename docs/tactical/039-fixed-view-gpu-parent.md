# 039 — Fixed-view GPU rendering and optional mesh bodies

Status: active, 2026-10-04. Parent sequencing plan.
Owner: [rendering architecture](../topics/rendering-architecture.md).
User authorized end-to-end autonomous implementation and commits on 2026-10-04.

Deliver the existing game presentation through an optional GPU backend, then one
mesh car with continuous visual orientation under the unchanged projection.
Keep the shared simulation, presentation rules and Canvas reference. Follow the
[composition invariants](../topics/rendering-architecture.md#fixed-view-spritemesh-invariants).
Diagnostic mesh acceptance is separate from approving reconstructed artwork.

| Slice | Status | Completion gate |
| --- | --- | --- |
| 1 — Compatibility baseline | Complete: 040 | Projection fixtures and reference scene coverage identified |
| 2 — GPU sprite scene | Complete: 041 | Shared drawing rules, persistent texture resources, actual GPU comparison |
| 3 — Optional mesh body | Complete: 042 | Neutral asset/pose data, isolated depth, same anchor/order and sprite fallback |
| 4 — Continuous orientation | Complete: 043 | Shared pose evaluation, arbitrary headings, inspector/gameplay reuse |
| 5 — Integration/lifecycle | Complete: 044 | All passes, streaming/editing, bounded residency, recovery and fallback tests |
| 6 — Measurement/decision | Active: 045 | Matched browser/phone evidence, WebGPU feasibility, honest default decision |

Create each slice tactical on arrival. Commit validated increments; record scope
adjustments and failures. Run required unit/type/lint checks and full rendering
validation, catalog/manifest verification and streaming readiness where affected.
No automatic artwork approval or presumption of a speedup. Canvas stays default
unless parity and device evidence justify adoption. Rust is outside this delivery.
