# 3D cameras, stereo output and WebXR

Status: slices 1 (view distance) and 2 (interiors in 3D) delivered for owner play
on 2026-11-08; slices 3 onward wait until
[226](226-player-views-and-local-split-screen.md) has its device session and view
with a camera-policy interface (226 slice 3).
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

Plan recorded 2026-11-08. Slices 1 and 2 implemented the same day at the owner's
request, ahead of 226.

### Slice 1: view distance (delivered for owner play)

- Gear (⚙) → **Options → First-person view distance**: Near (400 px), Medium
  (800 px, default) or Far (1,600 px), saved per player as
  `firstPersonViewDistance` (`src/config/firstPersonViewDistance.ts`).
- Fixed a 229 bug: the streamed radius was computed without `PIXEL_SCALE`, so it
  was overestimated threefold. Fog sat at up to 900 px while chunks loaded only to
  about 360–640 px, so the edge of the world showed through. Now
  `streamZoomFor` lowers the hidden fixed camera's zoom until its streamed
  rectangle reaches the chosen radius. Fog ends at the chosen distance
  (`firstPersonDrawRadius`, minimum 160 px). While chunks are still arriving
  (a farther choice, teleports, fast driving), the view pulls the fog in to the
  nearest in-reach chunk that has not arrived and eases it back out
  (`nextFogEnd`). Switching Near → Far measured 1,355 → 1,600 px over about 1.5 s.
- Cost (1280×800, downtown, capture below): Near 32 resident first-person chunks
  and 22 draw calls; Far 194 chunks, 124 billboards and 142 draw calls. Far streams
  and simulates a much larger rectangle (it is viewport shaped, not a circle).
  Per-view radius interest from 226 replaces the zoom floor later. No device frame
  pacing claim yet.

### Slice 2: interiors in 3D (delivered for owner play)

- First person no longer falls back to the fixed view indoors. The play glue
  compiles the room as the fixed view does (`compileGameplayRoom`, cached per room
  key) and passes it as `FirstPersonFrame.interior`.
- `FirstPersonRoomScene` rasterizes the room's layers once: the floor layer for a
  textured floor plane, and the whole fixed-view picture for wall faces. Outdoor
  ground is skipped; fog is off and the backdrop is the fixed view's room colour.
- Walls are the replicated shell prop's colliders, drawn as tall as the art paints
  them (collision walls are 64 px). East–west walls take the painted band above
  their base, so their south faces show exactly the fixed view's band. North–south
  walls take the room's typical height. Backs repeat the south art (mirrored). Tops
  and sides take colours sampled from the wall's art, since a projected top would
  show the floor beyond a low wall. Walls with no art of their own (outer
  boundary, void) are plain. The measurement is cached per shell.
- Furniture uses its catalog anchor and atlas rectangle, not the sprite's bottom
  centre. Floor-layer pieces (rugs) lie flat. Wall-layer pieces (pictures) hang on
  the south face of the painted wall containing their anchor. Other pieces follow
  the 229 rule (boxes wearing their art, or upright cards when the body is narrow,
  for example `potted-tree`). Cards stand on their anchor row; the catalog's padding
  below the anchor stays under the floor.
- Editing the room keeps the old walls and furniture until each chunk is rebuilt,
  so nothing flashes away.
- Limits:
  - Doorways to the street look out onto the backdrop.
  - The `objects` layer is drawn only on wall faces, not the floor.
  - Furniture placed on another piece (`on:`) would stand on the floor. No gameplay
    layout uses it yet.
  - Rooms stream at the chosen view distance like outdoors, so Far keeps about 121
    mostly empty room chunks resident.

### Validation (2026-11-08)

- Node: view distance math, choice parsing and the tick's zoom floor
  (`firstPersonPlay.test.ts`, `firstPersonViewDistance.test.ts`); room projection,
  floor plane, anchors, rugs, painted wall heights, plain walls and side colours
  (`FirstPersonInterior.test.ts`); two-sided shell faces (`FirstPersonProps.test.ts`).
- Static: `tsc` (game, server, worker, tools), Biome, knip, and the ratchet for the
  changed files. `GameClient` stays within its baseline (the update type is derived
  from the profile shape); room drawing moved to `FirstPersonRoomScene` to keep
  `FirstPersonView` under 600 lines.
- Browser: `scripts/first-person/capture-rooms.mjs` (isolated Vite, bundled
  Chromium, fresh regional world at the gameplay-interiors apartment door). It picks
  Near and Far through Options (the choice persists on the profile) and enters the
  apartment with the interact key. Shots cover four headings, looking down, deeper
  inside and the fixed view. Several rounds of captures found and fixed: walls
  twice as tall as their art, colliders running into void read as unpainted, and
  strips drawn above their base. No page errors. Captures are evidence, not
  committed.
- `controller-menu.spec.ts` (Options with a controller) passes;
  `streaming:bench --assert-ready` passes (fixed view; first person is not part
  of the bench).

### Independent review (2026-11-09)

A read-only Opus 5.5 high-effort review (yepanywhere, Work pool) returned REVISE.
Handling:

- **Fixed:**
  - Biome formatting in the new test and capture script.
  - Fog followed the requested rather than the arrived area (now `nextFogEnd`).
  - Pictures were hidden inside their wall (now hung on its face).
  - Low walls showed floor art on their tops (now flat tops).
  - Room edits blanked the room (groups now kept until rebuilt).
  - Wall measurement re-ran on every chunk rebuild (now cached).
  - Stale "indoors fallback" comments.
  - A duplicated backdrop colour (now `VIEW_BACKDROP_CSS`).
  - A per-frame `JSON.stringify` of the room key (now reference checks first).
- **Documented:** surface (`on:`) furniture (see Limits).
- **Rejected after capture:** "furniture cards sink their bottom rows". Putting
  the card's bottom row on the floor made the potted tree float 8 px. The rows
  below a catalog anchor are intentional transparent padding, so the anchor row
  stays on the floor (pinned by a test).

After the fixes, the capture adds a fog sample while Far streams in and a
wall-picture shot.
