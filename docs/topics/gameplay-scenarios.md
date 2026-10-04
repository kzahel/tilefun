# Gameplay scenarios

Status: shared recipe/runtime delivered and validated, 2026-10-03.

Interactive Workshop examples run the production `Realm`, `baseGameMod`, streaming,
record persistence, binary replication and `PlayerPredictor`. The temporary host
changes storage and scheduling; it does not implement another gameplay loop.
[Tactical 027](../tactical/027-composable-gameplay-scenarios.md) owns delivery evidence.

[Embedded engine labs](embedded-engine-labs.md) owns the requirement to keep labs
aligned with engine changes, including presentation and lifecycle contracts.
Shared simulation does not mean every lab runs the game's complete frame loop.

## Composition

`src/scenarios/ScenarioRecipe.ts` defines versioned plain data: generator identity,
player appearance/geometry and starting pose, props, ordinary gameplay actors,
physics overrides, named traffic fixtures and optional authored traffic/rail routes.
Authored road rectangles are tile-aligned, bounded and seeded once; reload uses
stored chunks. Vehicles may supply an initial height, restored from traffic records. `scenarioWalls` composes normal
wall props. Recipes contain no update callbacks and need no DOM or image loading.

- `TrafficRecipe`: current regional lanes, a compact car and bus, braking/roof commands.
- `FurnitureRecipe`: compiled furniture placements, reviewed body proposals and room edges.
- `CharacterRecipe`: candidate settings, passage/step/clearance obstacles and scale reference.
- `CurvedTrainRecipe`: a four-stop loop and a winding three-stop corridor, using
  production distance-based train motion and schematic heading frames.
- `TrainGeometryRecipe`: one production railway service with per-carriage grade
  support, bridge/tunnel surfaces and two termini.
- `VehicleGeometryRecipe`: straight car routes over the railway bridge or into the garage,
  with the production traffic controller and explicit opposite-direction starts.
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

Traffic, Outdoor Geometry, World Geometry, Character lab and furniture playtest
use `ScenarioPresentationHost` with the production clock, render host and shared
camera/terrain/indoor helpers. [Embedded engine labs](embedded-engine-labs.md)
tracks the completed migrations and explicit camera/overlay/reference boundaries. Diagnostics,
placement controls and static review painting remain view responsibilities. FurnitureMotion and CharacterTestScene
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
of the Worker runtime. Presentation version 1 additionally reopens the eleven
movement cases for the shared clock/interpolation/indoor-rendering migration; prior
reports remain historical. Static art identities still use exact rendered evidence.

Tests cover independent memory sessions, collision, scoped settings, binary
replicas, Worker-host/headless parity, reset/reload, invalid requests, all car
edges, generated junction rides, furniture support and character clearance.
The browser lifecycle test repeatedly changes tools/settings, checks Worker counts
return to zero on exit, and verifies that no IndexedDB worlds are created.

Next: review movement feel in the migrated labs. Future small gameplay examples
should add fixture data and semantic integration assertions through this host.


Paused camera changes use the `view-range` command to ready/replicate a bounded
chunk range without a simulation tick. Reload preserves that range, including
when the camera is far from the player. Railway restoration waits for service
footprint readiness before publishing bodies. `ScenarioSession.ready` also waits
for pending railway lifecycle work and reports its errors.

`GeneratedCrossingRecipe` supplies three current regional worlds without authored
roads, railway routes or props. Optional `railwayStarts` seeds initial saved
service positions before Realm startup; production railway validation and motion
own them thereafter. Staged traffic uses the real generated lane graph. Reset
creates a fresh world; reload preserves terrain, generated part identities,
car height and service state. See [tactical 062](../tactical/062-generated-road-rail-crossing.md).
