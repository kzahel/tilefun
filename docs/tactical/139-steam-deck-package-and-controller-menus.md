# 139 — Steam Deck package and controller menus

Owning topic: [Steam Deck and menus](../topics/steam-deck-and-menus.md).
Status: complete — implemented, validated and installed on the physical Deck.

## Authorized outcome

A launchable GPU Steam Deck package, controller-complete shared menu/UI and
multiplayer host/join, with Minecraft/mclone-style submenus. Commit when done.
The desktop browser may retain its sidebar. Keep game/lab engine authority and
rendering shared; do not rewrite the engine or introduce a Deck-only simulation.

## Delivery and acceptance

1. Package production assets, a secure Chromium shell and stable save origin.
2. Deliver home/pause, worlds/create/manage, character, Options, host/join/browse,
   keyboard/controller focus and text entry, and editor controller tools.
3. Test semantic edges, context cancellation, controller browser navigation and
   two actual WebRTC browser participants through the menu flow.
4. Install and launch via machine-control. Verify GPU, offline local play, saved
   reload/upgrade and real packaged host/join; record hardware limitations honestly.
5. Run required inventories, typechecks, unit tests, lint, production build,
   browser suite and streaming readiness. Commit source and evidence docs.

## Evidence

The read-only machine-control inventory doctor passed: SSH/Devkit reachable,
Gaming Mode active, internal panel enabled. The common `target doctor` and
claim interface do not apply to this physical provider; use `inventory doctor`
and `testbed --` as its documented common CLI routes. No VM was provisioned.

Implemented the secure Linux x64 Electron 44.9.0 package and Devkit title.
The observed Steam launch needed X11 and removal of Steam's overlay preload.
Chromium GPU compositing/WebGL/rasterization remain enabled, the renderer sandbox
is active, and the game reports `renderer=gpu`, `gpuDevice=ready` at 1280×800.
Steam exposed the integrated controls as a standard Xbox-compatible gamepad
(17 buttons, 4 axes). Automated tests drive standard Gamepad API snapshots;
physical button feel and child usability still need a hands-on play session.

The isolated Deck acceptance world (flat seed 4242) retained its exact world ID
across saved navigation reload and package replacement. Normal desktop quit
completed through the renderer/authority flush handshake. Browser and packaged
save directories remain separate.

Real cloud signaling connected the packaged Deck host to bundled full Chromium
on the development machine: both reported the same world ID, seed 4242 and
Player 1/Player 2 identities with GPU rendering. Initial browser integration
found raw PeerJS snapshots exceeding SCTP's message limit; selecting PeerJS
binary serialization restored the actual host/join/leave flow with chunked data.
The deterministic regression uses a local signaling broker and real WebRTC.

The opposite direction also passed: the packaged Deck joined the browser host's
flat seed 5151 world and reported Player 1/Player 2 with the Deck assigned Player 2.
The test used the actual Multiplayer → Join game menu and retained the packaged
`tilefun://` origin.

Offline acceptance passed with all HTTP(S)/WebSocket URLs blocked in Chromium:
a reload restored the same seed 4242 world and exact world ID with the GPU ready.
A fresh external fetch failed as expected; the bundled custom-scheme assets and
local authority remained usable. The machine's Wi-Fi was left connected.

Injected quit persistence failure left the packaged game running with a
controller-accessible recovery dialog. B dismissed the dialog without losing
the session; restoring persistence allowed Save and quit to close normally.

## Final validation

- Typechecks pass across client, server and worker projects.
- Unit tests: 287 files, 2,856 tests passed.
- Biome passes with the existing 119 warnings and 34 informational diagnostics.
- Art catalog and Workshop manifest regenerated sequentially; production build
  verifies all inventories. The manifest retains all 880 candidates and 64
  compiler exclusions; only its broad input digest changed.
- Full Playwright run: 699 passed, five failed. Four failures were menu/test-driver
  expectations corrected for the new hierarchy and render-frame input sampling;
  the fifth contacted an orphaned standalone test server with an old manifest.
  Focused rerun: 60 passed; clean standalone rerun: one passed. The standalone
  test now awaits its own startup, checks manifest freshness explicitly and
  cleans up its child even if browser close fails. Strict review protection remains.
- Controller coverage includes text Done/cancel, menu/Options/character travel,
  destructive confirmation cancellation, movement/map/editor paint and erase,
  multiplayer validation and recoverable saving errors. Real WebRTC integration
  verifies host, join and leave through the actual menu.
- `npm run streaming:bench -- --assert-ready` passes using isolated Vite and bundled
  Chromium. Cold, standing, walk, sprint, reverse and zoom-out end with zero
  missing, incomplete or stale terrain. This is a desktop readiness regression,
  not a Deck frame-rate or battery benchmark.

The delivered Devkit package uses the ordinary tracked launcher and stable
default save directory; the opt-in debug endpoint and isolated acceptance save
directory are not part of the normal launch configuration. Distribution beyond
the measured Deck, Steam storefront integration, Steam Cloud and TURN relay
service remain separate work. Next is a hands-on parent/child controller session.

## CI menu navigation follow-up (2026-10-19)

Run [39171151876](https://github.com/kzahel/tilefun/actions/runs/39171151876)
exposes a duplicate menu toggle in world-generation tests. A preceding Escape
starts an asynchronous Worker realm-list request; `openCreate`/`openWorlds` can
still see a hidden menu and send another Escape, closing it after the first
request completes. The helpers now own opening exclusively. Redundant toggles
are removed from generation and recreation checks; recreation also waits for
world joins before capturing container identity. No menu runtime behavior changed.
All six generation/recreation checks pass three consecutive single-worker full
Chromium runs (18 checks total); typechecks and lint pass. The full eight-case
vehicle-driving file also passes, including the prior CI reversal failure.
