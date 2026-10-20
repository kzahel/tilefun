# 157 — Browser-test audit

Status: audit complete, 2026-10-20. Guidance and evidence delivered; no tests deleted,
migrated or disabled, and no CI configuration changed.
Continuing owner: [testing](../topics/testing.md).

## Result

The suite has **1,724 registered Playwright cases**, expanded from **403 test
bodies/templates in 131 spec files**. The previous 1,711 count predates the vehicle
paint gameplay cases. There are also **6,066 Node/Vitest cases in 341 files** and
**11 separate Worker-package tests**. The 16 CI shards each use one Playwright
worker. Shards divide this suite; they do not each run all 1,724 cases.

| Disposition | Cases | Templates | Meaning |
| --- | ---: | ---: | --- |
| Fully portable to Node | 162 | 7 | Complete asserted domain behavior can run without Chromium; parity work may remain |
| Split semantic coverage from browser integration | 1,105 | 108 | Both exist in one body; preserve its real browser boundary |
| Retain browser contract | 451 | 283 | Actual rendering, input, DOM, browser APIs or lifecycle matter |
| Capture-only | 6 | 5 | Screenshot artifacts without behavioral/image regression expectations |
| **Total** | **1,724** | **403** | Every registered case accounted for |

**The 1,105 mixed cases are not a removal estimate.** A single test can combine
hundreds of portable assertions with one important browser boundary. The number
of residual browser representatives must follow those boundaries, not an arbitrary
target percentage. Conversely, “Browser” does not mean every repeated data check
inside that body needs a browser. It means the complete test cannot be replaced
by Node without losing something it currently asserts.

Of the 162 fully portable cases, **161 have partial native overlap and one has no
equivalent comparator self-test identified**. Four of those 161 have stronger native
coverage of their core food-chain rules, but still have small assertion differences
to reconcile. None is certified for immediate deletion. “Partial” never means ready
to delete. Native references
on browser rows are supplementary evidence, not proof of equivalent browser
behavior. Capture-only rows need a workflow/assertion decision, not a nominal
replacement test.

## Complete record and method

- [Readable ledger: all 131 files and 403 templates](157-browser-test-audit/ledger.md).
- [Machine-readable decisions, source hashes and expanded-case fingerprints](157-browser-test-audit/ledger.json).
- [Snapshot integrity checker](157-browser-test-audit/verify.mjs).

Snapshot base: `9ae14797e6c9b1848748ee3ec78171ff90949b55`. The audit collected
Playwright's JSON listing and the two Vitest listings, mapped each expanded case
to its source file and line, inspected test bodies/helpers/assertions and compared
their contracts with cited native suites. Loop-generated tests are represented
once with their full expansion count; they are not treated as hundreds of distinct
implementations. All 403 templates have a disposition, coverage assessment,
rationale, cited native suites where identified, and remaining work.

The ledger hashes every audited spec and every cited native test/configuration
(194 references including four configuration files). It fingerprints expanded
titles, locations, projects and expected status so catalog changes cannot silently
preserve an obsolete count. Verify the recorded snapshot with:

```sh
node docs/tactical/157-browser-test-audit/verify.mjs
```

The checker collects `playwright test --list`; it does not launch Chromium or run
the browser suite. It checks inventory completeness and source integrity, not
semantic equivalence. Equivalence is the source-review judgment recorded in each
row and must be backed by migration validation before removal. Source-line links
and classifications are a dated snapshot; changed source requires renewed review.
The hashes are not a complete transitive dependency graph: changes to shared
helpers, runtime code or asset catalogs also require reviewing affected decisions.

This is a source audit of the registered browser suite against existing native
coverage, not a mutation-testing study or a claim of exhaustively auditing every
native test for redundancy. Similar filenames alone were not accepted as coverage.

## Fully portable candidates

