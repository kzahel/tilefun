# 233 — Fast CI and a local full suite

Status: implemented · 2026-11-09. Owner: [testing](../topics/testing.md).

The owner asked for fast, reliable CI with fewer and faster browser tests, and a
wider suite that runs quickly on the local machine. They also asked to fix the
oversized animal-browser spec. CI run
[42635941585](https://github.com/kzahel/tilefun/actions/runs/42635941585)
(after 232) failed on four counts:
- the code-health ratchet;
- four BallCommands cases;
- a 15 s world-building timeout on a hosted runner;
- two smoke flakes (`p2p-menu` hit its 90 s deadline; a `tap-movement` claim race).

Deploy had been blocked since 2026-11-07.

## Changes

- **CI**:
  - `check`, `unit` (now four vitest shards) and `raster` are unchanged in
    scope.
  - `smoke` is one job running `smoke.spec.ts`, `worker-server.spec.ts` and
    `pwa.spec.ts` (launch and pixels, keyboard input, Worker lifecycle and
    saves, launcher assets).
  - The scheduled twelve-shard full browser run is removed.
  - `workflow_dispatch` reruns the push gate without deploying.
  - Controller, mobile-editor, multiplayer, vehicle-placement, touch and lab
    browser cases run in the local suite. The `@smoke` tags and the tagged
    project are gone.
- **Local suite**:
  - Hardware-GPU Playwright defaults to four workers with `fullyParallel`, the
    CI deadlines (60 s per test, 15 s per assertion) and one retry, so load
    flakes are reported as flaky.
  - The SwiftShader lane keeps two workers.
  - `npm run test:all` runs lint and health, typechecks, native and Node, HTTP
    integration, the build, and the full browser suite.
- **Animal browser**: 76 browser cases (about 730 s of test time) become eight
  (35 s). The exhaustive checks move to Node:
  - `src/workshop/AnimalBrowserPreviews.test.ts` reads every browser entry's
    sheet and checks that its travel clip paints and animates in all four
    facings, and that each watched species has an animated action or display
    clip;
  - `src/wildlife/AnimalScenes.partN.test.ts` (suite in `tests-support/`)
    runs all 70 species' Watch AI scenes in `ScenarioSession` and requires a
    moving animal (grounded or hopping; hunters animate past frame 4). The
    scenes use the `thicket` profile that the browser opens.

  The browser keeps:
  - search, sort, family filter and mobile layout;
  - one preview test drawing tiger, deer, sloth and wallaby in every facing;
  - Watch AI for a thicket walker, a hopper and water fauna;
  - an open-ground hunter and a deep-water hunter.
- **Repairs**:
  - 4a1feda9 made authority drop non-unit throws, and five callers sent raw
    deltas: `BallCommands.test.ts` and the duck, robin and frog browser specs.
    They now normalize the direction.
  - `streaming.spec.ts` hooked `prepareTerrain`, but frames call
    `prepareTerrainViews` since 226; it now samples the first view's range.
  - World-building tests that set 15 s (below the 20 s native default) now
    allow 60 s: generated crossings, settlement life and road traffic. Hosted
    runners took 18.4 s on the crossing test.
- **Ratchet**: the baseline accepts the growth from reviewed 226/232-era work
  (`--update`, 2026-11-09). Split candidates:
  - `GpuRasterSurface.ts` (1,011 lines);
  - `PhysicsScene.ts` (1,001 lines);
  - `ParticleSystem.ts` (443 lines, three functions over the complexity limit).

## Evidence

All local numbers are from an M4 Pro (14 cores) on hardware GPU.

| Run | Wall | Result |
| --- | --- | --- |
| Software WebGL, 2 workers, before | 34.1 min | 621 cases |
| Animal spec, 8 workers, before | 98 s | 76 passed |
| Animal spec, after | 38 s | 8 passed |
| Node animal checks (4 files) | 26 s | 277 passed |
| Full suite, 8 workers + concurrent vitest | 11.9 min | 444 passed, 112 failed (5 s waits under load) |
| Full suite, 4 workers (5 s/30 s deadlines) | 14.7 min | 548 passed, 8 failed |
| `npm run test:all` (final settings) | 17.1 min | vitest 5,348 in 118 s; browser 552 passed + 4 flaky in 14.7 min |
| CI smoke locally (`CI=1`, 1 worker) | 1.3 min | 12 passed |

Of the 8 failures at 4 workers, four were the throw and streaming bugs, now fixed.
The other four (an interior timeout, garden saved poses, a split-screen leave, the
standalone workshop heading) pass alone at four workers. In the final run, four
cases passed only on retry; they are the next local reliability targets:
- crow and squirrel animal work (`animal-work.spec.ts:17`);
- the wolf pack (`food-chain.spec.ts:4`);
- the apartment interior (`gameplay-interiors.spec.ts:12`).

The last green hosted push run (2026-11-07) took 7.6 min to validate and
10.3 min including deploy.
