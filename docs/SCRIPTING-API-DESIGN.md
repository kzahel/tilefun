# Gameplay scripting API

Current implementation guide, checked 2026-10-03. The lengthy
[original API proposal](archive/scripting-api-design.md) retains design rationale,
example mods and hypothetical sandbox options; its interfaces and phase list
are not the current API specification.

## API and ownership

[WorldAPI.ts](../src/server/WorldAPI.ts) defines the public TypeScript interfaces
and WorldAPIImpl. Terrain, entity, prop, query and player APIs are exposed with
tag, event, tick and overlap services. Read those actual types when writing a
mod instead of copying signatures from the original proposal.

A `Mod` has a name and `register(api): Unsubscribe`. Realm registers mods against
its WorldAPI and tears them down on reload/destruction. GameServer supplies the
base game mod. [EntityHandle](../src/server/EntityHandle.ts) and PlayerHandle
provide mutation/inspection methods; mounting/dismounting already exist.

| Concern | Owner |
| --- | --- |
| Core gameplay | [base-game.ts](../src/game/base-game.ts) |
| Example extension | [double-gems.ts](../src/mods/double-gems.ts) |
| Tags | [TagServiceImpl](../src/scripting/TagServiceImpl.ts) |
| Events | [EventBusImpl](../src/server/EventBusImpl.ts) |
| Pre/post simulation hooks | [TickServiceImpl](../src/server/TickServiceImpl.ts) |
| Tagged overlap checks | [OverlapServiceImpl](../src/scripting/OverlapServiceImpl.ts) |
| Host integration/lifecycle | [Realm](../src/server/Realm.ts) |

The proposed seven separate built-in mod files were not the final organization.
Gem/baddie and other spawning paths still exist in Realm and their spawner classes;
do not delete them based on the archived migration checklist.

## Runtime contracts

- EventBus dispatch is synchronous, with exceptions caught per listener. Nested
  emits run inline; there is no deferred queue or ten-batch reentrancy cap in the
  current implementation. The archived proposal described a different model.
- Tick hooks run around simulation substeps. They receive simulation `dt`;
  a mod can accumulate it for a lower cadence. Do not assume one hook per render
  frame or one hook per outer server tick when physics substeps are enabled.
- Tags/attributes are runtime state, not general durable script storage.
  [SavedMeta and SerializedEntity](../src/persistence/SaveManager.ts) define the
  actual save contract; arbitrary mod state does not persist automatically.
- Trusted TypeScript mods execute in the server host. WorldAPI is an API boundary,
  not a sandbox. The Worker execution boundary does not make arbitrary mods safe.
- Shared pattern/room undo exists independently; API terrain mutations do not
  automatically enter that editing history.

## Validation and remaining scope

Tests beside WorldAPI, EntityHandle, EventBusImpl, TickServiceImpl, TagServiceImpl
and OverlapServiceImpl cover the API/services. The double-gems test exercises an
extension against the live API. Run repository validation from [AGENTS.md](../AGENTS.md).

Untrusted-script isolation, per-mod budgets, durable mod storage, an in-game
script editor and custom client scripts remain proposals. The archived sandbox
survey is not a deployment recommendation; validate current options when that
work is selected. Current administrative access is documented in
[server security](SERVER-SECURITY.md), distinct from mod execution trust.
