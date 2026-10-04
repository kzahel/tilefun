# Gameplay scenarios

Status: shared recipe/runtime delivered and validated, 2026-10-03.

Interactive Workshop examples run the production `Realm`, `baseGameMod`, streaming,
record persistence, binary replication and `PlayerPredictor`. The temporary host
changes storage and scheduling; it does not implement another gameplay loop.
[Tactical 027](../tactical/027-composable-gameplay-scenarios.md) owns delivery evidence.

[Embedded engine labs](embedded-engine-labs.md) owns the requirement to keep labs
aligned with engine changes, including the remaining presentation-host gaps.
Shared simulation does not mean every lab runs the game's complete frame loop.

## Composition

`src/scenarios/ScenarioRecipe.ts` defines versioned plain data: generator identity,
player appearance/geometry and starting pose, props, ordinary gameplay actors,
physics overrides and named traffic fixtures. `scenarioWalls` composes normal
wall props. Recipes contain no update callbacks and need no DOM or image loading.

- `TrafficRecipe`: real regional-v11 lanes, a compact car and bus, braking/roof commands.
- `FurnitureRecipe`: compiled furniture placements, reviewed body proposals and room edges.
- `CharacterRecipe`: candidate settings, passage/step/clearance obstacles and scale reference.
- `OutdoorRecipe`: the selected asset's actual prop geometry and a bounded walking area.

`ScenarioSession` owns an isolated `MemoryRecordStore`/`RecordPersistenceStore`,
fixed registry, `Realm` and `PlayerSession`. Memory IO uses the production copying,
atomic commit and async readiness contracts. No world IndexedDB or filesystem save
is opened. Ordinary saved generators, promoted banks and player worlds are unchanged.

Candidate prop definitions are local to the Realm and used by both validation and
rehydration of persistent records. Props replicate their complete shapes through
the normal codec. Player candidate appearance is supplied to authority and replica
from the same recipe. No global entity definitions or physics CVars are modified.
Player recipes disable NPC wander/route controllers. `actors` is for ordinary
non-player gameplay actors; the controlled participant belongs in `player`.

`ScenarioWorkerHost` orders requests and invokes that same session. `ScenarioClient`
uses a dedicated Worker, normal binary frames, `RemoteStateView`, the production
predictor and replica animation clock. `predictInput` is shared with `PlayScene`.
The client bounds outstanding steps to six; pause/hidden views do not accumulate
unbounded command debt. Explicit commands change scenario state at the authority.

Presentation remains in the owning view: cameras, asset loading, diagnostics,
placement controls and static review painting. FurnitureMotion and CharacterTestScene
are layout/render models without movement loops. The former synchronous traffic
loop is `TrafficTestHarness`, imported only by low-level lane stress tests.
Static art/rail diagrams and frozen approval renders remain render fixtures.
The original exported pixel-character galleries remain art-only pose/movement
viewers; Character lab is the gameplay physics validation surface.

## Headless integration usage

```ts
const session = await ScenarioSession.create(trafficRecipe());
try {
  await session.command({ kind: "traffic-position", roof: true });
  for (let tick = 0; tick < 120; tick++) {
    await session.step({ dx: 0, dy: 0, jump: false, sprinting: false });
  }
  // Semantic assertions can read session.player.player and session.realm.
  // session.frames() produces the same binary packets used by the Worker client.
  await session.reload(); // retains committed memory records
  await session.reset();  // empty records and original recipe
} finally {
  await session.close();
}
```

Each step awaits streaming readiness and binary-roundtrips its input before the
Realm tick. Tests control input durations; Realm AI uses a session-seeded RNG.
This is repeatable for these fixtures, not a claim that every gameplay extension,
UUID, wall-clock persistence timestamp or future mod is deterministic.
A session is single-owner: await headless operations in sequence. Browser requests
are serialized by the Worker host. Browser disposal terminates its disposable
Worker and releases handlers; headless close drains the normal save lifecycle.

Live geometry/layout tuning creates a new session with the revised recipe. This
keeps persistence definitions fixed within a run. Position controls use authority
commands. Reset/reload pause submission while switching state, clear replica
baselines, and restore prediction before accepting further movement.

## Review and evidence

The immutable approved art banks and saved human decisions are unchanged.
Character fingerprints now include recipe and Realm host source. Furniture motion
version 2 reopens earlier behavior approvals; it does not relabel them as approvals
of the Worker runtime. Static art identities still use exact rendered evidence.

Tests cover independent memory sessions, collision, scoped settings, binary
replicas, Worker-host/headless parity, reset/reload, invalid requests, all car
edges, generated junction rides, furniture support and character clearance.
The browser lifecycle test repeatedly changes tools/settings, checks Worker counts
return to zero on exit, and verifies that no IndexedDB worlds are created.

Next: review movement feel in the migrated labs. Future small gameplay examples
should add fixture data and semantic integration assertions through this host.
