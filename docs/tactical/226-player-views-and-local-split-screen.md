# Player views and local split screen

Status: phasing set 2026-11-07 after four read-only research reviews (input
and labs, rendering and performance, authority and prediction, testing and
decomposition). Slices 0, 1a, 1b and 2 (input ownership, as 2a and 2b) are
done; slice 3 (device session and view) is next. Updated 2026-11-07 for seats on one device session,
online seats and the first-person view requirements from 229.
Owner request, 2026-11-07: Workshop labs show game UI but not game controls
(no on-screen joystick, HTML arrow buttons outside the canvas, no Options such as
pinch zoom or movement mode). Rather than give labs another copy, make the game
itself modular and embeddable. Local split screen with up to four players
(including two players sharing one keyboard) drives the design. Labs may regress
temporarily, but should stay usable if that is cheap.

Long-term goal (owner, 2026-11-07): two shared-screen modes, built after basic
split screen.
- **Leashed shared screen:** players share one screen and cannot move off it,
  like classic 16-bit co-op action RPGs (owner reference: Secret of Mana).
- **Dynamic split:** players share one screen until one moves too far away,
  then the screen splits automatically and merges again when they regroup.

This sequence delivers fixed split screen only, but its structure must not
preclude either mode.
Related ideas: [local multiplayer and controllers](../ideas.md#local-multiplayer-and-controllers).
Owners: [embedded engine labs](../topics/embedded-engine-labs.md),
[gameplay scenarios](../topics/gameplay-scenarios.md),
[Steam Deck and menus](../topics/steam-deck-and-menus.md),
[rendering architecture](../topics/rendering-architecture.md).

## Findings (2026-11-07)

- **Two client shells.** The game is `GameClient → PlayScene`. Labs are
  `ScenarioPresentationHost → ScenarioClient → scenario Worker`, about 1,200
  lines in `src/scenarios/Scenario{PresentationHost,Client,WorkerHost,Replica,Protocol}.ts`.
  The lab host has its own version of `PlayScene.render` and of input composition.
- **Hand-written lab input.** WorldGeometry, NaturalLandscape, Characters,
  OutdoorGeometryTest, Physics and the interiors playtest each keep their own
  set of held keys and a row of HTML arrow buttons. The lab host reads the
  controller only for vehicle recipes, and only while the canvas is focused.
- **Input composition is tied to `PlayScene`.** `PlayScene.update` (input locks,
  steering normalization, tap/hold, trains, jump/horn/siren press edges, reverse,
  relative driving, quantization) depends on `GameContext`.
  `PlayInputController` depends on `PlayInputHost`.
- **Singletons that block multiple instances.** `controllerInput`,
  `controllerPointer`, `ActionManager` window listeners, and about 25 UI pieces
  appended to `document.body` or fixed to the page.
- **Full-window coordinate assumption.** `TouchJoystick` records and draws at
  screen (`clientX`) coordinates. `TouchButtons` lays out in CSS pixels but draws
  in canvas pixels. That is only correct for a full-window canvas whose
  resolution equals its CSS size.
- **Keyboard bindings used `KeyboardEvent.key`.** Resolved early during 229
  (owner request, 2026-11-07): `DEFAULT_ACTION_MAP` binds `KeyboardEvent.code`,
  so WASD keeps its positions on every layout and Shift cannot change a held key.
  Hints label each physical key with what it types on the player's layout
  (`KeyLabels.ts`: Keyboard Map API where available, otherwise learned from presses).
  Two simultaneous schemes and per-seat ownership remain phase 1 work.
- **Seams that already exist:**
  - `GameClient` takes its connection to the authority (`IClientTransport`)
    as a constructor argument.
  - `LocalServerRuntime` accepts a pluggable `LocalAuthority`, and
    `attachPeer` already supports several connections (P2P guests).
  - `ScenarioSession` encodes ordinary server messages and accepts `player-input`.
  - `GameClient` already wraps its connection in `NetEmulatedClientTransport`.
  - `OptionsDialog` is callback-only.
- **The renderer has no sub-viewport support.** Render hosts, cameras and
  cached raster surfaces assume one full-canvas view.

## Target architecture

- **Page shell (one per page):** menus, profiles, world registry,
  rooms/hosting, startup progress, fault reporting, fullscreen. Workshop pages
  use a minimal shell.
- **Device session (one per simulated device; normally one per page):** the
  two-pane physics lab hosts two on one page. One connection to the authority,
  one world replica (`ClientStateView`) and one predictor. The connection
  carries several seats, like controller ports.
- **Local player / seat (one per person):** input set, settings, the player's
  own prompts and the seat's controlled entity. Players exist independently of
  how the screen is divided.
- **Multi-seat prediction:** the single predictor replays all locally
  controlled bodies together, each with its own seat's inputs. Local players
  who push, ride or are leashed to each other are predicted against one
  world, never as each other's remote entities.
- **View (one per screen region):**
  - a viewport, a camera, scene presentation and HUD mounted in its own
    container
  - a **camera policy** that frames one or more local players: follow one
    player (fixed split screen), frame a group (shared screen), or a fixed
    camera for labs
  - explicit options instead of reading `location`/`window`

  Fixed split screen is one view per player; shared screen is one view for
  all players. Dynamic split changes the number of views and their shapes
  at runtime without touching players.
- **Input device router (one per page):**
  - Keyboard schemes are bound by `KeyboardEvent.code`. Scheme A is WASD with
    left-hand actions; scheme B is the arrow keys with right-hand actions. One
    player may own both.
  - Each standard gamepad, by index, is assigned to one seat.
  - Touch goes to a player by screen region: the view under the finger for
    split screen, or a per-player half of the screen when sharing one view
    (tablet co-op).
  - A page-level pad poller replaces the singletons. Touch coordinates are
    mapped into each view's rect.
- **Shared input composition:** a pure, Node-testable step that turns device
  state plus vehicle context into movement and semantic press events (horn,
  emergency, throw, jump pressed). Each seat's output is sent, tagged with its
  seat, over the device session's connection.
- **One render host, several viewports.** Assets and world caches are shared;
  each view gets a camera and a region. Fixed layouts: 1, 2 (side by side),
  3 and 4 (2×2). Regions may change every frame. The API should allow
  non-rectangular regions (e.g. a diagonal split line), so dynamic split does
  not need a new renderer contract later.
- **Authority:** the normal `LocalServerRuntime`. A connection is bound to
  one player session per seat. One input packet per device tick carries every
  local seat's movement under one sequence number; frames list a controlled
  entity per seat and one input acknowledgement per (connection, realm) stream;
  streaming covers the union of the seats' areas as a list of rectangles. (The
  lab protocol's `seat: 0 | 1` routes to separate replicas, so it is not
  precedent for this.)
  The same applies online: two local players joining a remote world use one
  connection with two seats. A recipe-world authority built from
  `ScenarioSession` staging serves Workshop labs.
- **Single-player call sites** keep a seat-0 shortcut for `playerEntity`
  and migrate to per-seat access gradually.
