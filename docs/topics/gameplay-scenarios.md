# Gameplay scenarios

Status: shared recipe/runtime delivered; interactive authority scheduling aligned, 2026-10-07.

Interactive Workshop examples run the production `Realm`, `baseGameMod`, streaming,
record persistence, binary replication and `PlayerPredictor`. The temporary host
changes storage and fixture staging; interactive timing and transport use the same
ServerLoop and OrderedWorkerChannel as the game. Manual headless stepping remains
an explicit test mode.
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
- `NaturalLandscapeRecipe`: generated regional countryside, ponds and tree/thicket
  composition, or a real town-to-town railway; profile, starting view and omitted
  extra road traffic are staged.

The playable lab composition root is `ScenarioPresentationHost → ScenarioClient →
scenario Worker → ScenarioSession → Realm`. The game instead uses `GameClient`
and `LocalServerRuntime`. Both share simulation, streamed world chunks, prediction,
binary replication, terrain preparation and scene/render backends. Only nearby
world regions are resident; a generated world is not precomputed into one giant
in-memory map. Lab reload flushes/reopens its memory records; reset, closing or
replacing the session discards them. Labs omit the full menus/editor, audio,
particles, multiplayer hosting and durable world/profile registry. Ambient spawning
is disabled; recipes can also deliberately suppress traffic. These are explicit
host/content differences, so shared engine fidelity is not whole-application parity.

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
Inputs enter Realm independently of its ServerLoop ticks. Snapshots arrive without
request/response stepping, through production channel credits and bounded decode.
Pause/hidden views stop both clocks, and async controls fence authority while
pending. Live ticks use ordinary streaming admission; only initial construction,
explicit controls and manual headless steps wait for complete view readiness.
[Scheduling delivery](../tactical/069-interactive-authority-scheduling.md) records
regressions and intentional application-host differences.

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

## Explicit ready and paused terrain

The farm/town-pet inspection in [083](../tactical/083-farms-town-pets-and-larger-cities.md)
exposed partially initialized blend data after paused reload. Shared
`Realm.ensureReady` now completes ordinary autotile preparation after awaited
chunk loads, before publishing explicit-ready results. Live tick/load budgets
remain unchanged. Headless tests require computed terrain both initially and
after reload, without advancing individual clocks; Canvas/GPU captures check the
same paused presentation. Natural candidate identities include the farm, pet,
resident and district composition sources so changed layouts return to review.

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
reports remain historical. Presentation version 2 records the independent authority clock migration; motion
reviews reopen while static art identities retain their exact rendered evidence.

Tests cover independent memory sessions, collision, scoped settings, binary
replicas, Worker-host/headless parity, reset/reload, invalid requests, all car
edges, generated junction rides, furniture support and character clearance.
The browser lifecycle test repeatedly changes tools/settings, checks Worker counts
return to zero on exit, and verifies that no IndexedDB worlds are created.

Next: review movement feel in the migrated labs. Future small gameplay examples
should add fixture data and semantic integration assertions through this host.

Explicit authority clock fences also reset timed sprite clips to their latest
replicated phase. Local animation ticks can advance without a new sprite delta;
pausing must freeze the saved authority frame so reload does not change it.
`RemoteStateView` retains those phases until a clip ends, an entity exits or the
world is cleared; ordinary presentation-clock resets retain their existing behavior.


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
