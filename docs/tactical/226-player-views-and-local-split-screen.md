# Player views and local split screen

Status: phasing set 2026-11-07 after four read-only research reviews (input
and labs, rendering and performance, authority and prediction, testing and
decomposition). Slices 0, 1a, 1b, 2 (input ownership, as 2a and 2b), 3a
(render views), 3b (device session and view objects) and 3c (the recipe-world
authority, lab client and lab view surface, with the WorldGeometry car fixtures
on the game view) are done, as are 4a-i (all of World geometry on the game
view) and 4a-ii (Outdoor geometry). The other 4a parts (Characters, Interiors
playtest, Natural landscape) and 4b (server seats) are next. Updated 2026-11-07 for seats on one device session,
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
- 2026-11-08, slice 3 plan. Split at its seams, each part reviewed and committed:
  **3a** render views on main (below); **3b** device session, seat and view
  objects in a restricted-globals directory with the camera-policy interface,
  the game made thin over them (`GameTestHooks` and the input characterization
  unchanged); **3c** the recipe-world authority and view plugin surface, ending
  with the WorldGeometry car fixtures on the game view. 3b and 3c fix their exit
  lists before they start.
- 2026-11-08, slice 3a (render views, harvested from `spike-226-1b` with the 1b
  review's fixes; the single-view game is unchanged and no page draws two views
  yet). Exit list, all met:
  - `RenderHost.beginView(camera, region)`/`endView()` on the Canvas, GPU and
    selectable hosts; `beginWorld`/`endWorld` are the whole-canvas view through
    the same code. The GPU world target is reused (a later view clears it) and
    composed through a GL viewport or a half-plane discard; the composition moved
    out of `GpuRasterSurface` into `GpuWorldComposition`, with its maths in the
    pure `worldComposite`. The Canvas host clips to the region or polygon.
  - `layoutViews` (1, 2, 2×2, diagonal) tiles any canvas exactly, and
    `ViewLayouts` keeps the same regions until the layout or size changes (1b
    rebuilt them every frame).
  - One terrain preparation per frame over every view: `TerrainResidency` (split
    out of `TileRenderer`, which shrinks 649 → 608 lines) keeps every view's halo,
    ranks a shared chunk by the view that shows it, uses per-view look-ahead and
    focal rows, and never evicts another view's chunks. `prepareTerrainViews` is
    required on every backend (no per-view fallback) and refuses visible-only
    preparation; `presentTerrain(..., prepared)` lets each view only collect.
  - Slab fades are per view (`presentSurfaceScene`'s `fades`, defaulting to the
    `SceneFrame` map for single-view callers), so a view that does not draw a
    slab no longer restarts another view's fade (1b shared one map).
  - 1b's Canvas padding note: the clear pass already fills the padded view, and
    the Canvas host now also clears its world surface before every later view of
    a frame (as the GPU host clears its target), so a view that leaves pixels
    transparent never shows the previous view. The bench's forced mesh cars and
    the rest of the 1b throwaway list were not harvested.
  - Tests: Node cases for layouts and caching, the composite sampling and
    half-plane maths, Canvas composition calls, multi-view preparation (shared
    budget, residency, ranking, focal rows, refusal, disposal), per-view fades and
    a split frame on `RecordingBackend` (one preparation, N terrain passes, no
    warm uploads). Browser: renderer lab `probeViewRegions` in
    `gpu-renderer.spec.ts` renders 2, 4 and diagonal views on both hosts and
    compares each region with a single view of its size (pixel-identical, worst
    error 0), then cycles layouts with no textures, framebuffers or renderbuffers
    created.
  - Seeded faults: 20 of 20 single-line Node faults and 3 of 3 browser faults
    (GPU viewport, shader discard sign, Canvas clip) fail the suites; four needed
    added cases first (duplicate shared jobs, per-view focal row twice, pruning a
    view's own fades) and one more for the disposed check. The review fixes add
    two more (the Canvas later-view clear and its per-frame reset), both caught.
  - Ratchet: `GpuRasterSurface` 979 → 962, `TileRenderer` 649 → 608 (one fewer
    over-limit function), `SelectableRenderHost` 108 → 104; also the cleanup's
    `ScenarioSession` 429 → 423 and `PhysicsPage` worst 45 → 38. Two files other
    sessions had already pushed over baseline grow slightly with this slice:
    `RasterRenderBackend` +5 (`prepareTerrainViews`) and `presentSurfaceScene`
    +1 (the `fades` parameter).
  - Validation: `tsc` for all four configs, Biome, knip, focused vitest (130
    files, 1,276 tests), regenerated inventories, production build, Playwright
    `gpu-renderer`, `embedded-geometry-rendering`, `outdoor-presentation`,
    `world-geometry` and `car-projection` (35 passed) and smoke 28 of 28.
  - Review (Yep Anywhere, Opus 5.5 high): ACCEPT, no blocking findings; it
    confirmed single-view equivalence line by line and that the browser probe
    cannot pass vacuously (reference views use a different target-to-region
    offset). Optional findings taken: the GPU host restores the GL viewport even
    if a partial present throws, the Canvas host clears before later views (the
    two backends now agree for views that leave transparency), a duplicate
    shared-chunk test removed, and the single-view record releases the caller's
    range. Left for 3b: the view loop ends views in `finally` (a throw mid-view
    leaves `WorldRasterFrame` active); per-view look-ahead moves to the View (it
    is keyed by view index here); 3b must use or delete `prepareViewTerrain`,
    `ViewLayouts`, `VIEW_LAYOUTS` and `presentTerrain`'s `prepared` (test-only
    callers today); `RenderRegion` and the input layer's `ViewRegion` should be
    merged when 3b joins them. Not covered by a test: the GPU later-view clear of
    decals and depth (the probe content has neither).
