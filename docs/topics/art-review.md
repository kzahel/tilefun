# Art review and asset metadata

Topic: art-review
Status: Workshop and outdoor catalog delivered; human review remains ongoing.
Updated: 2026-10-03.

Owns agent operating rules for exact-source feedback, approvals and metadata.
The [Workshop guide](../tilefun-workshop.md) owns UI, authentication and API
reference; the [art workbench guide](../art-workbench.md) owns source selection
and inventory usage. Read these before changing review flows or acting on notes.

## Review workflow

The live deployment at `https://tilefun.graehlarts.com/tilefun/` serves this
checkout through Vite. Use that origin for human review links; isolated local
preview servers are for automated validation.

The central workspace is `/tilefun/workshop.html`, linked as Tilefun Workshop
from the game sidebar and world menu. It includes all review batches, requests,
activity/history and tools. Register new batches/candidates so zero-event work
appears in the global inbox. Old `/tilefun/tools.html` and lab links still work.
See [Workshop guide](../tilefun-workshop.md) for login, shared APIs and data. Use
`npm run workshop:inbox` for the combined trusted local read. Public/LAN private
API reads require the owner cookie; new/legacy writes also require its CSRF
token. Never commit owner/session files. Direct localhost with a loopback peer
and no forwarding headers skips login (CSRF/origin checks remain). Set
`WORKSHOP_LOCAL_AUTH_BYPASS=0` to exercise login locally; auth/browser tests do
this explicitly. Tests use isolated auth/data and Playwright Chromium, including
full Chromium GPU rendering for district fingerprint parity.
In Vite development, the broad source digest is advisory so concurrent agents
can edit unrelated code while the owner reviews. The inbox reports actual
`manifestCurrent` separately from server `reviewAllowed` policy. Individual
browser preview/source checks and submitted candidate fingerprints still apply;
a changed preview remains blocked. Existing decisions stay attached to their exact
registered identity. Vite preview, standalone serving, manifest generation and
production build checks remain strict. Do not treat the development exception as
permission to promote changed or unreviewed pixels.
The trusted `workshop:inbox` CLI uses the development projection, preserving saved
decision states while still reporting broad source drift separately.
Validated 2026-10-03 in an isolated source snapshot: typecheck, lint, build,
1,361 unit tests and 287 browser tests passed (one browser test skipped). API
coverage rejects mismatched identities while accepting exact development reviews;
browser coverage keeps changed previews blocked despite the development exception.
Read-only live phone verification confirmed voting with stale broad inputs.

After render/recipe/input changes run `npm run art:catalog` then
`npm run workshop:manifest`; build checks both. Do not synthesize approvals.

Exact canvas fingerprints must use `reviewContext2D` from the **first** context
acquisition, including intermediate sprite canvases. Default GPU and CPU canvas
rasterization can disagree despite identical source art; a current manifest digest
does not prove browser parity. Keep platform-dependent text out of hashed art.
Manifest generation compares fresh character/vehicle identities in headless-shell
and normal Chromium at retina scale before writing, and rejects concurrent input
changes. New review kinds need equivalent normal-browser verification in addition
to ordinary headless tests. A rebuilt manifest alone cannot fix nondeterministic
rendering.

The art workbench is at `/tilefun/art-workbench.html`. See
[art workbench guide](../art-workbench.md) for source-use inventory coverage and the shared note
inbox. Read pending art requests with `npm run art:notes`; notes persist in
ignored `data/art-notes/notes.ndjson`. Update status/reply after acting on the
exact recorded source revision/selection. Run `npm run art:catalog` after asset
source definitions change; the build verifies the generated inventory.

Building Lab review uses an unchecked queue with explicit human approvals.
Two Needs changes reports pause a batch; wait for the user to say “ready” in
chat before implementing that batch's art fixes. Read the saved reasons with
`npm run art:notes`. Agent replies/status changes do not count as approval;
changed recipes or rendered pixels return to review. See [art workbench guide](../art-workbench.md).

## Outdoor metadata and scene locations

Outdoor asset semantics and scene-location feedback continue in
[Tactical 010](../tactical/010-outdoor-asset-catalog-and-scene-review.md). Workshop's Outdoor
assets tool is native React (`#/tool/outdoor`); coverage inspection uses Source
art. `npm run assets:outdoor` builds/verifies committed-source coverage, rectangle
aliases and candidate geometry. Unknown collision stays unknown; runtime atlas
props and saved generations are unchanged. Detailed candidate geometry is shared
with production Prop/collision/renderer code under new explicit asset identities.
Human metadata proposals/approvals and scene notes use authenticated Workshop
`asset`/`scene` events and the existing ignored art inbox. Read their exact snapshots
with `npm run art:notes`; do not promote inferred labels/colliders automatically.
Status replies must preserve original metadata decision time. New used geometry
revisions need distinct asset versions. Neighborhoods default to one whole scene
per batch (`#/scene/CASE_ID`); crops are zoom shortcuts and retain old decisions.
World annotations record pixels, generation/seed and exact asset suggestions;
never interpret their compatibility source pointer as the scene location.

## Vehicles

The [vehicle topic](vehicles.md) owns the registered 180-view geometry batch,
editable ground bounds/height, exact approvals and proposed traffic follow-up.
Open [Workshop → Vehicles](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/vehicles).

## Railways

[Railway previews](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/railways)
registers 32 unapproved source, motion, layout and structure-study candidates.
[Trains](trains.md) owns scope and the explicit pre-overworld review gate. Moving
identities pin the source, recipe/motion implementation and deterministic sampled
frames, with full-Chromium parity. Schematic studies must stay visibly labelled;
their approval does not imply that physics or a complete art kit exists.

## Characters

The [character topic](characters.md) owns six registered movement/geometry
candidates, live tuning and exact shared settings reviews in
[Character lab](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/character-lab).
The six human-approved source/settings snapshots are promoted to Entities and
the player picker; future Workshop drafts remain separate from gameplay.

## Next work

Read `npm run workshop:inbox` and `npm run art:notes` for current feedback;
recorded statuses in docs are checkpoints, not a substitute for the live inbox.
Act on exact source/selection snapshots, preserve metadata decision times, and
wait for the applicable human review before promoting art or geometry. City
batch identities and pinned banks live in [city generation](city-generation.md).
Implementation records: [008](../tactical/008-tilefun-workshop-plan.md) and
[010](../tactical/010-outdoor-asset-catalog-and-scene-review.md).
