# Red car low-poly authoring pipeline

Status: corrected appearance accepted; final asset commit requested, 2026-10-19.

The owner chose 141's approach 3 as the closest style, especially its characteristic
outlines, and authorized YA subagents to refine its low-poly delivery and reusable
pipeline. This checkpoint is **red car only**. Beetle, school bus, pickup and other
families remain backlog until the owner agrees to the red car result.

## Acceptance target

Preserve the chosen coupe's shape, glass/panel ink, palette and clean pixel clusters
on a low-poly textured GLB with four independently rolling wheels. Keep the outer
silhouette ink in the existing renderer. No high-poly geometry, sprite billboards,
view-switched textures or per-view painting may substitute for a real runtime mesh.

Three independent YA Codex 6.1 Sol/high/bypass sessions compare source reduction,
authored retopology and semantic bake/paint transfer. Each targets a 1.2–3k total
triangle range with actual exported counts, a packed editable source, one compact
unlit atlas, explicit UV ownership and replay commands. A budget ladder on the
best route will determine which geometry earns its cost at native pixels.

The coordinator owns shared GLB/engine capture, comparison, review registration,
pipeline instructions and the [original vehicle backlog](../vehicle-status.md).
The exact 141 sources and all current production vehicles remain immutable.

## Evidence and outcome

All three YA sessions used `gpt-6.1-sol`, high reasoning and bypass permissions.
Common agent contract: `scripts/vehicle-bake/README.md`.

| Route | Actual exported triangle counts | Finding |
| --- | --- | --- |
| Source reduction + visible owned projection | 1,376 / 1,877 / 2,469 | Closest retained transfer; 1,877-triangle economy baseline |
| Authored geometry + semantic UV paint | 1,324 / 2,378 | Economical alternative with more angular features |
| High-surface semantic ray bake | 2,597 | True surface-transfer alternative, with retained ambiguity/unknown maps |

The common viewer loads actual GLBs through `CarMeshAsset` and `CarPixelOutline`,
with a 128px nearest unlit target and fixed camera registration. Six initial
candidates passed actual material/hierarchy audits, independent forward/reverse
roll checks, 16 study and 16 game headings, clipping checks and complete neutral
roll-envelope separation from the actual fixed body (including collision negative
controls). These checks qualify engineering properties, not owner art acceptance.
The standalone desktop/mobile viewer probe and 57 focused browser tests passed.

Owner feedback: the style otherwise looks good, but upper/far tires appear above
the fenders. This is also present in the retained detailed source. Thin arch trim
does not provide upper-tread coverage; a nonintersecting wheel can still look
exposed above the body. A is authoring a fresh physical-fender revision, while B
independently diagnoses and measures coverage. Initial raised caps were rejected
by the coordinator for conspicuous red humps; the next iteration must integrate
the shoulders smoothly and preserve the low sports-car silhouette.

The resulting `a-reduced-projection/mid-fenders-v3` has 2,299 triangles, 2,982
exported vertices, five draw primitives and one unchanged 512² atlas in a
149,324-byte embedded GLB. Integrated longitudinal shoulders replace thin trim,
and each wheel is tucked inward by .08 source units; wheel radius, axle X and
ground contact are preserved. Both shared camera sets now have a continuous body
profile with covered far tire crowns and visible near-side wheels. The independent
actual-GLB roll-clearance proof and shared captures pass for this exact export.

[Independent evidence](../../art-source/vehicle-bake/wheel-coverage/README.md)
records the inherited source defect and declared 25-point crown region per wheel:
baseline broad-panel coverage is 0/25 on each wheel, corrected coverage is 25/25
on each. Body-removal and displaced-panel negative controls pass. These finite
vertical samples do not certify camera-space appearance; raised-cap v1 is an
explicit example of perfect sampled coverage with an unacceptable silhouette.
Native/game visual inspection remains a separate gate.

`public/demos/vehicle-bake/wheel-review.png` presents actual before/after captures.
The standalone review defaults to v3; earlier six variants remain available as
experiments. Owner review of this correction is the next step before Beetle,
school-bus or pickup authoring.

Retained revisions are under `art-source/vehicle-bake/` and
`public/demos/vehicle-bake/`; local API receipts stay under ignored `data/vehicle-bake/`.
The registered Workshop batch is `vehicle-bake`. The hosted origin does not yet
serve this checkout's files; the generated standalone `data/vehicle-bake/review.html`
embeds the actual low-poly GLBs for local review. No gameplay activation or human
art acceptance is implied.

## Validation limits

Owner checkpoint: "good looks better" on the corrected v3 presentation, followed
by a request to commit assets/final outputs and ignore intermediate/generated
scratch. The exact GLB/atlas and frozen review identities are unchanged. Retain
only completed source/review bundles, their pinned inputs and final proof records;
ignore rejected drafts, duplicate replays, handoffs, backups and local `data/`.
The source and final proofs are intentional retained artifacts, including generated
GLBs/captures needed for normal builds and review. No gameplay wiring is present;
spawn/traffic integration remains the next implementation step.

Typecheck, lint and production build passed. The full unit run passed 4,379 tests
with five failures from Windows symlink permissions/POSIX process-signal behavior
and ten skipped tests. Full browser collection is blocked by the missing installed
`peer` dependency in existing P2P suites; the four focused Workshop/vehicle/browser
suites passed all 57 tests. No shared engine behavior was changed.