| Source | Cases | Existing coverage and remaining requirement |
| --- | ---: | --- |
| [fauna-gameplay:174](../../tests/fauna-gameplay.spec.ts#L174) | 153 | [FaunaBodies:113](../../src/wildlife/FaunaBodies.test.ts#L113) tests real ball collision/startle for every profile. [Fauna:286](../../src/wildlife/Fauna.test.ts#L286) and [WaterFauna:107](../../src/wildlife/WaterFauna.test.ts#L107) cover escape/recovery. Missing exact all-profile **Realm `throw-ball` command → collision → escape clip/height → recovery/survival** parity. |
| [deer:75](../../tests/deer-gameplay.spec.ts#L75), [frog:88](../../tests/frog-gameplay.spec.ts#L88), [rabbit:77](../../tests/rabbit-gameplay.spec.ts#L77), [robin:85](../../tests/robin-gameplay.spec.ts#L85) | 4 | Species suites overlap collision/startle. Verify/add the complete command-path/recovery assertion in the existing native owner before removing each browser body. |
| [food-chain:7](../../tests/food-chain.spec.ts#L7) | 4 | [FoodChain:8](../../src/wildlife/FoodChain.test.ts#L8) runs the **same two recipes**, checks the consumed identity, natural replacement lineage versus finite placed prey, reloads, advances again and reloads a second time. Its core policy assertions are stronger. Browser additionally asserts an initial count of four and an exact sorted survivor-type list; native uses a relative count and survivor IDs. Reconcile those small differences in the existing test and preserve shared page Pause/Save-reload wiring. |
| [interior-approved:13](../../tests/interior-approved.spec.ts#L13) | 1 | Already uses **no page/browser fixture**: it mutates PNG buffers to self-test Playwright's image comparator. Move to a browser-free comparison lane while preserving rounding tolerance, missing geometry and size rejection. Ordinary Vitest snapshot equality is not equivalent. |

The ball cases use page setup and direct transport commands, then read internal
replica state; they do not test the Throw button or compare screenshot pixels.
They should exercise production authority, codecs and replica interpretation in
Node. Preserve actual input/Worker integration independently. The all-profile
landing test already exists in [FaunaBodies:139](../../src/wildlife/FaunaBodies.test.ts#L139)
with and without input; do not add another just because the browser body lands on
an animal. [MallardInteractions:256](../../src/wildlife/MallardInteractions.test.ts#L256)
already demonstrates a real throw-command path, but only for ducks.

## Largest mixed matrices and duplication

| Browser area | Existing native evidence | Residual browser contract / action |
| --- | --- | --- |
| [Fauna motion/contact/reload](../../tests/fauna-gameplay.spec.ts#L13), 306 cases | [Fauna:384](../../src/wildlife/Fauna.test.ts#L384), [WaterFauna:146](../../src/wildlife/WaterFauna.test.ts#L146), [FaunaBodies:31](../../src/wildlife/FaunaBodies.test.ts#L31), [FaunaBodies:139](../../src/wildlife/FaunaBodies.test.ts#L139) cover roster motion, saved phase, replicated support and Realm landing | Keep real Worker pause/first client frame, visibility and no accidental bounce/presentation representatives. Compare exact phase/pose assertions before reducing renderer/roster multiplication. A native test's title saying “Worker behavior” does not mean it launched a Worker. |
| [Fauna create/delete](../../tests/fauna-gameplay.spec.ts#L264), 153 cases | Land suite tests manual identity/deletion; water suite tests generated identity/reload | Preserve picker interaction and real IndexedDB reopen. Establish exact all-habitat manual deletion/tombstone parity rather than assuming generated wildlife persistence covers it. |
| [Predator hunting](../../tests/predator-gameplay.spec.ts#L7), 72; [aquatic hunting](../../tests/aquatic-hunters.spec.ts#L9), 24 | [Predator:237](../../src/wildlife/Predator.test.ts#L237), [NaturalHunters:135](../../src/wildlife/NaturalHunters.test.ts#L135), [AquaticHunters:165](../../src/wildlife/AquaticHunters.test.ts#L165) already hunt generated prey and persist feeding/lineage; aquatic test retains position/pose/frame | Keep zoom, true Worker pause and first client publication. Compare remaining-prey and exact feeding-frame assertions; avoid redoing whole hunts in real time for every renderer. |
| [Original-vehicle editor flow](../../tests/authored-vehicle-gameplay.spec.ts#L339), 99 cases | [OriginalVehicles:403](../../src/traffic/OriginalVehicles.test.ts#L403) already parameterizes **all 33 models** through place → board → drive → reload → exit → delete | Keep mobile picker/touch, browser IndexedDB and real successful/failed mesh presentation. Do not add another 33-model native lifecycle matrix. |
| [Original mesh/roof](../../tests/authored-vehicle-gameplay.spec.ts#L273), 66 cases | [OriginalVehicles:218](../../src/traffic/OriginalVehicles.test.ts#L218) parses actual GLB geometry; shared driving/support tests overlap mechanics | Move roof physics/conformance below browser after closing any model-specific gap. Retain asset fetch, native decode, upload/draw and fallback failures. Node GLTF parsing with texture stubs is not GPU proof. |
| [Vehicle steering](../../tests/vehicle-steering.spec.ts#L8), 66; [car steering](../../tests/car-steering.spec.ts#L6), 4 | [Driving](../../src/traffic/Driving.test.ts), [CarDrivingPrediction](../../src/client/CarDrivingPrediction.test.ts), [VehicleHeading](../../src/traffic/VehicleHeading.test.ts) overlap signed turns and persistent pose | Native tests do not establish the exact all-33-family Realm/replica turn matrix. Close it once; preserve representative real Reverse/keyboard routing and client settling. Then consolidate the two browser files' overlap. |
| Parking, train, bridge/garage travel | [ScenarioParking:25](../../src/scenarios/ScenarioParking.test.ts#L25), [CityParking:7](../../src/scenarios/CityParking.test.ts#L7), [TrainGeometryRecipe:9](../../src/scenarios/TrainGeometryRecipe.test.ts#L9) already step phases, reloads and directions | Move long semantic traversal to deterministic stepping. Keep short actual Worker/input/presentation/reopen flows; many 90–120-second real-time waits are proving portable rules. See individual ledger entries. |
| Doors, boat seats and world recreation | [RealmBrowser:1460](../../src/server/RealmBrowser.test.ts#L1460), [:1543](../../src/server/RealmBrowser.test.ts#L1543), [:1698](../../src/server/RealmBrowser.test.ts#L1698), [:1782](../../src/server/RealmBrowser.test.ts#L1782) cover shared multi-door identity/restart, saved furniture, clean same-seed recreation, and open-water seat restoration | Despite its name, **RealmBrowser.test is Node**, using test transport/storage. Keep actual keyboard/fade, DOM recreation actions and IndexedDB composition; core rules already have substantial coverage. |
| API checks mixed with Workshop/tools/security/remote-world pages | Native auth/service/static-file tests cover many policies; [RealmBrowser:563](../../src/server/RealmBrowser.test.ts#L563) already tests live inspection edits | Separate HTTP/WS/filesystem subprocess checks from UI. Policy unit tests do not prove exact standalone endpoint acceptance; fill only that integration gap. Keep login/bootstrap/fragment removal and actual cross-origin client flow. |
| [Family-sheet invalid animation](../../tests/family-sheets.spec.ts#L794), 8 cases | No equivalent native runtime validator suite found | Extract pure timing/frame-size validation from FamilySheetArt, then retain representative actual error/no-artwork UI. Python generator tests are different code and are not run by npm test/CI. |
| [Play ideas](../../tests/play-ideas.spec.ts), 9 mixed cases | Server submission/auth/idempotency tests exist; no native client speech-controller suite identified | Extract mocked asynchronous recognition/capture/cancel/retry rules. Keep real pointer release, focus/fullscreen, dialog/unmount and local outbox integration. Mocked recognition does not prove microphone hardware or speech quality. |

Additional overlap is recorded conservatively: the original coupe flow overlaps
the larger authored-vehicle matrix; generic movement/error smokes overlap each
other; per-batch review UI repeats policy already tested in native queue/service
suites. None is assigned an automatic deletion count. Preserve unique inputs,
pixels, sources, adapters and error routes before consolidating.

## Weak assertions and captures

The six capture-only cases are [editor:19/44](../../tests/editor.spec.ts#L19),
[screenshot:34](../../tests/screenshot.spec.ts#L34) (two zooms), and
[interiors-screenshots:13/113](../../tests/interiors-screenshots.spec.ts#L13).
They produce screenshots without asserting captured appearance or meaningful
behavior. The editor test titled “verify autotile” does not assert an autotile
result. Move captures to an explicitly invoked capture workflow or define a real
regression expectation. Other bodies in interiors-screenshots do assert behavior;
the whole file cannot be removed as one capture-only unit.

[water-animation](../../tests/water-animation.spec.ts#L3) asserts only that the
canvas has nonblack pixels after walking. That is browser-dependent, but does not
prove water or its animation rendered. Stage known water and assert its specific
pixels/phase, or establish that the generic smoke is redundant. Replacing it with
a nominal Node test would preserve neither a useful visual assertion nor a new
behavioral contract.

## Browser boundaries to preserve

- Current canvas/source or approved-PNG comparisons, native image decoding,
  WebGL shader output, mesh/texture upload/draw/fallback, context loss/recovery.
  Recording/fake graphics surfaces in Node do not establish these behaviors.
- Actual pointer/keyboard cancellation and ownership, DOM hit testing/layout,
  focus, page scroll suppression, fullscreen and navigation composition.
- Real IndexedDB reopen/locks, page unload and browser outbox/session behavior.
  Memory records and mocked IDB tests prove different layers.
- Native Worker independence while the main thread is busy, actual lifecycle
  counts, visibility fences and shutdown. Manually stepped Realm tests cannot
  prove separate browser event loops or native Worker disposal.
- Real RTCDataChannel/SCTP negotiated limits, channel mapping, reconnect and
  ordering. Native protocol mirrors remain useful without replacing transport.
- [PWA](../../tests/pwa.spec.ts) uses Chromium CDP manifest/installability and
  native decoding; JSON/HTTP icon checks alone are insufficient.
- [Train audio](../../tests/train-audio.spec.ts#L18) measures actual AudioContext
  stereo energy; sound counters/mock graphs alone cannot replace it.

## Cost evidence and CI implications

The successful [CI run 39366263199](https://github.com/kzahel/tilefun/actions/runs/39366263199)
is an earlier source snapshot, not the 1,724-case inventory above. Its 16 e2e job
durations sum to **425.5 runner-minutes**, including setup/teardown. Individual
test-step durations ranged from **215 to 2,013 seconds**; this is substantial shard
imbalance. Summed job time is not elapsed PR latency or a guaranteed billable cost.

The logs' reported per-test durations sum to approximately **336.4 minutes**:
wildlife about **215.1**, including fauna about **168.6** (motion/contact **99.5**,
balls **34.3**, creation/deletion **34.4**); vehicles about **81.5**. These are
historical direction-finding measurements, not projected migration savings.
Durations exclude setup and can change with software rendering and CPU contention.

All 16 shards repeat raster-manifest verification, totaling **38.4 runner-minutes**
in that run; repeated builds total **4.9**. Moving semantic tests is the first
coverage decision. Separately evaluate sharing immutable build/raster artifacts
and balancing residual browser shards after measuring the changed suite. Raising
worker concurrency is not the first recommendation: the current configuration
explicitly bounds software-GPU/authority contention.

## Migration order and acceptance

1. **Food-chain overlap and comparator lane.** Keep the explicit initial count and
   survivor-type reload checks in the existing native food-chain test, confirm
   existing pause/reload browser coverage, then remove its four semantic browser
   variants. Relocate the comparator self-test without weakening tolerance. No new
   food-chain suite is needed just to replace a count.
2. **All-profile ball commands.** Extend the existing native owners with the
   missing command/collision/replica/recovery path. Include land, shore, deep-water,
   hop and ordinary-ground contracts across the roster. Preserve one actual Throw
   input/Worker path where required, then remove the 157 state-only browser cases.
3. **Large mixed wildlife/vehicle matrices.** Compare assertions line by line,
   reuse the existing roster lifecycle/landing/hunting suites, close exact gaps,
   and retain explicit browser representatives for distinct input, storage,
   rendering and resource-failure paths. Enumerate required per-asset loader checks
   before reducing any content matrix; representative generic meshes alone are
   not proof that every asset decodes.
4. **Long scenario waits and pure API/validator/controller matrices.** Keep route
   cycles in native step-driven suites and exact endpoint integration in Node;
   retain browser controls, actual scheduling and presentation. Extract pure
   validators/controllers only where existing coverage is missing.
5. **Capture and smoke cleanup, then CI measurements.** Decide which captures are
   opt-in, repair or retire weak assertions with evidence, measure residual runtime,
   rebalance shards and assess repeated artifact work. Do not set a speculative
   deletion percentage or claim 1,105 mixed cases as savings.

For each slice, record the old assertions, their existing/replacement test locations,
the exact browser contracts retained, and the targeted native/browser results.
Run the repository's required checks and relevant real browser representatives
before deletion. A rule/codec test, simulation integration test and browser adapter
test can overlap deliberately because they detect different failures; redundancy
means equivalent contracts, not merely the same feature appearing in both suites.

## Validation of this audit

- `npm run typecheck`: passed.
- `npm run check`: passed, including the final audit artifacts; existing warnings
  and informational diagnostics remain.
- `npm test`: **6,064 passed, two timed out**, 341 files / 6,066 cases, 413 seconds.
  Both failures were in workshopService: vehicle geometry registration at line 574
  and exact character settings at line 645, each under the default five-second
  timeout. No application/test implementation changed in this audit.
- `npx vitest run src/server/workshopService.test.ts --maxWorkers=2`: **13/13 passed**,
  17.86 seconds. This is consistent with contention; it does not establish a root
  cause or turn the initial full-suite result into a pass.
- `npm run test:worker`: **11/11 passed**.
- Snapshot integrity checker: passed for all 131 files, 403 templates and 1,724 cases,
  including cited coverage/configuration hashes. Audit JSON/verifier formatting passed.
- No build or browser-suite execution: changes are guidance, audit records and an
  inventory-only verifier; no rendering or gameplay behavior changed.
