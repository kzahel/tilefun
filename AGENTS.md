# Agent instructions

Tilefun is a creative-mode-first 2D tile game for children and parent co-op.
Read [README.md](README.md) for product/setup context and
[docs/README.md](docs/README.md) to find the relevant documentation.
For cross-project context, see `~/code/dotfiles/projects/README.md` when available.

## Working context

- Read the relevant [topic](docs/topics/README.md) before changing a continuing
  concern. Topics own current status, decisions, invariants, evidence and next work.
- [Tacticals](docs/tactical/README.md) own bounded plans and execution records.
  Completed plans are history; use topic and architecture docs for current guidance.
- [Roadmap](docs/ROADMAP.md) owns near-term direction;
  [ideas](docs/ideas.md) routes the uncommitted backlog and playtester requests.
- For in-game voice/STT feedback, start with [Play ideas](docs/topics/play-ideas.md):
  records are in `data/workshop/play-ideas/*.json` (or `WORKSHOP_DATA_DIR/play-ideas/`)
  and [Workshop → Play ideas](https://tilefun.graehlarts.com/tilefun/workshop.html#/play-ideas).
  These contain transcripts and screenshots, not audio; `workshop:inbox` does not list them.
- Update the owning doc when behavior, contracts, evidence or next work changes.
  Create a focused topic when continuity is useful, not for every small edit.
  New tacticals use the next zero-padded number and belong in the tactical index.
- Wildlife agents must refresh the [production table](docs/wildlife-status.md)
  after task checkpoints/completion/blocking and before handoff: persist fresh
  progress first, then run `node scripts/wildlife/status.mjs`. See the wildlife topic.
- Wildlife owner motion holds block broad art production; the tracked body-motion
  contract requires coordinator-reviewed correction prototypes before more repairs.
- Wildlife art production follows `art-source/wildlife-v2/repair-scope.json`:
  existing frozen-torso repairs plus the explicit four-pet authorization in
  [084](docs/tactical/084-common-pets-and-variations.md) and the explicit tiger-only
  pilot in [131](docs/tactical/131-predators-and-prehistoric-creatures.md) and
  four-predator art/gameplay in [132](docs/tactical/132-predator-hunting-and-replacement.md),
  and five fierce creatures in [137](docs/tactical/137-fierce-creatures-and-food-web.md);
  other expansion stays stopped.
  Provisional gameplay with existing drafts follows the wildlife topic.
- Keep this file short: agent guardrails and routing only. Put progress logs,
  benchmark captures and detailed review state in the owning docs. `CLAUDE.md`
  imports this file; do not add a second set of instructions there.

## Architecture and data guardrails

Single-player authority runs in a Worker using the shared server implementation;
prediction and rendering remain on the main thread. Read
[client/server boundaries](docs/client-server-architecture.md) for ownership.

Engine changes must account for affected embedded labs. Read
[embedded engine labs](docs/topics/embedded-engine-labs.md) before changing shared
simulation, prediction, presentation or renderer lifecycle; keep game and lab
consumers aligned through shared engine code.

Maintain one current regional generator. During active greenfield prototyping,
output may change without version bumps; existing development worlds are disposable.
Retired worlds use same-seed recreation, not historical emulation.
Promoted asset banks and exact review snapshots remain immutable; never regenerate
them during builds. Read [city generation](docs/topics/city-generation.md) before
changing generation or promotions.

Normal builds use committed assets. Keep credentials, owner/session files,
NDJSON histories and local state out of Git. Server logs do not include browser
drafts, outboxes or worlds. See [setup and local data](docs/setup-and-local-data.md).

## Controller-friendly gameplay

Primary on-screen gameplay actions must be usable with a standard controller
(including Steam Deck), with visible button hints and reachable focus/confirm/back
behavior. Give touch, keyboard and controller access to the same actions; a mouse
cursor alone is not sufficient. Secondary settings and views, such as control
schemes and minimap options, may live in controller-accessible menus. Follow
[Steam Deck and menus](docs/topics/steam-deck-and-menus.md) for the shared scheme.

## Human review

Before art/review work, read [art review](docs/topics/art-review.md).
Use `npm run workshop:inbox` and `npm run art:notes` for current requests and exact
source snapshots. Never synthesize human approvals; changed pixels return to review.
Two Needs changes reports pause a batch; wait for the user to say “ready” before
implementing that batch's art fixes. Agent replies do not count as approvals.
Register new batches/candidates so zero-event work appears in the global inbox.
Use `https://tilefun.graehlarts.com/tilefun/` for human review links.

## Validation

Before adding or expanding tests, identify the behavior and check existing
coverage. Choose the narrowest test level that can detect the failure: prefer
Node-based unit or headless simulation/integration tests; use a browser only for
a specific browser-dependent contract (headless Chromium still counts as a
browser). Existing similar tests are not a reason to copy their test level or
multiply their case matrix. Keep browser coverage focused on distinct boundaries;
validate exhaustive content variants below the browser where possible.

Run typechecks, unit tests and lint before considering work done:

```sh
npm run typecheck
npm test
npm run check
```

Fix diagnostics introduced by the change. For rendering or integration changes,
also run `npm run build && npx playwright test`. Use isolated auth/data and bundled
Playwright Chromium; GPU parity checks require full Chromium rendering.
After render/recipe/input changes run `npm run art:catalog` followed by
`npm run workshop:manifest`; builds check these generated inventories.
For streaming/execution changes run `npm run streaming:bench -- --assert-ready`;
[performance](docs/topics/performance.md) routes scenarios and measurement limits.

## Session completion

Briefly suggest the next logical step when this work is part of a larger plan.
