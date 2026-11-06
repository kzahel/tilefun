# Code health

Topic: code-health

Status: active, updated 2026-11-06. [221](../tactical/221-code-health-refactoring-sequence.md)
owns the current audit and phased refactoring sequence.

## Scope

Module boundaries, oversized files and functions, duplicated helpers, dead
code, lint/typecheck coverage and repository hygiene. Feature topics own their
behavior; this topic owns the guardrails that keep structure from regressing.

## Current state

- Biome `recommended` plus unused imports/variables, `useConst`,
  `noExplicitAny`, `noImportCycles` (value imports), `noFloatingPromises`,
  `useExhaustiveSwitchCases` and `noRestrictedImports` layer boundaries for
  `shared/` and Worker-authority/simulation directories (explicit allow-list
  overrides in `biome.json` record the remaining exceptions).
- TypeScript `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `verbatimModuleSyntax`, `noImplicitOverride` and `noImplicitReturns`.
  `npm run typecheck` covers `src`, the server and Worker projects and
  `tsconfig.tools.json` (tests, specs, captures, TS scripts, configs).
- `npm run check` = Biome + `npm run health`: the size/complexity ratchet
  (`scripts/code-health/ratchet.mjs`; non-test `src` files over 600 lines or with
  a function above cognitive complexity 25 must stay within
  `ratchet-baseline.json`) and knip (dead files/exports, unlisted dependencies).
  knip ignores exports used only in their own file, so "knip clean" means no
  dead code, not minimal exports.
  Lower the baseline with `--update` after a split; raising it is a reviewed decision.
- Browser specs and instrumentation use the typed `GameTestHooks` surface on
  `canvas.__game` instead of private `GameClient` members.
- Shared leaf helpers: `shared/required.ts`, `shared/Movement.ts`,
  `shared/Determinism.ts` (`lcgNext`, `positionSeed`, `fnv1a32`) and
  `shared/gap.ts`. GameClient has one mode (transport + `RemoteStateView`); Realm
  always streams. Browser specs reach client state through `__game.stateView`.
- Registries (declare new content once): client requests in `shared/requests.ts`
  plus the compiler-complete handler table in `GameServer`; replicated entity
  fields in `shared/entityFields.ts`; native wildlife kinds in
  `wildlife/WildlifeKinds.ts`/`WildlifeSpecies.ts` (dispatch order is behavior)
  with shared Work plumbing in `wildlife/WorkKit.ts`; Workshop tools in
  `workshop/ToolRegistry.ts` (+ `ToolPages.tsx` for dedicated pages) and natural
  case presentation in `workshop/NaturalCasePresentation.ts`.
- Workshop candidate identities for source-hashed batches embed raw engine source
  (`?raw` imports). New files split out of a hashed module must be added to the
  owning identity's source list, or edits to them will not reopen review.
- Hot files are split into collaborators (phase 5 of 221): Realm (`RealmRiding`,
  `RealmPhysics`, `RealmCommands` handler table, `RealmComposition`), GameServer
  (`RealmDirectory`, `SessionRegistry`, `DoorTransitions`), GameClient
  (`ServerMessageRouter` with a compiler-complete switch, `PlayInputController`,
  `WorldSessionActions`, `GameMenuChrome`), `collectScene` stages in
  `rendering/scene/`, Workshop App routes/chrome and EditorPanel sections. Add new
  behavior to the collaborator that owns it rather than the composition root.
- Largest remaining hotspots: `wildlife/Fauna.ts` and the Work `update` methods,
  `generation/regional/NaturalLandscape.ts`, `client/PlayerPredictor.ts`,
  `scenes/PlayScene.ts`, `physics/PhysicsScene.ts`.
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
