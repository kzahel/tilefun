# Leashed shared screen

Status: implemented 2026-11-22 for owner play review. This is the shared-camera
follow-up to [226](226-player-views-and-local-split-screen.md).

- **Multiplayer → Local multiplayer → Use shared screen** selects one top-down
  view for two to four local seats. The layout choice lasts for the current game
  session. **Use split screen** restores the per-seat cameras. Solo play,
  building, and immersive headset play use their usual cameras.
- The shared camera centres the visible party and zooms out as needed to leave
  room for characters, chassis and the guest HUD. If players start very far
  apart, zoom stays bounded and Player 1 stays visible. Edge markers point to
  distant players. Seat prompts follow the guest they belong to. Each guest has
  a separate inventory and gem display.
- The hard limit governs the party's horizontal spread on the ground at
  352 × 224 world pixels. Walkers and drivers can move along the edge, reverse
  or close the gap. If the party starts beyond the limit, it can regroup
  without being relocated. Scripted rail travel retains its ordinary route.
- The host's fixed-tick input carries the mode on the device's existing
  sequence. Authority groups live seats by device in the same realm, and
  prediction applies the same rule on forward and replay ticks. The simulation
  limits motor and wheel motion before contact solving and trims extra spread
  caused by contact resolution before poses are published.
- The shared viewport supplies the existing per-seat range reports so old
  split-screen ranges no longer keep distant views loaded after a switch.
  Party door and world travel use the existing device-level travel path.

Validation: focused Node tests cover car braking, reverse, wall contact,
connection isolation and camera limits. The Chromium split-screen suite covers
the one-camera menu flow and the walking limit. The standard streaming
readiness scenarios pass. Opus 5.5 high reviewed the change through Yep
Anywhere and confirmed the camera fixes on re-review.

Next: family playtest with one driver and one explorer, then tune the
separation limit or add a small edge cue if drivers miss why they stopped.