- **Lab instruments as plugins on a view:**
  - diagnostic overlays and dataset/diagnostic hooks
  - camera policies: fixed camera, pose cycle
  - admin/debug messages: teleport, place entity, step and clock control
    (the game protocol has `set-debug { paused }` only)

### Rejected: one connection per local player

Each local player could be a separate in-page client, as P2P guests are.
That needs almost no server change and works for fixed split screen. It is
rejected as the foundation for these reasons:
- In player 1's replica, player 2 is a remote (interpolated, delayed) entity.
  A shared view would show a laggy character, or disagree between replicas
  whenever local players touch.
- A leash would be evaluated against inconsistent worlds.
- Dynamic split would switch replica sources at each split/merge, so the
  transition would visibly jump.
- It costs N replicas and decode streams, and N network connections per device
  online.

It remains the fallback for fixed split screen only, if multi-seat prediction
proves infeasible.

### Online multiplayer with seats

Seats must work across devices. Example: device A with two seats on one screen
and device B with four seats in a 2×2 split, in one shared world. The
authority then has six player sessions on two connections. This works the same
for a dedicated server, a P2P host (the host's own seats sit on its local
Worker connection; guests' seats on their peer links) and WebRTC.
- Each device predicts only its own seats. Other devices' seats are ordinary
  remote players.
- Device-local rules (leash, group camera, dynamic split) apply only among
  seats of one device session and never constrain another device's players.
- Disconnecting a device removes all of its seats. Seats can join and leave
  on a live connection.

Things this must get right (current code: `Realm.sessions` and
`SessionRegistry` are keyed by connection `clientId`; interiors are separate
`interior~…` realms; a profile can occupy only one session):
- **Replication is per connection, not per seat.** Send one frame stream per
  (connection, realm), using the union of that connection's seats' interest
  areas. One stream per seat would duplicate shared data.
- **Seats in different realms.** If one seat walks through a door into an
  interior, the device holds one replica and predictor *per occupied realm*,
  shared by the seats in it. Alternatively a device-wide "party travel" rule
  moves all seats together. Shared-screen modes require the same realm.
- **Identity per seat.** Profile takeover rules mean one profile cannot fill
  two seats, so extra seats need guest identities or their own profiles.
- **Capacity counts seats, not connections:** player limits, P2P host CPU
  (a Chromebook hosting six players), downlink size for spread-out seats, and
  uplink (batch all of a device's seats into one input packet per tick).
- **Per-seat state:** permissions (editor/admin), chat names, gems, player
  markers.
- **Activity tickets.** [Entity activation](../topics/entity-activation.md)
  already unions player tickets (AI within 2/4 chunks, collision within 5)
  across players, so per-seat player tickets need nothing new. Camera tickets
  are different: today each session sends one visible range, but cameras belong
  to views. The connection should send its views' ranges, and per-seat rules
  that read "the player's visible range" (wildlife wake) use the view framing
  that seat. Dormancy after a disconnect applies to all of a device's seats.

The server therefore needs a **device session** object per connection that
owns its seats, replication streams, view ranges, lifecycle and device-local
rules (a leash is enforced by the authority, so it must know which seats share
a device). Each seat's player session keeps its body, player tickets, identity
and realm.

### A second view type: first person (229)

[229](229-first-person-view.md) delivers an experimental first-person view
with temporary glue that this sequence replaces. Design for it from the start, so
views are not hard-wired to the top-down camera:

- A camera policy can produce a 3D eye (position, yaw, pitch) as well as x/y/zoom.
- Input composition takes a movement frame from the seat's view: on foot,
  movement is camera-relative; vehicle-axis controls (steering cars, trains) stay
  unturned.
- A view's streaming/activation interest can be a radius or frustum, not only a
  screen rectangle (229 currently floors the fixed camera's zoom instead).
- One render host can mix viewport kinds: a 3D viewport shares the GPU host's
  Three.js renderer and loaded vehicle assets (`GpuRasterSurface` already owns a
  `WebGLRenderer`). Showcase: one player top-down beside another in first person.
- Per-view HUD: a crosshair, and no world-anchored markers in 3D views.

## Research results (2026-11-07)

Four read-only reviews answered the original research questions from code
(references as of `1ae31f5a`). Device measurements remain open (slice 1b).

- **Rendering.** The renderer already draws in view-local coordinates
  (`RasterRenderBackend.setView`); the remaining single-view assumptions are
  specific:
  - `TileRenderer.prepareTerrain` evicts every chunk outside its call's range,
    budgets per call and derives lookahead from the previous call. Per-view
    calls would re-raster every view every frame.
  - Caches count frames at `beginFrame`: the GPU texture LRU, car-image
    admission (same pose in the previous frame) and the mesh ready set.
  - `GpuOverlayResources` is keyed by surface ID and reuses only
    integer-shifted builds, so views at different zooms or with different
    cutaway observers alternate and rebuild every frame.
  - `EntityMeshPose` is view-owned and resamples after a visibility gap; per-view
    copies would disagree on wheels and heading. A mesh car in two views renders
    twice per frame without a same-frame image memo. The backend holds one
    interior resource.
  - A diagonal split needs no stencil: a half-plane mask in the GPU present
    shader or a Canvas path clip. Each diagonal view's bounds cover nearly the
    whole canvas, so collection and fill cost about 2× a full screen.
  - Cost follows per-view zoom. A 2×2 split on a 1280×800 Deck at zoom 1 shows
    about 13×8 tiles per view; at zoom 0.5 each view covers a full single view
    (about 4× collection, terrain and grass).
  - Baselines: no Deck frame-rate receipt exists. The Chromebook single-view
    driving receipt is already 16.7/33.4/50 ms p50/p95/p99 (216/217), and
    prediction shares the main thread.
- **Multi-seat prediction.** `PlayerPredictor` holds one predicted body and
  mount, rider lift, display error/correction anchor, state history, replay
  latches, one motor intent, one `active` gate and one presentation component.
  An `omitted` body holds the whole predictor; the 128-body budget is shared.
  Replay aligns all bodies to one acknowledged input tick. `CoopRecipe` already
  scripts push, opposed, glance, head, reverse and vehicle cases with both seats
  inside `PREDICTION_RADIUS`, so the spike needs no server change. Baseline: two
  predictors in `SharedPrediction.test.ts` (`maxCorrection < 16`).
- **Server seats.** The authority already simulates and tickets several sessions
  per realm (session-keyed `Realm.sessions`, camera-ticket union, per-session
  admission, `player:${id}` tickets, per-session wildlife wake). Connection
  coupling is in routing and replication: `SessionRegistry` keys,
  `GameServer.handleMessage`, `LocalServerRuntime.send`, one stream per session
  in `Realm.publishState`, `RealmReplicator.build` (one range, ack, player and
  physics anchor) and the wire format (input has no seat). Estimate: 500–700
  server/codec lines across about ten files.
- **Realms and identity.** Realm divergence is cheap on the server (`realmId`
  per session) and expensive on the client (`enterRealm` clears the state view,
  renderer and scene frame). `identify` evicts other sessions with the same
  profile and sends `kicked`, which through seat routing would kick the device.
  Guest seats skip takeover and persist under their session id. New
  `PlayerSession`s default to `editorEnabled = true`.
- **Decomposition.** Most DOM mounts are per page. The hard parts are non-DOM
  single-seat state: `RemoteStateView` (one player id, ack, mount, gems,
  invincibility), the visible range from one camera, one audio listener,
  world-map travel moving the connection, `MenuNavigation`'s global focus stack,
  the `controllerInput` single active pad (also used by the lab host and
  `EditorMode`), the `InputHints` last source and `location`/storage reads.
  Estimate: two to three slices.
- **Harnesses.** `memoryServer`, `LocalServerRuntime` with
  `WorkerClientTransport`, `RemoteStateView` + `PlayerPredictor` + codec,
  `ActionManager.pressKey`, fake-canvas touch controls and `RecordingBackend`
  already run in Node. Before slice 0 no test ran `PlayScene.update` or
  `PlayInputController`, and the smoke keyboard case checked pixels, not
  movement. Do not add jsdom/happy-dom: `MenuNavigation` decides visibility
  from `getClientRects`.
- **Labs.** Labs need the device session and view plus a recipe-world
  authority, not seats or split screen. Six pages hold about 460 lines of
  private input, and `ScenarioPresentationHost` about 55 lines of vehicle input
  with a third composition (`CarControls`, `ScenarioReplica`) lacking horn,
  siren, throw and jump-press edges. The five shell modules
  (`ScenarioPresentationHost`, `ScenarioClient`, `ScenarioWorkerHost`,
  `ScenarioReplica`, `scenario.worker`) are about 1,100 lines at `1ae31f5a`, plus
  68 lines of delay emulation (`OrderedLatency`) and about 610 lines of shell
  tests. The two-pane physics lab is two replicas with a delayed guest link and a
  three.js collider view: two device sessions on one page, not two views.

## Corrections to the target architecture

- **One input timeline per device.** One sequence number per device tick; each
  input packet carries every local seat's movement; frames carry one
  acknowledgement per (connection, realm) stream. Per-seat acknowledgements are a
  test assertion, not a protocol field. `PlayScene.cancelInput` (an extra,
  off-cadence sequence) and locked input skipping `storeInput` become neutral
  input for that seat, so the shared timeline keeps advancing.
- **Interest is a list of rectangles per connection** for visible ranges,
  replicator filters and a multi-anchor physics snapshot, never a bounding box.
- **Frames and views are separate render steps.** One `beginFrame` per display
  frame, then `beginView(region, camera)`/`endView()` per view; regions never go
  through `resize()`. Terrain is prepared once per frame over all view ranges
  with one budget, then collected per view. Mesh poses and presentation belong
  to the device session. Overlay caches key on zoom and observer state.
- **Input composition is wider than `PlayScene.update`:** E/F place controls
  (`VehicleControl`, `DoorControl`), door walk-through from `lastMovement`,
  click/tap interaction and `cancelInput`. Touch controls scoped to a view rect
  must map CSS to canvas pixels (lab canvases are 960×640 shown at 100% width).
- **Keyboard routing.** A focus rule per page shell (the game listens on
  `window`; Workshop form fields keep their keys), one owner for global keys
  (Escape, Tab, F3, console, zoom digits) when two schemes are active, and a
  real-keyboard rollover check.
- **Party travel** (if chosen) needs a follow path that skips the walk-through
  approach check, safe arrival per seat, rollback when one transfer fails, one
  realm-entered message per device, and startup pulling extra seats into seat
  0's realm.
- **Pause** is per session today (`debugPaused`). A device pause sets every seat
  and never pauses another device.
- **Isolation between seats.** A crowded seat must not stall the others
  (per-seat required set); an idle local seat stays on predicted time while
  another seat pushes it.

## Phasing

Prove the two uncertain parts first (multi-seat prediction and multi-view render
cost) behind a safety net; the remaining work is refactoring of known shape that
can proceed in parallel. Each slice fixes its exit list before work starts, gets
one independent review, fixes confirmed findings and commits. Work outside the
exit list goes to the next slice's backlog. Spikes are time-boxed and end in a
recorded decision. Device performance runs are owner checkpoints.

0. **Safety net (no behavior change).**
   - Characterize single-player input before code moves: a Node harness runs the
     real `PlayScene` and `PlayInputController` with a fake `GameContext` and a
     recording transport.
   - A shrink-only allow-list of files importing the lab shell.
   - Delete unused `ScenarioPresentationHost` options.
   - One touch case and one lab case join the smoke suite for this sequence.
1. **Spikes (parallel, separate worktrees).**
   - **1a, multi-seat prediction (Node only, no server change).** One predictor
     fed only by `ScenarioSession` seat 0's stream over `COOP_CASES`; both seats
     share one sequence with delayed inputs and frames. Measure per-seat maximum
     correction and past-tick error, contact gap at render fractions, status,
     replay steps/ms against one seat, convergence, and the two-predictor
     comparison. A guest beyond the prediction radius records why a
     multi-anchor snapshot is needed. Go: corrections no worse than two
     predictors and replay within its budget.
   - **1b, multi-view render.** `?views=1|2|4|diag` in the real game: view 0
     follows the player, others follow NPCs or fixed offsets (no seats or
     input). Adds `beginView`/`endView`, a reused world target, union terrain
     preparation and shared presentation/mesh poses. An in-page
     `__viewBench({views, seconds})` reports frame-interval percentiles,
     intervals over 25 ms, render CPU, uploads, overlay builds, mesh-image
     misses, terrain pending, texture bytes and heap; the existing benches gain
     `--views`. Take the Deck baseline first, then measure production builds at
     zoom 0.5 and 0.75 on the Chromebook and Deck.
   - **Render go/no-go.** Two views meet the single-view contract (p99 ≤16.8 ms,
     at most 0.5% of intervals over 25 ms, render CPU p95 ≤8 ms; driving no
     worse than the same-run one-view baseline). Four views: p95 ≤16.8 ms, p99
     ≤33.4 ms, at most 2% over 25 ms, render CPU p95 ≤11 ms; otherwise retest
     with a fallback ladder (grass, shadow receivers, halo, sprite mesh cars,
     particles). Warm: uploads per frame no more than one view, no overlay
     builds, terrain pending zero in every view, texture bytes under 64 MiB
     without LRU churn, no GL allocations while regions resize, flat heap over
     60 s.
   - Owner checkpoint: results, zoom policy and layouts.
2. **Input ownership.** Pure per-seat composition (including place controls)
   with one sequence per device tick, view-rect touch, pad assignment by index,
   the keyboard focus rule and two schemes. The interim lab adapter stays under
   about 50 lines: labs get the game's controls, `ScenarioSession.input` accepts
   horn/siren/throw, and the physics lab runs two input sets. The same slice
   deletes page-private lab input and the host's vehicle input.
3. **Device session and view** with the camera-policy interface, a recipe-world
   authority (a `LocalAuthority` over `ScenarioSession` staging) and the view
   plugin surface (follow camera, admin teleport/clock/reset, per-frame
   diagnostics hook). `GameTestHooks` stays compatible. A Biome
   `noRestrictedGlobals` override (`window`, `document`, `location`, storage,
   `navigator`) covers the new session/seat/view directory. Exit: the
   WorldGeometry car fixtures run on the game view.
4. **Parallel work.**
   - **4a, labs one at a time:** the rest of WorldGeometry, Outdoor,
     Characters, Interiors, NaturalLandscape (pose cycle, interior presenter
     and custom cameras as view plugins). Decide `ENGINE_REVIEW_REVISION` per
     lab when pixels or framing change. Delete `ScenarioPresentationHost` when
     its last consumer moves.
   - **4b, server seats (separate code):** `connectionId`/`seat` on
     `PlayerSession` (seat 0 keeps the bare connection id), streams per
     (connection, realm), seat-tagged messages, multi-rectangle interest and
     multi-anchor snapshots, join/leave-seat, travel policy, guest identities
     and device pause, proven end to end on `memoryServer`.
5. **Production multi-seat prediction and split screen in the game.** Join
   flow, layouts, per-view HUD and prompts, per-player hints, the audio listener
   policy and device performance gates.
6. **Physics lab as two device sessions**, then delete `ScenarioClient`,
   `ScenarioWorkerHost`, the scenario Worker entry, `ScenarioReplica`, delay
   emulation and `ScenarioSession`'s guest path.

Lab code is deleted in slices 2, 4a and 6 rather than in one final phase.
`ScenarioSession` stays as the headless harness and recipe-world opener.

### Later: shared-screen modes (separate tacticals)

- **Group camera policy:** frame all players in one view, within zoom limits.
  The streaming range covers the framed area.
- **Leash:** a maximum distance between players, enforced by the shared
  simulation so authority and prediction agree. This is a gameplay rule, not
  client-side clamping. Vehicles need a soft limit (e.g. throttle falloff), not
  a sudden wall. The rule applies per device session, so other devices'
  players are unaffected.
- **Dynamic split:** when the group no longer fits in one view, divide the
  screen along the line between the players, then merge when they regroup.
  The transition must stay readable for young players.
- **Prompts in a shared view** anchor to each player's character or that
  player's side of the screen, not to a per-view corner.

## Lab policy during this sequence

Labs keep their current capability until they move onto the game view (slice 3
onward). Shared changes supply only minimal adapters (the input set, render
host API changes). Lab-only features may regress temporarily when preserving
them would block a slice. Record each regression here and in the embedded
engine labs topic, and resolve it in that lab's migration slice rather than by
maintaining both shells. The shell import allow-list only shrinks.

## Decisions

- Open: zoom per layout. Proposed: measure 0.5 and 0.75 in slice 1b and decide
  on readability and cost.
- Open: who are local players 2–4? Proposed: guests of the host profile, with a
  seat-tagged `identify` so chosen profiles can follow.
- Open: do split-screen players go indoors separately? Proposed: party travel,
  keeping `realmId` per seat so per-realm replicas remain possible.
- Open: does split screen pause everyone when one player opens the menu
  (proposed: yes), and which player controls a menu (proposed: the opener)?
- Proposed: the two-pane physics lab becomes two device sessions on one page.
- Decided: make the game modular and embeddable rather than extend the lab
  shell; labs may regress temporarily. Owner, 2026-11-07: labs move once the
  device session and view exist (slice 3), not after split screen.
- Decided (owner, 2026-11-07): the slice phasing above, each slice reviewed by
  an independent Opus 5.5 high-effort session through Yep Anywhere before
  commit.
- Decided (owner, 2026-11-07): focus on the basic refactor. Unreachable train
  driving input is deleted rather than characterized. XR support may be removed
  entirely where that simplifies input, view or render work; it is not a
  constraint on this sequence.
- Decided: seats on one device session (one connection, one replica, one
  predictor), including online; one connection per local player is the
  fallback only.
- Decided: fixed split screen first; leashed shared screen and dynamic split
  are the long-term goal, and seats and views are separate concepts from
  phase 4 onward so those modes need no further restructuring.
- Proposed: one render host with viewports instead of one canvas per player.

## Validation approach

- **Characterization first.** Slice 0 pins current single-player input on the
  pre-refactor code. Later slices keep those tests passing or explain each
  intended difference in the slice record.
- **Native tests own** composition, bindings, the router, pad assignment,
  touch-rect mapping, layout maths, prediction, server seats, terrain
  preparation across views, cache keying, and paired listener add/remove on
  session/view teardown.
- **Browser boundaries (only these):** two keyboard schemes with real
  `KeyboardEvent.code`; the joystick in a canvas that does not fill the window
  (CDP touch); per-backend region pixels including the diagonal; Options focus
  returning to the opening view; two-seat Worker save/reload; two mocked pads in
  split screen. Physical pad mapping is a Deck acceptance check, since
  Playwright mocks `navigator.getGamepads`. Playwright serves `vite preview` of
  `dist/`, so build before browser reruns.
- **Per-slice review checklist:** characterization unchanged or differences
  explained; the replaced path deleted in the same slice; seat-0 shortcuts
  (`playerEntity`, `seats[0]`, `views[0]`) do not grow outside an allow-list;
  every mount and listener has a removal; the code-health ratchet does not grow;
  `art:catalog` and `workshop:manifest` regenerated after render/input changes;
  `streaming:bench -- --assert-ready` after streaming changes.
- **Performance** gates are defined in slice 1b and repeated on devices in
  slice 5.

## Progress

- 2026-11-07: research reviews complete; phasing, corrections and decisions
  recorded above.
- 2026-11-07, slice 0 (safety net, no behavior change):
  - `src/scenes/playInputCharacterization.test.ts` runs the real `PlayScene`,
    `PlayInputController`, `ActionManager`, controller input, touch controls,
    tap movement and `Camera` with a fake `GameContext` (canvas shown at half
    CSS size with an offset) and a recording transport. Twenty-three cases pin:
    - keyboard movement (quantized axes, sprint, diagonal normalization, reverse
      only in cars) and the jump press latch;
    - storage/door/menu locks (neutral input on the shared sequence, no
      prediction, held keys kept, `lastMovement` zero);
    - blur and `visibilitychange` clearing held input with an extra neutral
      command;
    - steering versus direction cars, the horn refresh (about 0.2 s; every 13th
      tick today), siren/style press edges ignoring keys held while boarding,
      warning-vehicle beacons, throw force/direction;
    - joystick, gamepad stick and A, and tap movement; boarding and hits
      cancelling destinations; pause; editor mode on enter/resume; zoom hotkeys
      bound only while playing; desktop click interaction with CSS-to-canvas
      mapping and the post-touch click window; camera follow.

    Seeding single-line faults into `PlayScene` and `PlayInputController` in an
    isolated worktree: all twenty behavioral faults fail the suite. Removing
    `PlayScene`'s camera placeholder guard is equivalent (`followPlayer` already
    ignores id −1). Two assertions are expected to change in slice 2 by design:
    locked ticks become stored neutral input, and `lastMovement` moves into
    per-seat composition.
  - Still unpinned, to characterize at the start of slice 2 before they move:
    E/F place controls (`VehicleControl`, `DoorControl` and
    `GameClient.updatePlaceControls`, which have no unit tests), hold movement
    mode, befriend taps and tap-mode clicks. Train driving and XR input are not
    characterized (owner decision below).
  - `src/scenarios/LabShellConsumers.test.ts` fixes the twelve files in `src`,
    `tests` and `scripts` that import the lab shell (any import form, including
    `?worker` URLs and `vi.mock`); the list may only shrink. Indirect use through
    an allowed file stays a review item.
  - Removed unused `ScenarioPresentationHost` options: `step()`,
    `selectRenderer()`, `cameraOffsetY` and `authoredTrains` (the default).
  - Smoke gains two `@smoke`-tagged cases through a second project: real touch
    gestures/Jump/resize targeting (`tap-movement.spec.ts`) and the Canvas
    WorldGeometry lab Worker movement/reload case (28 smoke cases).
  - Finding for slice 2: since `8f405aaf` (2026-11-03) `occupiedVehicle` returns
    only `vehicle-v1:` entities, so `PlayScene`'s train branches (train tap,
    `isTrain(vehicle)` steering exceptions) and `TrainTapMovement` are
    unreachable; inside train driving is deferred in the trains topic. Delete
    them in slice 2 unless inside driving returns first.
  - The Shift stuck-key defect was fixed separately by `1ae31f5a` (code-based
    bindings with tests), so slice 0 adds no test for it.
  - Review: an independent Opus 5.5 high-effort session through Yep Anywhere
    found two blocking gaps (the boarding siren case was vacuous; the hidden-page
    case skipped `visibilitychange`). Both were fixed and verified by seeded
    faults, then ACCEPT. Its claim that `ScenarioClient.step()` was dead was
    withdrawn (the physics lab's Step button uses it).
- 2026-11-07, slice 1a (multi-seat prediction spike): **go**, conditional on
  multi-anchor physics snapshots (slice 4b).
  - `PlayerPredictor` gains additive co-seat replay: `storeInput` takes the
    other local seats' movement keyed by controlled body, replay applies every
    seat's motor intent on the same tick with per-seat jump edges
    (`SeatInputs.ts`), co-seat bodies always present at predicted time, and
    diagnostics report `seatCorrections`. Without co-seats behavior is
    unchanged (all 16 predictor/replica/state-view test files pass). The
    ratchet baseline for `PlayerPredictor.ts` rises 983 → 1,014 lines;
    complexity is unchanged. A seat absent from an input has left: replay stops
    holding it, and only the latest input's co-seats join the presentation
    group. The primary seat's intent wins if a co-seat key collides with it.
  - `src/client/MultiSeatPrediction.test.ts` runs every `COOP_CASES` case
    against one authority twice with identical deterministic delays (remote:
    inputs +4–6 ticks, frames +5–7; local: +1/+1): two predictors fed by their
    own streams (today's shape) versus one predictor fed only by seat 0's
    stream with both seats in each input. Truth is the authority's physics pose
    at each tick; each view's first committed pose per tick is compared.
  - Results (pixels; remote / local):

    | Measure | Two predictors | One predictor |
    | --- | --- | --- |
    | Cross-view disagreement about a seat | up to 17.06 / 4.69 | 0 / 0 |
    | Seat 1 largest correction (push, reverse) | 4.27–4.33 / 1.07–1.09 | 1.07–1.13 / 0.53–0.55 |
    | Seat 0 largest correction | 7.36 / 2.27 (push) | same or lower |
    | Other player as shown in a view (push) | 13.98 / 4.69 | 10.68 / 2.41 (= own view) |
    | Presented collider overlap (push/reverse) | 0.49–0.73 | 0–0.5 |
    | Replay steps per run (halved by construction: shared acks) | 2,520 / 1,032 | 1,260 / 516 |

    A guest jump under remote delay corrects about 12 px in both shapes;
    acknowledgements of both seats match every tick when one packet carries
    both commands. Wall time roughly halves (M-series Node, informational).
    The comparisons sample predicted ticks only, so the test pins how many are
    missing: none, except in the vehicle case below.
  - Limit: a seat outside the primary seat's snapshot is not predicted at all.
    In the vehicle case the car outruns the walking seat, which then goes
    unpredicted in its own view for 39 (remote) / 52 (local) of 260 ticks versus
    0 with two predictors; a guest 400 px away is never predicted. Slice 4b's
    multi-anchor snapshot (one anchor per seat) is therefore required before
    slice 5 ships multi-seat prediction.
  - Not covered: what players see. The harness compares raw committed poses;
    today each seat's own predictor smooths its own correction, while a co-seat
    outside the primary's correction group snaps. Presentation activity also
    follows the primary seat only, so an idle primary can drop a moving co-seat
    to buffered poses. Also untested: a co-seat driving, seats in different
    realms, and more than two seats.
  - Carried into slice 4b/5: measure replay ms with two seats' bodies in one
    multi-anchor snapshot (the halving above assumes today's body count), make
    presentation activity and display smoothing per seat, and keep seat ids in
    step with mounting and leaving.
  - Review (Yep Anywhere, Opus 5.5 high): CHANGES REQUESTED. Blocking: the
    correction and overlap assertions passed even if seat 1 was never
    predicted; fixed by pinning unpredicted ticks. Optional findings on stale
    seat ids, key collisions and the per-step map were fixed (`SeatInputs.test.ts`
    covers departure and jump edges); the rest are the limits above.
    Re-review: ACCEPT.
- 2026-11-07, slice 1b (multi-view render spike; code kept off main at tag
  `spike-226-1b`, commit `9cea3260`; only this entry and the receipts merged):
  - **Result (Steam Deck): cadence go, render CPU open.** Frame cadence holds
    the 90 Hz panel in every layout and zoom except 4-view and diagonal mesh
    driving at zoom 0.5 (p95 22.3 ms), which sprite cars restore. The
    render-CPU gate as written (two views ≤8 ms and no worse than one view
    when driving; four views ≤11 ms) passes only in the city at 0.75, city 2-
    and 4-view at 0.5, and 4-view driving with sprite cars; one view driving at
    0.5 already takes 9.0 ms. Owner checkpoint: rebase the
    render-CPU limits for the 90 Hz panel's 11.1 ms frame or treat those cells
    as fails that need the car-image memo and fallbacks. Chromebook: not
    measured (see limits); its gate stays open for slice 5.
  - Built: `?views=1|2|4|diag|sweep` in the real game (GPU + 3D mesh default).
    View 0 follows the player; spectator cameras sit at fixed offsets within
    about one screen. `RenderHost.beginView(camera, region)`/`endView()` reuse
    the GPU world target (per-view clear, region viewport or half-plane mask in
    the present shader; Canvas path clip); one `beginFrame` per display frame.
    `TileRenderer.prepareTerrainViews` prepares the union of every view's halo
    once per frame with one budget and per-view lookahead; views then collect
    only. Scene frame, mesh poses and particles are shared. The server gets the
    bounding box of the view ranges. `__viewBench({views, seconds, zoom,
    motion, fallback})` switches layouts live and reports cadence, render CPU,
    uploads, overlay builds, mesh-image misses, terrain rows/pending and
    missing data per view, texture bytes, GL object creation and heap.
    `scripts/benchmark-views.ts` drives it on a production build (local preview,
    packaged Deck Electron or Chromebook Chrome over CDP);
    `scripts/summarize-views.mjs` prints the table below (both on the tag).
  - Native tests (on the tag): union preparation keeps two distant views
    resident, does no warm work and spends one shared row budget on both visible gaps
    (`TerrainPreparation.test.ts`); 2/4/diagonal frames draw N world passes with
    no warm uploads and every view's chunks resident (`SplitViews.test.ts` on
    `RecordingBackend`; per-view preparation seeded as a fault fails it);
    layouts tile odd canvases exactly with complementary diagonal halves. No
    browser pixel test was added; screenshots were checked by eye.
  - Protocol: production build in the packaged Electron 44 app on the Deck
    (1280×800, DPR 1, Gamescope, AC, saves isolated), city sprint walk and
    racetrack drive (bounded back-and-forth so repeats stay outdoors), zoom 0.5
    and 0.75, 10 s unrecorded priming, 4 s warmup, 8 s samples, two repeats in
    reversed layout order, 60 s cool-down per scene (k10temp 54→61 °C).
    The Deck panel runs at **90 Hz** (11.1 ms); a 22.2 ms interval is one missed
    vsync and stays under the 25 ms count.
    Receipts: [Deck](../benchmarks/226-split-views-steam-deck.json),
    [sprite cars](../benchmarks/226-split-views-steam-deck-sprite-cars.json),
    [sprite cars, no grass](../benchmarks/226-split-views-steam-deck-sprite-cars-no-grass.json).
    They record `e12ad12c` and `8676e706` with uncommitted edits; the tagged
    tree is believed to match what was measured but was not re-run.
  - Results (worst of two repeats; render = `GameClient.render` CPU p95;
    ratio = render p95 over the same repeat's one view). Gate = cadence /
    render CPU against the written thresholds; the diagonal uses the two-view
    gate:

    | scene, zoom | views | frame p50/p95/p99 ms | >25 ms | render p95 ms (ratio) | gate |
    |---|---|---|---|---|---|
    | city 0.5 | 1 | 11.1/11.2/11.2 | 0% | 6.0 | baseline |
    | city 0.5 | 2 / sweep | 11.1/11.2/11.2 | 0% | 7.1 (1.40) / 7.5 (1.50) | pass / pass |
    | city 0.5 | 4 | 11.1/11.2/11.2 | 0% | 9.9 (1.84) | pass / pass |
    | city 0.5 | diag | 11.1/11.2/11.6 | 0.28% | 10.1 (2.00) | pass / fail (> 8) |
    | city 0.75 | 1 / 2 / 4 / diag / sweep | 11.1/11.2/≤11.3 | 0% | 4.7 / 5.4 / 5.9 / 6.2 / 5.7 | pass / pass |
    | drive 0.5 | 1 | 11.1/11.2/11.3 | 0% | 9.0 | baseline (> 8 ms alone) |
    | drive 0.5 | 2 / sweep | 11.1/11.2/11.4 | ≤0.14% | 9.4 (1.09) / 9.8 (1.14) | pass / fail (> baseline) |
    | drive 0.5 | 4 | 11.1/22.3/22.4 | 0.17% | 13.2 (1.51) | fail / fail |
    | drive 0.5 | diag | 11.1/22.3/22.3 | 0.16% | 12.5 (1.45) | fail / fail |
    | drive 0.75 | 1 | 11.1/11.2/11.2 | 0% | 6.6 | baseline |
    | drive 0.75 | 2 / diag / sweep | 11.1/11.2/≤11.6 | ≤0.14% | 8.8 / 8.4 / 9.6 | pass / fail (> 8, > baseline) |
    | drive 0.75 | 4 | 11.1/11.2/22.2 | 0.14% | 11.3 (1.71) | pass / fail (> 11) |
    | drive 0.5, sprite cars | 1 / 2 / 4 / diag | 11.1/11.2/≤11.3 | ≤0.14% | 7.8 / 8.7 / 9.7 / 10.0 | pass / 4-view pass only |
    | drive 0.5, sprite cars, no grass | 1 / 2 / 4 / diag | 11.1/11.2/≤11.3 | 0% | 5.2 / 7.5 / 9.7 / 8.7 | pass / 4-view pass only |

  - Warm checks: overlay builds 0 in every split sample (one in a one-view
    sample); no view ever had visible chunks loaded but unready, though terrain
    preparation still ran (rows 240–320 for one view, 384 for four, 767–825 for
    sweep; maximum pending 5–6 in every run); texture bytes ≤ 27.6 MiB with no
    LRU churn. Uploads per frame were 0.008–0.032 against 0.011–0.026 for one
    view: most split cells exceed the written "no more than one view" check
    (up to 2.2×, four-view driving at 0.5: 0.024 vs 0.011). First-seen sprite
    pages over the larger area are a plausible cause, not measured. `sweep` resized regions every frame (≈700 distinct
    regions per 8 s) with no framebuffer creation in the city; its texture
    creations equal its sprite uploads. Driving creates textures/framebuffers in
    every layout, including one view (car-image admission targets). 60 s of
    four views in the city: heap 56–88 MiB sawtooth, floor flat, frame p99
    11.3 ms. Mesh-image misses rise from 6.2/frame (one view) to 12.6 (four)
    and 14.6 (diagonal) while driving: moving mesh cars re-render per view.
  - The fallback ladder stopped after one pass: sprite cars alone restore
    four-view and diagonal driving cadence at zoom 0.5. Shadow receivers, halo
    and particles were not needed or tested; grass removal mainly lowers the
    one-view cost.
  - Review (Yep Anywhere, Opus 5.5 high): CHANGES REQUESTED for merging the
    branch; recommended merging only this entry and the receipts with the gate
    verdicts and warm wording corrected (done here; two re-review rounds
    tightened the render-CPU and upload verdicts, then ACCEPT). Single-view
    rendering was verified unchanged without `?views`. Before slice 3 harvests
    the code:
    split views share one `SceneFrame`, so a view that does not draw a roof or
    slab deletes its fade record and the fade over the player restarts every
    frame (`presentSurfaceScene.ts`/`SurfacePresentation.ts`; inferred from
    code, not seen at runtime) — keep fade state per view or prune once per
    display frame. Also: the per-view fallback when a backend lacks
    `prepareTerrainViews` evicts other views' chunks (throw instead), the
    raster backend ignores `scope: "visible"`, layouts are rebuilt every frame,
    the Canvas path does not clear its 2 px padding between views and was not
    measured, the bench forces mesh cars on, and nothing tests the GPU
    region/mask present math.
  - Keep for slice 3: `beginView`/`endView` and the world-target reuse with
    region/mask present (`GpuRasterSurface.beginView`, `presentWorld(region,
    mask)`, Canvas clip), `prepareTerrainViews` (TileRenderer, backends,
    `RecordingBackend`) with its tests, `layoutViews` and the shared-frame
    render loop shape (`renderSplitViews`). Throwaway: the module-level active
    view set, `splitFallback`, fixed spectator offsets, the visible-range
    bounding box, the `PlayScene` branch, prototype-chained view contexts and
    `__viewBench` wiring (keep the bench idea as a lab/diagnostic plugin).
  - Limits: Chromebook not measured. The first attempt walked through a door
    (indoor samples) and its rerun could not start: the ChromeOS browser was
    swapping (8 GB, ~7 GB swap) at ~95% CPU, and DevTools stopped answering. The
    owner's session was not restarted. One device and one session per scene;
    driving is one depot car on a short segment, not a lap or the 96 crowd lab.
    Per-view HUD, markers and prompts are not drawn. Spectator views are cameras,
    not seats, so there is no second predicted player or seat input. The server
    range is one bounding box (fine within one screen; slice 4b replaces it with
    a list of rectangles). Motion is a back-and-forth under one 256 px chunk
    (about 500 px of travel per 8 s driving, 1,030 px walking), so the warm
    checks never cover entering new chunks with several views on one shared
    budget. Diagonal views collect and fill about two full screens. Render CPU excludes GPU time. The absolute 8 ms single-view render
    budget already fails on the Deck when driving at zoom 0.5 with one view.
  - Next: a same-frame car-image memo (frame-scoped targets reused by later
    views) before slice 5, re-measure four-view/diagonal mesh driving at 0.5,
    and measure the Chromebook when it is healthy. Owner checkpoint: zoom
    policy (0.75 for 3–4 players) and layouts.
- 2026-11-08, slice 2a (input ownership, part 1: characterize, then delete train
  and XR input). Slice 2 was split at its natural seam so each half gets its own
  review; 2b carries the per-seat composition, schemes, pad and touch routing and
  the lab adapter.
  - Characterization added before any composition moves (Node):
    - `src/client/PlaceControls.test.ts` (11 cases) pins the E/F wiring:
      vehicle prompts claim E ahead of doors (including while storage pause
      locks the vehicle button), exit with the same key, F runs equipment
      beside a dump truck while E still drives, door walk-through only after a
      fresh approach and 0.1 s of movement toward the door, sideways/backwards
      never, walk-through requests skip neutral input and begin the door
      presentation (a failed trip cancels it), E/F act only in play with input
      unblocked, a busy presentation drops door requests and locks the vehicle
      button, locks and overlays stop walk-throughs, and teardown removes the
      subscriptions. The wiring moved verbatim from
      `GameClient.updatePlaceControls` and its two action handlers into
      `src/client/PlaceControls.ts` so it can run with the real
      `VehicleControl`, `DoorControl` and `ActionManager` against a minimal DOM
      stand-in.
    - `playInputCharacterization.test.ts` gains pointer cases (35 tests; the
      original 23 are unchanged apart from two removed harness fields): hold
      mode walks toward the held point, yields to manual input and is released
      by a lock; hold in a steering car aims in world space and slows within
      24 px; tap-mode clicks set a destination instead of interacting; a
      befriendable animal under a tap is befriended on foot (destination
      cancelled) but becomes a destination for drivers; hold mode befriends but
      never sets a destination; a touch tap keeps the destination resolved at
      touch start even if the finger drifts before lifting, and suppresses the
      following click; a short joystick-mode touch tap interacts at the point;
      storage pause, door transition, open menu or another scene drop clicks,
      destination taps and befriend taps in every movement mode, including a
      tap that began before the lock.
    - Seeded single-line faults in `PlayScene`, `PlayInputController`,
      `TouchTap` and `PlaceControls`: 38 of 38 fail the suites (two cases were
      tightened after their faults survived a first run). Not pinned: the
      `GameClient` host getters (which movement the door sees, the overlay
      set, `playing`); 2b replaces them with the seat's composed movement.
  - Deleted train driving input (unreachable since `8f405aaf`):
    `TrainTapMovement`, the train branches in `PlayScene`, `PlayInputController`
    and `firstPersonPlay`, the half-screen `screenSide` target, the
    `TouchHold` train mode, the touch **Whistle** label and train exceptions in
    reverse and steering, and the lab host's train branch. Server train
    services, calling and roof riding are unchanged. Trains, vehicles and touch
    movement topics record the removal.
  - Deleted XR: `src/xr/XRSessionManager` (and its test), the **Enter VR** menu
    button, `GameContext.xrActive`, the XR gamepad/throw hooks (`GamepadPoller`
    folded into `ActionManager`), the reusable `captureFrame(target)` parameter
    (`captureFrame()` always returns an independent snapshot; the GPU browser
    case asserts that instead of reuse), the `webxr` tsconfig types and the
    direct `@types/webxr` devDependency (it stays installed through
    `@types/three`).
  - Ratchet baselines tightened: `PlayScene` 811 → 792 lines (worst complexity
    128 → 104), `GameClient` 982 → 931, `TouchButtons` 275 → 267 (35 → 30),
    `ScenarioPresentationHost` 525 → 498; `ActionManager` and `XRSessionManager`
    leave the baseline.
  - Validation: focused vitest (scenes, client, input, core, ui, render hosts,
    lab host, lab-shell guard), `tsc` for all four configs, Biome, knip,
    ratchet (only other sessions' `src/rendering` failures), regenerated
    `art:catalog`/`workshop:manifest` (line references only), production build,
    Playwright smoke and the edited GPU capture case in bundled Chromium: 27 of
    28 smoke cases and the GPU case pass. The failing smoke case
    (`vehicle-placement`, "Get out") is environmental and predates this slice:
    on this Mac's Dvorak layout Chromium's Keyboard Map labels physical E as
    ".", so the button reads "Get out · ." and the test's `[EY]` hint pattern
    fails after reload (before reload a touch source hides the hint).
  - Review (Yep Anywhere, Opus 5.5 high): ACCEPT, no blocking findings. Optional
    findings fixed: pointer input under locks and outside play was unpinned
    (added; a fault in `onDestinationTap`'s lock guard only failed once a lock
    lands mid-tap), the vehicle button's busy/blocked lock was unpinned, the
    touch-start claim was not distinguishable from touch end, the `webxr`
    wording, a stale research reference and a line wrap. The `GameClient` host
    getters stay a review note until 2b replaces them. Re-review: ACCEPT (it
    also agreed the smoke failure is the Dvorak hint label, not this slice).
- 2026-11-08, slice 2b (input ownership, part 2: per-seat composition and lab
  input):
  - `src/input/SeatComposer.ts` is the pure per-seat composition: locks,
    vehicle rules (no jump, reverse, relative steering only for manual or
    joystick input), quantization, the horn refresh, siren/style press edges
    that ignore keys held while boarding, throw charge and aim, the jump edge
    and `lastMovement`. It returns the seat's messages around its movement
    command. `devicePacket` builds one packet per device tick: every seat shares
    the sequence, seat 0 is today's `player-input` and other seats ride along as
    `SeatMovements` keyed by controlled body (the vehicle when driving), which
    `predictInput` now forwards to the slice 1a predictor. `PlayScene` keeps
    device sampling (keys, pad, joystick, first-person turning, tap/hold
    destinations) and calls the composer; `lastMovement` is a getter onto it.
    All characterization (the original 23, slice 2a's pointer cases and
    `PlaceControls`) passes unchanged.
  - Pure pieces with Node tests, no split-screen UI yet: `KeyboardSchemes`
    (one player keeps today's full map; two sharing players get disjoint
    left/right one-handed schemes, provisional, and the page owns global keys);
    `KeyFocus`, wired into `ActionManager` through an optional lab `root` (the
    game page still takes every key; a lab takes keys, pads and pad commands
    only while focus is inside it and not on a form control, and releases held
    keys when focus leaves); `PadAssignment` by `Gamepad.index` (one seat: every
    pad drives it; several: a pad joins the lowest free seat on a press and keeps
    it until it disconnects); `ViewRect`, used by `TouchJoystick` and
    `TouchButtons` to lay out and hit-test in canvas CSS pixels and draw scaled,
    with optional regions and `viewAt` for split screen. The full-window game
    canvas is unchanged.
  - Labs: `src/scenarios/LabInput.ts` (about 60 lines of code) gives
    `ScenarioPresentationHost` labs the game's play keys (Tab, Escape and digits
    stay with the page), pads, touch joystick and buttons (drawn only on touch
    screens) and the composer; E/F reach the vehicle control. Presses travel on
    the seat's ordered input path: `ScenarioClient.submitPress` →
    `ScenarioSession.input`, which accepts horn, siren and throw (the unused
    horn/siren `ScenarioCommand` kinds were removed). Deleted: the host's
    vehicle key/pad handlers, controller sampling and car-input merge, and the
    private keys, HTML arrow buttons and Characters D-pad of World geometry,
    Natural landscape, Characters and Asset movement, plus the physics lab's
    key set and touch arrows. The physics lab runs one `LabInput` per pane.
  - Deferred, with reasons:
    - Storing locked ticks as neutral predictor input and replacing the extra
      `cancelInput` sequence with per-seat neutral input move to slice 5. With
      one seat every lock is device-wide, and the change alters prediction
      during doors and menus, so it ships with per-seat locks.
    - The furniture/interiors playtest keeps its own input through a
      transitional host `input` option until slice 4a. Its automatic walk and
      place mode are lab instruments, and its D-pad and Jump button drive the
      view offset under browser tests.
    - The page-level pad poller replacing the `controllerInput` singleton is
      slice 3; the real-keyboard rollover check for two schemes is a slice 5
      device acceptance item.
    - `LabShellConsumers` does not shrink: the pages still construct the host.
  - Lab regressions (recorded in the embedded labs topic): the physics lab's
    WebGL panes cannot draw touch controls, so touch drags steer but have no
    Jump until slice 6; the Characters D-pad becomes a drag on the scene.
  - Ratchet baselines tightened: `PlayScene` 792 → 734 lines (worst complexity
    104 → 79), `ScenarioPresentationHost` 498 → 465, `PhysicsPage` 425 → 343,
    `WorldGeometryPage` 459 → 369 (one fewer over-limit function),
    `NaturalLandscapePage` 902 → 839, `TouchButtons` 267 → 266.
  - Validation: `tsc` for all four configs, Biome, knip, ratchet (only other
    sessions' `src/rendering` failures), focused vitest (80 files, 842 tests),
    38 of 38 seeded single-line faults across the new code fail the suites
    (five needed added cases first; one exposed a host test whose 25 ms frames
    sometimes ran two updates), regenerated inventories (line references only),
    production build, and Playwright in bundled Chromium: smoke 27 of 28 (the
    same Dvorak hint-label failure as 2a) and all 51 lab and input specs
    (world geometry including phone joystick touch, pair physics, characters,
    outdoor, natural landscapes, furniture playtest, vehicle workshop, train
    recovery, car controls, scenario lifecycle, jump park, tap movement).
  - Review (Yep Anywhere, Opus 5.5 high): CHANGES REQUESTED for one blocking
    finding: labs on desktop kept enabled but undrawn touch buttons, so a click
    near a lab canvas's lower right jumped or threw and blocked canvas focus.
    Fixed: `LabInput` enables action buttons only on touch screens (rechecked
    each tick); a host test clicks the Jump position with `maxTouchPoints` 0 and
    5 and fails if the fix is reverted. Also taken: `devicePacket` rejects two
    seats controlling the same body, and the host test checks presses precede
    movement. Left as notes: throws on the press path skip the command path's
    validation (as in the game's `GameServer` path); a siren or throw press is
    dropped if the session is briefly not accepting, and a jump pressed while a
    lab is paused fires on resume; `throwDirection` still lives under
    `scenes/`; `board()` must precede `tick()` each tick. The reviewer accepted
    all four deferrals and the adapter's size. After the fix the six lab specs
    that touch lab canvases were re-run on a fresh build (24 passed).
    Re-review: ACCEPT.
- 2026-11-08, cleanup before slice 3 (from the 2b notes):
  - The car hint tests (`vehicle-placement`, `vehicle-paint-gameplay`,
    `roadkill`) accept any short key label after "·", so the smoke suite no
    longer fails on a Dvorak layout where the Keyboard Map labels physical E as
    ".".
  - `throwDirection` moved from `src/scenes/playThrow.ts` to
    `src/input/throwDirection.ts`; `SeatComposer` no longer imports `scenes/`.
  - Throw validation (finite values, force 0..1, unit direction) is one
    `isValidThrow` in `RealmCommands`: `throwBall` drops invalid throws on every
    path (game server, lab presses) and the lab command path still reports them.
  - `LabInput.skip()` drops jump and horn presses and a charging throw while a
    lab is paused or busy, or a physics pane is scripted (callers invoke it on
    ticks they do not play), so they no longer fire on resume.
    `SeatComposer.board()` documents that it precedes `tick()`.
  - The spike's `tilefun_viewbench` Devkit title was deleted from the Steam Deck
    (`steamos-delete`, plus its leftover launch files).
  - Review (Yep Anywhere, Opus 5.5 high): ACCEPT. Optional findings taken: a
    throw released during a pause no longer throws on resume, scripted physics
    panes skip, and the hint pattern allows at most three characters (so a
    broken label such as `undefined` still fails).
