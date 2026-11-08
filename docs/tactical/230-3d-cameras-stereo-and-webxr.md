# 3D cameras, stereo output and WebXR

Status: planned, deferred. Implementation waits until
[226](226-player-views-and-local-split-screen.md) has its device session and view
with a camera-policy interface (226 slice 3). Slices 1 and 2 below do not depend
on 226 and can start whenever the owner says.
Owner direction, 2026-11-08, after playing the [229](229-first-person-view.md)
first-person experiment: configurable view distance, a stereo "2D-looking" hybrid,
a tabletop mode, and WebXR again (a basic screen mode as before, plus immersive).
Owners: [rendering architecture](../topics/rendering-architecture.md),
[226 player views](226-player-views-and-local-split-screen.md).
Background: [WebXR research](../research/webxr-vr-support.md) (the earlier
mono-screen mode and its DOM problem).

## Direction

There is one 3D scene, the 229 first-person scene. Every new mode is a
**camera** that looks at that scene, combined with an **output** that shows it.
The 2D sprite renderer is not changed to fake depth. These are experiments, so
uniformity matters more than polish.

### Cameras (each produces a 3D eye)

- **Eye:** today's first person.
- **Chase:** today's driving camera.
- **Orbit:** a camera circling an anchor point, with distance or scale, yaw and
  pitch. Two presets use it:
  - *Overhead* is the "pretend 2D" view: high pitch, fixed yaw, follows the
    player, narrow field of view from far away (close to flat projection, but
    stereo still has real depth).
  - *Tabletop* shows the world as a miniature on a table, at lower pitch.

### Outputs

- Mono on the page (today).
- Side-by-side (SBS) on the page, for SBS glasses and 3D TVs. Half or full width
  is an option. Anaglyph is a debug toggle.
- **Headset screen:** a flat screen floating in an XR session, mono or stereo.
  A WebXR quad layer with `stereo-left-right` layout takes the SBS image directly.
  This is the earlier "basic 2D" VR mode, now fed from a view render target
  instead of the composed page frame.
- **Headset immersive:** three.js `renderer.xr`. The head pose provides the eyes.

| | Page mono | Page SBS | Headset screen | Headset immersive |
| --- | --- | --- | --- | --- |
| Eye | today | stereo first person | first person on a screen | VR first person |
| Orbit, overhead | "3D 2D" | **stereo hybrid** | 3D TV mode | (use tabletop) |
| Orbit, tabletop | overview | stereo overview | — | **tabletop** |

### Decisions (2026-11-08)

- **Stereo depth:** window style. Convergence (zero parallax) is at the ground, so
  the world sits at or behind the screen. Use three.js `StereoCamera` (off-axis
  frustums) on top of the active camera. A depth (eye separation) slider is part
  of the experiment.
- **Billboards:** behave as in first person in every camera (today's upright
  quads, `FirstPersonBillboards.ts`). There is no separate tilt rule for orbit
  cameras. A known consequence: sprites foreshorten at steep pitch, so the
  overhead preset's default pitch must stay readable with upright cards.
- **Interiors in 3D:** worth doing. First person currently falls back to the
  fixed view indoors (`firstPersonPlay.ts`, `stateView.interior`). With stereo
  and XR modes that fallback would snap flat at every door.
- **HUD:** deferred. The in-play HUD stays as it is. Per-view canvas HUD belongs
  to 226 slice 5 and an XR HUD comes later.
- **Menus in a headset:** pausing ends the XR session. On Quest the page then
  shows as the browser's flat panel with working controller pointers, so the
  HTML menus work unchanged. The Resume click is the user gesture that starts a
  new session. HTML-in-Canvas (Chromium's API that draws live DOM into a
  canvas or WebGL texture) is a spike, used only when feature detection finds it,
  because its API changed in breaking ways during 2026. Copying HTML into images
  (html2canvas, SVG `foreignObject`) is rejected.
- **Build mode in a headset:** not in scope. VR is for playing. A parent edits
  from another device in multiplayer.

## Current constraints (2026-11-08)

- **View distance:** `drawRadius` is clamped to 320–900 world px (20–56 tiles)
  from the hidden fixed camera's visible area. The fixed camera may zoom no
  closer than 0.5 (`FIRST_PERSON_STREAM_ZOOM`). Fog and the camera far plane
  follow `drawRadius`, and chunk meshes build at most 3 per frame. The real limit
  is the streamed rectangle, which is centred on the player and not shaped to
  what the camera sees. 226 plans radius or frustum streaming interest per view.
