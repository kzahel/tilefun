# Browser-test audit ledger

Snapshot: 2026-10-20, base `9ae14797e6c9b1848748ee3ec78171ff90949b55`. All 131 files, 403 source templates and 1,724 expanded cases are accounted for.

Read the [audit report](../157-browser-test-audit.md) for definitions, evidence and implementation order. [Machine-readable decisions and hashes](ledger.json) retain the exact effective decision for each template. Run `node docs/tactical/157-browser-test-audit/verify.mjs` from the repository to detect source or inventory drift.

Each file has a common coverage assessment, a table for every source template, and any template-specific refinements below it. “Partial” is overlap, not permission to delete. “Browser boundary” means cited native tests supplement rather than replace the browser assertions. “Gap” means no equivalent native contract identified. Line links refer to the audit snapshot.

| Group | Files | Cases | Node | Split | Browser | Capture |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Wildlife | 21 | 916 | 161 | 668 | 87 | 0 |
| Vehicles, roads and rail | 36 | 419 | 0 | 355 | 64 | 0 |
| Buildings and interiors | 18 | 126 | 1 | 31 | 92 | 2 |
| Art and Workshop | 18 | 91 | 0 | 15 | 76 | 0 |
| World generation and explorer | 12 | 58 | 0 | 16 | 42 | 0 |
| Input, editor and player UI | 9 | 54 | 0 | 11 | 41 | 2 |
| Engine, networking and app | 17 | 60 | 0 | 9 | 49 | 2 |

## Files

### ambulance-driving.spec.ts

8 cases; 1 source template. Emergency state/boost/release are headless authority/prediction; button visibility and tagged lights on real loaded models are browser integration.

Existing native coverage: [src/server/VehicleControl.test.ts](../../../src/server/VehicleControl.test.ts), [src/traffic/EmergencyVehicle.test.ts](../../../src/traffic/EmergencyVehicle.test.ts), [src/rendering/VehicleEmergencyLights.test.ts](../../../src/rendering/VehicleEmergencyLights.test.ts), [src/rendering/CarMeshAsset.test.ts](../../../src/rendering/CarMeshAsset.test.ts)

