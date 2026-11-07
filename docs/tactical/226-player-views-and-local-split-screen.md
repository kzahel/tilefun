# Player views and local split screen

Status: direction agreed; research needed before phasing. No implementation
started. The sequence below is provisional; the research questions decide it.
Updated 2026-11-07 for seats on one device session, online seats and the
first-person view requirements from 229.
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
- **Keyboard bindings use `KeyboardEvent.key`.** They cannot distinguish left
  and right modifiers, and they depend on the keyboard layout. Shift changes
  `w` to `W`, so a keyup can probably leave a stuck key (unverified).
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
- **Device session (one per page/device):** one connection to the authority,
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
  one player session per seat. Input messages carry a seat; frames list a
  controlled entity and an input acknowledgement per seat; streaming covers the
  union of the seats' areas. (The lab protocol already has `seat: 0 | 1`.)
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

## Research questions (decide the phasing)

1. Multi-viewport rendering: can one Canvas/GPU host draw 2–4 regions
   (including a diagonal split) within budget on a Chromebook and the Steam Deck?
   Can one of them be a 229 first-person viewport sharing the same renderer?
2. Multi-seat prediction: can one predictor replay several controlled bodies
   with acceptable corrections and cost?
3. Server seats: how much of `Realm`, `SessionRegistry`, the replicator,
   `RealmStreaming` camera tickets, dormancy and door/realm travel assumes one
   session per connection?
4. Realm divergence: per-realm replicas on a device, or party travel? This is
   partly a product question (do split-screen players go indoors separately?).
5. Seat identity: guests of the host profile, or chosen profiles?
6. `GameClient` decomposition: which UI and globals are per page, per device
   session, per seat and per view?
7. Fast feedback: which native/headless harnesses can exercise several seats
   and views without a browser? Examples: two seats in `ScenarioSession`,
   predictor replay with two controlled bodies, multi-region render probes.
   Which few browser checks remain necessary?
8. Phasing: what is the smallest first slice that delivers something visible
   (e.g. game controls in the car labs, or two keyboard players in fixed split
   screen) while keeping later phases open?

## Provisional sequence

Each phase keeps the single-player game unchanged unless the phase delivers
a visible feature.

1. **Input ownership.**
   - Per-player input sets, the device router, `code`-based bindings and the
     shared composition step moved out of `PlayScene`.
   - Joystick and buttons scoped to a view rect.
   - Node tests pin current single-player behavior, two simultaneous keyboard
     schemes, pad assignment and touch routing by region.
   - Interim lab adapter: `ScenarioPresentationHost` uses one input set, which
     gives labs the game's on-screen controls early.
2. **Multi-viewport rendering spike (can run in parallel with 1).**
   - Draw N cameras into regions of one Canvas/GPU host, including cached
     terrain cells, elevated-surface overlays and mesh vehicles.
   - Check that regions can change size every frame, and that a
     non-rectangular clip (a diagonal split) is feasible on both backends.
   - Measure 2 and 4 views on a Chromebook and the Steam Deck before
     committing to layouts.
3. **Multi-seat prediction spike (gate for phase 5, can run in parallel).**
   - Two controlled bodies with independent inputs in one `PlayerPredictor`
     replay, using a native harness.
   - Cases: walking into and pushing each other, both riding one car, one
     driving while the other walks, and a simple distance leash.
   - Measure correction size and replay cost per added seat against the
     existing contact-presentation and matched-tick prediction tests
     (207–212).
   - Decide multi-seat prediction or the rejected fallback before phase 5.
4. **Device session, seat and view extraction.** Split `GameClient` into the
   page shell, device session, seat and view, with a camera-policy interface
   (follow one player is the only policy delivered). Per-view UI mounts in a
   container. The game still has one seat and one view.
5. **Seats on the authority.**
   - Seat-tagged input, per-seat controlled entity and input acknowledgement,
     one player session per seat, and union streaming.
   - Multi-seat prediction from the phase 3 result.
   - Join flow: a player presses A on an unassigned pad, or Enter with an
     unclaimed keyboard scheme.
   - Identity per seat (guest or profile: see decisions below).
   - Shared pause/menu policy and one audio mix.
6. **Split screen in the game.** Layout switching, per-view HUD/prompts,
   controller/keyboard hints per player, and performance gates for 2 and 4
   players.
7. **Labs onto views.**
   - Recipe-world authority plus instrument plugins.
   - Car pages first, then characters, interiors, outdoor and natural landscape.
   - The two-pane physics lab becomes two views with network emulation.
   - Then delete `ScenarioPresentationHost`, `ScenarioClient`, the scenario
     Worker and the per-page input code.
   - `ScenarioSession` stays as the headless test harness and recipe-world
     opener.

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

Labs keep running at their current capability through phase 6. Shared changes
supply only minimal adapters (the input set, render host API changes). Lab-only
features may regress temporarily when preserving them would block a phase.
Record each regression here and in the embedded engine labs topic, and resolve
it in phase 7 rather than by maintaining both shells.

## Decisions

- Open: who are local players 2–4? Guests of the host profile, or chosen
  profiles with their own saved settings?
- Open: does split screen pause everyone when one player opens the menu
  (proposed: yes), and which player controls a menu (proposed: the opener)?
- Decided: make the game modular and embeddable rather than extend the lab
  shell; labs may regress temporarily and move onto views last.
- Decided: seats on one device session (one connection, one replica, one
  predictor), including online; one connection per local player is the
  fallback only.
- Decided: fixed split screen first; leashed shared screen and dynamic split
  are the long-term goal, and seats and views are separate concepts from
  phase 4 onward so those modes need no further restructuring.
- Proposed: one render host with viewports instead of one canvas per player.

## Validation approach

- Phase 1 behavior is Node-tested at the composition/router level. Browser
  coverage is one focused check that a view-scoped joystick and buttons drive
  a player, plus one check with two keyboard schemes in two views (phase 6).
- Rendering phases follow the rendering topic's Canvas/GPU pixel and
  `streaming:bench` requirements, with device measurements for 2 and 4 views.