- **Separate renderer:** `FirstPersonView` owns its own canvas and
  `WebGLRenderer`. 226 plans to share the GPU host's renderer. XR needs that
  renderer to be XR-compatible, and stereo doubles draw calls.
- **Frame loop:** `GameLoop` drives frames from the page's `requestAnimationFrame`.
  XR needs the session's frame callback as an external driver. The removed
  `XRSessionManager` replaced the loop instead.
- **Taps and hold-to-move** are suppressed in first person because they aim
  through the hidden fixed camera.

## Slices

Each slice fixes its exit list, gets one independent review and commits,
following 226's slice rules.

1. **View distance option (no 226 dependency).** An Options choice (Near /
   Medium / Far) that scales `drawRadius`, raises the 900 px cap and derives the
   fixed camera's zoom floor from it (`zoom = min(vw, vh) / (2 · radius)`).
   Record the cost: streamed and simulated area, chunk build backlog, frame time.
   Once 226 has per-view streaming interest, the option sets that radius instead.
2. **Interiors in the 3D scene (no 226 dependency).** Find what an interior realm
   gives the client (floor, walls, furniture props, doorways, roof cutaway) and
   draw it with the existing terrain, prop-box and billboard builders. Remove the
   indoor fallback. Orbit cameras will need walls facing the camera cut away (the
   fixed view shows interiors roofless). Record this here and implement it in
   slice 3.
3. **Orbit camera** as a 226 camera policy: anchor, distance or scale, yaw, pitch,
   with overhead and tabletop presets. Draw radius comes from the visible area,
   not from eye fog. Movement is relative to the camera yaw. Tap and hold
   destinations come from a ray against the 3D ground instead of the hidden fixed
   camera. On the page, orbiting uses the mouse or right stick, so tabletop can
   be tuned without a headset.
4. **Stereo page output:** `StereoCamera` on any camera, SBS half or full width,
   anaglyph debug, an eye separation slider, convergence at the ground. Measure
   draw calls and frame time against mono.
5. **XR session and headset screen.** XR-compatible shared renderer; `GameLoop`
   accepts the session frame callback; `local-floor` reference space; a quad
   layer showing a view's render target, mono or stereo. Pause and Exit end the
   session and return to the HTML menus. HTTPS dev server for Quest testing (as
   in `1fe0aa8e`).
6. **XR controllers as a seat input device**, like 226's gamepad-per-seat
   assignment: `xr-standard` mapping to movement, jump, throw, interact; the
   pause button ends the session. Check the mapping on hardware.
7. **Immersive first person:** head pose added to the player's eye. Comfort
   rules: snap turn, pitch only from the head, slower walk, world scale set to a
   child's eye height. View distance defaults shorter to hold 72–90 fps.
8. **Immersive tabletop:** the orbit preset becomes a room-to-world transform.
   - Scale: slider, plus a two-controller grab to scale and rotate.
   - Table edge: clip at a disc or square, or fade at the radius. The table area
     divided by the scale sets the streaming interest.
   - Recentering:
     - *Auto:* the anchor glides to the player over about 0.5 s once the player
       leaves a dead zone (about 30% of the table radius).
     - *Manual:* grab and drag the world, a button to snap back to the player,
       and a lock that keeps the anchor in place.
   - Table height and position, standing or seated, and snap rotation.
   - Movement relative to the table's yaw or the head's yaw (option).
9. **Spike: HTML-in-Canvas in Quest Browser.** Feature-detect the Chrome 155+
   API (`texElementSubImage2D`, `content="drawable"`) and show the pause menu
   on a panel inside the session, using controller-ray hit testing. Record a
   decision. Exiting to the browser panel stays the fallback.

## Validation approach

- Node tests for camera math (orbit eye, stereo frustums, recentering dead zone
  and glide, scale and clip radius) and for XR input mapping with a fake
  `XRInputSource`.
- A browser check only for a specific browser contract, such as SBS output size
  or XR session start and end on a WebXR emulator.
- Device checkpoints are owner runs on Quest (frame pacing, comfort, controller
  mapping) and on SBS glasses or a TV if available. No performance claims without
  them.

## Progress

None yet. Plan recorded 2026-11-08.