- 2026-11-08, slice 3b (device session and view objects; game and lab host on
  them, still one view each). Exit list, all met:
  - `src/session/` with a Biome `noRestrictedGlobals` override (`window`,
    `document`, `location`, `localStorage`, `sessionStorage`, `navigator`).
  - `DeviceSession`: the replica, the shared `SceneFrame`, the prediction
    lifecycle (start, resume, stop), one `reconcile(reset, mountId)` /
    `predict(seq, movement, dt, coSeats)` path, seat 0's world readiness (moved
    out of `GameClient`) and `clearPresentation()`, which the message router
    calls on every world load and realm exit to clear the frame and every view's
    slab fades. `PlayScene` and `ScenarioReplica` both use it;
    their duplicated reset-and-reconcile code was deleted. The two reset-mount
    policies stay explicit: the game seats a reset on its gameplay mount
    (`mountEntityId`), labs on the player's parent; unifying them would change
    game prediction for seated drivers and is left for slice 5.
  - `View`: camera, region (from `ViewLayouts`), observer-local slab fades (no
    longer on `SceneFrame`; one-off callers of `presentSurfaceScene` keep none)
    and a `CameraPolicy` (`followSeat`, `fixedCamera`; `beforeInput` says whether
    it is placed before the step's input or after the predicted step). `GameClient.camera` is seat
    0's view camera, so `GameTestHooks` is unchanged; `GameContext` gains
    `session` and `view` (seat-0 shortcuts `camera`, `stateView`, `sceneFrame`
    remain).
  - One outdoor world draw, `drawViewTerrain` + `drawViewScene`, and the frame
    loop `renderViews` (terrain prepared once over every view's world-frame
    range, every view ended in `finally`, no camera left in world scope).
    `PlayScene` renders through it (`renderPlayViews`), EditScene keeps
    `renderWorld`/`renderEntities` on the same draw, and `ScenarioPresentationHost`
    lost its own camera follow, terrain and scene-collection code (465 → 454
    lines, now under the ratchet limits).
  - Characterization: the 35 play cases and 11 `PlaceControls` cases pass
    unchanged (the harness gained `session` and `view`); one case was added for
    reconcile-before-predict and the door-transition reset, which the harness
    never covered.
  - Native tests: `DeviceSession` (lifecycle, reset rules, mount choice,
    co-seat prediction order, readiness, disposal), camera policies, view region,
    `renderViews` (one preparation with the world-frame ranges, region order,
    views ended on a throw, scope released when a range or preparation throws),
    `drawViewScene` (own fades on the shared frame, room hook, release on throw),
    `renderPlayViews` (one preparation per frame, headless path) and
    `ScenarioReplica`'s reconcile policy (in `CoopWorker.test.ts`, so the shell
    import list does not grow). 24 of 24 seeded single-line faults fail
    the suites (three needed tightened cases and two the new tests first); after
    the review fixes 28 of 28.
  - From the 3a review: the view loop ends views in `finally`; the 3a staging
    exports now have production callers (`prepareViewTerrain`, `ViewLayouts`,
    `presentTerrain`'s `prepared`) except `VIEW_LAYOUTS`, which was deleted.
    Deferred to slice 5: per-view look-ahead keyed by view rather than index
    (view count and order are fixed until split screen), merging `RenderRegion`
    with the input layer's `ViewRegion` (when touch regions join views), and
    seat objects (the composer stays in `PlayScene` and `LabInput` until seats
    gain their own input sets).
  - Ratchet: `PlayScene` 734 → 653 lines (worst complexity 79 → 50),
    `GameClient` 931 → 927, `ScenarioPresentationHost` leaves the baseline.
  - Validation: `tsc` for all four configs, Biome, knip, focused vitest,
    regenerated inventories, production build, Playwright smoke 28 of 28 and 76
    game and lab specs (world geometry, embedded geometry rendering, characters,
    outdoor, natural landscapes, pair physics, furniture motion, interiors, car
    controls, GPU renderer, player markers, building doors, jump park, vehicle
    placement, prediction recovery, racetrack).
  - Review (Yep Anywhere, Opus 5.5 high): CHANGES REQUESTED for one blocking
    finding: slab fades had moved onto the view but nothing cleared them on a
    world load or realm exit (previously `sceneFrame.clear()` did), so leaving a
    building or switching worlds kept a deck's stale fade. Fixed with
    `DeviceSession.clearPresentation()` from the router (router test updated),
    and `SceneFrame.surfaceFades` deleted. Optional findings taken: the reconcile
    mount is a required argument (a lab's undefined parent no longer falls back
    to the game's mount; PlayScene passes `mountEntityId` and the
    characterization case pins it), camera policies carry `beforeInput` so labs
    leaving the host need not repeat the fixed-versus-follow timing, the host's
    redundant frame clear went, and indoor drawing documents that it still uses
    seat 0's camera. A new host case pins the follow camera moving after the
    predicted step. The reviewer verified behaviour preservation for the game
    and labs otherwise and agreed to keep the two reset-mount rules explicit
    until slice 5 (the parent rule is the general one).
- 2026-11-08, slice 3c is split: **3c-i** the recipe-world authority and lab
  client, proven in Node; **3c-ii** the lab view surface with the WorldGeometry
  car fixtures on it. Owner, 2026-11-08: run 3c, 4a, 4b and 5 autonomously, each
  part reviewed through Yep Anywhere and committed; the open decisions take the
  proposals above (recorded under Decisions when first used).
- 2026-11-08, slice 3c-i exit list:
  - `RecipeWorldAuthority`: a `LocalAuthority` over `ScenarioSession` staging,
    served by the game's `LocalServerRuntime` from
    `src/scenarios/recipe-world.worker.ts` (Worker port wiring shared with the
    game Worker). Seat 0 is the runtime's `local` connection and speaks the game
    protocol (`player-input`, horn/siren/throw presses, `visible-range`); frames
    and syncs leave through the runtime's transport with the game's
    backpressure. Two-seat recipes are refused (the physics lab keeps the
    scenario Worker until slice 6).
  - Lab admin requests: an `admin` packet on the local host channel, ordered
    with game messages and answered by a result; `GameServer` has no handler, so
    the runtime refuses them. Open; clock run/pause (a paused lab never advances
    the realm, while the loop heartbeat keeps the watchdog satisfied); step
    (paused only); commands (teleport, place entity, enter/exit/recover vehicle,
    equipment, call train, throw, view range); reset and reload, announced with
    `world-loaded` so the client clears as on a realm change; diagnostics
    (timings and collision). Every result follows a full snapshot. A failed
    open, reset or reload fails the authority.
  - `RecipeWorldClient`: `WorkerClientTransport`, a `DeviceSession` over
    `RemoteStateView` and a predictor with the recipe's gravity; state applied
    at the start of the lab's tick as in `GameClient`; reconcile on the lab
    parent-mount rule; one sequence per tick through `devicePacket`; presses on
    the same ordered path; admin calls resolve after their snapshot is applied;
    dispose shuts the Worker down.
  - Native tests on an in-process Worker through the real port wiring: input,
    presses and visible range, admin requests and errors, fences, pause freeze
    and heartbeat, reset/reload clearing, prediction parity with direct
    `ScenarioSession` steps, lifecycle (shutdown terminates the Worker, failures
    surface, the game authority refuses admin).
  - No page uses it until 3c-ii; `LabShellConsumers` is unchanged and the new
    code imports no shell module.
- 2026-11-08, slice 3c-i done (exit list met):
  - **Authority:** `RecipeWorldAuthority` serves the recipe world through the game runtime.
    - The Worker port wiring moved into `serveLocalAuthority`, shared by `local-server.worker.ts` and `recipe-world.worker.ts`. The runtime no longer imports `GameServer` itself.
    - `ScenarioSession` takes an optional link (connection id and transport), so seat 0's messages go straight to the runtime.
    - Recipe validation moved to `prepareScenarioRecipe`. The lab replica rules (recipe appearances, movement normalization) are shared by both lab clients.
    - Play is accepted only from `local`, only while the clock runs and only when no instrument is changing the world; otherwise it is dropped, as the client stops sending.
    - The authority keeps the camera's last range. It streams it while paused and into every new world, teleport and step.
  - **Admin channel:** `shared/` may not import `scenarios/`, so the `admin` payload is opaque below the lab layer and the authority parses it.
    - `WorkerClientTransport.admin()` consumes packets while a request is outstanding; after `start()` the game pumps manually.
    - The request bookkeeping moved to `LocalHostRequests`. Requests still outstanding when the Worker stops now settle instead of hanging.
  - **Client:** `RecipeWorldClient` lives in `src/client/`, because `scenarios/` may not import client code.
    - Diagnostics are read beside play.
    - Work cut short by dispose is not a failure.
  - **Tests:** native tests on an in-process Worker that uses the real port wiring (`src/server/testing/InProcessWorker.ts`).
    - The step test shows the authority matching direct `ScenarioSession` steps through the transport. Prediction convergence is proven by a real-time case.
    - The transport suite now runs through the same wiring, so the Worker entry's probe, duplicate-init and unhandled-rejection paths are covered.
  - **Seeded faults:** 71 seeded single-line faults; 70 fail the suites, several only after added cases. The survivor drops the client's `sync-cvars` filter, which cannot be observed in-process because the rig shares the page's gravity global.
  - **Ratchet:** `ScenarioSession` 423 → 406 lines, `WorkerClientTransport` 383 → 379.
  - **Validation:**
    - `tsc` for all four configs, Biome on the changed files, knip, focused vitest (88 files, 892 tests), regenerated inventories (line references only) and a production build.
    - Playwright smoke 28 of 28, plus `scenario-lifecycle`, `scenario-scheduling`, `p2p-worker`, `worker-server`, `jump-park` and `pair-physics`.
    - `src/wildlife/BallCommands.test.ts` fails on the unchanged base too, as do repo-wide Biome errors in unrelated files.
  - **Review** (Yep Anywhere, Opus 5.5 high): ACCEPT.
    - Should-fix taken: a paused lab lost its camera range after reset or teleport.
    - Optional findings taken: diagnostics no longer block play, the rig moved under `server/testing`, failures after dispose are ignored, outstanding requests settle at shutdown, and the Worker entry's failure paths have tests.
    - Re-review: CHANGES REQUESTED. The range fix stored a `view-range` command's range before the session validated it, so a refused range failed every later request. The range is now kept only after the session accepts it, with a test.
    - Second re-review: ACCEPT.
  - **Carried into 3c-ii:**
    - Wire visibility as the game does.
    - Clear the renderer on a new world.
    - Document the recipe-world Worker and admin channel in the client–server and embedded-labs docs once a page uses them.
- 2026-11-08, slice 3c-ii exit list:
  - **`LabView`** (`src/client/`): the lab view surface. It is built from `RecipeWorldClient`, one `View`, `LabInput`, `renderViews` with `drawViewTerrain` and `drawViewScene`, `VehicleControl`, `GameLoop` and the selectable render host. It imports no lab shell module.
    - Plugins: the camera policy (default `followSeat`), admin commands and reload, a per-frame hook, surface visibility, zoom, pause and terrain pacing.
    - A hidden page, a pause or an instrument in flight stops play; the camera's range streams while paused through `setVisibleRange`.
    - A new world (open, reset, reload) clears the renderer through a client hook, as the game router does, beside the replica and device presentation; the camera snaps to the new world.
  - **Shared with the old host:** the lab scene draw and the presentation diagnostics move into one module that both use, so the two shells cannot drift while labs migrate.
  - **World geometry:** the page picks the surface by fixture. `car-bridge`, `car-garage`, `car-dynamics` and `car-jumps` run on `LabView`; the other fixtures stay on the old host until 4a. `LabShellConsumers` is unchanged, because the page still imports the host.
  - **Tests:**
    - Node: `LabView` on the real authority through the in-process Worker with a recording render host. Covers the lifecycle and visibility, follow camera and streaming, pause, commands and reload clearing the renderer, failure and disposal.
    - Browser: `vehicle-geometry` (`car-garage`; `car-dynamics` default, ramp, bed and tow), `jump-park` and the `car-garage` case of `gpu-renderer`. Smoke, `world-geometry` and `scenario-scheduling` also run, for the fixtures that stay on the old host.
  - **Review revision:** `ENGINE_REVIEW_REVISION` is unchanged if framing and pixels are unchanged; a capture compares the old and new surfaces on `car-garage`.
  - **Docs:** the client–server and embedded-labs docs describe the recipe-world Worker, the admin channel and `LabView`.
- 2026-11-08, slice 3c-ii done (exit list met):
  - **`LabView`** (`src/client/LabView.ts`) is the lab view surface: `RecipeWorldClient`, one `View` (camera policy option, `followSeat` by default), `LabInput`, `VehicleControl`, the production `GameLoop` and the selectable render host, with no lab shell import.
    - Pause, a hidden page and in-flight client work stop play. Lab commands no longer pause the clock as the old host did: the authority does not tick while an instrument is busy, and the client refuses play meanwhile.
    - A hidden page also stops the authority's loop through `WorkerClientTransport.setHidden`, as `main.ts` does for the game.
    - While paused, each tick hands the camera's range to `setVisibleRange` (deduplicated; the authority streams it). This replaces the old host's `view-range` command from `render()`.
    - Commands and reload snap the camera after their answer. The client's new `onWorldLoaded` hook clears the renderer's world caches on a new world, as the game router does.
    - The view registers with its device session, so a new world also clears its slab fades. The old host now does the same: its view is registered, and `ScenarioReplica.clear()` (on a reset or reload) clears the device presentation.
    - Behaviour differences from the old host for these fixtures:
      - inputs queued before a command apply after it, where the old host's pause discarded them (the client replays them too, so the two agree);
      - reload snaps the camera and clears the renderer;
      - a hidden page stops the authority's loop;
      - as before, a new world does not reset held input or particles (the game router's `clearPlayInput` has no lab counterpart yet).
  - **Shared with the old host:** `src/client/LabScene.ts` (not `src/session/`, whose files stay free of `RenderHost` types) holds `drawLabFrame` and `labPresentationDiagnostics`. The old host draws and reports through them (453 → 404 lines), so the two shells cannot drift while labs migrate. `LabDiagnostics` is the type both satisfy.
  - **World geometry:** `src/workshop/GeometrySurface.ts` holds the page's surface interface, the shared options, `labViewSurface`, the fixture set and the per-frame dataset writer (moved from the page). The page keeps the old-host adapter, so it remains the only `LabShellConsumers` entry involved and the list is unchanged. `WorldGeometryPage` leaves the ratchet baseline (369 lines, worst 33 → under the limits).
  - **Finding:** Rapier's WASM bindings read timing through `window` when one exists, so a bare `EventTarget` stubbed as `window` in Node crashes the authority's physics step. The `LabView` tests give the stub the real `performance`.
  - **Tests:**
    - `LabView.test.ts` (11) runs the real authority on the in-process Worker with the real client, input, vehicle control and camera policies; only the render host is a `RecordingBackend` with spies. `LabScene.test.ts` (3) pins the shared draw's option mapping.
    - Browser: `vehicle-geometry` and `jump-park` now assert that the car fixtures load `recipe-world.worker`.
    - `CoopWorker.test.ts` covers `ScenarioReplica.clear()` clearing a registered view's fades.
  - **Seeded faults:** 64 single-line faults over the new code; 61 fail the suites (the first run caught 48, and the gaps became tests). The review fixes added 4 more (both view registrations, the replica's presentation clear, the horn order), all caught. Survivors:
    - the follow policy's fixed-step tick, which is not observable while a presentation clock writes the actual camera each frame (as in the game);
    - an early return after a refused input, which `LabView` never reaches because it already excludes the paused and busy states that make the client refuse;
    - particle ageing, which the browser contact-effects spec catches.
  - **Review revision:** `ENGINE_REVIEW_REVISION` is unchanged. A build with a temporary switch (not committed) captured both surfaces after pausing:
    - camera framing was identical on all four car fixtures, and `car-jumps` was pixel-identical;
    - the remaining differences are time-dependent content (the parked mesh car's suspension settling, the grass wind phase), within the old host's own run-to-run variation (on `car-garage`: 0.51% old against old, 0.31% old against new).
  - **Validation:**
    - `npm run typecheck`, Biome on the changed files, knip, the ratchet (only other sessions' `src/rendering` entries fail), focused vitest (166 files, 1,567 tests), regenerated inventories and a production build.
    - Playwright: `vehicle-geometry` (7), `jump-park`, `world-geometry` (5), `scenario-scheduling`, the `gpu-renderer` `car-garage` case and smoke 28 of 28.
    - After the review fixes, on a fresh build: those specs plus `furniture-motion` (the old host's room path), `character-presentation` (pose cycle), `pair-physics` and `scenario-lifecycle`, 27 of 27.
    - One earlier batch had a single `character-presentation` timeout under two-worker load. It then passed 10 of 10 times.
  - **Review** (Yep Anywhere, Opus 5.5 high): ACCEPT, no blocking findings. It confirmed parity with the old host for the car fixtures, the command fence without a clock pause, the hidden-page ordering, the shared draw and the `ENGINE_REVIEW_REVISION` evidence.
    - Optional findings taken: register the view so a new world clears its slab fades (both shells), a deterministic horn-order assertion, a busy-lock test separated from the clock change, the behaviour differences above, and a browser re-run of the old host's room path and pose cycle.
    - Not taken: moving `LabScene.ts` to `src/session/` (the `RenderHost` boundary).
    - Re-review: ACCEPT.
  - **Carried into 4a:**
    - The transport's channel diagnostics in `RecipeWorldClient.getDiagnostics()` for traffic (`scenario-scheduling`), then make `LabDiagnostics.authority.channel` required again.
    - Plugins the remaining labs need: overlay, underlay and `uiOverlay` hooks; the pose cycle (displayed player, `presentedPlayer`, `presentationAlpha`); the interior room view with its presentation cleared on dispose; `resize` and `captureFrame`; scripted input and `step`; explicit options in place of `location.search` reads.
- 2026-11-08, slice 4a is split into one part per lab, in this order: 4a-i the rest of World geometry, then Outdoor geometry, Characters, Interiors playtest and Natural landscape. `ScenarioPresentationHost` is deleted with its last consumer.
- 2026-11-08, slice 4a-i exit list (the rest of World geometry):
  - **Every World geometry fixture on `LabView`:** deck, garage, crossing, tree-house, outskirts-park, realm (with `?crowd=`), traffic, traffic-crowd, racetrack, shopping, train and the generated crossings. Fixed diagnostic frames use the `fixedCamera` policy, as on the old host. The `nature-*` fixtures belong to Natural landscape, a later part.
  - **The page:** the old-host adapter and the per-fixture choice go. With one surface left, the page drives `LabView` directly, with no adapter interface. The page imports no lab shell module and leaves `LabShellConsumers`.
  - **Traffic diagnostics:** `RecipeWorldClient.getDiagnostics()` reports the transport's outgoing channel (its high-water marks). It also reports a live clock: the authority's ticks, advanced by the frames applied since its last answer. That lets `scenario-scheduling` watch the authority outrun a stalled client. `LabDiagnostics.authority.channel` becomes required again.
  - **The realm benchmark's** `__physicsSample` keeps working through the admin diagnostics.
  - **Tests:**
    - Node: the live clock (it advances with frames, holds while paused and restarts with a new world) and the channel diagnostics.
    - Browser, for the moved fixtures: `world-geometry`, `scenario-scheduling`, `scenario-lifecycle`, `embedded-geometry-rendering`, `generated-crossing`, `rail-crossing`, the embedded `train-recovery` case, `underground-garage`, `vehicle-audio`, `vehicle-geometry`, the World geometry cases of `gpu-renderer`, and smoke.
  - **Review revision:** `ENGINE_REVIEW_REVISION` is unchanged if the framing is identical and the remaining pixel differences are time-dependent. A capture comparison against the old host settles it.
  - **Docs:** the embedded-labs topic.
- 2026-11-08, slice 4a-i done (exit list met):
  - **World geometry is on `LabView`:** every fixture runs on the game's lab view and the recipe-world Worker, apart from `nature-*`, which belongs to Natural landscape. That covers the car fixtures (3c-ii), deck, garage, crossing, tree-house, outskirts-park, realm (`?crowd=`), traffic, traffic-crowd, racetrack, shopping, train and the generated crossings.
    - The page drives `LabView` directly. The old-host adapter, the per-fixture choice and the adapter interface were deleted. `GeometrySurface.ts` became `GeometryFrame.ts`, which holds only the dataset writer.
    - The page no longer imports the lab shell and left `LabShellConsumers`.
  - **Traffic diagnostics:** `RecipeWorldClient.getDiagnostics()` reports the transport's outgoing channel through a new `WorkerClientTransport.channelDiagnostics()` (also used by its fault report). The file stays at its ratchet limit of 379 lines through two equivalent compressions.
    - It also reports a live clock: the last answer's ticks, advanced by the frames' `serverTick` since that answer arrived. A paused world's streamed frames repeat its tick, and a new world's answer re-bases the clock.
    - `scenario-scheduling` again sees the authority outrun a stalled page. `LabDiagnostics.authority.channel` is required again, and the spec's `?.` is reverted.
  - **The realm benchmark's** `__physicsSample` works through the admin diagnostics. A temporary browser check called it with and without reset; both answers returned timings and collision counters.
  - **Tests:**
    - `RecipeWorldClient`: a new case covers the live clock (no answer yet, steps, running between answers, close to the authority's own answer at a lab's tick rate, held while paused and streaming, restarted by a new world) and the channel.
    - `WorkerClientTransport`: the failure case checks the queue snapshot taken at the failure, and the startup-failure case checks that every Worker handler is released.
    - `LabView` (from 3c-ii): the diagnostic-camera case was sensitive to CPU load, because it assumed one tick per frame. It now checks each input's camera, pose and range as the input is sent, and that the camera stays a tick behind the player after the step.
  - **Seeded faults:** 13 single-line faults; 12 fail the suites. The first run caught 7 of 12, and the gaps became tests.
    - A first-draft clamp on the clock was removed: it held the old count while a new world's frames arrived ahead of its answer.
    - Survivor: taking the clock base from the answer's ticks instead of the frames' server tick. The two are equal while the realm's tick counter equals the authority's ticks, as it does now (reset and reload build a new realm).
  - **Review revision:** `ENGINE_REVIEW_REVISION` is unchanged. A build with a temporary switch (not committed) captured both hosts on all 14 moved fixtures after pausing.
    - Camera framing, player position and traffic count were identical on every fixture. Deck, garage and crossing were pixel-identical on every run.
    - The other differences are time-dependent content (grass wind phase, moving traffic and animals), within each host's run-to-run variation. On tree-house, one old run is pixel-identical to a new one; on shopping, old against old ranges from 0% to 1.35%.
  - **Validation:**
    - `npm run typecheck`, Biome on the changed files, knip, the ratchet (only other sessions' `src/rendering` entries fail, as on HEAD), focused vitest (95 files, 926 tests), the regenerated manifest and a production build.
    - Playwright: `world-geometry` (5), `scenario-scheduling` (plus 5 repeats), `scenario-lifecycle`, `embedded-geometry-rendering`, `generated-crossing` (3), `rail-crossing`, `underground-garage` (3), `vehicle-audio` (2), `vehicle-geometry` (7), `jump-park`, the two `gpu-renderer` traffic cases, the embedded `train-recovery` case, and smoke 28 of 28.
  - **Review** (Yep Anywhere, Opus 5.5 high): CHANGES REQUESTED, with one blocking item that was a test fix only. The reviewer confirmed the exit list, fixture parity with the old host's deleted adapter, the live clock in every state, the channel quantity, the page cleanup and the `ENGINE_REVIEW_REVISION` evidence.
    - Blocking: the 3c-ii diagnostic-camera case failed when run on its own, as it did at HEAD. A walk input still in flight replays one tick on top of the teleport, so the case now asserts the camera at the predicted pose within 16 px, like the other command-snap case.
    - Optional findings taken:
      - assertions that the frames' server tick equals the authority's ticks;
      - an accurate channel comment;
      - a note in the performance topic that realm benchmark captures from before this part are not directly comparable (they ran on the scenario Worker).
    - Also fixed while re-checking: the clock case's upper bound now allows for frames arriving a batch per pump, so CPU load no longer fails it.
    - Not taken: a Node test for the moment between a new world's frames and its answer. The in-process rig cannot order that batching, and the invariant assertions cover it.
    - Re-review: ACCEPT.
  - **For the next parts:** `WorkerClientTransport` is at its ratchet limit of 379 lines, so its next change must split it.
- 2026-11-08, slice 4a-ii exit list (Outdoor geometry):
  - **`LabView` plugins:**
    - `underlay` and `overlay` hooks that collect diagnostic drawing into one owned `OverlayFrame`, submitted as overlay passes at the old host's points (after the terrain, after the scene). Its items are released after each frame and cleared on dispose.
    - A `pixelExactShadows` option.
    - `presentedPlayer` and `presentationAlpha`, which the hooks read (the pose cycle's displayed player comes with Characters).
  - **The movement test** (`OutdoorGeometryTest`, shown by the Outdoor and Vehicles workshop pages) builds `LabView` directly and leaves `LabShellConsumers`. Its reset is a teleport command, as before.
  - **Tests:**
    - Node: the hooks' pass order and contents, nothing submitted for an empty collection, release after each frame, clearing on dispose, and the `pixelExactShadows` mapping.
    - Browser: `outdoor-presentation` (both renderers; it now expects the recipe-world Worker), the movement case of `outdoor-workshop`, and the walker case of `vehicle-workshop`. (`family-sheets` and `player-dev-reload` do not touch this lab.)
  - **Review revision:** `ENGINE_REVIEW_REVISION` is unchanged if a capture against the old host shows identical framing and pixels within its run-to-run variation.
  - **Docs:** the embedded-labs topic.
- 2026-11-08, slice 4a-ii done (exit list met):
  - **`LabView` plugins:**
    - `underlay` and `overlay` hooks collect into one owned `OverlayFrame`. Each is submitted as an overlay pass through `drawLabFrame`'s existing callbacks (after the terrain, after the scene); an empty collection submits nothing. The items are released in the render's `finally` and the frame is cleared on dispose, as in the old host.
    - A `pixelExactShadows` option (false by default).
    - `presentedPlayer` (the replica's `presentedPlayerEntity`) and `presentationAlpha` (the frame's alpha). The pose cycle's displayed-player override comes with Characters.
  - **Outdoor geometry:** `OutdoorGeometryTest` (shown by the Outdoor and Vehicles workshop pages) builds `LabView` with the `fixedCamera` policy and otherwise the same options. It no longer imports the lab shell and left `LabShellConsumers`.
  - **Tests:**
    - `LabView`: a new case covers the hooks: pass order and contents, each hook starting from an empty frame, the presented camera (framed from the presented pose, so it differs from the actual one), the presented player and fractional alpha the hooks see, no pass for an empty collection, one owned frame released after each display frame and cleared on dispose, and `pixelExactShadows`. The play case checks that shadows default to not pixel-exact.
    - Browser: `outdoor-presentation` now expects the recipe-world Worker and no scenario Worker.
  - **Seeded faults:** 15 single-line faults over the new `LabView` code, the presented camera and the guard; all 15 fail the suites.
  - **Review revision:** `ENGINE_REVIEW_REVISION` is unchanged. A build with a temporary switch (not committed) captured both hosts on both renderers, four runs each: idle on a small and a large asset, and settled after walking into the small asset's collision. Every comparison, old against new included, was pixel-identical, with matching camera and player datasets.
  - **Validation:**
    - `npm run typecheck`, Biome on the changed files, knip, the ratchet (only other sessions' `src/rendering` entries fail, as on HEAD), focused vitest (55 files, 599 tests), the regenerated manifest and a production build.
    - Playwright: `outdoor-presentation` (2), `outdoor-workshop` (5), `vehicle-workshop` (3), `world-geometry` (5), `jump-park` and `vehicle-geometry` (6), 22 of 22.
  - **Review** (Yep Anywhere, Opus 5.5 high): ACCEPT, no blocking findings. The reviewer confirmed parity with the old host for this lab: hook timing and camera, the shared frame, the presented player and alpha, the initial zoom, the teleport fence, scoped assets, datasets and cleanup. It also confirmed that reusing the frame is safe on every backend (the raster backend draws at submit, the GPU backend copies).
    - Optional findings taken: an identity check for the presented player, a camera framed from the presented pose so the check can tell the presented camera from the actual one, the stale `gameplay-scenarios` sentence, doc wording and wrapping, pixel identity qualified as idle and settled, and a spec assertion that no scenario Worker loads, with a current title.
    - Re-review: ACCEPT.
