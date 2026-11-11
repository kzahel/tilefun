# Steep-jump prediction reproduction

Status: numerical landing divergence reproduced, 2026-11-11; runtime unchanged.
Owner: [player prediction](../topics/player-prediction.md).

The owner reports a large apparent correction driving the F1 car over the
steepest generated motocross jump in local Host play. This investigation uses
the `open-wheel-racer` and shared `sky` profile. It establishes a related
landing defect; it does not claim an exact reproduction of the owner's phone,
approach, world or point in the jump.

## Repeatable native reproduction

```sh
npx tsx scripts/reproduce-jump-prediction.ts --json=data/scratch/jump-prediction.json
```

The script runs the ordinary jump-park Realm, binary replication,
RemoteStateView and PlayerPredictor. After entering the car, three idle ticks
settle the suspension; sequences 4–270 hold manual forward and boost. Two runs
use identical authority input schedules. One delivers each frame immediately;
the other queues frames for two fixed ticks (33.3 ms). Input delivery to the
authority remains immediate. There is no renderer, screen, Worker or wall-time
simulation clock. The predictor's injected clock removes CPU-speed-dependent
replay slicing from this numerical reproduction.

Each sample compares the published **car body** with authority at the same
physics tick, before delivering the next frame. It does not compare the
current predicted position with an older server position. Optional JSON keeps
the full numerical authority state, predicted pose, tick and reconciliation
diagnostics. Quaternion angle comparisons normalize their lengths.

| Delivery | Largest same-tick position error | Rotation error at that sample | Tick |
| --- | ---: | ---: | ---: |
| Immediate | 0.0000156 px | 0.0000038° | 172 |
| Two ticks later | **13.5601 px** | **6.5477°** | **249** |

Both authority runs peak at 199.8072 px. The delayed run executes three direct
steps and 792 steps inside replay jobs; the immediate run executes 267 direct
steps and zero replay steps. Thus this reproduction actually exercises
unacknowledged replay. Two independent scratch executions and the retained
script produce the same worst error.

Flight agrees closely. Contact begins at tick 246. At tick 248, the delayed
prediction differs by about 0.002 px; tick 249 produces the large error:

| Car position, tick 249 | Authority | Prediction |
| --- | ---: | ---: |
| X | 925.0455 | 912.5089 |
| Y | 192.0179 | 187.9402 |
| Z | 43.0970 | 46.2721 |

The next replay recovers numerical agreement; its matching-horizon correction
diagnostic records the 13.56 px error. Presentation applies easing, so this
numerical error is not a claim of a single 13.56 px rendered teleport.

## Supporting checks and limits

- An isolated browser run using a real RecipeWorldClient/authority Worker,
  constant forward/boost and no simulated network delay produced a **7.207 px
  same-tick landing error** near X=913–920, Z≈43. The run sampled numerical
  prediction and frames; it did not capture the renderer or camera.
- A separate first browser attempt inadvertently loaded the main game alongside
  the reproduction. Its heavily delayed samples are excluded. The retained
  Worker result came from a blank page with only the diagnostic client.
- Generated seed-2026 motocross runs, replacing the start-line rally car with
  an open-wheel racer, also show landing disagreement. Different initial
  settling/approach gives different magnitudes: 0.489 px with a two-tick delay
  and 4.869 px with four ticks. These are supporting evidence, not an exact
  phone reproduction. Nearby actors and rail services remain present.
- `--direct-state` bypasses the physics-state codec and feeds the independently
  captured numerical authority snapshot to reconciliation at the same delivery
  tick. It produces the **same 13.5601 px error**. Packet packing is therefore
  not the cause in this fixture; this does not establish snapshot completeness.
- A scratch-only control clearing the private scene before each restore did
  **not** fix agreement and worsened other delay cases. Rebuilding the scene is
  not a qualified remedy. No such change was made to runtime source.
- Headless reproduction excludes screen refresh, camera, GPU rendering and GC
  pauses as necessary triggers. The exact first divergent contact operation is
  not yet identified. Shared code and fixed dt do not ensure restored solver
  context is identical.

Validation: retained native reproduction and direct-state control; tools
TypeScript check and focused Biome check. No playable code changes, production
build, streaming change or reload-readiness update is needed for this diagnostic.

## Next bounded step

Trace the three replay steps beginning from authority tick 246 through landing:
compare wheel hits/normals, prepared impulses and post-solver pose against the
authority at the same ticks. Identify the first differing operation before
choosing between restore, geometry or solver-context changes. Keep the exact
three-idle-tick fixture as a regression; a candidate repair should bring its
position and angle errors below 0.1 px / 0.1° and retain the immediate-delivery
control. Then check the actual Worker jump and owner phone; avoid another broad
allocation or rendering investigation unless that evidence points there.