Remaining work: Keep one siren/style/Fast input path plus model-specific loaded-light validation; metadata/state alone does not prove GPU lenses render.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L12](../../../tests/ambulance-driving.spec.ts#L12) | ``${model} uses its own model, switches lights/styles and boosts in shared driving (${backend})`` | 8 | Split | Partial |

### animal-browser.spec.ts

76 cases; 5 source templates. Search/sort controls, layout, preview pixel visibility and frame advancement, and Watch AI routing are browser contracts.

Existing native coverage: [src/wildlife/Fauna.test.ts](../../../src/wildlife/Fauna.test.ts), [src/wildlife/Predator.test.ts](../../../src/wildlife/Predator.test.ts)

Remaining work: Roster metadata/filter rules can gain cheap data tests, but those do not replace image decode/canvas or DOM handoff. Reduce repeated handoff cases only with a route/asset inventory plus representative real flows.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L41](../../../tests/animal-browser.spec.ts#L41) | ``browses animated animals by name, family and dates, then runs their real AI scene`` | 1 | Browser | Browser boundary |
| [L103](../../../tests/animal-browser.spec.ts#L103) | ``mobile animal search fits the viewport and opens a hunting scene`` | 1 | Browser | Browser boundary |
| [L120](../../../tests/animal-browser.spec.ts#L120) | ``every animal has a visible animated locomotion preview facing ${direction}`` | 4 | Browser | Browser boundary |
| [L181](../../../tests/animal-browser.spec.ts#L181) | ``${animal.species} opens from the browser as visible moving natural wildlife`` | 53 | Browser | Browser boundary |
| [L239](../../../tests/animal-browser.spec.ts#L239) | ``${animal.species} browser display opens a real moving shared hunter`` | 17 | Browser | Browser boundary |

### animal-work.spec.ts

9 cases; 3 source templates. Production Realm work, attachment/replication and reload already run headlessly; real browser pause/phase presentation and activity UI remain.

Existing native coverage: [src/wildlife/AnimalWork.test.ts](../../../src/wildlife/AnimalWork.test.ts)

Remaining work: Check the ordinary-game moving-facing/clip publication regression against headless assertions; retain browser work-selector and one carry presentation path.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L18](../../../tests/animal-work.spec.ts#L18) | ``${animal} real work, carried object and reload (${renderer})`` | 6 | Split | Partial |
| [L70](../../../tests/animal-work.spec.ts#L70) | ``ordinary game dog fetches a player-thrown ball (${renderer})`` | 2 | Split | Partial |
| [L179](../../../tests/animal-work.spec.ts#L179) | ``Animal Browser filters behavior demonstrations and opens the selected activity`` | 1 | Browser | Browser boundary |

**L179: Browser / Browser boundary** — Filters Animal Browser demonstration cards and opens a selected activity.

Remaining work: Keep DOM filter and scene handoff coverage.

### aquatic-hunters.spec.ts

24 cases; 1 source template. The headless suite already hunts generated prey and reloads meal/respawn lineage; the browser adds selected zoom, live Worker pause and client phase publication. AquaticHunters.test:165 explicitly retains saved position, pose/frame and lineage.

Existing native coverage: [src/wildlife/AquaticHunters.test.ts](../../../src/wildlife/AquaticHunters.test.ts)

Remaining work: Core hunt/reload and saved pose are already covered; check exact remaining-prey count and first paused client publication, then retain a representative zoom/pause/replica browser path.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L9](../../../tests/aquatic-hunters.spec.ts#L9) | ``${p.species} hunts in its real lagoon and saves feeding phase (${renderer})`` | 24 | Split | Partial |

### art-workbench.spec.ts

6 cases; 6 source templates. Source canvas selection/bookmarks, cross-browser notes, offline outbox, phone dragging and stale-source visible blocking require browser UI/storage/image behavior.

Existing native coverage: [src/art/ArtCatalog.test.ts](../../../src/art/ArtCatalog.test.ts), [src/art/ArtNoteInbox.test.ts](../../../src/art/ArtNoteInbox.test.ts), [src/server/artNotesHttp.test.ts](../../../src/server/artNotesHttp.test.ts), [src/explorer/ViewState.test.ts](../../../src/explorer/ViewState.test.ts)

Remaining work: API/parser and selection math already have Node tests; keep actual source-pixel selection and user-visible save gating rather than replacing with model checks.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L8](../../../tests/art-workbench.spec.ts#L8) | ``traces source uses, bookmarks exact regions, and browses both major atlases`` | 1 | Browser | Browser boundary |
| [L40](../../../tests/art-workbench.spec.ts#L40) | ``saves notes on the machine for a second browser and resolves the same thread`` | 1 | Browser | Browser boundary |
| [L78](../../../tests/art-workbench.spec.ts#L78) | ``retains offline notes and replays each event once after reconnect`` | 1 | Browser | Browser boundary |
| [L103](../../../tests/art-workbench.spec.ts#L103) | ``supports phone tap and dragged source regions without horizontal overflow`` | 1 | Browser | Browser boundary |
| [L142](../../../tests/art-workbench.spec.ts#L142) | ``flags changed source revisions without discarding the pending annotation`` | 1 | Browser | Browser boundary |
| [L171](../../../tests/art-workbench.spec.ts#L171) | ``refuses to attach new notes to pixels from a stale inventory`` | 1 | Browser | Browser boundary |

### authored-train.spec.ts

9 cases; 5 source templates. Real carriage GLB load/draw, renderer switching, native-art request suppression, archived review navigation and aborted-request fallback are browser contracts.

Existing native coverage: [src/rendering/AuthoredTrainMeshes.test.ts](../../../src/rendering/AuthoredTrainMeshes.test.ts), [src/railway/CurveTrain.test.ts](../../../src/railway/CurveTrain.test.ts)

Remaining work: Move geometry/registry metadata checks to Node, but preserve actual decode/draw/backend/fallback paths and comparison image layout.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L11](../../../tests/authored-train.spec.ts#L11) | ``main-game default draws reviewed carriages and backend changes retain the service`` | 1 | Browser | Browser boundary |
| [L93](../../../tests/authored-train.spec.ts#L93) | ``blue train exact review opens its 4×2 and both retained motion comparisons`` | 1 | Browser | Browser boundary |
| [L122](../../../tests/authored-train.spec.ts#L122) | ``native train comparison stays available (${renderer})`` | 3 | Browser | Browser boundary |
| [L139](../../../tests/authored-train.spec.ts#L139) | ``reviewed blue train loads three own carriages in shared ${fixture} service`` | 3 | Browser | Browser boundary |
| [L180](../../../tests/authored-train.spec.ts#L180) | ``failed front-carriage fetch retains its native crop and the complete service`` | 1 | Browser | Browser boundary |

### authored-vehicle-gameplay.spec.ts

180 cases; 7 source templates. Actual browser GLB fetching, native image decode, GPU upload/draw eligibility and failed-fetch fallback are browser contracts; Node already decodes actual geometry with texture decoding substituted.

Existing native coverage: [src/traffic/OriginalVehicles.test.ts](../../../src/traffic/OriginalVehicles.test.ts), [src/rendering/CarMeshAsset.test.ts](../../../src/rendering/CarMeshAsset.test.ts), [src/rendering/AuthoredVehicleMeshes.test.ts](../../../src/rendering/AuthoredVehicleMeshes.test.ts)

Remaining work: Do not call Node GLTF geometry parsing GPU coverage. Keep real fetch/upload/fallback paths, with exhaustive asset identity/geometry in Node.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L12](../../../tests/authored-vehicle-gameplay.spec.ts#L12) | ``every compact uses its own GLB in the shared traffic presentation`` | 1 | Browser | Browser boundary |
| [L46](../../../tests/authored-vehicle-gameplay.spec.ts#L46) | ``every additional sedan loads its own GLB in shared traffic`` | 1 | Browser | Browser boundary |
| [L77](../../../tests/authored-vehicle-gameplay.spec.ts#L77) | ``every bus loads its own GLB in shared traffic`` | 1 | Browser | Browser boundary |
| [L108](../../../tests/authored-vehicle-gameplay.spec.ts#L108) | ``every large car loads its own GLB in shared traffic`` | 1 | Browser | Browser boundary |
| [L152](../../../tests/authored-vehicle-gameplay.spec.ts#L152) | ``failed ${vehicle} fetch keeps the traffic scene and sprite fallback available`` | 11 | Browser | Browser boundary |
| [L273](../../../tests/authored-vehicle-gameplay.spec.ts#L273) | ``${family.title} shares GPU traffic presentation and roof support with ${failed ? "failed-mesh sprite fallback" : "its own mesh"}`` | 66 | Split | Partial |
| [L339](../../../tests/authored-vehicle-gameplay.spec.ts#L339) | ``${family.title} palette placement, boarding, driving, save/reload and deletion (${renderer}${failed ? ", failed mesh" : ""})`` | 99 | Split | Partial |

**L273: Split / Partial** — Own-mesh/fallback GPU readiness and drawing need a browser; per-model roof physics/height and traffic movement belong headlessly.

Remaining work: OriginalVehicles tests cover all models/geometry and shared placement; verify per-model roof carry in ScenarioSession, keep GPU/fallback representatives and every required asset-load check.

**L339: Split / Partial** — All 33 models already have production Realm place→board→drive→reload→exit→delete coverage (OriginalVehicles.test). Mobile picker/touch hit testing, IndexedDB and successful/failed mesh presentation remain browser-specific.

Remaining work: Retain representative mobile editor/IDB/mesh-fallback combinations; preserve the per-model Node test. Verify browser record identity/seat assertions are represented in native persistence tests before removing variants.

### authored-vehicle-review.spec.ts

46 cases; 1 source template. Per-revision review link, image load and responsive layout need a browser; GLB existence/magic and exact registry identity are filesystem/data checks.

Existing native coverage: [src/traffic/OriginalVehicles.test.ts](../../../src/traffic/OriginalVehicles.test.ts), [src/art/ArtCatalog.test.ts](../../../src/art/ArtCatalog.test.ts)

Remaining work: Create or verify an exhaustive archived-revision link/resource inventory. Retain representative actual navigation and browser image/layout checks; current originals do not cover every historical revision.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L51](../../../tests/authored-vehicle-review.spec.ts#L51) | ``retained ${asset} ${revision} review opens its own comparison from Workshop on desktop and phone`` | 46 | Split | Partial |

### blender-tiger.spec.ts

3 cases; 3 source templates. Standalone demo keyboard/pointer routing, mobile layout, image decoding and exact canvas/source pixel equality need the browser.

Existing native coverage: No equivalent native suite identified.

Remaining work: Extract pure movement logic only if it becomes a shared concern; no existing headless equivalent identified for this standalone page.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L3](../../../tests/blender-tiger.spec.ts#L3) | ``tiger walks in all directions and stops when input is released`` | 1 | Browser | Browser boundary |
| [L33](../../../tests/blender-tiger.spec.ts#L33) | ``both art styles and native sizes load real sprites and comparison can show actual pixels`` | 1 | Browser | Browser boundary |
| [L75](../../../tests/blender-tiger.spec.ts#L75) | ``direction buttons move the tiger and the mobile layout fits`` | 1 | Browser | Browser boundary |

### boat-lakes.spec.ts

6 cases; 2 source templates. Boat movement/seat/clearance/persistence and lake population are headless; browser Drive boat input, saved browser seat and loaded presentation remain integration. RealmBrowser.test already restores an occupied boat seat at its exact open-water position after server restart and distinguishes explicit shore travel.

Existing native coverage: [src/boats/Boat.test.ts](../../../src/boats/Boat.test.ts), [src/server/VehiclePlacement.test.ts](../../../src/server/VehiclePlacement.test.ts), [src/server/RealmBrowser.test.ts](../../../src/server/RealmBrowser.test.ts)

Remaining work: Open-water seat restore is covered in Node (RealmBrowser.test:1782); verify lake wildlife recipe counts separately. Retain actual Drive boat/touch input, client presentation and browser IndexedDB reopen.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L37](../../../tests/boat-lakes.spec.ts#L37) | ``natural boat drives and retains its open seat and parked pose (${renderer})`` | 3 | Split | Partial |
| [L104](../../../tests/boat-lakes.spec.ts#L104) | ``lake playground uses the shared boat and varied real water wildlife (${renderer})`` | 3 | Split | Partial |

### building-doors.spec.ts

6 cases; 4 source templates. Door thresholds, arrivals and saved interior identity have headless owners; actual keyboard traversal, CSS fade and browser reentry/reload compose those owners. RealmBrowser.test:1460/1543 already checks concurrent multi-entrance shared identity, opposite exits/restart, and saved room geometry/furniture.

Existing native coverage: [src/interiors/DoorTraversal.test.ts](../../../src/interiors/DoorTraversal.test.ts), [src/client/DoorPresentation.test.ts](../../../src/client/DoorPresentation.test.ts), [src/server/RealmBrowser.test.ts](../../../src/server/RealmBrowser.test.ts)

Remaining work: Retain automatic keyboard/fade and actual browser restore. Existing multi-entrance server coverage is substantial; inventory any additional building geometry before expanding native fixtures.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L8](../../../tests/building-doors.spec.ts#L8) | ``${kind}: walk between entrances, exit at the selected door and reload indoors`` | 2 | Split | Partial |
| [L84](../../../tests/building-doors.spec.ts#L84) | ``all four playable layouts have usable Workshop previews`` | 1 | Browser | Browser boundary |
| [L94](../../../tests/building-doors.spec.ts#L94) | ``${kind}: automatic walk-through, fade, arrival and reload latch`` | 2 | Split | Partial |
| [L239](../../../tests/building-doors.spec.ts#L239) | ``door animation candidates match the registered preview`` | 1 | Browser | Browser boundary |

**L84: Browser / Browser boundary** — Opens registered door/interior review candidates and requires actual browser verification readiness.

Remaining work: Keep current preview verification; data registry alone does not prove renderability.

**L239: Browser / Browser boundary** — Opens registered door/interior review candidates and requires actual browser verification readiness.

Remaining work: Keep current preview verification; data registry alone does not prove renderability.

### building-lab.spec.ts

10 cases; 8 source templates. Canvas source-pixel/alpha checks, navigation, responsive controls, feedback drafts/outbox and stale-byte disabled UI are browser contracts.

Existing native coverage: [src/generation/regional/CityBuildingPrefabs.test.ts](../../../src/generation/regional/CityBuildingPrefabs.test.ts), [src/art/BuildingReviewQueue.test.ts](../../../src/art/BuildingReviewQueue.test.ts), [src/server/artNotesHttp.test.ts](../../../src/server/artNotesHttp.test.ts)

Remaining work: Node prefab/queue/API coverage supplements these tests. Extract pure feedback payload validation, but retain user-visible routing and pixel verification.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L5](../../../tests/building-lab.spec.ts#L5) | ``composes every candidate through shared gameplay recipes and renderer`` | 1 | Browser | Browser boundary |
| [L38](../../../tests/building-lab.spec.ts#L38) | ``shared ${scene} frontage and recipe navigation`` | 3 | Browser | Browser boundary |
| [L57](../../../tests/building-lab.spec.ts#L57) | ``phone building showcase and workbench links fit without overflow`` | 1 | Browser | Browser boundary |
| [L65](../../../tests/building-lab.spec.ts#L65) | ``leaves block and building feedback directly, shares it with the workbench, and reads replies`` | 1 | Browser | Browser boundary |
| [L133](../../../tests/building-lab.spec.ts#L133) | ``keeps offline feedback tied to its original block across reload and scene changes`` | 1 | Browser | Browser boundary |
| [L175](../../../tests/building-lab.spec.ts#L175) | ``refuses feedback when prefab source bytes differ from the pinned revision`` | 1 | Browser | Browser boundary |
| [L186](../../../tests/building-lab.spec.ts#L186) | ``shared facade joins preserve opaque source pixels without atlas-edge bleeding after redraw`` | 1 | Browser | Browser boundary |
| [L250](../../../tests/building-lab.spec.ts#L250) | ``complete single buildings explain topology and old storefront links open an assembled building`` | 1 | Browser | Browser boundary |

### building-review.spec.ts

5 cases; 5 source templates. Visible review advance/pause/undo, offline/reload and second-browser synchronization require DOM/local browser storage.

Existing native coverage: [src/art/BuildingReviewQueue.test.ts](../../../src/art/BuildingReviewQueue.test.ts), [src/server/workshopService.test.ts](../../../src/server/workshopService.test.ts)

Remaining work: Policy already has Node coverage; preserve a bounded set of true UI scenarios rather than mirroring every policy variant through the page.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L8](../../../tests/building-review.spec.ts#L8) | ``one-tap review hides approvals, persists, pauses after two reports, and can undo`` | 1 | Browser | Browser boundary |
| [L70](../../../tests/building-review.spec.ts#L70) | ``approvals survive debug view changes; a changed appearance returns to unchecked`` | 1 | Browser | Browser boundary |
| [L106](../../../tests/building-review.spec.ts#L106) | ``phone navigation and voting are visible without scrolling`` | 1 | Browser | Browser boundary |
| [L135](../../../tests/building-review.spec.ts#L135) | ``an exhausted queue stays empty after reload and decisions are readable from another browser`` | 1 | Browser | Browser boundary |
| [L178](../../../tests/building-review.spec.ts#L178) | ``a fixed batch reopens only changed candidates and releases the pause`` | 1 | Browser | Browser boundary |

### car-controls.spec.ts

2 cases; 1 source template. Steering/automatic reverse/contact math are headless; saved Options controls, real keys/taps and touch-button bounds require a browser.

Existing native coverage: [src/traffic/Driving.test.ts](../../../src/traffic/Driving.test.ts), [src/traffic/CarContact.test.ts](../../../src/traffic/CarContact.test.ts), [src/input/TapMovement.test.ts](../../../src/input/TapMovement.test.ts), [src/server/VehicleControl.test.ts](../../../src/server/VehicleControl.test.ts)

Remaining work: Keep settings persistence and pointer/keyboard routing; avoid repeating contact overlap assertions per renderer.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L38](../../../tests/car-controls.spec.ts#L38) | ``saved car controls, keyboard steering, automatic reverse taps and solid car contact (${renderer})`` | 2 | Split | Partial |

### car-projection.spec.ts

2 cases; 2 source templates. GPU pixel changes/source comparison, orbit pointer controls, WebGL context loss/recovery, teardown and responsive layout require a browser.

Existing native coverage: [src/projection/CarProxy.test.ts](../../../src/projection/CarProxy.test.ts), [src/projection/ProxyTexture.test.ts](../../../src/projection/ProxyTexture.test.ts)

Remaining work: Node geometry/UV tests supplement but do not replace shader output and native context lifecycle.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L7](../../../tests/car-projection.spec.ts#L7) | ``car proxy preserves source pixels, orbits, recovers and releases its GPU context`` | 1 | Browser | Browser boundary |
| [L116](../../../tests/car-projection.spec.ts#L116) | ``car experiment is discoverable without approvals and works in a touch viewport`` | 1 | Browser | Browser boundary |

### car-steering.spec.ts

4 cases; 1 source template. Overlaps the original-family steering matrix and pure driving tests; adds keyboard Reverse/steering through live Traffic UI.

Existing native coverage: [src/traffic/Driving.test.ts](../../../src/traffic/Driving.test.ts), [src/client/CarDrivingPrediction.test.ts](../../../src/client/CarDrivingPrediction.test.ts), [src/traffic/VehicleHeading.test.ts](../../../src/traffic/VehicleHeading.test.ts)

Remaining work: Keep explicit reverse input and client settle representative; consolidate overlapping car-steering/vehicle-steering coverage after adding family headless turns.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L6](../../../tests/car-steering.spec.ts#L6) | ``shared rolling turns, reverse steering and stopped heading (${model}, ${backend})`` | 4 | Split | Partial |

### character-gameplay.spec.ts

2 cases; 2 source templates. NPC/player appearance registry and saved identity can be headless; picker animation/scrolling, per-profile browser choice and world reload need browser integration.

Existing native coverage: [src/characters/PlayerModels.test.ts](../../../src/characters/PlayerModels.test.ts), [src/characters/CharacterCatalog.test.ts](../../../src/characters/CharacterCatalog.test.ts), [src/persistence/RealmRecords.test.ts](../../../src/persistence/RealmRecords.test.ts)

Remaining work: Verify exact approved-NPC placement/reload in production Realm and separate profile-selection persistence. Keep mobile scroll/animation and one real profile isolation/reopen path.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L44](../../../tests/character-gameplay.spec.ts#L44) | ``approved NPCs place, save and reload in the Worker; player choice persists separately`` | 1 | Split | Partial |
| [L115](../../../tests/character-gameplay.spec.ts#L115) | ``phone picker scrolls, animates previews and isolates profile choices`` | 1 | Browser | Browser boundary |

**L115: Browser / Browser boundary** — Checks actual phone picker scrolling, preview animation and isolated browser profile choices.

Remaining work: Keep DOM/presentation/browser-profile isolation.

### character-presentation.spec.ts

2 cases; 1 source template. Real Worker ownership, pose/frame UI, render-size/camera controls, stacked canvases and resource cleanup need browser integration.

Existing native coverage: [src/scenarios/ScenarioPresentationHost.test.ts](../../../src/scenarios/ScenarioPresentationHost.test.ts), [src/characters/CharacterTestScene.test.ts](../../../src/characters/CharacterTestScene.test.ts), [src/rendering/RenderHost.test.ts](../../../src/rendering/RenderHost.test.ts)

Remaining work: Collision/clearance semantics are native-covered; preserve actual canvas/Worker lifecycle and inspector event routing.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L5](../../../tests/character-presentation.spec.ts#L5) | ``character ${renderer} host preserves gameplay, pose inspection and resource lifetime`` | 2 | Browser | Browser boundary |

### character-rendering.spec.ts

2 cases; 2 source templates. Current browser rendering fingerprint and disabled approval on mismatched manifest require canvas/UI.

Existing native coverage: [src/characters/CharacterCatalog.test.ts](../../../src/characters/CharacterCatalog.test.ts), [src/art/ArtCatalog.test.ts](../../../src/art/ArtCatalog.test.ts)

Remaining work: Registry tests cannot replace exact rendered appearance verification.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L8](../../../tests/character-rendering.spec.ts#L8) | ``normal Chromium verifies every character against the generated manifest`` | 1 | Browser | Browser boundary |
| [L26](../../../tests/character-rendering.spec.ts#L26) | ``character verification rejects a mismatched manifest without enabling reviews`` | 1 | Browser | Browser boundary |

### character-workshop.spec.ts

3 cases; 3 source templates. Real movement controls, animation, jump routing, draft/feedback forms, canceled touch and offline retry are browser contracts.

Existing native coverage: [src/characters/CharacterTestScene.test.ts](../../../src/characters/CharacterTestScene.test.ts), [src/characters/CharacterCatalog.test.ts](../../../src/characters/CharacterCatalog.test.ts), [src/server/workshopService.test.ts](../../../src/server/workshopService.test.ts)

Remaining work: Native geometry/settings/pause policy are covered below the browser; retain distinct DOM/input/offline enforcement scenarios.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L7](../../../tests/character-workshop.spec.ts#L7) | ``character lab lists six candidates and exercises movement, grounding, animation and editing`` | 1 | Browser | Browser boundary |
| [L66](../../../tests/character-workshop.spec.ts#L66) | ``character touch controls release, drafts survive reload, and offline reviews retry`` | 1 | Browser | Browser boundary |
| [L114](../../../tests/character-workshop.spec.ts#L114) | ``character reports require reasons and pause after two reports`` | 1 | Browser | Browser boundary |

### city-places-review.spec.ts

8 cases; 2 source templates. Review page indexing, phone controls, archived explorer rendering and current-world handoff links are actual browser navigation/identity contracts.

Existing native coverage: [src/generation/regional/CityPlacesStrategy.test.ts](../../../src/generation/regional/CityPlacesStrategy.test.ts), [src/art/CityReviewArchive.test.ts](../../../src/art/CityReviewArchive.test.ts), [src/art/BuildingReviewQueue.test.ts](../../../src/art/BuildingReviewQueue.test.ts)

Remaining work: Archived layout/data inventories can remain native; retain finite snapshot/page load and honest handoff UI.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L9](../../../tests/city-places-review.spec.ts#L9) | ``${run} is indexed with exact feedback, phone controls and independent review state`` | 4 | Browser | Browser boundary |
| [L58](../../../tests/city-places-review.spec.ts#L58) | ``${run} archived explorer is a finite snapshot, not a playable historical world`` | 4 | Browser | Browser boundary |

### city-train-riding.spec.ts

4 cases; 2 source templates. Long real-time traversal/support/save semantics are headless; actual jump input, browser world reopen, phone layout and client continuity need browser checks.

Existing native coverage: [src/scenarios/CityTrainRecipe.test.ts](../../../src/scenarios/CityTrainRecipe.test.ts), [src/scenarios/TrainRoofRiding.test.ts](../../../src/scenarios/TrainRoofRiding.test.ts), [src/server/VehicleControl.test.ts](../../../src/server/VehicleControl.test.ts), [src/client/IdleSupportJump.test.ts](../../../src/client/IdleSupportJump.test.ts)

Remaining work: Move long route progression and mid-bend semantic replay to native steps; retain short real Worker ride/reopen/alight and phone input smoke.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L38](../../../tests/city-train-riding.spec.ts#L38) | ``ride a generated train between cities, reopen mid-bend and alight (${backend})`` | 3 | Split | Partial |
| [L149](../../../tests/city-train-riding.spec.ts#L149) | ``generated city-train lab supports a saved roof ride on a phone`` | 1 | Split | Partial |

### commercial-review.spec.ts

3 cases; 3 source templates. Actual review pause/layout, exact feedback discoverability and archive→current-world navigation need DOM/browser integration.

Existing native coverage: [src/generation/regional/CommercialDistrictStrategy.test.ts](../../../src/generation/regional/CommercialDistrictStrategy.test.ts), [src/art/CityReviewArchive.test.ts](../../../src/art/CityReviewArchive.test.ts), [src/art/BuildingReviewQueue.test.ts](../../../src/art/BuildingReviewQueue.test.ts), [src/server/artNotesHttp.test.ts](../../../src/server/artNotesHttp.test.ts)

Remaining work: Pure district/queue/payload policy is native-covered; do not multiply identical UI policy across future batches.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L17](../../../tests/commercial-review.spec.ts#L17) | ``commercial batch is indexed, fits phone review and pauses independently`` | 1 | Browser | Browser boundary |
| [L71](../../../tests/commercial-review.spec.ts#L71) | ``commercial feedback carries the exact place recipe and resolves to its Workshop candidate`` | 1 | Browser | Browser boundary |
| [L94](../../../tests/commercial-review.spec.ts#L94) | ``commercial archive offers a fresh current world without promising the archived layout`` | 1 | Browser | Browser boundary |

### controller-menu.spec.ts

5 cases; 5 source templates. Controller cursor/focus, text keyboard, menu/modal isolation and actual save-failure recovery UI require browser DOM composition.

Existing native coverage: [src/input/ControllerInput.test.ts](../../../src/input/ControllerInput.test.ts), [src/ui/sessionNavigation.test.ts](../../../src/ui/sessionNavigation.test.ts)

Remaining work: Controller mapping and navigation policies are native-tested; mocked getGamepads still exercises actual DOM focus/action routing that pure mapping tests cannot replace.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L74](../../../tests/controller-menu.spec.ts#L74) | ``right-stick cursor selects editor tools and map controls with A and RT`` | 1 | Browser | Browser boundary |
| [L114](../../../tests/controller-menu.spec.ts#L114) | ``Deck-sized menu, worlds, text keyboard, character and Options are controller complete`` | 1 | Browser | Browser boundary |
| [L174](../../../tests/controller-menu.spec.ts#L174) | ``multiplayer join, validation, public browse and cancellation use controller navigation`` | 1 | Browser | Browser boundary |
| [L200](../../../tests/controller-menu.spec.ts#L200) | ``controller moves the player, opens the map and edits without leaking held input into menus`` | 1 | Browser | Browser boundary |
| [L271](../../../tests/controller-menu.spec.ts#L271) | ``failed saving keeps the session open and the recovery dialog works with B`` | 1 | Browser | Browser boundary |

### curved-trains.spec.ts

3 cases; 2 source templates. Turning/reversal/pose persistence can run through ScenarioSession; source-crop selection, camera UI and actual Worker teardown are browser integration.

Existing native coverage: [src/scenarios/CurvedTrainRecipe.test.ts](../../../src/scenarios/CurvedTrainRecipe.test.ts), [src/railway/CurveTrain.test.ts](../../../src/railway/CurveTrain.test.ts), [src/scenarios/ScenarioPresentationHost.test.ts](../../../src/scenarios/ScenarioPresentationHost.test.ts)

Remaining work: Keep heading→carriage-source rendering and real worker count checks; headless host disposal is not proof of browser Worker cleanup.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L5](../../../tests/curved-trains.spec.ts#L5) | ``curved trains turn, reload and reverse through the real Worker (${backend})`` | 2 | Split | Partial |
| [L70](../../../tests/curved-trains.spec.ts#L70) | ``town loop fits a phone and its controls suppress long taps`` | 1 | Browser | Browser boundary |

**L70: Browser / Browser boundary** — Checks phone layout, CSS user-select and cancelable contextmenu on controls.

Remaining work: Retain real DOM/CSS/event checks.

### deer-gameplay.spec.ts

4 cases; 3 source templates. Motion/contact/reload core already has native simulation and codec tests; retain bounded Worker presentation and editor/storage integration.

Existing native coverage: [src/wildlife/Deer.test.ts](../../../src/wildlife/Deer.test.ts), [src/persistence/RealmRecords.test.ts](../../../src/persistence/RealmRecords.test.ts)

Remaining work: Check real command-to-contact coverage and browser IndexedDB tombstone wiring separately; headless persistence uses another storage adapter.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L8](../../../tests/deer-gameplay.spec.ts#L8) | ``woodland deer walk, react to landing and reload their walking pose (${renderer})`` | 2 | Split | Partial |
| [L75](../../../tests/deer-gameplay.spec.ts#L75) | ``ordinary ball throws ricochet from a deer, trigger a short grounded escape`` | 1 | Node | Partial |
| [L138](../../../tests/deer-gameplay.spec.ts#L138) | ``ordinary woodland deer support manual creation and durable deletion on world reopening`` | 1 | Split | Partial |

**L75: Node / Partial** — Direct transport-spawn/throw and internal state reads; the behavior needs production Realm ball collision and replication, not Chromium.

Remaining work: Existing species tests assert ball ricochet/startle at EntityManager level; add or verify the complete Realm throw-command path and recovery for this species before deletion.

### dense-review.spec.ts

7 cases; 6 source templates. Generation/tombstone/interior rules have native coverage; real archive rendering, handoff, note outbox, browser inspection and entrance controls remain integration.

Existing native coverage: [src/generation/regional/DenseDistrictStrategy.test.ts](../../../src/generation/regional/DenseDistrictStrategy.test.ts), [src/art/CityReviewArchive.test.ts](../../../src/art/CityReviewArchive.test.ts), [src/persistence/WorldInspection.test.ts](../../../src/persistence/WorldInspection.test.ts), [src/interiors/GameplayInterior.test.ts](../../../src/interiors/GameplayInterior.test.ts)

Remaining work: Keep actual saved-world inspection/restore and native archived render verification. Add a headless dense-world actor/building tombstone roundtrip if exact scenario is not represented.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L12](../../../tests/dense-review.spec.ts#L12) | ``three real district views share review navigation and fit phone controls`` | 1 | Browser | Browser boundary |
| [L56](../../../tests/dense-review.spec.ts#L56) | ``district judgments pause independently, sync offline feedback, and reopen changed scenes`` | 1 | Browser | Browser boundary |
| [L104](../../../tests/dense-review.spec.ts#L104) | ``district notes round trip through the isolated inbox and are discoverable from the master index`` | 1 | Browser | Browser boundary |
| [L126](../../../tests/dense-review.spec.ts#L126) | ``archived dense review hands off to the current station start with a moving train`` | 1 | Browser | Browser boundary |
| [L168](../../../tests/dense-review.spec.ts#L168) | ``dense building edits and actor tombstones survive saved-world inspection and resume`` | 1 | Split | Partial |
| [L281](../../../tests/dense-review.spec.ts#L281) | ``promoted dense ${kind} enters and returns through the shared interior`` | 2 | Split | Partial |

**L12: Browser / Browser boundary** — Asserts actual review/explorer UI rendering, navigation or outbox/pause state.

Remaining work: Retain real DOM/browser storage/current-preview integration; use Node for pure recipe/policy matrices.

**L56: Browser / Browser boundary** — Asserts actual review/explorer UI rendering, navigation or outbox/pause state.

Remaining work: Retain real DOM/browser storage/current-preview integration; use Node for pure recipe/policy matrices.

**L104: Browser / Browser boundary** — Asserts actual review/explorer UI rendering, navigation or outbox/pause state.

Remaining work: Retain real DOM/browser storage/current-preview integration; use Node for pure recipe/policy matrices.

**L126: Browser / Browser boundary** — Asserts actual review/explorer UI rendering, navigation or outbox/pause state.

Remaining work: Retain real DOM/browser storage/current-preview integration; use Node for pure recipe/policy matrices.

### editor.spec.ts

2 cases; 2 source templates. Both tests click paint tools, sleep and save screenshots; neither asserts changed terrain, autotile result or captured pixels, despite the second title saying verify.

Existing native coverage: [src/editor/EditorModel.test.ts](../../../src/editor/EditorModel.test.ts), [src/autotile/Autotiler.test.ts](../../../src/autotile/Autotiler.test.ts)

Remaining work: Move screenshots to opt-in capture tooling. Add one meaningful browser paint-gesture integration and use Node terrain/autotile tests for exact neighborhood outputs; do not count these as current autotile assertions.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L19](../../../tests/editor.spec.ts#L19) | ``editor mode: paint water on grass`` | 1 | Capture | Gap |
| [L44](../../../tests/editor.spec.ts#L44) | ``editor mode: paint dirt on grass and verify autotile`` | 1 | Capture | Gap |

### entity-picker.spec.ts

2 cases; 1 source template. Reads actual sprite alpha bounds, CSS button/canvas sizes/contrast and checks the selected label on desktop/phone.

Existing native coverage: [src/characters/PlayerModels.test.ts](../../../src/characters/PlayerModels.test.ts), [src/assets/SpriteCatalog.test.ts](../../../src/assets/SpriteCatalog.test.ts)

Remaining work: Native sheet dimensions do not prove browser layout or image fitting.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L12](../../../tests/entity-picker.spec.ts#L12) | ``entity thumbnails fill their buttons without stretching at ${viewport.width}px`` | 2 | Browser | Browser boundary |

### family-sheets.spec.ts

28 cases; 19 source templates. Exact canvas composition/pixel changes, native padding, controlled animations, scoped note drafts, navigation/layout and stale-byte UI need browser behavior.

Existing native coverage: [src/workshop/FamilySheetNotes.test.ts](../../../src/workshop/FamilySheetNotes.test.ts), [src/art/ArtCatalog.test.ts](../../../src/art/ArtCatalog.test.ts), [scripts/build-family-expansion.test.py](../../../scripts/build-family-expansion.test.py)

Remaining work: Move catalog inventory and payload invariants into Node where absent. Python generator tests are supplementary and are not in npm test or CI; note-target unit tests do not cover all catalog animation validation.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L65](../../../tests/family-sheets.spec.ts#L65) | ``all contact sheets fit desktop, tablet and 390px phone with the complete piece inventory`` | 1 | Browser | Browser boundary |
| [L134](../../../tests/family-sheets.spec.ts#L134) | ``shadow and tree color controls change real artwork pixels`` | 1 | Browser | Browser boundary |
| [L151](../../../tests/family-sheets.spec.ts#L151) | ``outdoor seating retains original-only benches and exact colored-chair note targets`` | 1 | Browser | Browser boundary |
| [L181](../../../tests/family-sheets.spec.ts#L181) | ``cabinet connector details and piece/variant deep links survive reload`` | 1 | Browser | Browser boundary |
| [L228](../../../tests/family-sheets.spec.ts#L228) | ``discussion drafts stay scoped to family, piece and variant and send exact source notes`` | 1 | Browser | Browser boundary |
| [L299](../../../tests/family-sheets.spec.ts#L299) | ``changed source bytes block artwork and discussion submission`` | 1 | Browser | Browser boundary |
| [L318](../../../tests/family-sheets.spec.ts#L318) | ``a refreshed catalog cannot reuse a family proposal pinned to different artwork`` | 1 | Browser | Browser boundary |
| [L336](../../../tests/family-sheets.spec.ts#L336) | ``an earlier proposal link cannot attach new discussion to the current revision`` | 1 | Browser | Browser boundary |
| [L359](../../../tests/family-sheets.spec.ts#L359) | ``whole-sheet comments remain available while a piece is selected`` | 1 | Browser | Browser boundary |
| [L408](../../../tests/family-sheets.spec.ts#L408) | ``tree bases explain their counterparts and dense forests preserve the approved compositions`` | 1 | Browser | Browser boundary |
| [L464](../../../tests/family-sheets.spec.ts#L464) | ``sofa partial shadows stay scoped to the selected piece and exact discussion target`` | 1 | Browser | Browser boundary |
| [L507](../../../tests/family-sheets.spec.ts#L507) | ``room continuation windows have their own section`` | 1 | Browser | Browser boundary |
| [L518](../../../tests/family-sheets.spec.ts#L518) | ``tube examples replay the independently reviewed source-over recipes`` | 1 | Browser | Browser boundary |
| [L602](../../../tests/family-sheets.spec.ts#L602) | ``door source demonstrations stay paused and expose every frame independently of note selection`` | 1 | Browser | Browser boundary |
| [L794](../../../tests/family-sheets.spec.ts#L794) | ``invalid animation ${invalid} is blocked even with current metadata revisions`` | 8 | Split | Gap |
| [L825](../../../tests/family-sheets.spec.ts#L825) | ``plant variants preserve native padding and exact piece discussion targets`` | 1 | Browser | Browser boundary |
| [L884](../../../tests/family-sheets.spec.ts#L884) | ``bed blankets remain components and assembled examples follow shadow selection`` | 1 | Browser | Browser boundary |
| [L919](../../../tests/family-sheets.spec.ts#L919) | ``fence sheets distinguish required joins, open sections and uncertain garden gates`` | 1 | Browser | Browser boundary |
| [L958](../../../tests/family-sheets.spec.ts#L958) | ``broad ${packet.familyId} sheet retains uncertain components and exact variant notes`` | 3 | Browser | Browser boundary |

**L794: Split / Gap** — Eight malformed animation metadata variants exercise pure timing/frame-size validation plus visible error/no-artwork UI.

Remaining work: Extract timing/frame-size validation from FamilySheetArt into a pure module and cover all eight invalid cases in Node. Retain representative browser error/empty-canvas behavior; generator Python tests are not equivalent runtime validation.

### fault-reports.spec.ts

4 cases; 4 source templates. Report formatting/dedup/outbox, watchdog and timeout policy are native-covered; actual Worker crash/hang, visible recovery UI and browser upload/reload integration need browser tests.

Existing native coverage: [src/diagnostics/FaultReporter.test.ts](../../../src/diagnostics/FaultReporter.test.ts), [src/transport/LocalServerWatchdog.test.ts](../../../src/transport/LocalServerWatchdog.test.ts), [src/client/RequestBroker.test.ts](../../../src/client/RequestBroker.test.ts), [src/server/faultReports.test.ts](../../../src/server/faultReports.test.ts)

Remaining work: Keep one real Worker failure/hang and browser retry/reload path. Native reporter storage mocks do not prove localStorage/Worker stack/overlay wiring.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L15](../../../tests/fault-reports.spec.ts#L15) | ``synthetic Worker crash uploads stack and context to the owner diagnostic inbox`` | 1 | Split | Partial |
| [L51](../../../tests/fault-reports.spec.ts#L51) | ``offline fault survives reload and is retried with the same report ID`` | 1 | Split | Partial |
| [L90](../../../tests/fault-reports.spec.ts#L90) | ``a silent authority hang becomes a recoverable error and an automatic hang report`` | 1 | Split | Partial |
| [L134](../../../tests/fault-reports.spec.ts#L134) | ``a lost map request reports its timeout while the healthy authority remains usable`` | 1 | Split | Partial |

### fauna-gameplay.spec.ts

614 cases; 4 source templates. State/phase/landing/reload is portable; retain representative real Worker pause/presentation and editor/IndexedDB integration rather than the species × renderer matrix. Fauna.test:384 and WaterFauna.test:146 already exercise land/water production Realm identity/reload; FaunaBodies.test:139 covers all-profile landing with and without input.

Existing native coverage: [src/wildlife/Fauna.test.ts](../../../src/wildlife/Fauna.test.ts), [src/wildlife/WaterFauna.test.ts](../../../src/wildlife/WaterFauna.test.ts), [src/wildlife/FaunaBodies.test.ts](../../../src/wildlife/FaunaBodies.test.ts), [src/wildlife/GrazerRiding.test.ts](../../../src/wildlife/GrazerRiding.test.ts)

Remaining work: Do not add duplicate all-profile landing tests: FaunaBodies already has them. Close the all-profile ball-command path and compare exact manual deletion/browser tombstone assertions; retain actual Worker/presentation/IndexedDB representatives.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L13](../../../tests/fauna-gameplay.spec.ts#L13) | ``${profile.species} motion, contact and saved phase (${renderer})`` | 306 | Split | Partial |
| [L174](../../../tests/fauna-gameplay.spec.ts#L174) | ``${profile.species} ordinary ball throws trigger a harmless escape`` | 153 | Node | Partial |
| [L264](../../../tests/fauna-gameplay.spec.ts#L264) | ``${profile.species} manual creation and durable deletion on world reopening`` | 153 | Split | Partial |
| [L328](../../../tests/fauna-gameplay.spec.ts#L328) | ``wildlife scene switching keeps native framing (${renderer})`` | 2 | Browser | Browser boundary |

**L174: Node / Partial** — Spawns and throws via transport.send, reads replica AI/clip/height; no Throw input or pixel assertion. The complete behavioral contract can run through Realm and codec headlessly.

Remaining work: Fauna/WaterFauna cover startle/recovery, but not an actual throw-ball command and collision for every profile. Add a roster-parameterized Realm throw/escape/survival test.

**L328: Browser / Browser boundary** — Changes the scene selector and checks automatic zoom/framing defaults; this is page control integration.

Remaining work: Keep browser selector/framing coverage; recipe defaults alone do not prove the control updates.

### fierce-creatures.spec.ts

10 cases; 1 source template. Warning/charge/feed/dens are headless simulation contracts; browser audio enable/call dispatch and the rendered diet table are genuine UI contracts.

Existing native coverage: [src/wildlife/Predator.test.ts](../../../src/wildlife/Predator.test.ts), [src/wildlife/DragonBehavior.test.ts](../../../src/wildlife/DragonBehavior.test.ts), [src/wildlife/GriffinBehavior.test.ts](../../../src/wildlife/GriffinBehavior.test.ts), [src/wildlife/SpiderBehavior.test.ts](../../../src/wildlife/SpiderBehavior.test.ts), [src/audio/CreatureCall.test.ts](../../../src/audio/CreatureCall.test.ts)

Remaining work: Keep browser sound/table wiring, add any missing warning→charge→feed state/den reload coverage per fierce behavior headlessly; screenshots here are artifacts, not image comparisons.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L7](../../../tests/fierce-creatures.spec.ts#L7) | ``${p.species} displays, sounds its warning, charges and feeds (${renderer})`` | 10 | Split | Partial |

### food-chain.spec.ts

5 cases; 2 source templates. Diet/origin/pack/reload assertions are headless; the pack case additionally checks actual browser sound opt-in and call dispatch.

Existing native coverage: [src/wildlife/FoodChain.test.ts](../../../src/wildlife/FoodChain.test.ts), [src/wildlife/FoodWeb.test.ts](../../../src/wildlife/FoodWeb.test.ts), [src/wildlife/WolfPack.test.ts](../../../src/wildlife/WolfPack.test.ts), [src/audio/CreatureCall.test.ts](../../../src/audio/CreatureCall.test.ts)

Remaining work: Natural/placed branches in the first browser body assert identical surviving types, not replacement policy. Strengthen origin/timer assertions headlessly; keep browser audio dispatch representative.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L7](../../../tests/food-chain.spec.ts#L7) | ``${id} runs cross-predator meals and preserves its origin policy on reload (${renderer})`` | 4 | Node | Partial |
| [L40](../../../tests/food-chain.spec.ts#L40) | ``a live wolf pack howls, hunts together and reloads three pack members`` | 1 | Split | Partial |

**L7: Node / Partial** — Only observes actor types before/after a hunt and reload; Canvas/GPU is unused by its assertions. FoodChain.test runs the same two recipe IDs and is stronger about consumed identity, natural lineage/queued respawns, finite placed prey and repeated reload.

Remaining work: Reuse FoodChain.test rather than creating another suite. Its initial population is a relative baseline, not an explicit count of four, and reload compares survivor IDs rather than the exact sorted type list. Preserve these small assertions in that existing owner and retain shared browser Pause/Save-reload wiring before removing the four renderer variants.

### frog-gameplay.spec.ts

4 cases; 3 source templates. Motion/contact/reload core already has native simulation and codec tests; retain bounded Worker presentation and editor/storage integration.

Existing native coverage: [src/wildlife/Frog.test.ts](../../../src/wildlife/Frog.test.ts), [src/persistence/RealmRecords.test.ts](../../../src/persistence/RealmRecords.test.ts)

Remaining work: Check real command-to-contact coverage and browser IndexedDB tombstone wiring separately; headless persistence uses another storage adapter.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L8](../../../tests/frog-gameplay.spec.ts#L8) | ``pond frogs physically hop, react to landing and reload their mid-hop pose (${renderer})`` | 2 | Split | Partial |
| [L88](../../../tests/frog-gameplay.spec.ts#L88) | ``ordinary ball throws ricochet from a frog, trigger a croak and a short escape hop`` | 1 | Node | Partial |
| [L163](../../../tests/frog-gameplay.spec.ts#L163) | ``ordinary pond frogs support manual creation and durable deletion on world reopening`` | 1 | Split | Partial |

**L88: Node / Partial** — Direct transport-spawn/throw and internal state reads; the behavior needs production Realm ball collision and replication, not Chromium.

Remaining work: Existing species tests assert ball ricochet/startle at EntityManager level; add or verify the complete Realm throw-command path and recovery for this species before deletion.

### furniture-motion.spec.ts

18 cases; 8 source templates. Collision/path/support physics and review policy are headless; placement dragging, report canvas, key/touch cancellation, occlusion pixels and startup Worker replacement need browser integration.

Existing native coverage: [src/interiors/FurnitureMotion.test.ts](../../../src/interiors/FurnitureMotion.test.ts), [src/interiors/MotionReview.test.ts](../../../src/interiors/MotionReview.test.ts), [src/scenarios/ScenarioSession.test.ts](../../../src/scenarios/ScenarioSession.test.ts)

Remaining work: Keep real input/preview/report/Worker-race paths; avoid redoing all furniture pathfinding in real time.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L5](../../../tests/furniture-motion.spec.ts#L5) | ``shared movement stops at furniture, supports precise placement, and saves a reproducible report`` | 1 | Split | Partial |
| [L57](../../../tests/furniture-motion.spec.ts#L57) | ``scene.name`` | 11 | Split | Partial |
| [L73](../../../tests/furniture-motion.spec.ts#L73) | ``direction controls release and dragging selects actual sprite pixels`` | 1 | Browser | Browser boundary |
| [L107](../../../tests/furniture-motion.spec.ts#L107) | ``jumps onto tall furniture, records good verdicts, and reopens changed physics`` | 1 | Split | Partial |
| [L174](../../../tests/furniture-motion.spec.ts#L174) | ``phone jump control releases on cancellation and high jumps stay in view`` | 1 | Browser | Browser boundary |
| [L196](../../../tests/furniture-motion.spec.ts#L196) | ``approval advances past checked sets offline and finishes the new batch without looping`` | 1 | Browser | Browser boundary |
| [L281](../../../tests/furniture-motion.spec.ts#L281) | ``the full player sprite remains visible at the back of the bed after landing`` | 1 | Browser | Browser boundary |
| [L332](../../../tests/furniture-motion.spec.ts#L332) | ``replacing the initial furniture Worker does not abort review startup`` | 1 | Browser | Browser boundary |

**L57: Split / Partial** — Eleven preset walks repeat headless route/collider tests; the browser additionally checks the Circle control reaches Walk complete and each view fits a phone.

Remaining work: Native FurnitureMotion tests find clear routes for each preset, but do not prove real Worker Circle completion. Retain a representative Circle/phone path and use data bounds plus native path tests for the exhaustive catalog.

**L73: Browser / Browser boundary** — Actual direction release and sprite-pixel hit testing during drag.

Remaining work: Keep this browser boundary; native physics/policy tests do not replace the asserted event/pixel/lifecycle behavior.

**L174: Browser / Browser boundary** — Pointer cancellation releases Jump and browser camera keeps the jump visible.

Remaining work: Keep this browser boundary; native physics/policy tests do not replace the asserted event/pixel/lifecycle behavior.

**L196: Browser / Browser boundary** — Offline review advance/sync/disabled controls must reflect policy in the page.

Remaining work: Keep this browser boundary; native physics/policy tests do not replace the asserted event/pixel/lifecycle behavior.

**L281: Browser / Browser boundary** — Reads actual rendered player pixels and occlusion depth after a landing.

Remaining work: Keep this browser boundary; native physics/policy tests do not replace the asserted event/pixel/lifecycle behavior.

**L332: Browser / Browser boundary** — Holds the initial real Worker response and replaces it during startup; browser race coverage.

Remaining work: Keep this browser boundary; native physics/policy tests do not replace the asserted event/pixel/lifecycle behavior.

### furniture-presentation.spec.ts

2 cases; 1 source template. Real Worker counts, renderer-specific canvases, URL preservation, screenshot composition and teardown require browser lifecycle.

Existing native coverage: [src/scenarios/ScenarioPresentationHost.test.ts](../../../src/scenarios/ScenarioPresentationHost.test.ts), [src/rendering/RenderHost.test.ts](../../../src/rendering/RenderHost.test.ts)

Remaining work: Headless host tests cover ownership, not actual browser Worker/canvas resource disposal.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L5](../../../tests/furniture-presentation.spec.ts#L5) | ``furniture ${renderer} shares presentation, captures the room and retires old sessions`` | 2 | Browser | Browser boundary |

### gameplay-interiors.spec.ts

2 cases; 1 source template. Interior collision/furniture deletion and persistence are headless; actual entry/exit prompts, keyboard traversal and IndexedDB refresh are browser integration. RealmBrowser.test:1543 preserves saved room geometry/furniture through a second entrance; :563 checks live inspection deletions/moves.

Existing native coverage: [src/interiors/GameplayInterior.test.ts](../../../src/interiors/GameplayInterior.test.ts), [src/interiors/GameplayRoom.test.ts](../../../src/interiors/GameplayRoom.test.ts), [src/server/RealmBrowser.test.ts](../../../src/server/RealmBrowser.test.ts)

Remaining work: Keep actual enter/edit/return/reopen input and browser storage. Compare exact deleted furnishing/revision in GameplayRoom and RealmBrowser tests before adding another native roundtrip.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L9](../../../tests/gameplay-interiors.spec.ts#L9) | ``enters and returns from the shared ${kind} interior`` | 2 | Split | Partial |

### gameplay-room-editing.spec.ts

1 cases; 1 source template. Connected-room validation/revision/undo/collision are headless; actual brush gestures, editor mode UI and browser persistence remain integration.

Existing native coverage: [src/interiors/GameplayRoom.test.ts](../../../src/interiors/GameplayRoom.test.ts), [src/patterns/PatternDocument.test.ts](../../../src/patterns/PatternDocument.test.ts), [src/editor/EditorModel.test.ts](../../../src/editor/EditorModel.test.ts)

Remaining work: Keep real room drawing/undo/reload interaction; extract long semantic revision/error matrices to production Realm tests.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L63](../../../tests/gameplay-room-editing.spec.ts#L63) | ``draws a connected gameplay room with real walls, validates, undoes, walks and restores it`` | 1 | Split | Partial |

### generated-crossing.spec.ts

3 cases; 2 source templates. Generated surfaces, traffic height and traversal/reload already have shared-headless fixtures; scene selection, live Worker cleanup and phone layout remain browser contracts.

Existing native coverage: [src/scenarios/GeneratedCrossingRecipe.test.ts](../../../src/scenarios/GeneratedCrossingRecipe.test.ts), [src/scenarios/RailCrossingRecipe.test.ts](../../../src/scenarios/RailCrossingRecipe.test.ts)

Remaining work: Keep selector/cleanup/input representatives; move long grade/travel sampling into headless generated fixtures.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L5](../../../tests/generated-crossing.spec.ts#L5) | ``generated bridge supports traversal, moving traffic and reload (${renderer})`` | 2 | Split | Partial |
| [L81](../../../tests/generated-crossing.spec.ts#L81) | ``seeded crossings are selectable and fit phone review`` | 1 | Browser | Browser boundary |

**L81: Browser / Browser boundary** — Seed selector handoff and mobile layout are genuine page controls.

Remaining work: Pure recipe seed validation cannot replace DOM selection/layout.

### gpu-renderer.spec.ts

19 cases; 19 source templates. Actual shaders/pixels, mesh upload/draw/fallback, indexed batches, context loss/recovery, frame caches and live renderer switching require a graphics browser.

Existing native coverage: [src/rendering/GpuRasterSurface.test.ts](../../../src/rendering/GpuRasterSurface.test.ts), [src/rendering/CarMeshAsset.test.ts](../../../src/rendering/CarMeshAsset.test.ts), [src/rendering/EntityMeshPose.test.ts](../../../src/rendering/EntityMeshPose.test.ts), [src/rendering/TerrainResources.test.ts](../../../src/rendering/TerrainResources.test.ts), [src/rendering/GrassDetail.test.ts](../../../src/rendering/GrassDetail.test.ts)

Remaining work: Node rendering tests often use recording/fake graphics surfaces; they are not substitutes for GPU output, native WebGL resource lifecycle or image decode.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L5](../../../tests/gpu-renderer.spec.ts#L5) | ``adjacent sprites have no gaps or overlaps at fractional scales on either backend`` | 1 | Browser | Browser boundary |
| [L22](../../../tests/gpu-renderer.spec.ts#L22) | ``stationary terrain, props and grass stay rigid while the camera settles`` | 1 | Browser | Browser boundary |
| [L40](../../../tests/gpu-renderer.spec.ts#L40) | ``GPU consumes the Canvas scene with retained textures and union clips`` | 1 | Browser | Browser boundary |
| [L72](../../../tests/gpu-renderer.spec.ts#L72) | ``default GPU mesh host runs the shared game and retains the input/UI canvas`` | 1 | Browser | Browser boundary |
| [L145](../../../tests/gpu-renderer.spec.ts#L145) | ``optional mesh body rotates, composes in order and falls back atomically`` | 1 | Browser | Browser boundary |
| [L196](../../../tests/gpu-renderer.spec.ts#L196) | ``authored car retains its fixed width registration across headings and zoom`` | 1 | Browser | Browser boundary |
| [L261](../../../tests/gpu-renderer.spec.ts#L261) | ``shared traffic scenario feeds the same GPU mesh path`` | 1 | Browser | Browser boundary |
| [L278](../../../tests/gpu-renderer.spec.ts#L278) | ``Traffic override selects original non-blue road vehicles without changing their types`` | 1 | Browser | Browser boundary |
| [L301](../../../tests/gpu-renderer.spec.ts#L301) | ``shared room and editor passes match the native reference`` | 1 | Browser | Browser boundary |
| [L323](../../../tests/gpu-renderer.spec.ts#L323) | ``real graphics loss recovers resources without restarting gameplay`` | 1 | Browser | Browser boundary |
| [L380](../../../tests/gpu-renderer.spec.ts#L380) | ``smooth shadows preserve final pixel placement at different scales`` | 1 | Browser | Browser boundary |
| [L400](../../../tests/gpu-renderer.spec.ts#L400) | ``GPU feedback capture includes the world and preserves generation metadata`` | 1 | Browser | Browser boundary |
| [L434](../../../tests/gpu-renderer.spec.ts#L434) | ``portable car materials render through WebGPU selection and forced WebGL2`` | 1 | Browser | Browser boundary |
| [L457](../../../tests/gpu-renderer.spec.ts#L457) | ``unavailable WebGL2 leaves a usable Canvas game`` | 1 | Browser | Browser boundary |
| [L471](../../../tests/gpu-renderer.spec.ts#L471) | ``debug renderer selector switches live without replacing the game or Worker`` | 1 | Browser | Browser boundary |
| [L544](../../../tests/gpu-renderer.spec.ts#L544) | ``GPU reads decoded image dimensions once per frame and resets on recovery`` | 1 | Browser | Browser boundary |
| [L600](../../../tests/gpu-renderer.spec.ts#L600) | ``GPU indexed batches preserve quad order, capacity boundaries and upload accounting`` | 1 | Browser | Browser boundary |
| [L658](../../../tests/gpu-renderer.spec.ts#L658) | ``shared grass LOD fades consistently in Canvas and GPU and returns at ordinary zoom`` | 1 | Browser | Browser boundary |
| [L706](../../../tests/gpu-renderer.spec.ts#L706) | ``missing authored GLB keeps the complete sprite body`` | 1 | Browser | Browser boundary |

### horse-riding.spec.ts

2 cases; 1 source template. Mount geometry, riding speed, move/dismount are simulation contracts; keyboard Jump routing through the actual game is browser-specific.

Existing native coverage: [src/wildlife/HorseRiding.test.ts](../../../src/wildlife/HorseRiding.test.ts), [src/wildlife/GrazerRiding.test.ts](../../../src/wildlife/GrazerRiding.test.ts)

Remaining work: Retain actual keyboard mount/dismount; do not expand browser cases per coat or renderer for server-side mount rules.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L8](../../../tests/horse-riding.spec.ts#L8) | ``default keyboard jump mounts a fast horse and Jump gets off (${renderer})`` | 2 | Split | Partial |

### hotel-signs.spec.ts

4 cases; 2 source templates. Exact sign/top source pixels, selector/reload, scoped drafts and visible phone voting require canvas/DOM/browser storage.

Existing native coverage: [src/generation/regional/CityBuildingPrefabs.test.ts](../../../src/generation/regional/CityBuildingPrefabs.test.ts), [src/art/BuildingReviewQueue.test.ts](../../../src/art/BuildingReviewQueue.test.ts)

Remaining work: Metadata/topology and per-sign identity belong in Node too; do not discard actual source-pixel comparisons.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L11](../../../tests/hotel-signs.spec.ts#L11) | ``hotel ${floors}: full top and optional sign pixels survive switching and reload`` | 3 | Browser | Browser boundary |
| [L123](../../../tests/hotel-signs.spec.ts#L123) | ``hotel sign variants own their drafts and approvals; mobile review stays in view`` | 1 | Browser | Browser boundary |

### interior-approved.spec.ts

16 cases; 8 source templates. Actual wall/cap/occlusion pixels, approved PNG comparisons and compact review UI need current browser canvas rendering.

Existing native coverage: [src/interiors/ApartmentWallProfiles.test.ts](../../../src/interiors/ApartmentWallProfiles.test.ts), [src/interiors/ApartmentWallSurfaces.test.ts](../../../src/interiors/ApartmentWallSurfaces.test.ts), [src/interiors/review/ReviewCases.test.ts](../../../src/interiors/review/ReviewCases.test.ts)

Remaining work: Geometry/schema tests cannot replace golden images. Existing approved references remain immutable; browser matrix is justified by distinct pixel regressions.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L13](../../../tests/interior-approved.spec.ts#L13) | ``visual comparison tolerates color rounding but rejects missing geometry and size changes`` | 1 | Node | Gap |
| [L44](../../../tests/interior-approved.spec.ts#L44) | ``shell-relative height and occlusion in ${id}`` | 2 | Browser | Browser boundary |
| [L80](../../../tests/interior-approved.spec.ts#L80) | ``normal-height ${side} cap joins the room rail in ${id}`` | 4 | Browser | Browser boundary |
| [L115](../../../tests/interior-approved.spec.ts#L115) | ``all ${baseline.length} approved interiors match their visual references`` | 1 | Browser | Browser boundary |
| [L133](../../../tests/interior-approved.spec.ts#L133) | ``height sampler is compact and preserves the two-failure review cycle`` | 1 | Browser | Browser boundary |
| [L160](../../../tests/interior-approved.spec.ts#L160) | ``thickness round exposes eight compact cases and saves widths in the quick review cycle`` | 1 | Browser | Browser boundary |
| [L216](../../../tests/interior-approved.spec.ts#L216) | ``profile attaches to the room shell in ${fixture.id}`` | 4 | Browser | Browser boundary |
| [L258](../../../tests/interior-approved.spec.ts#L258) | ``${height} south partition preserves the height step at the cutaway`` | 2 | Browser | Browser boundary |

**L13: Node / Gap** — No page/browser/context fixture: mutates PNG buffers and exercises screenshot-comparator tolerance. It is already Node-only work scheduled in the E2E job.

Remaining work: Move comparator self-test to a Node-compatible image-comparison harness preserving the exact tolerance/size semantics. Vitest generic snapshot equality is not an equivalent image comparator; no existing comparator self-test identified.

### interior-furniture.spec.ts

1 cases; 1 source template. Canvas hashing, overlay pixel changes, furniture UI/source metadata in reports and browser review state require the page.

Existing native coverage: [src/interiors/FurnitureCatalog.test.ts](../../../src/interiors/FurnitureCatalog.test.ts), [src/interiors/review/ReviewCases.test.ts](../../../src/interiors/review/ReviewCases.test.ts)

Remaining work: Keep actual clean-render hash versus annotated canvas behavior; unit fingerprint/schema coverage alone is insufficient.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L6](../../../tests/interior-furniture.spec.ts#L6) | ``furniture review preserves layered placements and hashes the clean image plus catalog metadata`` | 1 | Browser | Browser boundary |

### interior-review-loading.spec.ts

2 cases; 2 source templates. Measures browser scheduling/resource requests/canvas counts and background verification/category UI.

Existing native coverage: [src/interiors/review/ReviewCases.test.ts](../../../src/interiors/review/ReviewCases.test.ts), [src/interiors/MotionReview.test.ts](../../../src/interiors/MotionReview.test.ts)

Remaining work: Native policy tests do not prove incremental page loading, resource transfer budget or nonblocking background verification.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L4](../../../tests/interior-review-loading.spec.ts#L4) | ``review starts before verification finishes, uses only small sprites, and recomputes on reload`` | 1 | Browser | Browser boundary |
| [L93](../../../tests/interior-review-loading.spec.ts#L93) | ``category counts verify old verdicts, distinguish wrong from unchecked, and follow undo`` | 1 | Browser | Browser boundary |

### interior-review-rounds.spec.ts

10 cases; 8 source templates. Tests actual wall pixels, pin coordinate transforms, phone layout, persisted categories and review pause/undo UI.

Existing native coverage: [src/interiors/review/ReviewCases.test.ts](../../../src/interiors/review/ReviewCases.test.ts), [src/art/BuildingReviewQueue.test.ts](../../../src/art/BuildingReviewQueue.test.ts)

Remaining work: Move repeated category/pause model cases headlessly if expanded, retaining current unique UI/pixel interactions.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L13](../../../tests/interior-review-rounds.spec.ts#L13) | ``tall north overhang remains visible and plan pins account for viewport padding`` | 1 | Browser | Browser boundary |
| [L53](../../../tests/interior-review-rounds.spec.ts#L53) | ``normal south cap continues into the cutaway without a lower end face`` | 1 | Browser | Browser boundary |
| [L78](../../../tests/interior-review-rounds.spec.ts#L78) | ``changed side connections reopen their historical approvals`` | 1 | Browser | Browser boundary |
| [L132](../../../tests/interior-review-rounds.spec.ts#L132) | ``stage ${stage} provides eight phone-sized candidates and pauses after two reports`` | 3 | Browser | Browser boundary |
| [L188](../../../tests/interior-review-rounds.spec.ts#L188) | ``eight boundary cases fit a phone and retain category counts`` | 1 | Browser | Browser boundary |
| [L235](../../../tests/interior-review-rounds.spec.ts#L235) | ``unchecked position updates after background verification without changing categories`` | 1 | Browser | Browser boundary |
| [L254](../../../tests/interior-review-rounds.spec.ts#L254) | ``unchecked filter hides completed categories, supports browsing grades, and survives reload`` | 1 | Browser | Browser boundary |
| [L283](../../../tests/interior-review-rounds.spec.ts#L283) | ``three new eight-case rounds fit a phone and preserve the two-report pause`` | 1 | Browser | Browser boundary |

### interior-review.spec.ts

31 cases; 14 source templates. Most templates assert specific actual pixel joins; remaining templates assert keyboard review, pins, offline storage and phone focus/layout.

Existing native coverage: [src/interiors/review/ReviewCases.test.ts](../../../src/interiors/review/ReviewCases.test.ts), [src/interiors/ApartmentWallAlignment.test.ts](../../../src/interiors/ApartmentWallAlignment.test.ts), [src/interiors/ApartmentWallSurfaces.test.ts](../../../src/interiors/ApartmentWallSurfaces.test.ts)

Remaining work: Do not mistake data-model geometry tests for exact current-renderer pixels; retain those pixel regressions and actual review wiring.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L9](../../../tests/interior-review.spec.ts#L9) | ``vertical rail meets a small framed top square at junction ${caseId}`` | 2 | Browser | Browser boundary |
| [L56](../../../tests/interior-review.spec.ts#L56) | ``upper vertical divider connects to the back wall and has a closed end`` | 1 | Browser | Browser boundary |
| [L95](../../../tests/interior-review.spec.ts#L95) | ``south doorway trim has the same clean edges as the north doorway`` | 1 | Browser | Browser boundary |
| [L140](../../../tests/interior-review.spec.ts#L140) | ``one-key review saves actual renders to the inbox, pauses at two failures, and supports undo`` | 1 | Browser | Browser boundary |
| [L191](../../../tests/interior-review.spec.ts#L191) | ``offline judgments survive refresh, changed renders reopen, and unchanged good verdicts persist`` | 1 | Browser | Browser boundary |
| [L232](../../../tests/interior-review.spec.ts#L232) | ``phone review fits the viewport and typed notes do not trigger shortcuts`` | 1 | Browser | Browser boundary |
| [L250](../../../tests/interior-review.spec.ts#L250) | ``block pins survive refresh and travel with the screenshot and verdict`` | 1 | Browser | Browser boundary |
| [L313](../../../tests/interior-review.spec.ts#L313) | ``recessed south edge is six pixels high at ${id}:${x},${y}`` | 3 | Browser | Browser boundary |
| [L353](../../../tests/interior-review.spec.ts#L353) | ``pinning the emoji plan brings an offscreen apartment block into view on a phone`` | 1 | Browser | Browser boundary |
| [L400](../../../tests/interior-review.spec.ts#L400) | ``small stress review mixes motifs and shows complete compact renders on a phone`` | 1 | Browser | Browser boundary |
| [L462](../../../tests/interior-review.spec.ts#L462) | ``pinned joins keep connected rails and cut away exterior tails in ${fixture.id}`` | 2 | Browser | Browser boundary |
| [L517](../../../tests/interior-review.spec.ts#L517) | ``rail and facing stay consistent through the exterior transition in ${fixture.id}`` | 4 | Browser | Browser boundary |
| [L701](../../../tests/interior-review.spec.ts#L701) | ``short wall rails and faces agree in ${fixture.id}`` | 11 | Browser | Browser boundary |
| [L750](../../../tests/interior-review.spec.ts#L750) | ``changed apartments reopen as compact related review cases`` | 1 | Browser | Browser boundary |

### interior-workbench.spec.ts

3 cases; 3 source templates. Pointer painting, plan/render tab layout, local custom fixtures, undo and exported issue UI require browser integration.

Existing native coverage: [src/interiors/workbench/WorkbenchDocument.test.ts](../../../src/interiors/workbench/WorkbenchDocument.test.ts)

Remaining work: Document edits/export schemas are unit-covered; keep actual pointer coordinate mapping and persistence/UI behavior.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L4](../../../tests/interior-workbench.spec.ts#L4) | ``indoor workbench paints plans and tiles, records flags, and exports a reproducible fixture`` | 1 | Browser | Browser boundary |
| [L75](../../../tests/interior-workbench.spec.ts#L75) | ``phone layout switches between the plan and the rendered zone`` | 1 | Browser | Browser boundary |
| [L94](../../../tests/interior-workbench.spec.ts#L94) | ``new enclosed rooms persist locally and custom fixtures can be deleted`` | 1 | Browser | Browser boundary |

### interiors-screenshots.spec.ts

5 cases; 5 source templates. Includes developer screenshot captures plus UI builder/layout checks; geometry/reachability counters are portable, pixels/capture need Chromium.

Existing native coverage: [src/interiors/GenericHomeGeometry.test.ts](../../../src/interiors/GenericHomeGeometry.test.ts), [src/interiors/ApartmentFloorPlan.test.ts](../../../src/interiors/ApartmentFloorPlan.test.ts), [src/interiors/AdvancedSuite.test.ts](../../../src/interiors/AdvancedSuite.test.ts)

Remaining work: Separate manual capture tooling from regression CI. Screenshot files alone do not assert appearance; retain any unique input/layout checks before removing captures from mandatory CI.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L13](../../../tests/interiors-screenshots.spec.ts#L13) | ``capture source atlas geometry grids`` | 1 | Capture | Gap |
| [L32](../../../tests/interiors-screenshots.spec.ts#L32) | ``capture Generic Home 1 layer validation`` | 1 | Split | Partial |
| [L113](../../../tests/interiors-screenshots.spec.ts#L113) | ``capture room-builder wall candidates`` | 1 | Capture | Gap |
| [L124](../../../tests/interiors-screenshots.spec.ts#L124) | ``capture apartments generated from editable floor plans`` | 1 | Split | Partial |
| [L171](../../../tests/interiors-screenshots.spec.ts#L171) | ``capture branched and offset layered suites`` | 1 | Split | Partial |

**L13: Capture / Gap** — Produces screenshots without a regression expectation on the captured image; requires a browser to create the artifact, not to prove a behavioral contract.

Remaining work: Move to explicitly invoked capture tooling or add a justified visual assertion. Do not replace with a meaningless headless smoke.

**L113: Capture / Gap** — Produces screenshots without a regression expectation on the captured image; requires a browser to create the artifact, not to prove a behavioral contract.

Remaining work: Move to explicitly invoked capture tooling or add a justified visual assertion. Do not replace with a meaningless headless smoke.

### interiors.spec.ts

1 cases; 1 source template. Checks actual atlas-painted canvas content in the validation panel.

Existing native coverage: [src/interiors/GenericHomeGeometry.test.ts](../../../src/interiors/GenericHomeGeometry.test.ts), [src/interiors/FurnitureCatalog.test.ts](../../../src/interiors/FurnitureCatalog.test.ts)

Remaining work: Geometry and catalog data tests cannot establish that browser image decode/draw paints the panel.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L30](../../../tests/interiors.spec.ts#L30) | ``Modern Interiors validation panel renders Generic Home layers`` | 1 | Browser | Browser boundary |

### lived-in-interiors.spec.ts

7 cases; 2 source templates. Resident/furnishing counts and AI cycles are headless; actual door fade, indoor client drawing/readiness and registered review pixels need browser integration.

Existing native coverage: [src/interiors/LivedInLayouts.test.ts](../../../src/interiors/LivedInLayouts.test.ts), [src/server/ResidentTransfer.test.ts](../../../src/server/ResidentTransfer.test.ts), [src/interiors/InteriorPresentation.test.ts](../../../src/interiors/InteriorPresentation.test.ts)

Remaining work: Keep ordinary-game entry/presentation smoke; move exhaustive layout/resident cycle semantics headlessly. Saving a screenshot is not a pixel assertion.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L14](../../../tests/lived-in-interiors.spec.ts#L14) | ``${renderer}: ${layout} renders furnishings and animated residents in ordinary gameplay`` | 6 | Split | Partial |
| [L79](../../../tests/lived-in-interiors.spec.ts#L79) | ``new lived-in room compositions have registered, renderable review identities`` | 1 | Browser | Browser boundary |

**L79: Browser / Browser boundary** — Verifies actual registered lived-in review render readiness.

Remaining work: Keep actual renderer/identity verification.

### mall-doors.spec.ts

2 cases; 1 source template. Mall destination/arrival identity and repeated traversal can run headlessly; real fade/input and browser saved interior reopen remain integration.

Existing native coverage: [src/interiors/DoorTraversal.test.ts](../../../src/interiors/DoorTraversal.test.ts), [src/generation/regional/ShoppingCenters.test.ts](../../../src/generation/regional/ShoppingCenters.test.ts), [src/server/RealmBrowser.test.ts](../../../src/server/RealmBrowser.test.ts), [src/client/DoorPresentation.test.ts](../../../src/client/DoorPresentation.test.ts)

Remaining work: Verify all shop entrances in a native Realm persistence fixture; keep representative browser multi-door/fade path.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L12](../../../tests/mall-doors.spec.ts#L12) | ``mall ${kind}: walk in and out, reenter and reload the same shop`` | 2 | Split | Partial |

### mobile-editor.spec.ts

6 cases; 2 source templates. Real scroll/tab/header bounds, touch placement, minimization and Atlas modal close/selection routing need browser layout/input.

Existing native coverage: [src/editor/EditorModel.test.ts](../../../src/editor/EditorModel.test.ts), [src/input/TouchButtons.test.ts](../../../src/input/TouchButtons.test.ts)

Remaining work: Native editor model tests cannot replace scrolling, focus and hit-testing contracts.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L56](../../../tests/mobile-editor.spec.ts#L56) | ``all palettes stay within half the screen; scrolling and minimizing preserve placement`` | 3 | Browser | Browser boundary |
| [L131](../../../tests/mobile-editor.spec.ts#L131) | ``Atlas controls fit and closing or choosing a sprite resumes editing`` | 3 | Browser | Browser boundary |

### mobile-fullscreen.spec.ts

4 cases; 3 source templates. Actual requestFullscreen/fullscreenElement and touch/desktop action routing require browser activation/lifecycle semantics.

Existing native coverage: No equivalent native suite identified.

Remaining work: Denied/unavailable branches use instrumented APIs but still assert actual page control behavior. No equivalent native fullscreen test identified.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L6](../../../tests/mobile-fullscreen.spec.ts#L6) | ``first tap opens fullscreen and its menu; later taps respect fullscreen exit`` | 1 | Browser | Browser boundary |
| [L31](../../../tests/mobile-fullscreen.spec.ts#L31) | ``${unavailable} fullscreen leaves touch controls usable without repeated requests`` | 2 | Browser | Browser boundary |
| [L66](../../../tests/mobile-fullscreen.spec.ts#L66) | ``desktop clicks leave fullscreen off`` | 1 | Browser | Browser boundary |

### natural-landscapes.spec.ts

8 cases; 5 source templates. Forest composition/collision/restore are native; page handoff, paused terrain preparation, client movement/input and real Worker cleanup need browser checks.

Existing native coverage: [src/generation/regional/NaturalLandscape.test.ts](../../../src/generation/regional/NaturalLandscape.test.ts), [src/scenarios/NaturalLandscapeRecipe.test.ts](../../../src/scenarios/NaturalLandscapeRecipe.test.ts), [src/scenarios/TrainRoofRiding.test.ts](../../../src/scenarios/TrainRoofRiding.test.ts)

Remaining work: Keep representative terrain-ready/ground-blend and handoff integration; avoid long train movement waits for deterministic simulation assertions.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L5](../../../tests/natural-landscapes.spec.ts#L5) | ``ordinary explorer handoff creates patterned forests by default (${renderer})`` | 2 | Browser | Browser boundary |
| [L82](../../../tests/natural-landscapes.spec.ts#L82) | ``landscape lab shares Worker trees, walking, reload and train travel (${renderer})`` | 2 | Split | Partial |
| [L133](../../../tests/natural-landscapes.spec.ts#L133) | ``native forest patterns render and block the player (${renderer})`` | 2 | Split | Partial |
| [L168](../../../tests/natural-landscapes.spec.ts#L168) | ``explorer keeps composition in copied locations and exact tiles, with lab handoff`` | 1 | Browser | Browser boundary |
| [L192](../../../tests/natural-landscapes.spec.ts#L192) | ``offers usable controls and the exact registered review from the inbox`` | 1 | Browser | Browser boundary |

**L5: Browser / Browser boundary** — Checks actual explorer/lab controls, copied URL settings, handoff or review readiness/phone layout.

Remaining work: Retain user-facing routing and controls; generation settings unit tests are supplementary.

**L168: Browser / Browser boundary** — Checks actual explorer/lab controls, copied URL settings, handoff or review readiness/phone layout.

Remaining work: Retain user-facing routing and controls; generation settings unit tests are supplementary.

**L192: Browser / Browser boundary** — Checks actual explorer/lab controls, copied URL settings, handoff or review readiness/phone layout.

Remaining work: Retain user-facing routing and controls; generation settings unit tests are supplementary.

### original-vehicle.spec.ts

2 cases; 1 source template. Coupe mesh/fallback loading needs the browser; roof support and forward motion are already shared simulation and overlap the broader authored-vehicle file.

Existing native coverage: [src/traffic/OriginalVehicleGameplay.test.ts](../../../src/traffic/OriginalVehicleGameplay.test.ts), [src/traffic/OriginalVehicles.test.ts](../../../src/traffic/OriginalVehicles.test.ts), [src/rendering/AuthoredVehicleMeshes.test.ts](../../../src/rendering/AuthoredVehicleMeshes.test.ts)

Remaining work: Consolidate duplicate coupe GPU/fallback browser checks only after retaining roof support and actual fallback pixel checks at least once.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L6](../../../tests/original-vehicle.spec.ts#L6) | ``coupe shares game/lab GPU registration and drives with ${failed ? "failed-mesh sprite fallback" : "its own mesh"}`` | 2 | Split | Partial |

### outdoor-presentation.spec.ts

2 cases; 1 source template. Real Worker count, backend canvases, camera framing, CSS pixelated surface and disposal/reset require browser lifecycle.

Existing native coverage: [src/scenarios/ScenarioPresentationHost.test.ts](../../../src/scenarios/ScenarioPresentationHost.test.ts), [src/rendering/RenderHost.test.ts](../../../src/rendering/RenderHost.test.ts)

Remaining work: Native host/geometry tests do not establish actual Worker/canvas cleanup or embedded CSS alignment.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L5](../../../tests/outdoor-presentation.spec.ts#L5) | ``outdoor geometry shares the ${mode} host with fixed framing and bounded lifecycle`` | 2 | Browser | Browser boundary |

### outdoor-workshop.spec.ts

5 cases; 5 source templates. Bounded live DOM, geometry preview controls, source proposals, spatial note selection, authentication UI and reload/outbox need browser integration.

Existing native coverage: [src/assets/outdoor/OutdoorCatalog.test.ts](../../../src/assets/outdoor/OutdoorCatalog.test.ts), [src/workshop/OutdoorQueries.test.ts](../../../src/workshop/OutdoorQueries.test.ts), [src/workshop/SceneReview.test.ts](../../../src/workshop/SceneReview.test.ts), [src/server/workshopAuth.test.ts](../../../src/server/workshopAuth.test.ts), [src/server/workshopService.test.ts](../../../src/server/workshopService.test.ts)

Remaining work: Pure catalog/query/note/auth rules have Node tests. Keep actual selection/DOM/write-gating; move repeated API 401/403 matrices below browser.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L5](../../../tests/outdoor-workshop.spec.ts#L5) | ``outdoor catalog bounds DOM, saves exact corrections and runs production movement geometry`` | 1 | Browser | Browser boundary |
| [L68](../../../tests/outdoor-workshop.spec.ts#L68) | ``atlas gaps can become named asset proposals without original source packs`` | 1 | Browser | Browser boundary |
| [L89](../../../tests/outdoor-workshop.spec.ts#L89) | ``full neighborhood area notes attach asset revisions, survive drafts and locate shared feedback`` | 1 | Browser | Browser boundary |
| [L153](../../../tests/outdoor-workshop.spec.ts#L153) | ``new catalog and scene writes retain public login and CSRF protections`` | 1 | Split | Partial |
| [L187](../../../tests/outdoor-workshop.spec.ts#L187) | ``metadata outbox survives a failed save and reload then syncs once`` | 1 | Browser | Browser boundary |

**L153: Split / Partial** — Combines actual login handoff with API-only unauthenticated/CSRF response checks.

Remaining work: Keep one real form/login route; Node workshopAuth/privateDataPlugin tests cover policy but verify identical standalone endpoints before removing request checks.

### p2p-menu.spec.ts

1 cases; 1 source template. Real host/join menus, invitation routing, peer connection and return-to-local UI compose browser APIs and multiple contexts.

Existing native coverage: [src/transport/PeerGuestTransport.test.ts](../../../src/transport/PeerGuestTransport.test.ts), [src/ui/sessionNavigation.test.ts](../../../src/ui/sessionNavigation.test.ts)

Remaining work: Native peer/navigation tests supplement rather than replace actual menu→RTC→local recovery.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L9](../../../tests/p2p-menu.spec.ts#L9) | ``host and join through menus share a world and can return to local play`` | 1 | Browser | Browser boundary |

### p2p-recovery.spec.ts

2 cases; 2 source templates. Actual RTC negotiated message limits, fragmentation, channel reconnect and Retry/Back overlays need browser transport/DOM integration.

Existing native coverage: [src/transport/webrtcFragment.test.ts](../../../src/transport/webrtcFragment.test.ts), [src/transport/PeerGuestTransport.test.ts](../../../src/transport/PeerGuestTransport.test.ts), [src/transport/PeerConnectionDiagnostics.test.ts](../../../src/transport/PeerConnectionDiagnostics.test.ts)

Remaining work: Keep real RTC/SCTP constraints; native fragmentation/retry math does not establish negotiated browser channel limits.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L107](../../../tests/p2p-recovery.spec.ts#L107) | ``large P2P zoom transfers and reconnect baselines remain fragmented and playable`` | 1 | Browser | Browser boundary |
| [L157](../../../tests/p2p-recovery.spec.ts#L157) | ``short-lived P2P connections exhaust retries and leave a working Retry and Back overlay`` | 1 | Browser | Browser boundary |

### parking-lab.spec.ts

2 cases; 2 source templates. Static layout canvas pixel differences, exact rendered fingerprint and phone controls require a browser.

Existing native coverage: [src/art/studies/ParkingLotStudy.test.ts](../../../src/art/studies/ParkingLotStudy.test.ts), [src/road/ParkingSurface.test.ts](../../../src/road/ParkingSurface.test.ts)

Remaining work: Parking counts/layout recipes can remain exhaustive in Node; keep canvas/fingerprint/control integration.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L6](../../../tests/parking-lab.spec.ts#L6) | ``parking layouts, empty patterns, grid and phone inspection`` | 1 | Browser | Browser boundary |
| [L43](../../../tests/parking-lab.spec.ts#L43) | ``all three parking reviews match registered pixels in full Chromium`` | 1 | Browser | Browser boundary |

### parking-visits.spec.ts

4 cases; 3 source templates. Full shopper phase loops/reload/native parked ownership are already headless; default GPU mesh rendering, live pause, page handoff and phone controls need browser checks.

Existing native coverage: [src/scenarios/CityParking.test.ts](../../../src/scenarios/CityParking.test.ts), [src/scenarios/ScenarioParking.test.ts](../../../src/scenarios/ScenarioParking.test.ts), [src/rendering/ParkingTerrain.test.ts](../../../src/rendering/ParkingTerrain.test.ts), [src/generation/regional/ShoppingCenters.test.ts](../../../src/generation/regional/ShoppingCenters.test.ts)

Remaining work: Remove 90–120s real-time phase waits only after preserving a short browser loading/pause/handoff path; keep native traffic/visit identity and every phase in deterministic tests.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L42](../../../tests/parking-visits.spec.ts#L42) | ``generated city shopping visits, paused reload and phone controls (${renderer})`` | 2 | Split | Partial |
| [L119](../../../tests/parking-visits.spec.ts#L119) | ``generated city uses 3D cars by default and keeps one road visitor through reload and departure`` | 1 | Split | Partial |
| [L176](../../../tests/parking-visits.spec.ts#L176) | ``main-game handoff realizes shopping centers and native parked cars`` | 1 | Split | Partial |

### pattern-studio.spec.ts

5 cases; 5 source templates. Gesture validation/compiler/undo payloads are headless; real canvas coordinates, stable pan/zoom, download, touch layout and browser-world restoration need UI integration.

Existing native coverage: [src/patterns/PatternDocument.test.ts](../../../src/patterns/PatternDocument.test.ts), [src/patterns/TreeBrushEditor.test.ts](../../../src/patterns/TreeBrushEditor.test.ts), [src/interiors/GameplayRoom.test.ts](../../../src/interiors/GameplayRoom.test.ts), [src/editor/EditorModel.test.ts](../../../src/editor/EditorModel.test.ts)

Remaining work: Retain brush gesture/selection and browser save/load; extract exhaustive invalid compiler/room cases to existing native owners.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L32](../../../tests/pattern-studio.spec.ts#L32) | ``tree drawing previews, validates whole gestures, saves drafts and undoes split ends`` | 1 | Split | Partial |
| [L68](../../../tests/pattern-studio.spec.ts#L68) | ``rooms draw directly on art, reject invalid doors and keep a stable zoom/pan center`` | 1 | Split | Partial |
| [L109](../../../tests/pattern-studio.spec.ts#L109) | ``pattern kit is discoverable in the inbox with exact preview and next navigation`` | 1 | Browser | Browser boundary |
| [L123](../../../tests/pattern-studio.spec.ts#L123) | ``game row brush uses the same compiler, exposes host history and restores a saved row`` | 1 | Split | Partial |
| [L181](../../../tests/pattern-studio.spec.ts#L181) | ``phone studio initially fits its full grid and Shift dragging pans past the edges`` | 1 | Browser | Browser boundary |

**L109: Browser / Browser boundary** — Verifies inbox discovery, current preview identity, Next navigation and deep link routing.

Remaining work: Keep page/render identity integration.

**L181: Browser / Browser boundary** — Phone grid fit and Shift-drag pan past canvas edges are DOM/pointer contracts.

Remaining work: Keep browser coordinate/event behavior.

### pinch-zoom.spec.ts

5 cases; 3 source templates. Real simultaneous contacts, joystick/button ownership, Options preference storage/focus and visible phone controls are browser integration.

Existing native coverage: [src/input/TouchPinch.test.ts](../../../src/input/TouchPinch.test.ts), [src/input/TouchJoystick.test.ts](../../../src/input/TouchJoystick.test.ts), [src/input/TouchButtons.test.ts](../../../src/input/TouchButtons.test.ts)

Remaining work: Native gesture math is covered; retain real multifinger routing and browser preference persistence.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L78](../../../tests/pinch-zoom.spec.ts#L78) | ``pinch preference, world zoom and joystick/button protection (${renderer})`` | 2 | Browser | Browser boundary |
| [L150](../../../tests/pinch-zoom.spec.ts#L150) | ``pinch cancels world movement and Options cancels pinch (${renderer})`` | 2 | Browser | Browser boundary |
| [L190](../../../tests/pinch-zoom.spec.ts#L190) | ``Options keeps the checkbox and Back button visible in portrait and landscape`` | 1 | Browser | Browser boundary |

### pixel-characters.spec.ts

14 cases; 6 source templates. Standalone gallery source-pixel equality, image selectors, rAF frames, actual key/touch release and loading-error UI require browser behavior.

Existing native coverage: [src/characters/CharacterCatalog.test.ts](../../../src/characters/CharacterCatalog.test.ts)

Remaining work: Pure gallery records and per-character mapping can be tested as data; retain actual sheets/decoding and input representatives. No equivalent Node gallery runtime test identified.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L5](../../../tests/pixel-characters.spec.ts#L5) | ``gallery publishes completed records and displays both independently authored sizes`` | 1 | Browser | Browser boundary |
| [L66](../../../tests/pixel-characters.spec.ts#L66) | ``character selector loads the completed ${character} and renders its own sheets in every direction`` | 4 | Browser | Browser boundary |
| [L143](../../../tests/pixel-characters.spec.ts#L143) | ``${character} keyboard movement covers every direction, stops on release and resets`` | 5 | Browser | Browser boundary |
| [L183](../../../tests/pixel-characters.spec.ts#L183) | ``${character} native16 walk plays all four poses at the default four fps`` | 2 | Browser | Browser boundary |
| [L204](../../../tests/pixel-characters.spec.ts#L204) | ``touch movement releases cleanly and the small mobile layout fits`` | 1 | Browser | Browser boundary |
| [L249](../../../tests/pixel-characters.spec.ts#L249) | ``failed sprite loads give a visible error and disable the preview`` | 1 | Browser | Browser boundary |

### play-ideas.spec.ts

14 cases; 9 source templates. Actual speech-related dialog controls, pointer/focus/fullscreen lifecycle, screenshot capture, local outbox and private review UI require browser integration.

Existing native coverage: [src/server/playIdeas.test.ts](../../../src/server/playIdeas.test.ts)

Remaining work: Speech recognition is mocked here; these are UI/lifecycle tests, not speech accuracy or real microphone hardware validation. Server submission/auth/idempotency is already native-covered.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L146](../../../tests/play-ideas.spec.ts#L146) | ``anonymous hold, exact readback, screenshot submission and private Workshop management`` | 1 | Browser | Browser boundary |
| [L208](../../../tests/play-ideas.spec.ts#L208) | ``keeps offline submissions across reload and retries with the same ID`` | 1 | Browser | Browser boundary |
| [L235](../../../tests/play-ideas.spec.ts#L235) | ``cancel, focus loss, recognition errors and interim results never submit unfinished words`` | 1 | Split | Gap |
| [L271](../../../tests/play-ideas.spec.ts#L271) | ``permission denial leaves typing usable and draft restores without triggering game shortcuts`` | 1 | Browser | Browser boundary |
| [L291](../../../tests/play-ideas.spec.ts#L291) | ``releasing before the microphone starts aborts and shuts down late audio capture`` | 1 | Split | Gap |
| [L316](../../../tests/play-ideas.spec.ts#L316) | ``release turns off the microphone before delayed final words and allows another hold`` | 1 | Split | Gap |
| [L353](../../../tests/play-ideas.spec.ts#L353) | ``${interruption} releases microphone capture`` | 5 | Split | Gap |
| [L377](../../../tests/play-ideas.spec.ts#L377) | ``sends directly if idea storage is unavailable, retaining the draft if the network also fails`` | 1 | Split | Gap |
| [L408](../../../tests/play-ideas.spec.ts#L408) | ``large controls fit and touch hold ends on release`` | 2 | Browser | Browser boundary |

**L235: Split / Gap** — Speech-recognition/capture state transitions and submission retry are mostly a mocked asynchronous state machine plus actual dialog/focus/cancellation wiring.

Remaining work: No native client speech-controller suite identified. Extract controller with injected recognition/storage/clock, test delayed start/final results/abort/retry exhaustively in Node, retain actual pointer-release/focus/unmount and UI state representatives.

**L291: Split / Gap** — Speech-recognition/capture state transitions and submission retry are mostly a mocked asynchronous state machine plus actual dialog/focus/cancellation wiring.

Remaining work: No native client speech-controller suite identified. Extract controller with injected recognition/storage/clock, test delayed start/final results/abort/retry exhaustively in Node, retain actual pointer-release/focus/unmount and UI state representatives.

**L316: Split / Gap** — Speech-recognition/capture state transitions and submission retry are mostly a mocked asynchronous state machine plus actual dialog/focus/cancellation wiring.

Remaining work: No native client speech-controller suite identified. Extract controller with injected recognition/storage/clock, test delayed start/final results/abort/retry exhaustively in Node, retain actual pointer-release/focus/unmount and UI state representatives.

**L353: Split / Gap** — Speech-recognition/capture state transitions and submission retry are mostly a mocked asynchronous state machine plus actual dialog/focus/cancellation wiring.

Remaining work: No native client speech-controller suite identified. Extract controller with injected recognition/storage/clock, test delayed start/final results/abort/retry exhaustively in Node, retain actual pointer-release/focus/unmount and UI state representatives.

**L377: Split / Gap** — Speech-recognition/capture state transitions and submission retry are mostly a mocked asynchronous state machine plus actual dialog/focus/cancellation wiring.

Remaining work: No native client speech-controller suite identified. Extract controller with injected recognition/storage/clock, test delayed start/final results/abort/retry exhaustively in Node, retain actual pointer-release/focus/unmount and UI state representatives.

### player-dev-reload.spec.ts

2 cases; 2 source templates. Actual Vite full reload/page refresh during doorway transitions and editor camera restoration through browser storage need browser lifecycle.

Existing native coverage: [src/persistence/PlayerLocationStore.test.ts](../../../src/persistence/PlayerLocationStore.test.ts), [src/client/ReloadCamera.test.ts](../../../src/client/ReloadCamera.test.ts), [src/client/DoorPresentation.test.ts](../../../src/client/DoorPresentation.test.ts)

Remaining work: Native location/camera/fade tests do not establish page-unload flush or reconnect/IndexedDB composition.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L10](../../../tests/player-dev-reload.spec.ts#L10) | ``dev full reload restores the indoor player and scopes the editor camera to its realm`` | 1 | Browser | Browser boundary |
| [L120](../../../tests/player-dev-reload.spec.ts#L120) | ``dev reload during the guided doorway walk settles into the saved destination`` | 1 | Browser | Browser boundary |

### player-markers.spec.ts

2 cases; 1 source template. Marker selection/projection/age rules are native; actual co-op live delivery, rendered marker diagnostics and realm/editor departure wiring need browser integration.

Existing native coverage: [src/ui/PlayerMarkers.test.ts](../../../src/ui/PlayerMarkers.test.ts), [src/client/RemoteStateView.test.ts](../../../src/client/RemoteStateView.test.ts)

Remaining work: Keep real two-client marker/realm lifecycle; do not duplicate projection edge cases already covered in PlayerMarkers.test.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L138](../../../tests/player-markers.spec.ts#L138) | ``live co-op markers follow nearby/distant players, editor and realm departure (${renderer})`` | 2 | Split | Partial |

### predator-gameplay.spec.ts

72 cases; 1 source template. Generated hunting/feeding/replacement and reload run in production Realm headlessly; browser pause and replica publication are the residual boundary.

Existing native coverage: [src/wildlife/Predator.test.ts](../../../src/wildlife/Predator.test.ts), [src/wildlife/NaturalHunters.test.ts](../../../src/wildlife/NaturalHunters.test.ts)

Remaining work: Verify feeding sprite frame and paused first replica for each behavior class; avoid claiming Realm reload proves the Worker clock or presentation.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L7](../../../tests/predator-gameplay.spec.ts#L7) | ``${p.species} hunts and reloads its meal in the shared Worker lab (${renderer})`` | 72 | Split | Partial |

### predator-origins.spec.ts

8 cases; 1 source template. Placed-prey origin, no resurrection and player protection are simulation/persistence contracts; this body also reopens a browser world.

Existing native coverage: [src/wildlife/Predator.test.ts](../../../src/wildlife/Predator.test.ts), [src/wildlife/PeoplePredation.test.ts](../../../src/wildlife/PeoplePredation.test.ts), [src/wildlife/WildlifeRespawns.test.ts](../../../src/wildlife/WildlifeRespawns.test.ts)

Remaining work: Prove the exact eight prey/hunter pairings through Realm save/reload; retain one browser save adapter test, not all pairs.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L18](../../../tests/predator-origins.spec.ts#L18) | ``a player-placed ${pair.name} is eaten without replacement in the real Worker world and stays gone on reload`` | 8 | Split | Partial |

### predator-world.spec.ts

48 cases; 1 source template. Natural-spawn location and placement/deletion semantics are portable; real picker input and browser-world reopening remain browser integration.

Existing native coverage: [src/wildlife/Predator.test.ts](../../../src/wildlife/Predator.test.ts), [src/wildlife/NaturalHunters.test.ts](../../../src/wildlife/NaturalHunters.test.ts), [src/wildlife/AquaticHunters.test.ts](../../../src/wildlife/AquaticHunters.test.ts), [src/persistence/RealmRecords.test.ts](../../../src/persistence/RealmRecords.test.ts)

Remaining work: All-profile generated spawn/placement/tombstone headless conformance is not established by hunting tests. Preserve a real editor/IndexedDB representative.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L36](../../../tests/predator-world.spec.ts#L36) | ``${p.species} naturally spawns, supports editor placement and retains deletion on reopening`` | 48 | Split | Partial |

### prediction-recovery.spec.ts

2 cases; 1 source template. Monotonic sequence and reconciliation are native contracts; real Tab-driven scene replacement and input/predictor wiring through the game loop need a browser smoke.

Existing native coverage: [src/client/InputSequence.test.ts](../../../src/client/InputSequence.test.ts), [src/client/PredictionRecovery.test.ts](../../../src/client/PredictionRecovery.test.ts), [src/server/InputQueuePrediction.test.ts](../../../src/server/InputQueuePrediction.test.ts)

Remaining work: Native sequence/recovery suites cover individual owners; add replacement lifecycle conformance if missing and retain repeated edit/play browser input representative.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L7](../../../tests/prediction-recovery.spec.ts#L7) | ``input sequence and authority recovery survive repeated edit/play replacement (${renderer})`` | 2 | Split | Partial |

### pwa.spec.ts

2 cases; 2 source templates. Uses Chromium CDP manifest parsing/installability, native image decode and actual serviceWorker registrations under build and Vite serving.

Existing native coverage: No equivalent native suite identified.

Remaining work: Manifest/icon bytes/HTTP prefix checks could be Node-tested, but those alone cannot replace Chromium installability or rewritten document URL resolution. No existing native launcher inventory test identified.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L4](../../../tests/pwa.spec.ts#L4) | ``the built game exposes a valid standalone launcher under its deployment path`` | 1 | Browser | Browser boundary |
| [L12](../../../tests/pwa.spec.ts#L12) | ``Vite dev serving applies the deployment prefix once to launcher assets`` | 1 | Browser | Browser boundary |

### rabbit-gameplay.spec.ts

4 cases; 3 source templates. Motion/contact/reload core already has native simulation and codec tests; retain bounded Worker presentation and editor/storage integration.

Existing native coverage: [src/wildlife/Rabbit.test.ts](../../../src/wildlife/Rabbit.test.ts), [src/persistence/RealmRecords.test.ts](../../../src/persistence/RealmRecords.test.ts)

Remaining work: Check real command-to-contact coverage and browser IndexedDB tombstone wiring separately; headless persistence uses another storage adapter.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L8](../../../tests/rabbit-gameplay.spec.ts#L8) | ``meadow rabbits physically hop, react to landing and reload their mid-hop pose (${renderer})`` | 2 | Split | Partial |
| [L77](../../../tests/rabbit-gameplay.spec.ts#L77) | ``ordinary ball throws ricochet from a rabbit, trigger a short escape hop`` | 1 | Node | Partial |
| [L140](../../../tests/rabbit-gameplay.spec.ts#L140) | ``ordinary meadow rabbits support manual creation and durable deletion on world reopening`` | 1 | Split | Partial |

**L77: Node / Partial** — Direct transport-spawn/throw and internal state reads; the behavior needs production Realm ball collision and replication, not Chromium.

Remaining work: Existing species tests assert ball ricochet/startle at EntityManager level; add or verify the complete Realm throw-command path and recovery for this species before deletion.

### racetrack.spec.ts

7 cases; 3 source templates. Racer population/movement/saved ownership and spectators can be headless; kerb/checker pixel counts and world-map rendering/controls require a browser.

Existing native coverage: [src/traffic/Racetrack.test.ts](../../../src/traffic/Racetrack.test.ts), [src/generation/regional/RacetrackPlanner.test.ts](../../../src/generation/regional/RacetrackPlanner.test.ts)

Remaining work: Keep track/map pixels. The ordinary-game spectator cases inspect replica population; add exact generated spectator integration headlessly and retain a single game replication smoke.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L8](../../../tests/racetrack.spec.ts#L8) | ``generated speedway has racing cars, spectators and saved motion (${renderer})`` | 2 | Split | Partial |
| [L78](../../../tests/racetrack.spec.ts#L78) | ``ordinary game shows spectators at the ${name}`` | 3 | Split | Partial |
| [L128](../../../tests/racetrack.spec.ts#L128) | ``world map draws and names the speedway (${phone ? "phone" : "desktop"})`` | 2 | Browser | Browser boundary |

**L128: Browser / Browser boundary** — Map marker labels, panning, oval pixels and phone layout are browser rendering/UI contracts.

Remaining work: Planner data tests do not replace map canvas rendering.

### rail-crossing.spec.ts

3 cases; 2 source templates. Bridge support/train clearance is headless; keyboard movement and real Worker reset/lifetime remain integration.

Existing native coverage: [src/scenarios/RailCrossingRecipe.test.ts](../../../src/scenarios/RailCrossingRecipe.test.ts), [src/railway/RoadRailBridge.test.ts](../../../src/railway/RoadRailBridge.test.ts)

Remaining work: Retain a bounded game/lab Worker support smoke rather than redoing complete physics per backend.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L5](../../../tests/rail-crossing.spec.ts#L5) | ``road bridge clears a real moving train (${renderer})`` | 2 | Split | Partial |
| [L50](../../../tests/rail-crossing.spec.ts#L50) | ``crossing controls fit a phone`` | 1 | Browser | Browser boundary |

**L50: Browser / Browser boundary** — Checks actual phone layout.

Remaining work: Retain responsive-layout coverage.

### rail-map.spec.ts

2 cases; 1 source template. Rail-line pixels, station labels/buttons, map navigation and responsive layout need the browser.

Existing native coverage: [src/railway/Railway.test.ts](../../../src/railway/Railway.test.ts)

Remaining work: Route metadata can be unit-tested, but does not replace actual map pixels or controls.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L6](../../../tests/rail-map.spec.ts#L6) | ``map shows production railways and named stops (${phone ? "phone" : "desktop"})`` | 2 | Browser | Browser boundary |

### railway-preview.spec.ts

4 cases; 4 source templates. Rendered railway identity gate, animation scrub UI, persisted review state and stale-preview UI blocking need the browser.

Existing native coverage: [src/railway/RailwayPreview.test.ts](../../../src/railway/RailwayPreview.test.ts), [src/art/ArtCatalog.test.ts](../../../src/art/ArtCatalog.test.ts), [src/server/workshopService.test.ts](../../../src/server/workshopService.test.ts)

Remaining work: Move API stale-fingerprint validation to Node if duplicated; retain visible enforcement and real canvas identity verification.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L14](../../../tests/railway-preview.spec.ts#L14) | ``all railway proposals verify in normal Chromium and are discoverable before feedback`` | 1 | Browser | Browser boundary |
| [L38](../../../tests/railway-preview.spec.ts#L38) | ``motion pauses, scrubs, slows and survives geometry controls on phone`` | 1 | Browser | Browser boundary |
| [L64](../../../tests/railway-preview.spec.ts#L64) | ``railway decisions persist against exact identity and reject stale fingerprints`` | 1 | Browser | Browser boundary |
| [L100](../../../tests/railway-preview.spec.ts#L100) | ``changed preview blocks review, reasons are required and two reports pause only that batch`` | 1 | Browser | Browser boundary |

### railway.spec.ts

1 cases; 1 source template. Station props/native carriage count and movement/orientation are native generation/simulation; real game bootstrap and terrain readiness are browser integration.

Existing native coverage: [src/scenarios/CityTrainRecipe.test.ts](../../../src/scenarios/CityTrainRecipe.test.ts), [src/railway/CurveTrain.test.ts](../../../src/railway/CurveTrain.test.ts), [src/railway/Railway.test.ts](../../../src/railway/Railway.test.ts)

Remaining work: Keep one new-world browser station/native-art smoke; assert route constants and platform inventory headlessly.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L4](../../../tests/railway.spec.ts#L4) | ``new regional world opens at a furnished station with moving native curved train carriages`` | 1 | Split | Partial |

### raptors.spec.ts

6 cases; 1 source template. Swoop height, feeding and meal reload can run headlessly; preview animation, camera-follow checkbox and Watch AI handoff are browser wiring.

Existing native coverage: [src/wildlife/RaptorBehavior.test.ts](../../../src/wildlife/RaptorBehavior.test.ts), [src/wildlife/Predator.test.ts](../../../src/wildlife/Predator.test.ts)

Remaining work: Verify per-raptor production Realm swoop/meal phase persistence; retain browser preview and handoff representatives.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L7](../../../tests/raptors.spec.ts#L7) | ``${animal.species} browser action, visible swoop and durable meal (${renderer})`` | 6 | Split | Partial |

### remote-world.spec.ts

1 cases; 1 source template. Shared interior edits, server persistence and HTTP snapshot/CORS are headless-testable; real cross-origin explorer, two game clients and restart restoration are browser integration. RealmBrowser.test:563/1460/1543 already proves live inspection edits and multi-client shared interior/restart semantics with an in-memory transport/store.

Existing native coverage: [src/server/RealmBrowser.test.ts](../../../src/server/RealmBrowser.test.ts), [src/server/ReplicationDelivery.test.ts](../../../src/server/ReplicationDelivery.test.ts), [src/persistence/WorldInspection.test.ts](../../../src/persistence/WorldInspection.test.ts), [src/server/staticFiles.test.ts](../../../src/server/staticFiles.test.ts)

Remaining work: The remaining native gap is standalone WS+HTTP+filesystem and exact cross-origin endpoint composition, not basic shared-interior persistence. Retain a smaller real cross-origin explorer/two-client UI smoke.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L13](../../../tests/remote-world.spec.ts#L13) | ``two clients share a persistent interior and cross-origin explorer reads live authority`` | 1 | Split | Partial |

### road-geometry.spec.ts

3 cases; 3 source templates. Exact atlas canvas equality, review navigation/layout, outbox sync and batch pause UI need the browser.

Existing native coverage: [src/road/CitySurfaceRecipes.test.ts](../../../src/road/CitySurfaceRecipes.test.ts), [src/server/artNotesHttp.test.ts](../../../src/server/artNotesHttp.test.ts), [src/art/BuildingReviewQueue.test.ts](../../../src/art/BuildingReviewQueue.test.ts)

Remaining work: Pure recipe/source-note validation and two-report policy belong in Node too; do not replace real pixels or disabled controls with policy tests.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L14](../../../tests/road-geometry.spec.ts#L14) | ``four geometry cases are indexed under Roads, render exact source pixels and fit phone review`` | 1 | Browser | Browser boundary |
| [L79](../../../tests/road-geometry.spec.ts#L79) | ``geometry feedback round trips through the isolated server and atlas with its own recipe and URL`` | 1 | Browser | Browser boundary |
| [L103](../../../tests/road-geometry.spec.ts#L103) | ``geometry batch pauses at two reports without pausing the approved foundation batch`` | 1 | Browser | Browser boundary |

### roadkill.spec.ts

2 cases; 1 source template. Death, inert corpse, fade and saved state are headless; the browser additionally verifies PlayScene corpse presentation diagnostics and driving UI.

Existing native coverage: [src/wildlife/Roadkill.test.ts](../../../src/wildlife/Roadkill.test.ts), [src/scenarios/ScenarioRoadkill.test.ts](../../../src/scenarios/ScenarioRoadkill.test.ts), [src/rendering/collectScene.test.ts](../../../src/rendering/collectScene.test.ts)

Remaining work: Keep one browser renderer wiring path; Node collectScene expectations do not prove real Canvas/GPU drawing. No screenshot pixel comparison is made here.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L8](../../../tests/roadkill.spec.ts#L8) | ``driving produces inert visible roadkill and saves its death (${renderer})`` | 2 | Split | Partial |

### robin-gameplay.spec.ts

4 cases; 3 source templates. Motion/contact/reload core already has native simulation and codec tests; retain bounded Worker presentation and editor/storage integration.

Existing native coverage: [src/wildlife/Robin.test.ts](../../../src/wildlife/Robin.test.ts), [src/persistence/RealmRecords.test.ts](../../../src/persistence/RealmRecords.test.ts)

Remaining work: Check real command-to-contact coverage and browser IndexedDB tombstone wiring separately; headless persistence uses another storage adapter.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L10](../../../tests/robin-gameplay.spec.ts#L10) | ``grove robins fly to crowns, react to landing and reload their flight pose (${renderer})`` | 2 | Split | Partial |
| [L85](../../../tests/robin-gameplay.spec.ts#L85) | ``ordinary ball throws ricochet from a robin, trigger a short escape flight`` | 1 | Node | Partial |
| [L158](../../../tests/robin-gameplay.spec.ts#L158) | ``ordinary grove robins support manual creation and durable deletion on world reopening`` | 1 | Split | Partial |

**L85: Node / Partial** — Direct transport-spawn/throw and internal state reads; the behavior needs production Realm ball collision and replication, not Chromium.

Remaining work: Existing species tests assert ball ricochet/startle at EntityManager level; add or verify the complete Realm throw-command path and recovery for this species before deletion.

### scenario-lifecycle.spec.ts

1 cases; 1 source template. Actual browser Worker counts across tool changes and no IndexedDB world creation are native browser resource/lifecycle contracts.

Existing native coverage: [src/scenarios/ScenarioPresentationHost.test.ts](../../../src/scenarios/ScenarioPresentationHost.test.ts), [src/scenarios/ScenarioWorkerHost.test.ts](../../../src/scenarios/ScenarioWorkerHost.test.ts)

Remaining work: Headless session close does not prove real browser Worker termination or no unintended IndexedDB databases.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L3](../../../tests/scenario-lifecycle.spec.ts#L3) | ``lab navigation and tuning dispose Worker sessions without creating saved worlds`` | 1 | Browser | Browser boundary |

### scenario-scheduling.spec.ts

2 cases; 1 source template. Stalls the actual page main thread and verifies a separate authority Worker continues, channel bounds and hidden/pause fences.

Existing native coverage: [src/scenarios/ScenarioScheduling.test.ts](../../../src/scenarios/ScenarioScheduling.test.ts), [src/server/ServerLoop.test.ts](../../../src/server/ServerLoop.test.ts), [src/transport/OrderedWorkerChannel.test.ts](../../../src/transport/OrderedWorkerChannel.test.ts)

Remaining work: Fake clocks/channels and manually stepped Realm cannot establish browser event-loop independence or real visibility lifecycle.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L6](../../../tests/scenario-scheduling.spec.ts#L6) | ``preview authority survives a stalled client and explicit lifecycle fences (${renderer})`` | 2 | Browser | Browser boundary |

### screenshot.spec.ts

2 cases; 1 source template. Two zoom cases only wait, change a debug slider and save PNGs; no assertion checks zoom, scene contents or image differences.

Existing native coverage: No equivalent native suite identified.

Remaining work: Move to opt-in capture tooling or define a justified visual expectation. Do not replace an unasserted artifact with a nominal Node test.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L34](../../../tests/screenshot.spec.ts#L34) | ``screenshot at zoom ${zoom}`` | 2 | Capture | Gap |

### secretary-bird.spec.ts

3 cases; 2 source templates. The exact natural-cobra hunt/reload already runs through ScenarioSession; browser action-preview animation and Watch AI handoff need a browser.

Existing native coverage: [src/wildlife/SecretaryBird.test.ts](../../../src/wildlife/SecretaryBird.test.ts)

Remaining work: Keep preview/scene handoff representative and saved first-client phase check; simulation tests do not replace rendered preview animation.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L5](../../../tests/secretary-bird.spec.ts#L5) | ``secretary-bird catches a cobra and reloads its natural meal (${renderer})`` | 2 | Split | Partial |
| [L42](../../../tests/secretary-bird.spec.ts#L42) | ``secretary-bird browser action opens its real hunting scene`` | 1 | Browser | Browser boundary |

**L42: Browser / Browser boundary** — Checks browser preview frame advancement and Watch AI scene selection.

Remaining work: Retain DOM/canvas-preview handoff coverage.

### server-security.spec.ts

2 cases; 1 source template. Guest/admin authorization and command persistence can run against real dedicated WS/RTC server clients headlessly; consuming the fragment through browser bootstrap/history is a distinct browser contract.

Existing native coverage: [src/server/adminAuthorization.test.ts](../../../src/server/adminAuthorization.test.ts), [src/server/GameServer.test.ts](../../../src/server/GameServer.test.ts), [src/transport/webrtcChannels.test.ts](../../../src/transport/webrtcChannels.test.ts)

Remaining work: Native adminAuthorization tests cover pure policy and URL parsing, not standalone transport acceptance end-to-end. Add a Node subprocess/WS authority test; retain real browser fragment removal and RTC handshake representative.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L9](../../../tests/server-security.spec.ts#L9) | ``dedicated ${transport} server rejects guest administration and consumes the browser admin credential`` | 2 | Split | Partial |

### settlement-life.spec.ts

8 cases; 3 source templates. Farm/pet population, stable identity and reload are headless; browser paused terrain preparation and camera coordinates are presentation integration.

Existing native coverage: [src/generation/regional/SettlementLife.test.ts](../../../src/generation/regional/SettlementLife.test.ts), [src/scenarios/NaturalLandscapeRecipe.test.ts](../../../src/scenarios/NaturalLandscapeRecipe.test.ts), [src/wildlife/Fauna.test.ts](../../../src/wildlife/Fauna.test.ts), [src/wildlife/WaterFauna.test.ts](../../../src/wildlife/WaterFauna.test.ts)

Remaining work: Keep representative paused terrain/pet presentation. Verify full farmstead/city/town-pet recipe roundtrip and saved clip/phase counts headlessly before reducing the scene × renderer matrix.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L11](../../../tests/settlement-life.spec.ts#L11) | ``connected farmstead contains farmhouse, crops and durable pasture (${renderer})`` | 2 | Split | Partial |
| [L60](../../../tests/settlement-life.spec.ts#L60) | ``larger city center renders inhabited connected blocks (${renderer})`` | 2 | Split | Partial |
| [L92](../../../tests/settlement-life.spec.ts#L92) | ``${id} has moving saved cats and dogs (${renderer})`` | 4 | Split | Partial |

### smoke.spec.ts

11 cases; 11 source templates. Basic real canvas content/layout and actual input/render startup checks need browser rendering, but several generic movement/no-console cases overlap.

Existing native coverage: [src/rendering/RenderingBoundary.test.ts](../../../src/rendering/RenderingBoundary.test.ts), [src/rendering/TileRenderer.test.ts](../../../src/rendering/TileRenderer.test.ts)

Remaining work: Consolidate redundant generic movement/error smokes after preserving distinct keyboard aliases, debug toggle and chunk traversal; nonblack pixels do not establish a sprite or terrain identity.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L3](../../../tests/smoke.spec.ts#L3) | ``canvas renders with non-zero dimensions`` | 1 | Browser | Browser boundary |
| [L14](../../../tests/smoke.spec.ts#L14) | ``canvas has pixel content from spritesheet`` | 1 | Browser | Browser boundary |
| [L40](../../../tests/smoke.spec.ts#L40) | ``multiple chunks are rendered across the viewport`` | 1 | Browser | Browser boundary |
| [L75](../../../tests/smoke.spec.ts#L75) | ``camera movement via arrow keys does not crash`` | 1 | Browser | Browser boundary |
| [L112](../../../tests/smoke.spec.ts#L112) | ``no console errors on load`` | 1 | Browser | Browser boundary |
| [L128](../../../tests/smoke.spec.ts#L128) | ``player sprite visible at screen center`` | 1 | Browser | Browser boundary |
| [L160](../../../tests/smoke.spec.ts#L160) | ``arrow key movement does not crash and keeps rendering`` | 1 | Browser | Browser boundary |
| [L196](../../../tests/smoke.spec.ts#L196) | ``no console errors after WASD movement`` | 1 | Browser | Browser boundary |
| [L224](../../../tests/smoke.spec.ts#L224) | ``F3 toggles debug overlay`` | 1 | Browser | Browser boundary |
| [L271](../../../tests/smoke.spec.ts#L271) | ``no console errors with collision and NPCs active`` | 1 | Browser | Browser boundary |
| [L291](../../../tests/smoke.spec.ts#L291) | ``no console errors after rapid scrolling through many chunks`` | 1 | Browser | Browser boundary |

### source-viewport.spec.ts

3 cases; 3 source templates. Real trackpad wheel cancellation, focused keyboard/Shift interaction, scroll suppression, cursor CSS and resized source-canvas selection require browser events/layout.

Existing native coverage: [src/explorer/ViewState.test.ts](../../../src/explorer/ViewState.test.ts), [src/workshop/WorkshopProjection.test.ts](../../../src/workshop/WorkshopProjection.test.ts)

Remaining work: Native transform math is supplementary; it cannot prove preventDefault, DOM focus or page-scroll isolation.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L11](../../../tests/source-viewport.spec.ts#L11) | ``atlas buttons and wheel preserve the same center through bursty trackpad input`` | 1 | Browser | Browser boundary |
| [L63](../../../tests/source-viewport.spec.ts#L63) | ``atlas can pan past every edge, zoom there, and select without snapping the view`` | 1 | Browser | Browser boundary |
| [L116](../../../tests/source-viewport.spec.ts#L116) | ``Shift temporarily pans and focused arrows navigate without changing selections or text input`` | 1 | Browser | Browser boundary |

### streaming.spec.ts

1 cases; 1 source template. Measures actual moving-camera visible terrain readiness in the production Worker/frame/render composition.

Existing native coverage: [src/server/RealmStreaming.test.ts](../../../src/server/RealmStreaming.test.ts), [src/world/ChunkManager.test.ts](../../../src/world/ChunkManager.test.ts), [src/rendering/TerrainPreparation.test.ts](../../../src/rendering/TerrainPreparation.test.ts)

Remaining work: Native streaming/readiness policies cannot prove zero incomplete visible terrain in the running browser. Benchmark overlap is not permission to remove this regression without equivalent CI evidence.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L6](../../../tests/streaming.spec.ts#L6) | ``${version} prepares terrain before sprinting and revisiting it`` | 1 | Browser | Browser boundary |

### street-review.spec.ts

5 cases; 5 source templates. Reads exact atlas pavement pixels and checks actual review/outbox/focus/link/draft behavior.

Existing native coverage: [src/generation/regional/StreetRecipes.test.ts](../../../src/generation/regional/StreetRecipes.test.ts), [src/art/BuildingReviewQueue.test.ts](../../../src/art/BuildingReviewQueue.test.ts), [src/server/artNotesHttp.test.ts](../../../src/server/artNotesHttp.test.ts)

Remaining work: Recipe inventories/payload schemas/review policy are native-covered; keep source pixels and actual UI enforcement.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L11](../../../tests/street-review.spec.ts#L11) | ``street starter renders the dense neighborhood's source pavement, curb and asphalt pixels`` | 1 | Browser | Browser boundary |
| [L54](../../../tests/street-review.spec.ts#L54) | ``street starter renders every shared scene, source links and mobile review in view`` | 1 | Browser | Browser boundary |
| [L97](../../../tests/street-review.spec.ts#L97) | ``street review saves exact scenes, pauses at two reports, persists offline and does not alter building queues`` | 1 | Browser | Browser boundary |
| [L152](../../../tests/street-review.spec.ts#L152) | ``street judgments are accepted by the real shared note API and link back from the atlas`` | 1 | Browser | Browser boundary |
| [L181](../../../tests/street-review.spec.ts#L181) | ``street drafts and exact appearance approvals survive debug views; changed renders reopen`` | 1 | Browser | Browser boundary |

### surface-review.spec.ts

3 cases; 3 source templates. Exact current canvas/source pixel comparison, render fingerprints, visible review gating and note links need browser integration.

Existing native coverage: [src/road/CitySurfaceRecipes.test.ts](../../../src/road/CitySurfaceRecipes.test.ts), [src/art/CityReviewArchive.test.ts](../../../src/art/CityReviewArchive.test.ts), [src/art/BuildingReviewQueue.test.ts](../../../src/art/BuildingReviewQueue.test.ts), [src/server/artNotesHttp.test.ts](../../../src/server/artNotesHttp.test.ts)

Remaining work: Composition hashes, payload schemas and review policy are native-covered; keep current pixel verification and UI enforcement.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L15](../../../tests/surface-review.spec.ts#L15) | ``all surface recipes render exact source pixels and keep phone review controls visible`` | 1 | Browser | Browser boundary |
| [L109](../../../tests/surface-review.spec.ts#L109) | ``surface verdicts use independent recipe identities, pause after two reports and reopen changed pixels`` | 1 | Browser | Browser boundary |
| [L162](../../../tests/surface-review.spec.ts#L162) | ``real isolated inbox accepts surface feedback and links to the exact case`` | 1 | Browser | Browser boundary |

### tap-movement.spec.ts

14 cases; 8 source templates. Actual native/synthetic pointer routing, fullscreen first gesture, focus/menu/modal isolation, settings storage and input ownership are browser contracts.

Existing native coverage: [src/input/TapMovement.test.ts](../../../src/input/TapMovement.test.ts), [src/input/TouchTap.test.ts](../../../src/input/TouchTap.test.ts), [src/input/TouchHold.test.ts](../../../src/input/TouchHold.test.ts), [src/input/TouchJoystick.test.ts](../../../src/input/TouchJoystick.test.ts), [src/input/TouchButtons.test.ts](../../../src/input/TouchButtons.test.ts)

Remaining work: Distance/obstacle targeting math can remain exhaustive in Node; keep real tap/hold/Jump/multifinger/resize/browser preference boundaries. Renderer cross-product can be reviewed separately after preserving rendered marker and camera paths.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L166](../../../tests/tap-movement.spec.ts#L166) | ``first slow world tap keeps its destination through fullscreen; focus loss cancels it (${renderer})`` | 2 | Browser | Browser boundary |
| [L215](../../../tests/tap-movement.spec.ts#L215) | ``walks, redirects, arrives and cancels with manual input (${renderer})`` | 2 | Browser | Browser boundary |
| [L279](../../../tests/tap-movement.spec.ts#L279) | ``tap walking enters a door and clears the old destination (${renderer})`` | 2 | Browser | Browser boundary |
| [L314](../../../tests/tap-movement.spec.ts#L314) | ``stops at water and preserves animal interaction without duplicate clicks (${renderer})`` | 2 | Browser | Browser boundary |
| [L447](../../../tests/tap-movement.spec.ts#L447) | ``Options fits, owns focus and preserves first-tap fullscreen (${viewport.width}×${viewport.height})`` | 2 | Browser | Browser boundary |
| [L485](../../../tests/tap-movement.spec.ts#L485) | ``reload remembers each local player's choice and storage failures retain the session mode`` | 1 | Browser | Browser boundary |
| [L537](../../../tests/tap-movement.spec.ts#L537) | ``gesture rejection, claimed Jump, resize targeting and menu cancellation use the real input path`` | 1 | Browser | Browser boundary |
| [L614](../../../tests/tap-movement.spec.ts#L614) | ``hold movement starts immediately, keeps walking, tolerates fingers and cancels on UI (${renderer})`` | 2 | Browser | Browser boundary |

### terrain-pacing.spec.ts

2 cases; 1 source template. Measures actual render demand/quiet frames/GPU upload counters and live zoom shortcut routing.

Existing native coverage: [src/rendering/TerrainPreparation.test.ts](../../../src/rendering/TerrainPreparation.test.ts), [src/rendering/TerrainResources.test.ts](../../../src/rendering/TerrainResources.test.ts), [src/rendering/TerrainFrame.test.ts](../../../src/rendering/TerrainFrame.test.ts)

Remaining work: Native budget/cache invariants do not prove that the composed browser frame loop settles without reuploads.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L21](../../../tests/terrain-pacing.spec.ts#L21) | ``zoom shortcuts and terrain pacing survive demand changes (${renderer})`` | 2 | Browser | Browser boundary |

### three-debug.spec.ts

1 cases; 1 source template. Creates a real WebGL context and verifies visible debug canvas removal/lifetime.

Existing native coverage: [src/rendering/RenderingBoundary.test.ts](../../../src/rendering/RenderingBoundary.test.ts)

Remaining work: Native renderer boundary tests cannot replace actual context availability and DOM teardown.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L3](../../../tests/three-debug.spec.ts#L3) | ``Three.js debug view renders and releases its WebGL canvas`` | 1 | Browser | Browser boundary |

### tools-index.spec.ts

3 cases; 3 source templates. Actual game sidebar/navigation, tool cards, bookmark/reset behavior and return links need DOM routing.

Existing native coverage: [src/art/ArtCatalog.test.ts](../../../src/art/ArtCatalog.test.ts), [src/server/staticFiles.test.ts](../../../src/server/staticFiles.test.ts), [src/explorer/PreviewSettings.test.ts](../../../src/explorer/PreviewSettings.test.ts)

Remaining work: Exhaustive endpoint status/content-type checks can run with Node HTTP/static-file tests; retain actual click/navigation and page layout.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L4](../../../tests/tools-index.spec.ts#L4) | ``game sidebar opens the central index and each listed destination is served`` | 1 | Split | Partial |
| [L64](../../../tests/tools-index.spec.ts#L64) | ``the full sheet resets old selections and filtered art shortcuts survive reload and sharing`` | 1 | Browser | Browser boundary |
| [L96](../../../tests/tools-index.spec.ts#L96) | ``tools and both in-game catalogs provide a return path to the index`` | 1 | Browser | Browser boundary |

**L4: Split / Partial** — Combines true sidebar/tool-card/layout navigation with an APIRequest loop checking every tool URL status and HTML content type.

Remaining work: Add exhaustive current WORKSHOP_TOOLS route/resource conformance to Node HTTP tests; staticFiles tests cover generic serving, not necessarily this exact inventory. Keep representative clicked pages.

### traffic-rendering.spec.ts

5 cases; 3 source templates. Actual terrain-cache settling, rAF interpolation, embedded surface DOM alignment, resize/scroll and GPU context lifecycle require a browser.

Existing native coverage: [src/rendering/TerrainPreparation.test.ts](../../../src/rendering/TerrainPreparation.test.ts), [src/rendering/RenderHost.test.ts](../../../src/rendering/RenderHost.test.ts), [src/scenarios/ScenarioPresentationHost.test.ts](../../../src/scenarios/ScenarioPresentationHost.test.ts), [src/rendering/PresentationTimeline.test.ts](../../../src/rendering/PresentationTimeline.test.ts)

Remaining work: Node covers scheduler/cache/timeline invariants, but not real GPU resources, DOM surface alignment or native rAF/Worker interaction.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L33](../../../tests/traffic-rendering.spec.ts#L33) | ``traffic terrain settles and retains its caches after movement and reset (${mode})`` | 3 | Browser | Browser boundary |
| [L93](../../../tests/traffic-rendering.spec.ts#L93) | ``traffic uses interpolated presentation, freezes simulation on pause and resumes`` | 1 | Browser | Browser boundary |
| [L129](../../../tests/traffic-rendering.spec.ts#L129) | ``embedded GPU surface tracks scrolling/resizing, recovers context and leaves no canvas on exit`` | 1 | Browser | Browser boundary |

### traffic.spec.ts

3 cases; 3 source templates. Traffic stop/roof/support/reload semantics already run headlessly; real keyboard jump, canceled touch release, phone layout and game bootstrap remain browser wiring.

Existing native coverage: [src/scenarios/ScenarioTraffic.test.ts](../../../src/scenarios/ScenarioTraffic.test.ts), [src/persistence/GenerationPersistence.test.ts](../../../src/persistence/GenerationPersistence.test.ts), [src/input/TouchButtons.test.ts](../../../src/input/TouchButtons.test.ts)

Remaining work: Retain input and transport composition representatives, move exhaustive traffic mechanics to ScenarioTraffic.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L6](../../../tests/traffic.spec.ts#L6) | ``generated traffic stops, supports a real jump onto its roof, and continues driving`` | 1 | Split | Partial |
| [L35](../../../tests/traffic.spec.ts#L35) | ``traffic playground fits phones and touch directions release on cancellation`` | 1 | Split | Partial |
| [L50](../../../tests/traffic.spec.ts#L50) | ``traffic revision creates a real Worker world and survives reload`` | 1 | Split | Partial |

### train-audio.spec.ts

1 cases; 1 source template. Uses real AudioContext stereo energy and game menu/focus/scene voice cleanup.

Existing native coverage: [src/audio/TrainAudio.test.ts](../../../src/audio/TrainAudio.test.ts), [src/audio/AudioManager.test.ts](../../../src/audio/AudioManager.test.ts)

Remaining work: Mock audio graph/unit policy cannot establish real channel energy or browser autoplay/focus lifecycle.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L18](../../../tests/train-audio.spec.ts#L18) | ``moving trains produce real stereo audio and silence on menu/focus/scene exit`` | 1 | Browser | Browser boundary |

### train-call.spec.ts

2 cases; 1 source template. Recall identity/dwell/location/reload can be headless; touch interaction, prompt/status display and browser persistence remain UI integration.

Existing native coverage: [src/railway/TrainCall.test.ts](../../../src/railway/TrainCall.test.ts), [src/scenarios/CityTrainRecipe.test.ts](../../../src/scenarios/CityTrainRecipe.test.ts), [src/server/VehicleControl.test.ts](../../../src/server/VehicleControl.test.ts)

Remaining work: Keep actual touch prompt routing and a browser reload; avoid full service travel waits per renderer.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L72](../../../tests/train-call.spec.ts#L72) | ``call a departed train by touch at either station and keep it after reload (${backend})`` | 2 | Split | Partial |

### train-geometry.spec.ts

3 cases; 2 source templates. Carriage support heights/grades/reversal/reload are headless; camera/visibility controls, client pause and Worker lifecycle need the browser.

Existing native coverage: [src/scenarios/TrainGeometryRecipe.test.ts](../../../src/scenarios/TrainGeometryRecipe.test.ts), [src/scenarios/TrainRoofRiding.test.ts](../../../src/scenarios/TrainRoofRiding.test.ts)

Remaining work: Keep level/camera rendering and cleanup smoke; replace long real-time grade traversal with native steps.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L5](../../../tests/train-geometry.spec.ts#L5) | ``train carriages follow bridge and tunnel grades (${renderer})`` | 2 | Split | Partial |
| [L82](../../../tests/train-geometry.spec.ts#L82) | ``camera and level controls fit without changing the simulation`` | 1 | Browser | Browser boundary |

**L82: Browser / Browser boundary** — Phone layout, contextmenu cancellation and camera/level UI preserving simulation state.

Remaining work: Retain actual UI/event isolation test.

### underground-garage.spec.ts

3 cases; 2 source templates. Garage space/height/ceiling and restore rules are headless; keyboard prediction alignment, visibility controls and Worker lifetime are browser integration.

Existing native coverage: [src/scenarios/UndergroundGarageRecipe.test.ts](../../../src/scenarios/UndergroundGarageRecipe.test.ts), [src/physics/TerrainExcavation.test.ts](../../../src/physics/TerrainExcavation.test.ts)

Remaining work: Keep client/authority alignment and UI visibility representative; avoid repeating all server physics per renderer.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L5](../../../tests/underground-garage.spec.ts#L5) | ``garage descends through terrain, reloads underground and preserves the street (${renderer})`` | 2 | Split | Partial |
| [L84](../../../tests/underground-garage.spec.ts#L84) | ``level controls fit and switch spaces with touch`` | 1 | Browser | Browser boundary |

**L84: Browser / Browser boundary** — Touch level controls and phone layout need DOM/input routing.

Remaining work: Retain a real touch space-switch integration test.

### vehicle-driving.spec.ts

8 cases; 2 source templates. Boarding/seat/save/exit and train direction are headless; actual tap/hold UI isolation, wheel-pose alignment, mesh draw and client presentation need browser integration.

Existing native coverage: [src/server/VehicleControl.test.ts](../../../src/server/VehicleControl.test.ts), [src/client/CarDrivingPrediction.test.ts](../../../src/client/CarDrivingPrediction.test.ts), [src/rendering/EntityMeshPose.test.ts](../../../src/rendering/EntityMeshPose.test.ts), [src/input/TouchHold.test.ts](../../../src/input/TouchHold.test.ts), [src/input/TapMovement.test.ts](../../../src/input/TapMovement.test.ts)

Remaining work: Keep input modes, UI hitboxes, real mesh/wheel render and browser storage representatives; semantic authority checks already overlap extensively.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L140](../../../tests/vehicle-driving.spec.ts#L140) | ``car boarding, tap destination, saved inside seat and exit (${backend})`` | 4 | Split | Partial |
| [L413](../../../tests/vehicle-driving.spec.ts#L413) | ``train ${mode} starts, stops, reverses, and UI stays isolated (${backend})`` | 4 | Split | Partial |

### vehicle-game-fit.spec.ts

1 cases; 1 source template. Review link/image load and layout need a browser; assertions on frozen report.json are filesystem data checks and do not measure current renderer output.

Existing native coverage: [src/traffic/OriginalVehicles.test.ts](../../../src/traffic/OriginalVehicles.test.ts), [src/rendering/CarMeshProjection.test.ts](../../../src/rendering/CarMeshProjection.test.ts)

Remaining work: Add direct Node validation of the 45-row archived game-fit report, thresholds and artifact identity; keep navigation/image decoding/layout smoke.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L3](../../../tests/vehicle-game-fit.spec.ts#L3) | ``game-camera vehicle fit is registered and opens its frozen grounded comparisons`` | 1 | Split | Partial |

### vehicle-geometry.spec.ts

4 cases; 1 source template. Bridge/garage car grade/reload semantics already have native fixture tests; live scene reset and Worker cleanup are residual browser contracts.

Existing native coverage: [src/scenarios/VehicleGeometryRecipe.test.ts](../../../src/scenarios/VehicleGeometryRecipe.test.ts)

Remaining work: Keep bounded Worker reset/presentation smoke; native tests should enumerate both directions/fixtures before reducing matrix.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L6](../../../tests/vehicle-geometry.spec.ts#L6) | ``vehicle grades ${garage ? "garage" : "bridge"} (${renderer})`` | 4 | Split | Partial |

### vehicle-paint-gameplay.spec.ts

13 cases; 3 source templates. Paint identity/save/replication is headless; actual GPU texture/cache loading, aborted image/model fallback and mobile swatch selection require browser integration.

Existing native coverage: [src/server/VehiclePaintIntegration.test.ts](../../../src/server/VehiclePaintIntegration.test.ts), [src/server/VehiclePaintReplication.test.ts](../../../src/server/VehiclePaintReplication.test.ts), [src/traffic/VehiclePaint.test.ts](../../../src/traffic/VehiclePaint.test.ts), [src/rendering/VehiclePaintResources.test.ts](../../../src/rendering/VehiclePaintResources.test.ts)

Remaining work: Keep actual texture/cache/failure paths and UI swatch hit testing. Node resource mocks are not real GPU texture decode/upload proof.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L18](../../../tests/vehicle-paint-gameplay.spec.ts#L18) | ``all fourteen reviewed schemes use the shared GPU paint cache in Traffic`` | 1 | Browser | Browser boundary |
| [L60](../../../tests/vehicle-paint-gameplay.spec.ts#L60) | ``${model} preserves its ${paint} sprite when ${failure} loading fails`` | 6 | Browser | Browser boundary |
| [L113](../../../tests/vehicle-paint-gameplay.spec.ts#L113) | ``mobile editor places and reloads ${model}/${paint} with ${renderer}`` | 6 | Split | Partial |

**L18: Browser / Browser boundary** — Exercises actual shared GPU paint cache for every scheme and selector hide/reset behavior.

Remaining work: Geometry/palette metadata tests cannot replace live GPU texture upload/cache selection.

**L60: Browser / Browser boundary** — Aborts actual model/paint/atlas requests and verifies surviving painted sprite fallback.

Remaining work: Keep real resource-failure integration; deduplicate only truly equivalent loader paths.

### vehicle-paint-study.spec.ts

2 cases; 1 source template. Standalone comparison image sizing, paint/camera selection and responsive layout need browser image/DOM behavior.

Existing native coverage: [src/traffic/VehiclePaint.test.ts](../../../src/traffic/VehiclePaint.test.ts)

Remaining work: Pure palette identity tests supplement the page; no equivalent headless page integration identified.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L12](../../../tests/vehicle-paint-study.spec.ts#L12) | ``vehicle paint comparison preserves native sizes and selection at ${viewport.width}px`` | 2 | Browser | Browser boundary |

### vehicle-placement.spec.ts

4 cases; 1 source template. Roadless placement/seat/lights/park/delete are extensively headless; mobile picker layout, preview world-to-screen alignment and input/IndexedDB routing remain browser-specific.

Existing native coverage: [src/server/VehiclePlacement.test.ts](../../../src/server/VehiclePlacement.test.ts), [src/server/VehicleControl.test.ts](../../../src/server/VehicleControl.test.ts), [src/traffic/OriginalVehicles.test.ts](../../../src/traffic/OriginalVehicles.test.ts)

Remaining work: Keep mobile preview/hitbox and a browser reopen/delete path; exhaustive model mechanics should remain Node.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L62](../../../tests/vehicle-placement.spec.ts#L62) | ``place, drive, save and delete ${model} through the mobile editor in a roadless world (${renderer})`` | 4 | Split | Partial |

### vehicle-rendering.spec.ts

2 cases; 2 source templates. Real rendering fingerprint verification and mismatched-manifest disabled approval require Chromium canvas/UI.

Existing native coverage: [src/assets/vehicles/VehicleCatalog.test.ts](../../../src/assets/vehicles/VehicleCatalog.test.ts), [src/art/ArtCatalog.test.ts](../../../src/art/ArtCatalog.test.ts)

Remaining work: Retain current-renderer verification; metadata/hash tests alone cannot prove appearance matches.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L13](../../../tests/vehicle-rendering.spec.ts#L13) | ``normal Chromium can review every vehicle with the registered appearance`` | 1 | Browser | Browser boundary |
| [L33](../../../tests/vehicle-rendering.spec.ts#L33) | ``vehicle appearance verification still blocks a mismatched manifest`` | 1 | Browser | Browser boundary |

### vehicle-steering.spec.ts

66 cases; 1 source template. Signed forward/reverse turning and stopped heading are headless physics/replication contracts; keyboard routing and settled client presentation are browser integration.

Existing native coverage: [src/traffic/Driving.test.ts](../../../src/traffic/Driving.test.ts), [src/client/CarDrivingPrediction.test.ts](../../../src/client/CarDrivingPrediction.test.ts), [src/client/PredictionPresentation.test.ts](../../../src/client/PredictionPresentation.test.ts), [src/traffic/VehicleHeading.test.ts](../../../src/traffic/VehicleHeading.test.ts)

Remaining work: Current Node Driving tests use representative dimensions, not all 33 families. Add a family matrix through Realm/replica for signed turns and stopped pose; keep representative keyboard/interpolation paths.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L8](../../../tests/vehicle-steering.spec.ts#L8) | ``${family.title} forward and reverse rolling turns preserve stopped heading (${backend})`` | 66 | Split | Partial |

### vehicle-workshop.spec.ts

3 cases; 3 source templates. Form validation, collision preview, direction draft persistence, offline queue and pause/approval UI require browser integration.

Existing native coverage: [src/assets/vehicles/VehicleCatalog.test.ts](../../../src/assets/vehicles/VehicleCatalog.test.ts), [src/art/BuildingReviewQueue.test.ts](../../../src/art/BuildingReviewQueue.test.ts), [src/server/workshopService.test.ts](../../../src/server/workshopService.test.ts)

Remaining work: Policy/schema/data checks can be headless, but do not replace DOM draft scoping, local persistence or native preview rendering.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L7](../../../tests/vehicle-workshop.spec.ts#L7) | ``vehicles are discoverable in the inbox and save exact directional boxes and height`` | 1 | Browser | Browser boundary |
| [L66](../../../tests/vehicle-workshop.spec.ts#L66) | ``vehicle drafts survive direction changes and offline corrections sync on phones`` | 1 | Browser | Browser boundary |
| [L103](../../../tests/vehicle-workshop.spec.ts#L103) | ``two vehicle reports pause the batch and require reasons`` | 1 | Browser | Browser boundary |

### warning-beacon-driving.spec.ts

4 cases; 1 source template. The two garbage-truck beacon/state restrictions already have headless authority checks; no-Style UI and loaded six-wheel rendering are browser-specific.

Existing native coverage: [src/server/VehicleControl.test.ts](../../../src/server/VehicleControl.test.ts), [src/traffic/EmergencyVehicle.test.ts](../../../src/traffic/EmergencyVehicle.test.ts), [src/rendering/VehicleEmergencyLights.test.ts](../../../src/rendering/VehicleEmergencyLights.test.ts)

Remaining work: Retain silent-beacon UI and actual loader/draw representative; remove renderer multiplication of state assertions only after preserving distinct light wiring.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L7](../../../tests/warning-beacon-driving.spec.ts#L7) | ``${model} owns six-wheel model and silent beacon driving controls (${renderer})`` | 4 | Split | Partial |

### water-animation.spec.ts

1 cases; 1 source template. The only assertion is nonblack canvas content after walking; that needs a canvas but does not establish water tiles rendered.

Existing native coverage: [src/assets/TileVariants.test.ts](../../../src/assets/TileVariants.test.ts), [src/rendering/TileRenderer.test.ts](../../../src/rendering/TileRenderer.test.ts)

Remaining work: Rewrite to stage known water and assert its specific raster/source pixels, or retire as redundant smoke after comparing smoke.spec. A generic Node terrain test is not an equivalent visual claim.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L3](../../../tests/water-animation.spec.ts#L3) | ``water tiles render with ME tileset (static)`` | 1 | Browser | Gap |

### webrtc-delivery.spec.ts

2 cases; 2 source templates. Interception happens at real RTCDataChannel receive boundaries; verifies reliable lane choice, reconnect and reset ordering across actual clients.

Existing native coverage: [src/server/ReplicationDelivery.test.ts](../../../src/server/ReplicationDelivery.test.ts), [src/transport/webrtcChannels.test.ts](../../../src/transport/webrtcChannels.test.ts), [src/transport/webrtcFragment.test.ts](../../../src/transport/webrtcFragment.test.ts)

Remaining work: Native ReplicationDelivery is deliberately the semantic mirror, but cannot catch production RTC channel selection/wiring. Keep real transport tests; avoid duplicating all protocol edge cases in browser.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L185](../../../tests/webrtc-delivery.spec.ts#L185) | ``reliable RTC delivers spawns with unreliable faults armed, channel closure and reconnect`` | 1 | Browser | Browser boundary |
| [L235](../../../tests/webrtc-delivery.spec.ts#L235) | ``reliable RTC delivers exits and orders a world reset behind delayed old-world baselines`` | 1 | Browser | Browser boundary |

### wildlife-gameplay.spec.ts

6 cases; 4 source templates. Duck physics/AI/replication/persistence already have Node tests; game quack dispatch, live Worker pause and browser editor/storage remain integration.

Existing native coverage: [src/wildlife/Mallard.test.ts](../../../src/wildlife/Mallard.test.ts), [src/wildlife/MallardInteractions.test.ts](../../../src/wildlife/MallardInteractions.test.ts), [src/wildlife/MallardResidency.test.ts](../../../src/wildlife/MallardResidency.test.ts), [src/audio/AudioManager.test.ts](../../../src/audio/AudioManager.test.ts)

Remaining work: Retain quack dispatch and representative Worker freeze/reload plus editor/IndexedDB path; sound counters establish dispatch, not audible output quality.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L7](../../../tests/wildlife-gameplay.spec.ts#L7) | ``an ordinary game ball throw startles a duck into flight and plays a quack`` | 1 | Split | Partial |
| [L95](../../../tests/wildlife-gameplay.spec.ts#L95) | ``duck landing stays grounded and starts a durable escape in the shared pond Worker (${renderer})`` | 2 | Split | Partial |
| [L149](../../../tests/wildlife-gameplay.spec.ts#L149) | ``pond ducks animate in the shared Worker lab and survive reload (${renderer})`` | 2 | Split | Partial |
| [L196](../../../tests/wildlife-gameplay.spec.ts#L196) | ``ordinary seeded pond has durable ducks and offers manual creation in Entities`` | 1 | Split | Partial |

### wildlife-review.spec.ts

4 cases; 4 source templates. Exact image/canvas equality, playback controls, source-byte failure UI and disabled approval affordances are browser contracts.

Existing native coverage: [src/art/WildlifeReview.test.ts](../../../src/art/WildlifeReview.test.ts), [src/server/workshopService.test.ts](../../../src/server/workshopService.test.ts)

Remaining work: Source evidence/hash validation is covered headlessly; retain UI enforcement and actual decoding, with bounded representative failures rather than replacing with a hash-only test.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L14](../../../tests/wildlife-review.spec.ts#L14) | ``portable pet and tiger drafts have exact pending review and usable native/travel playback`` | 1 | Browser | Browser boundary |
| [L49](../../../tests/wildlife-review.spec.ts#L49) | ``wildlife revisions preserve native pixels or block feedback on missing archived evidence in full Chromium`` | 1 | Browser | Browser boundary |
| [L129](../../../tests/wildlife-review.spec.ts#L129) | ``changed playback bytes disable exact wildlife feedback`` | 1 | Browser | Browser boundary |
| [L148](../../../tests/wildlife-review.spec.ts#L148) | ``missing archived motion evidence blocks human feedback`` | 1 | Browser | Browser boundary |

### worker-server.spec.ts

5 cases; 5 source templates. Actual Worker isolation under busy authority/crash, browser map recovery, page shutdown/IDB reopen, cross-heap settings and visibility lifecycle require browser integration.

Existing native coverage: [src/server/RealmStreaming.test.ts](../../../src/server/RealmStreaming.test.ts), [src/transport/WorkerClientTransport.test.ts](../../../src/transport/WorkerClientTransport.test.ts), [src/transport/OrderedWorkerChannel.test.ts](../../../src/transport/OrderedWorkerChannel.test.ts), [src/transport/LocalServerWatchdog.test.ts](../../../src/transport/LocalServerWatchdog.test.ts), [src/scenarios/ScenarioWorkerHost.test.ts](../../../src/scenarios/ScenarioWorkerHost.test.ts)

Remaining work: Native channel/watchdog/persistence mocks do not prove real separate event loops, shutdown flush or browser lifecycle.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L34](../../../tests/worker-server.spec.ts#L34) | ``lake travel and rejected open-water travel keep the local Worker, map and streaming alive`` | 1 | Browser | Browser boundary |
| [L120](../../../tests/worker-server.spec.ts#L120) | ``single player renders while its authoritative Worker is busy`` | 1 | Browser | Browser boundary |
| [L152](../../../tests/worker-server.spec.ts#L152) | ``an unhandled local Worker failure offers reload with the authority stack`` | 1 | Browser | Browser boundary |
| [L177](../../../tests/worker-server.spec.ts#L177) | ``Worker saves player and edits before shutdown and restores them on reopen`` | 1 | Browser | Browser boundary |
| [L230](../../../tests/worker-server.spec.ts#L230) | ``physics settings replicate across isolated heaps and lifecycle pause resumes`` | 1 | Browser | Browser boundary |

### workshop-dev-review.spec.ts

2 cases; 1 source template. Development-source drift banners and enabling/disabling real review buttons depend on current page-render verification.

Existing native coverage: [src/server/workshopService.test.ts](../../../src/server/workshopService.test.ts), [src/art/ArtCatalog.test.ts](../../../src/art/ArtCatalog.test.ts)

Remaining work: Source identity/data validation is not proof that the page enforces the correct vote state.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L6](../../../tests/workshop-dev-review.spec.ts#L6) | ``development source drift permits review only when preview matches: changed=${changed}`` | 2 | Browser | Browser boundary |

### workshop-rendering.spec.ts

1 cases; 1 source template. Current full Chromium/retina GPU district pixels must match registered image hashes.

Existing native coverage: [src/generation/regional/DistrictStrategy.test.ts](../../../src/generation/regional/DistrictStrategy.test.ts), [src/art/ArtCatalog.test.ts](../../../src/art/ArtCatalog.test.ts)

Remaining work: Data-only fingerprints and generation tests cannot replace current GPU pixel verification.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L9](../../../tests/workshop-rendering.spec.ts#L9) | ``GPU Chromium at retina scale renders every district with the registered pixel hash`` | 1 | Browser | Browser boundary |

### workshop-standalone.spec.ts

1 cases; 1 source template. Much of this is standalone HTTP/auth/compatibility/storage testing; actual login, native review render and vote-button route remain browser integration.

Existing native coverage: [src/server/workshopAuth.test.ts](../../../src/server/workshopAuth.test.ts), [src/server/privateDataPlugin.test.ts](../../../src/server/privateDataPlugin.test.ts), [src/server/workshopService.test.ts](../../../src/server/workshopService.test.ts), [src/server/artNotesHttp.test.ts](../../../src/server/artNotesHttp.test.ts)

Remaining work: Add subprocess standalone Node HTTP tests for both protected compatibility APIs and on-disk write results; retain one true login→render→vote flow.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L10](../../../tests/workshop-standalone.spec.ts#L10) | ``standalone serves Workshop login, native reviews and both protected compatibility APIs`` | 1 | Split | Partial |

### workshop-viewport.spec.ts

2 cases; 2 source templates. Cursor-anchored zoom/pan, page-scroll cancellation, rendered pixel stability and zoomed pin hit testing require browser input/canvas layout.

Existing native coverage: [src/explorer/ViewState.test.ts](../../../src/explorer/ViewState.test.ts), [src/workshop/WorkshopProjection.test.ts](../../../src/workshop/WorkshopProjection.test.ts)

Remaining work: Native transforms do not replace actual pointer coordinate mapping, wheel suppression or CSS sizing.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L9](../../../tests/workshop-viewport.spec.ts#L9) | ``district camera zooms at the cursor, pans without scrolling or changing pixels, and resets between candidates`` | 1 | Browser | Browser boundary |
| [L115](../../../tests/workshop-viewport.spec.ts#L115) | ``panning a room never adds pins and a zoomed tap maps to the original tile on desktop and phone`` | 1 | Browser | Browser boundary |

### workshop.spec.ts

7 cases; 7 source templates. Login/session expiry, exact current render, draft imports/outbox, shared navigation and pin coordinates require browser integration.

Existing native coverage: [src/server/workshopAuth.test.ts](../../../src/server/workshopAuth.test.ts), [src/server/workshopService.test.ts](../../../src/server/workshopService.test.ts), [src/art/BuildingReviewQueue.test.ts](../../../src/art/BuildingReviewQueue.test.ts), [src/workshop/SceneReview.test.ts](../../../src/workshop/SceneReview.test.ts)

Remaining work: HTTP authorization and pure pause/filter/note validation belong in native tests too; retain actual local storage, login boundary and visible enforcement.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L13](../../../tests/workshop.spec.ts#L13) | ``owner login protects both legacy APIs and reveals all batches on desktop and phone`` | 1 | Browser | Browser boundary |
| [L47](../../../tests/workshop.spec.ts#L47) | ``native road review preserves exact pixels, drafts, independent pause and reopened appearances`` | 1 | Browser | Browser boundary |
| [L142](../../../tests/workshop.spec.ts#L142) | ``source selection saves a shared request and full history supports replies without approvals`` | 1 | Browser | Browser boundary |
| [L181](../../../tests/workshop.spec.ts#L181) | ``unsent legacy notes survive a login boundary and sync once into the shared inbox`` | 1 | Browser | Browser boundary |
| [L226](../../../tests/workshop.spec.ts#L226) | ``existing room editor and movement tools stay inside the shared navigation`` | 1 | Browser | Browser boundary |
| [L257](../../../tests/workshop.spec.ts#L257) | ``session expiry retains native feedback and signing back in completes the save`` | 1 | Browser | Browser boundary |
| [L292](../../../tests/workshop.spec.ts#L292) | ``native room pins and drafts survive reload and use the existing feedback contract`` | 1 | Browser | Browser boundary |

### world-explorer.spec.ts

8 cases; 8 source templates. Actual worker lifetime/queue cancellation, resource-request exclusions, phone interaction, canvas residency and browser download/storage/UI are integration contracts.

Existing native coverage: [src/explorer/QueryClient.test.ts](../../../src/explorer/QueryClient.test.ts), [src/explorer/PreviewSettings.test.ts](../../../src/explorer/PreviewSettings.test.ts), [src/explorer/ReviewStore.test.ts](../../../src/explorer/ReviewStore.test.ts), [src/explorer/ViewState.test.ts](../../../src/explorer/ViewState.test.ts), [src/generation/Generator.test.ts](../../../src/generation/Generator.test.ts)

Remaining work: Native query/settings/generator tests cover the algorithms; preserve real worker boot/disposal, bundling and DOM interaction.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L8](../../../tests/world-explorer.spec.ts#L8) | ``regional map loads without a game runtime, inspects stable features, and shares negative coordinates`` | 1 | Browser | Browser boundary |
| [L51](../../../tests/world-explorer.spec.ts#L51) | ``broad views and rapid navigation have bounded work and discard obsolete seeds`` | 1 | Browser | Browser boundary |
| [L94](../../../tests/world-explorer.spec.ts#L94) | ``review advances to unchecked cases, persists verdicts, and exports reproducible reports`` | 1 | Browser | Browser boundary |
| [L128](../../../tests/world-explorer.spec.ts#L128) | ``phone touch navigation remains responsive with a throttled CPU`` | 1 | Browser | Browser boundary |
| [L182](../../../tests/world-explorer.spec.ts#L182) | ``unsupported generator links show an error and can recover through seed selection`` | 1 | Browser | Browser boundary |
| [L194](../../../tests/world-explorer.spec.ts#L194) | ``real tile zoom uses bounded shared rendering, configurable settings, and releases detail on map mode`` | 1 | Browser | Browser boundary |
| [L244](../../../tests/world-explorer.spec.ts#L244) | ``actual explorer worker realizes exactly the game producer buffers for every generator`` | 1 | Split | Partial |
| [L309](../../../tests/world-explorer.spec.ts#L309) | ``sustained exact navigation and repeated source changes keep bounded residency on phone layout`` | 1 | Browser | Browser boundary |

**L244: Split / Partial** — Exhaustive generator buffer parity is deterministic and could run through an extracted pure explorer query handler; actual module Worker import/message and transferable buffers need a browser smoke.

Remaining work: Generator.test does not prove the same explorer query handler emits exact six buffers. Add native handler parity for every generator, keep one real compiled Worker protocol/transfer test.

### world-generation.spec.ts

5 cases; 5 source templates. Descriptors/defaults/retirement/deleted-prop snapshots are native logic; actual menu validation, explorer handoff and IndexedDB create/reopen/inspect remain browser contracts.

Existing native coverage: [src/generation/Generator.test.ts](../../../src/generation/Generator.test.ts), [src/persistence/GenerationPersistence.test.ts](../../../src/persistence/GenerationPersistence.test.ts), [src/persistence/WorldInspection.test.ts](../../../src/persistence/WorldInspection.test.ts), [src/explorer/PreviewSettings.test.ts](../../../src/explorer/PreviewSettings.test.ts)

Remaining work: Keep real browser storage/new-world form and saved-inspection integration. Consolidate repeated pure descriptor matrices below browser only after preserving generator-specific storage adapters.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L8](../../../tests/world-generation.spec.ts#L8) | ``new worlds and the explorer default to the newest regional revision`` | 1 | Split | Partial |
| [L38](../../../tests/world-generation.spec.ts#L38) | ``game creates and reopens every generator with the pinned descriptor in IndexedDB`` | 1 | Split | Partial |
| [L91](../../../tests/world-generation.spec.ts#L91) | ``explorer handoff preserves settings and game reports an invalid seed`` | 1 | Split | Partial |
| [L106](../../../tests/world-generation.spec.ts#L106) | ``Play here creates at the preview location and saved inspection includes a deleted building`` | 1 | Split | Partial |
| [L249](../../../tests/world-generation.spec.ts#L249) | ``retired URL descriptors cannot create historical worlds`` | 1 | Split | Partial |

### world-geometry.spec.ts

5 cases; 3 source templates. Deck support/ceiling and movement semantics are native; touch cancellation, visibility controls, actual automatic-cutaway pixels and Worker disposal require browser integration.

Existing native coverage: [src/scenarios/WorldGeometryRecipe.test.ts](../../../src/scenarios/WorldGeometryRecipe.test.ts), [src/physics/surfaceHeight.test.ts](../../../src/physics/surfaceHeight.test.ts), [src/rendering/SurfacePresentation.test.ts](../../../src/rendering/SurfacePresentation.test.ts)

Remaining work: Keep actual occlusion pixel comparison and input/cleanup; headless cutaway policy does not prove rendered automatic cutaway.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L8](../../../tests/world-geometry.spec.ts#L8) | ``geometry lab uses real Worker movement, cutaways and reload (${backend})`` | 2 | Split | Partial |
| [L55](../../../tests/world-geometry.spec.ts#L55) | ``geometry controls suppress long-press defaults and release touch input`` | 1 | Browser | Browser boundary |
| [L116](../../../tests/world-geometry.spec.ts#L116) | ``automatic cutaway follows rendered occlusion north and south of the deck (${backend})`` | 2 | Browser | Browser boundary |

**L55: Browser / Browser boundary** — Long-press/contextmenu, touch release, CSS selection suppression and page pause routing.

Remaining work: Retain actual DOM/event or rendering evidence.

**L116: Browser / Browser boundary** — Compares actual automatic/all/lower rendered pixels on both backends.

Remaining work: Retain actual DOM/event or rendering evidence.

### world-map.spec.ts

5 cases; 3 source templates. Native multifinger transitions, hold-to-travel cancellation, live multiplayer marker DOM and world/realm menu isolation need browser pointer/DOM composition.

Existing native coverage: [src/explorer/ViewState.test.ts](../../../src/explorer/ViewState.test.ts), [src/ui/PlayerMarkers.test.ts](../../../src/ui/PlayerMarkers.test.ts), [src/input/TouchPinch.test.ts](../../../src/input/TouchPinch.test.ts)

Remaining work: Native gesture/marker math is supplementary; preserve actual map routing and pointer capture transitions.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L12](../../../tests/world-map.spec.ts#L12) | ``native two-finger map pan and zoom continue into one-finger pan (${viewport.width})`` | 2 | Browser | Browser boundary |
| [L58](../../../tests/world-map.spec.ts#L58) | ``in-game map keeps distant multiplayer players live and long-press travels safely`` | 1 | Browser | Browser boundary |
| [L186](../../../tests/world-map.spec.ts#L186) | ``touch map supports hold-to-travel and cancellation (${hybrid ? "hybrid Chromebook" : "mobile"})`` | 2 | Browser | Browser boundary |

### world-recreation.spec.ts

1 cases; 1 source template. Retirement/same-seed recreation/container identity can be native; actual saved world list, recreate action and IndexedDB new-container coexistence need the browser. RealmBrowser.test:1698 already proves retired-world rejection, fresh same-seed container, preservation of the old world and exclusion of its entity records.

Existing native coverage: [src/persistence/GenerationPersistence.test.ts](../../../src/persistence/GenerationPersistence.test.ts), [src/generation/Generator.test.ts](../../../src/generation/Generator.test.ts), [src/ui/sessionNavigation.test.ts](../../../src/ui/sessionNavigation.test.ts), [src/server/RealmBrowser.test.ts](../../../src/server/RealmBrowser.test.ts)

Remaining work: Core registry recreation is already covered. Keep actual saved-world list/recreate control and simultaneous old/new IndexedDB containers; generic generation tests are not proof of that adapter.

| Source | Test title / template | Cases | Disposition | Existing coverage |
| --- | --- | ---: | --- | --- |
| [L5](../../../tests/world-recreation.spec.ts#L5) | ``retired browser worlds stay listed and recreate with the same seed in a new container`` | 1 | Split | Partial |
