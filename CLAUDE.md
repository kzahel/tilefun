# CLAUDE.md

## Cross-Project Context

For cross-project context (how this project relates to Transistor, JSTorrent, etc.), see `~/code/dotfiles/projects/README.md`.

## After making changes

Always run typecheck and tests before considering work done:

```bash
npx tsc --noEmit          # typecheck
npm test                  # unit tests (vitest)
npx biome check --write . # lint + format
```

For changes that affect rendering or integration, also run E2E tests:

```bash
npm run build && npx playwright test
```

## Setup and data portability

See `docs/setup-and-local-data.md` for fresh-machine dependencies, committed
versus ignored art, regeneration inputs, and review/browser/world data transfer.
Normal builds use committed assets. Keep NDJSON histories and local state out
of Git; copying server logs does not copy browser drafts, outboxes or worlds.

## Public preview and art feedback

The live deployment at `https://tilefun.graehlarts.com/tilefun/` serves this
checkout through Vite. Use that origin for human review links; isolated local
preview servers are for automated validation.

The central tool directory is `/tilefun/tools.html`, linked as
Indexes / atlases / labs from the game sidebar and world menu. Keep new tools
and useful shortcuts discoverable there, with descriptions and a return link.

The art workbench is at `/tilefun/art-workbench.html`. See
`docs/art-workbench.md` for source-use inventory coverage and the shared note
inbox. Read pending art requests with `npm run art:notes`; notes persist in
ignored `data/art-notes/notes.ndjson`. Update status/reply after acting on the
exact recorded source revision/selection. Run `npm run art:catalog` after asset
source definitions change; the build verifies the generated inventory.

Building Lab review uses an unchecked queue with explicit human approvals.
Two Needs changes reports pause a batch; wait for the user to say “ready” in
chat before implementing that batch's art fixes. Read the saved reasons with
`npm run art:notes`. Agent replies/status changes do not count as approval;
changed recipes or rendered pixels return to review. See `docs/art-workbench.md`.

The street starter review is `/tilefun/building-lab.html?run=streets`, with six
phase-0 furniture cases and its own navigation/pause state. It uses the same
art inbox and review loop; CLI notes include the street case and prop types.
These props are available for editing/review, not yet selected by city worldgen.
The next district milestones are in `docs/tactical/007-dense-city-districts-and-street-life-plan.md`.

Road foundation review is `/tilefun/building-lab.html?run=surfaces`, with nine
source-backed width/curb/crossing/divider scenes, its own queue/pause, and shared
`src/road/CitySurfaceRecipes.ts` composition. It is a candidate surface contract
for regional-v4; earlier world revisions are unchanged. The approved neutral
lookup is now promoted, while the revised divider remains a candidate. Surface
notes carry a case ID and
`surfaceRecipe`, with no fake building or prop IDs.

Dense neighborhood review is `/tilefun/building-lab.html?run=districts`, with
three views of one real `regional-v4` world (seed 2026, tile 300,519). The lab,
explorer and game use the same plan, pinned building factories and terrain
renderer. The explorer link supports Play here; preview walkers are initial
poses, while the game simulates the planned routes. Review/navigation/pause
remain independent of the other runs. District notes carry `districtRecipe`,
case ID, promoted building IDs and prop types. Keep new runs indexed in tools.

`src/generation/regional/dense-city-assets-v1.json` is an immutable promotion
snapshot, not build output. Do not regenerate it from changing review candidates.
Regional v4 pins the neutral surface lookup and persistent RoadType IDs 5–14;
its geometry, assets, surface choices and realized fixtures have freeze tests.
Future output changes require a new revision and promoted IDs/bank. New worlds
default to Procedural regional with Dense districts (v4); older generators and
regional revisions remain available with legacy/old labels.
