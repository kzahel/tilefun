# 022 — Renderer backend decoupling

Status: **active; authorized end to end**.
Created: 2026-10-03. This is a parent sequencing and progress plan.
Owner: [rendering architecture](../topics/rendering-architecture.md).
Measurement owner: [performance](../topics/performance.md).

## Objective and finish line

Finish the separation from game state, through presentation data, to a replaceable
rendering backend. Canvas2D remains the working production implementation.
Adding another backend should require implementing the rendering contract and
selecting it at the application entry point, without changing physics, world
generation, editing rules, visibility or depth-ordering logic.

The architecture topic owns the durable contracts and visual invariants. This
parent owns sequence, progress and completion gates; child tacticals own detailed
implementation plans and evidence. Five remaining milestones are expected to
need roughly **4–6 delivery slices**, but passing the gates determines completion,
not the number of commits. Split or reorder work when inspection justifies it.

This plan does not include implementing WebGPU/wgpu, porting to Rust/WASM,
rewriting simulation or persistence, changing approved art, deploying the game,
or resolving every phone hitch. Those are separate decisions after this boundary
is demonstrated. Do not build a generic wrapper around individual Canvas calls.

## Activation and autonomous execution

The user requested this setup on 2026-10-03 and wants implementation to begin
only on a subsequent start signal. “Start renderer plan” or an equivalent clear
instruction activates the entire sequence, not just its first slice. Record that
instruction and date in the checkpoint below before implementation begins.

Once activated, plan, implement, validate and commit each slice, update the
checkpoint, then continue to the next slice without asking for routine approval.
Direct commits on the current branch are already authorized. Keep the user
informed of meaningful findings and progress. Routine design choices, failed
tests and a need to split a slice are work to resolve, not reasons to ask whether
to continue. A status question does not cancel the sequence.

Stop for an explicit user pause, a requirement conflict requiring their decision,
an external blocker that prevents further useful work, or an action outside the
authorized scope. Respect art-review requirements if a proposed change would
alter approved pixels; first try preserving existing behavior. Document the exact
blocker, evidence, independent work completed and the smallest needed decision.
An unavailable phone alone does not block deterministic or desktop validation;
record that evidence gap accurately. Never mark blocked or unvalidated work done.

This document is a durable continuation checkpoint, not a background scheduler.
After an interruption or context reset, read AGENTS.md, the topic, this plan and
the active child; inspect Git status/history and reconcile actual work with the
checkpoint. Preserve unrelated concurrent changes. If activated and not paused
or complete, resume the remaining authorized work without repeating finished
slices. If still awaiting activation, do not begin implementation.

## Progress checkpoint

- **Activation:** 2026-10-03: “go ahead proceed fully end to end autonomously committing as you go.”
- **Overall state:** R1–R4 delivered; final boundary proof and integrated validation next.
- **Active child tactical:** [033 Shared terrain and consumers](033-shared-terrain-and-consumers.md).
- **Next action:** remove obsolete APIs, guard dependencies and run final recording/device validation (034).
- **Blockers:** none known; device availability and current checkout must be
  checked when implementation starts.
- **Completion evidence:** pending the gates below.

