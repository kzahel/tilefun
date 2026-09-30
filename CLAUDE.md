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

## Public preview and art feedback

The live deployment at `https://tilefun.graehlarts.com/tilefun/` serves this
checkout through Vite. Use that origin for human review links; isolated local
preview servers are for automated validation.

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
