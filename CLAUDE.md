# CLAUDE.md

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