Completed foundations, recorded in [Tactical 013](013-renderer-boundary-and-allocation-audit.md#implementation-record-renderer-resource-boundaries):

| Foundation | Delivered commit |
| --- | --- |
| Desired architecture and resource/frame lifetimes | `7fad488` |
| Terrain canvas ownership removed from world chunks | `50f6181` |
| Neutral elevation resource handles | `c471375` |
| Static backend-independent elevation descriptors | `9c56be5` |

## Remaining milestones

| ID | Outcome and dependencies | Exit evidence | State / child / commits |
| --- | --- | --- | --- |
| R1 | Define and use a neutral frame contract for outdoor terrain, shadows, sorted scene content and editor overlays. Separate static content updates from camera/dynamic frame data. Builds on the completed foundations. | Real outdoor/editor orchestration submits ordered data; no Canvas objects or draw callbacks cross the contract. Existing phase/depth behavior and reusable frame ownership are preserved. | Done / [029](029-outdoor-frame-contract.md), [030](030-editor-overlay-data.md) / `d613cfd`; `9823673` |
| R2 | Express indoor floors, actors, furniture and walls through ordered data on the same contract. Depends on R1; split if needed to preserve occlusion safely. | Remove indoor actor draw callbacks; representative rooms, edited furniture and actor/wall crossings retain visual parity and cache reuse. | Done / [031](031-interior-frame-data.md) / `dce609b` |
| R3 | Separate sprite/atlas descriptions from loaded images. Coordinate IDs and geometry with R1/R2; move earlier if those slices need the catalog first. | Presentation resolves metadata without browser image types. Backends own loaded resources, asset invalidation and stale-resource handling. | Done / [028](028-sprite-metadata.md), [032](032-renderer-host-lifecycle.md), [033](033-shared-terrain-and-consumers.md) / `fb73fa0`; `2d86c08`; current slice |
| R4 | Complete one backend interface and migrate gameplay, editor, explorer and review consumers. Depends on R1–R3. Include preparation, resize, invalidation, realm change, disposal and resource recovery ownership. | Consumers select a backend at composition; concrete Canvas renderer access leaves game presentation orchestration. Independent instances and lifecycle transitions do not share or leak resources. | Done / [032](032-renderer-host-lifecycle.md), [033](033-shared-terrain-and-consumers.md) / `2d86c08`; current slice |
| R5 | Remove transitional APIs and prove the boundary with a recording backend and final integration/allocation checks. Depends on R1–R4. | Representative outdoor, indoor and editor frames run through the same presentation path without Canvas resources, draw callbacks or simulation mutation. Remaining platform dependencies are inventoried and justified; all completion gates pass. | Pending / — / — |

Each milestone row must link its actual child tactical(s), delivered commits and
evidence as work proceeds. Use pending, planning, implementing, validating, done
or blocked states. A milestone can span several children; a child can finish
closely related parts of two milestones. Record such changes and their reason.

## Just-in-time slice protocol

Before each slice, inspect the current implementation and previous evidence.
Create a bounded child tactical and add it to the index. Specify:

- The concrete behavior/boundary being delivered, affected consumers and current
  coupling, with source locations verified at that time.
- Proposed data ownership, resource lifetimes, invalidation and ordering rules;
  any temporary adapter and the milestone that removes it.
- Scope, exclusions, focused acceptance tests and relevant baseline workload.
- Validation commands and evidence needed to call this slice complete.

Then implement a working vertical slice, preserving the Canvas implementation.
Run its checks, fix introduced regressions, inspect the diff and stage only this
work. Update the child evidence, parent checkpoint and topic status/contracts,
then commit. Record the resulting commit in the next checkpoint update; avoid
trying to embed a commit's own hash in its contents. Continue immediately with
the next useful slice until the finish gates pass. Keep the active checkpoint
accurate before a handoff or interruption; do not commit broken runtime work as
a completed slice.

If inspection reveals a missing dependency, add a bounded child or adjust the
sequence with a reason. Do not expand into unrelated optimizations or a new
backend implementation. Use a final corrective slice if verification exposes a
remaining coupling; nominal milestone completion is not sufficient.

## Completion gates

- [ ] Production outdoor, indoor and editor presentation emits backend-neutral
  ordered data, covering terrain, shadows, actors, elevation, grass, particles,
  walls/furniture and overlays. Ordering lives outside the backend.
- [ ] Static terrain/asset updates are versioned separately from dynamic frame
  data. Camera-only movement reuses static geometry/resources; frame borrowing
  and future asynchronous ownership requirements are explicit.
- [ ] Sprite metadata is independent of loaded images. Backends own concrete
  image/texture/buffer resources, preparation and complete lifecycle handling.
- [ ] Gameplay, editor, explorer and applicable review rendering use the same
  contracts. Remaining Canvas dependencies are confined to implementations,
  platform composition or explicitly documented independent UI/debug surfaces;
  exceptions must not conceal game presentation coupling.
- [ ] Transitional adapters and obsolete APIs are removed. A dependency check
  guards forbidden imports/types, and a recording backend exercises the actual
  presentation path for representative frames and lifecycle/resource updates.
- [ ] Existing visual invariants and immutable review identities are preserved.
  Independent renderers, equal-revision replacement, asset changes, partial
  builds, eviction, stale handles and realm resets have relevant passing checks.
- [ ] Integrated checks pass, allocation/retention comparisons show no unexplained
  regression for equivalent work, and device evidence/limitations are recorded.
- [ ] All children, topic status, this checkpoint and index reflect actual delivery;
  changes are committed and any separate follow-up is explicitly scoped.

For each runtime slice run `npm run typecheck`, `npm test` and `npm run check`,
plus focused contract tests. Rendering/integration changes also require
`npm run build && npx playwright test`. After render/recipe/input changes run
`npm run art:catalog` then `npm run workshop:manifest` before the build. For
streaming/execution changes run `npm run streaming:bench -- --assert-ready`;
include that traversal readiness check in final integrated validation regardless.
Use isolated auth/data and bundled Playwright Chromium, with full Chromium for
GPU parity. Follow the performance topic for outdoor/indoor and edited-room
runners and attached Android testing where available.

Compare equivalent seeds, content, camera paths and output hashes; record
allocation counters, retained resources and timing separately. Existing passing
counts and old captures are historical baselines, not fresh validation. A
recording backend proves the data boundary, not GPU performance or full future
backend parity. Preserve terrain preparation budgets, visible-hole priority and
fallback imagery; don't trade readiness for a better frame-time number.

## Execution record

- 2026-10-03: parent tracker prepared with five remaining milestones, activation
  protocol, just-in-time child planning and verifiable completion gates.
  Implementation awaits the user's start signal.
- Setup validation: all local link targets in the four edited documents resolve;
  `git diff --check`, typechecks, all 1,335 unit tests and lint pass (lint reports
  existing warnings). Checks ran in the shared checkout, which also contains
  concurrent persistence work. This commit changes documentation only; browser,
  rendering and device evidence will be collected during implementation.

- 2026-10-03: activated on explicit end-to-end instruction. R3 metadata moves
  first so frame contracts can use neutral asset descriptions from inception.

- R1 split: 029 delivers terrain/scene submission; editor overlay geometry follows
  as a bounded child. This preserves the current phase order while migrating.
