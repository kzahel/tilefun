# Code health

Topic: code-health

Status: active, updated 2026-11-06. [221](../tactical/221-code-health-refactoring-sequence.md)
owns the current audit and phased refactoring sequence.

## Scope

Module boundaries, oversized files and functions, duplicated helpers, dead
code, lint/typecheck coverage and repository hygiene. Feature topics own their
behavior; this topic owns the guardrails that keep structure from regressing.

## Current state

- Biome `recommended` plus unused imports/variables, `useConst` and
  `noExplicitAny`; TypeScript `strict`, `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes` for `src`.
- Largest churn hotspots: `server/Realm.ts`, `client/GameClient.ts`,
  `wildlife/Fauna.ts`, `rendering/collectScene.ts`, `server/GameServer.ts`.
- The dominant cost is shotgun surgery: new species, replicated fields and
  Workshop tools are added by hand in many central lists. Prefer registries and
  schemas that let new content be declared in one place over splitting files alone.

## Decisions and invariants

- `shared/` is a leaf layer: it must not import server, client, rendering,
  input, UI, workshop or domain systems.
- Worker authority (server, simulation, generation) must not reach DOM or
  rendering modules, directly or transitively.
- Generic helpers (assertions, determinism, geometry) live in shared modules,
  not in feature directories. Determinism helpers keep exact constants and salts.
- Delete unreachable modes and dead code before splitting the files that hold them.
- Hash-pinned artifacts under `art-source/` and `public/demos/` are not lint or
  format targets; never reformat or regenerate them.
- Split hot regions in short commits and prefer cold regions first.

## Next work

Follow the phases in [221](../tactical/221-code-health-refactoring-sequence.md).
Storage policy (LFS/compression, shared viewer bundles) is deferred.
