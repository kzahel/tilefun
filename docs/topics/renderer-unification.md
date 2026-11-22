# Renderer unification

Topic: renderer-unification
Status: fixed GPU world renderer retired, owner-authorized 2026-11-17.
The unified scene owns every interactive consumer. Local validation, regression
corrections and passing hosted Linux qualification are recorded in
[253](../tactical/253-retire-fixed-world-renderer.md).
[254](../tactical/254-remove-renderer-scaffolding.md) removes the remaining
fixed-pass orchestration, enable gates, empty host hooks and GPU raster adapters.
Interactive `RenderResources` expose terrain preparation/resources only;
`ReviewRenderBackend` exposes the immutable native review pass protocol.
[255](../tactical/255-wildlife-3d-model-campaign/progress.md) exercises skinned
animal GLBs in the same game and lab scene. A development catalog maps each
GLB to the actor's existing clip, frame phase and facing. Sprite fallback and
a mixed-species crowd ran locally. The art disposition lives in the tactical.
[256](../tactical/256-wildlife-3d-game-rollout.md) adds the approved wildlife
bank and exact Workshop play links. The shared view falls through to the sprite
for pending or failed loads or after using its 24-model draw budget. A view
starts at most four model loads concurrently and retains up to 48 model batches.
[261](../tactical/261-mobile-crane.md) uses the same rigid model path for the
four-axis crane and its loose wooden pallet. The pallet draws its solved
quaternion in the shared scene, with a sprite fallback while the model loads.
Updated: 2026-11-20.

Owns the move to one world renderer: its status, parity checklist, device
scorecard and decision gates. [Rendering architecture](rendering-architecture.md)
still owns backend boundaries and resource lifetimes. The plan and its slices are
in [248](../tactical/248-renderer-unification.md).

[262](../tactical/262-leashed-shared-screen.md) adds a shared top-down camera
policy to the existing host view. It frames the projected poses of two to four
local seats using the same scene as solo play, and reports its visible chunk
range for the party. Split screen retains one view per seat.

## Decision

Owner, 2026-11-14: unify the renderers, accepting that it takes time. WebXR is
wanted as well, and a third renderer is not.

- The first-person 3D scene ([229](../tactical/229-first-person-view.md),
  [247](../tactical/247-first-person-shadows-and-walls.md)) becomes the one world
  renderer. Top-down, first person, chase, orbit and XR are cameras on it.
- Unification runs in that direction only. The first-person view is not merged
  into the fixed 2D backend.
- The fixed 2D view stayed the default for top-down play until the unified one
  was good enough (owner, 2026-11-16: make it the default). Since 2026-11-17
  it remained behind development controls and internal fallbacks until the
  owner authorized retirement later that day (253).

## Why this direction

- A spike on 2026-11-14 put the fixed view's `x, y − z` projection on the
  first-person scene. Buildings, props, actors and vehicles landed where the fixed
  view draws them. On the M4 Pro its main-thread render time was equal to or below
  the fixed view's in eight of nine cells, with lower GPU time in eight of nine.
  Numbers and limits: [248](../tactical/248-renderer-unification.md#spike).
- The fixed view builds depth inside a 2D pipeline: painter-ordered quads with
  per-quad depth equations, an offscreen colour and depth image per vehicle, and
  a deferred shadow pass. A 3D scene gets these from its depth buffer.
- WebXR needs a scene drawn with a different view matrix per eye. The
  first-person scene can do that. The fixed view's screen-space quads cannot.

## Guardrails

- **One world scene.** Top-down, first-person, driving and XR cameras share
  `FirstPersonView`. Game, labs, prop editing and offscreen previews use it.
- **Shared resources stay.** `GpuRenderResources` owns CPU terrain rasters,
  the shared page atlas and native-pixel vehicle body images. These are not a
  second world renderer. `GpuSceneSurface` owns the WebGL context and pages.
- **Review raster stays.** Immutable candidate images and `ReviewRasterBackend`
  are outside retirement. Never regenerate frozen approval pixels to match play.
- **One presentation evaluation.** Cameras share collection, mesh poses,
  shadow shapes, simulation, prediction and replication.
- **Device claims need device runs.** Local SwiftShader and hardware Chromium
  runs do not establish hosted Linux, phone, Deck or headset performance.

## Choosing the view

The unified scene is mandatory, including software WebGL. The player-facing
choice was removed in `71f1e81d`; 253 removes `r_topdown3d`, the classic-view
Debug checkbox, the software fallback and `?rooms3d=0`. Retired `?view=fixed`
links now get unified drawing. `?view=fps`, per-seat first-person selection and
camera settings still choose cameras on this scene.

Loading, module failure and lost graphics show an opaque UI frame. Restoring
WebGL resumes the scene without restarting the world. A failed module can be
retried with the existing Save and reload action. No world raster draws beneath
these frames.

First-person and driving fog use the selected fixed view distance: Near 400,
Medium 800 or Far 1600 world pixels. Since 2026-11-16, missing terrain never
reduces that distance (owner instruction); fog fades from 45% of the selected
distance to fully opaque at its end. Changes of distance apply immediately.
Immersive XR uses the same distance converted to metres; rooms, tabletop and
top-down views retain their fog-free presentation. Terrain holes are a separate
streaming concern; [fog investigation](../research/first-person-driving-fog.md).
The persistent holes reproduced by cycling 0.1× ↔ 0.25× were fixed on 2026-11-16
by clearing evicted chunks' replication baselines; the matched browser run has
zero missing terrain or ground images. [Cause and evidence](../research/terrain-holes-on-zoom.md).

The perspective ground filter keeps its four samples and computes their footprint
from each face's projected texture plane and the current viewport. On macOS
Chromium, fragment derivatives sometimes spiked where a pixel quad crossed a
chunk edge, pulling unrelated colors from the same terrain page into one-pixel
stripes. The town-road browser regression compares filtered and single-sample
pixels in uniform grass beside the road. Top-down's pixel grid samples once at
the pixel center.

Dense forest residency follows the row artwork when it extends past its anchor
chunk. The oblique camera draws the native composition and perspective cameras
draw whole tree cards, which also supply shadows for both. The
[natural landscapes topic](natural-landscapes.md#dense-forests-in-the-unified-renderer)
records the reproduction and the shared presentation.

## Target shape

```text
Worker authority / prediction (unchanged)
        ↓ read-only replicated and predicted state
shared presentation (collector, mesh poses, shadow shapes)
        ↓
one WebGL2 context: one page atlas, one set of vehicle assets
        ↓
one 3D scene (ground, props, cards, vehicles, shadows)
        ↓ cameras                         ↓ outputs
top-down (oblique) · eye · chase       page regions (split screen)
orbit · tabletop · XR head pose        stereo page · headset screen · immersive
```

A camera is a bundle of settings, not only a matrix. Top-down needs the oblique
projection, cards that do not turn, sprite rows chosen from the south, no fog,
the player's own body shown, residency from the visible rectangle and pixel
snapping.

## Slice tracker

One row per slice of [248](../tactical/248-renderer-unification.md). Update the
row when a slice starts, delivers or is blocked.

| Slice | State | Record |
| --- | --- | --- |
| 0 — Spike and plan | Done 2026-11-14 | [248](../tactical/248-renderer-unification.md) |
| 1 — One renderer host | Done 2026-11-14: one WebGL context, shared vehicle assets, first person as a per-seat view kind with mixed split screen | [249](../tactical/249-one-renderer-host.md) |
| 2 — Ground artwork, shared page atlas | Done 2026-11-14: the 3D ground wears the fixed view's terrain pages, and 3D cards read the same atlas instead of whole-sheet textures (99.6 MiB → 4.6 MiB of card artwork in the city) | [250](../tactical/250-ground-artwork-and-shared-pages.md) |
| 3 — Top-down camera, parity probe, draw calls, device scorecard | Done 2026-11-14: `?view=topdown3d` / `r_topdown3d` draws top-down play through the 3D scene; the parity probe gives the checklist numbers; static content is merged into 4 to 25 draws; measured on the Mac, Pixel 7a and Deck, with a go on draw-call cost | [251](../tactical/251-top-down-camera-parity-and-merged-meshes.md) |
| 4 — XR on the shared scene | Done 2026-11-14 for owner play: the world menu's **Headset** buttons start a WebXR session as a floating screen, immersive first person or a tabletop miniature, with the headset's controllers as seat 0's pad; all three hold 72 Hz on a Quest 3 in `city` and `woods`. Comfort and the controller mapping are not yet checked by a wearer | [252](../tactical/252-xr-on-the-shared-scene.md) |
| 5 — Top-down parity | Retirement authorized 2026-11-17; historical comparisons retained below: building bodies match their artwork (solid props identical at 1×), grass blades are drawn (99% overlap), and since 2026-11-16 vehicles are the fixed view's outlined pixel images (identical at 1×). 2026-11-17: actors' feet show over the ground and excavation roofs fade; sprite edges waived | checklist below |
| 6 — Opt-in, default, retirement | Opt-in and default done 2026-11-16 (owner instruction); retirement completed 2026-11-17: all consumers migrated, fixed GPU passes/probes removed, local and hosted qualification passed | [253](../tactical/253-retire-fixed-world-renderer.md) |

## Top-down parity checklist

What the unified top-down camera needs before it can replace the fixed view.
States: missing, partial, done. Add rows as differences are found.

Numbers are from the parity probe
([251](../tactical/251-top-down-camera-parity-and-merged-meshes.md#3b--delivered-2026-11-14),
`node scripts/first-person/parity.mjs --headed`) in `city`, `woods` and `crowd`
on the Mac. "Overlap" is the share of a kind's pixels that both renderers draw.
These measurements are historical: 253 retires the comparison renderer and
probe. Current regressions exercise the unified scene directly. The historical
`--scenes=hills` raised ground first. The solid props and grass rows
were measured on 2026-11-15; the other rows are 251's.

| Item | State | Notes |
| --- | --- | --- |
| Framing and registration of actors and vehicles | Done at whole pixels | Actors identical in the city at 1× (3,735 pixels, none different). Vehicles identical at 1× since 2026-11-16 ([vehicles](#vehicles)); they overlapped 95–97% as meshes. Both align best with no move at zooms 1 and 0.25 |
| Registration of standing cards (trees, posts, forest rows) | Waived | 98% overlap at 1×, best one pixel to the left: the fixed view floors a static sprite's screen edges to whole pixels and the 3D card is rasterised where it falls. Owner, 2026-11-17: does not matter |
| Solid props (buildings) | Done at 1×; partial zoomed out | 2026-11-15: identical at 1× in the city (28,672 pixels, none different; was 54% overlap) and 97.8% overlap at 0.25× (was 86%), where 12% of shared pixels differ in colour from sampling, as for ground. A building's physical box is now the one its artwork depicts ([building bodies](#building-bodies)). Since 2026-11-16 artwork outside the box is drawn too (`appendLeftover`): the composition minus the volumes' silhouettes, upright at the feet row above it (rooftop and side signs) and lying on the ground below it (the hotel's carpet), so each pixel lands where the fixed view draws it. Top-down faces also drop the average-colour backing of empty artwork (`ART_HOLES`), so ground shows where the fixed view shows ground (beside the hotel's carpets); first person keeps it. Mac city draws unchanged (27 at 1×, 72 at 0.25×) |
| Ground artwork (terrain pages, road markings, paths) | Done at 1×; partial zoomed out | Identical at 1×, including the seeded pond shoreline ([pond comparison](#pond-shoreline-comparison)). At 0.25× in the city 1.1% of pixels differ on crosswalk stripes and lane dashes: four samples per pixel against the fixed view's one. The top-down camera still needs its own sampling rule |
| Grass blades | Done for the top-down camera | 2026-11-15: 99% overlap at 1× in all three scenes (city 1,215 against 1,222 pixels, woods 30,252 against 30,382), about 1% of shared pixels a different colour; 99% at 0.4× and 0.5×, inside the zoom fade. What is left is the edge pixels of leaning blades. See [grass](#grass). First person and headset views draw none |
| Particles and contact effects | Done | 2026-11-16: every 3D view draws play's particles (dust, spray, splashes, wisps) as the fixed view's coloured squares standing at their point, on the pixel grid top-down (`EffectQuads`). They are collected as the fixed view collects them, on surface receivers built only while particles are active (and top-down only above the 0.2× receiver LOD) |
| Surface decals | Done | 2026-11-16: the landing ring, the only surface mark play makes, lies on its deck or ground with the fixed view's mask, in the same draw as particles. Body shadows use contact shadows instead (row below) |
| Sprite edges | Waived; feet done | Owner, 2026-11-17: the 3D view's hard, one-sample cutouts look best, so the fixed view's filtered edges are not matched. The same day's capture showed the larger difference was missing feet: an actor's rows under its standing point (`drawOffsetY`: a rabbit's near feet) were under the ground. Top-down, actor cards now hang from the standing height and draw those rows at the depth of the ground they cover, as blades do (`bladeDepth`, one world pixel nearer so the contact shadow stays under them). Crowd at 1×: actors overlap 93.8% (was 85.2%); what is left is the fixed view's soft edges. First person and chase leave those rows under the ground (owner: hiding them reads as more correct there) |
| Pixel snapping and stable sampling at fractional zoom | Partial | Fixed-view rules from 213 and 215. Owner direction, 2026-11-16: snap, with one shared rule for every element on screen. The pixel grid was accepted by the owner in play the same day ("consistent and good") and is the top-down default since: the eye, bodies (in `collectWorldSprites`, after interpolation, with their heights) and blades stand on one grid of screen pixels, and the ground is sampled once per pixel. `?pixelgrid=0` / `r_pixelgrid 0` turn it off for comparison. Fractional zoom still drops and doubles texels. Owner decision, 2026-11-16: keep one sample per pixel (crisp, texels may drop or double between whole scales). A four-tap card prototype (coverage-weighted between scales) was filmed against it and not chosen, and was removed. Behaviour in motion: [renderer film](#renderer-film) |
| Grass in front of actors | Done | 2026-11-16: blade cards stand at their anchor, so they sort with bodies by the anchor's row as the fixed view does; the rows below the anchor are drawn at the depth of the ground they cover ([grass](#grass)) |
| Vehicle shading and outline | Done at 1× for the top-down camera; partial zoomed out | 2026-11-16: the top-down camera draws the fixed view's own outlined native-pixel images ([vehicles](#vehicles)). City and crowd at 1×: 100% overlap, 0.0% of shared pixels differ (as meshes, a fifth to a third differed and there was no outline). At 0.5×: 97–98% overlap, 11% differ, the same sampling gap as solid props. First person and headset views keep meshes |
| Walkable surfaces (decks, ramps, motocross jumps) | Done for the 3D scene | 2026-11-16: the fixed view's top and edge colours and its 16 px tile grid, from one shared definition (`surfaceColors`, `surfaceGridLines` in `SurfacePresentation.ts`). Grid lines are one-pixel lines merged per map area, moved toward the top-down camera along its view ray so the surface never hides them. The 3D slab is an exact plane where the fixed view draws 2 px strips |
| Road decks (bridges) | Done | 2026-11-16: 3D decks wear the fixed view's asphalt (shaded by the deck's mean height over rail) and edge colour, and its painted lines (`roadDeckMarkings`: edge lines, guard rails, dashed centre) as strips on the deck plane, as wide in world pixels as the fixed view draws them. Not yet seen on a live bridge; covered by unit tests. The fixed view's ground shadow beside north/south decks is not drawn; the sun shades the 3D track instead |
| Raised ground | Done | 2026-11-16: raised tops wear their ground image darkened as the fixed view's 12% overlay darkens it, and a cliff's south face (the only side the top-down camera sees) wears its tile's bottom image row stretched down the face under the fixed view's 35% overlay (`RAISED_ART_SHADE`, `CLIFF_ART_SHADE`; a per-vertex `groundShade` applied in display space). Those faces are a ground mesh of their chunk, made only where ground is raised and bound to its page; north, east and west walls stay flat brown for first person. The parity probe's `hills` scene (elevation edits round the player in the woods): ground identical at 1× (0.0% of pixels differ). The generated world is flat, so only edited worlds show it |
| Body shadows | Decided | Owner decision, 2026-11-16: top-down keeps the sun's shadows as well as contact shadows (`?sun3d=0` / `r_sun3d 0` turns the sun off for comparison). Sprites with a shadow but no depth-pass shape (gems, colliderless bodies) take the fixed view's plain oval at their feet (`plainShadow`), as every body does in rooms. Before: 3D has sun shadows and contact shadows; the fixed view has the deferred depth pass. The two are not comparable (340–6,800 pixels against 5,500–72,000). Choose one look for top-down. The fixed view's player shadow is hidden under the sprite in play ([renderer film](#renderer-film)). Since 2026-11-16 the sun's map follows the top-down zoom (`sunMapScale`): still 2,048 texels, but one texel is 1, 2, 4 or 8 world pixels so the shaded square covers the view and the tall faces south of it (scale 2 at 0.25×, 4 at 0.1× on 1,280 × 800); the snap step, fade and sampling offsets grow with it. First person keeps scale 1 Since 2026-11-22 [266](../tactical/266-dynamic-shadows.md) adds opt-in dynamic shadows (`r_dynshadows`, Options): moving bodies cast the sun's shadow from a second per-frame map and drop their contact shadows |
| Cutaways, slab fades, roof visibility | Done for the top-down camera | 2026-11-16: overhead decks (bridge decks and ramp ends, garage levels: `isOverheadDeck`) are each their own mesh and fade to `REVEAL_OPACITY` over the seat's body with the fixed view's rule (`surfaceDisplay`) and the view's own fades. Unit-tested on the rail-crossing recipe and seen in the world geometry lab (`lab-capture.mjs crossing trackside`): the south ramp fades over the player as in the fixed view. Ground-built slabs (motocross) occlude by depth instead. Since 2026-11-16 room props (tree houses: parts with an inside and an outside `view`) swap pictures with the fixed view's rule (`observerInsideRoom`): top-down, each picture's pieces stand on the depth planes the fixed view sorts them by (`appendPiecePlane`: upright at their row, or flat on the deck), the inside one while the view's body is in the cabin; first person keeps the volumes. The tree-house lab (`lab-capture.mjs tree-house ground|inside`) matches the fixed view both ways apart from sun shadows; before, its 120 px deck box wore shifted artwork above the cabin |
| Rooms shown roofless | Done for play | 2026-11-16: the top-down 3D view draws rooms as the fixed view's picture (`FirstPersonRoomScene` with `topDown`): the floor raster on the floor; an editable room's walls in the fixed view's two-row bands (`wallBands`), each upright at its sort row with its rows below that lying on the floor, so bodies sort against walls as in the fixed view; a legacy room's walls on the floor, behind everything, as the fixed view draws them. Furniture stands as its artwork at its anchor row (rows below lie on the floor), rugs lie on the floor lifted along the view ray, and bodies take the fixed view's plain oval shadows (rooms have no depth pass). First person keeps full walls (230 slice 2). Seed-2026 apartment and shop: static content identical to the fixed view (`scripts/first-person/room-capture.mjs`; what differs is animation phase and shadow edges). `?rooms3d=0` hands rooms back to the fixed view. Room labs (`LabView` with an interior) stay on the fixed view |
| Tow and bed groups posed together | Done top-down; other cameras accepted for retirement | 2026-11-16: a body's image holds its towed car and bed contents, posed as the fixed view poses them. First person and headset views: members draw at their own poses (229 limit); owner accepted the flat-ground mesh comparison on 2026-11-17 for retirement |
| Emergency lights and flashing sprites | Done | 2026-11-16: mesh vehicles flash through their lens materials, as meshes and as pixel images (lit bodies are drawn each frame, not cached). A vehicle drawn as its sprite gets the fixed view's 4 × 2 lamp in the effects draw (`emergencyLamp`). Invincibility flashes hide the card, as in the fixed view |
| Excavations (garage ramps below ground) | Partial | 2026-11-17: an excavation's roof (`excavationCeilings`) is an overhead deck although it lies at ground level, so it fades over a body on the dug floor with the fixed view's rule; seen in the garage lab (`lab-capture.mjs garage garage`). The owner prefers the 3D view's sun shadows there. Still open: the fixed view hides the dug floor while the roof is opaque and the observer is outside; the 3D scene relies on ground to cover it, and the lab has none. Whether real ground gets a hole over a ramp is not checked: no generated world has a garage |
| Building mode and editor overlays | Done | 2026-11-16: building mode (`EditScene`) draws through the unified top-down view whenever play would (same `renderFirstPerson` path, seat 0 alone), outdoors and in rooms. Its overlays (tile grid, cursor and brush shapes, elevation tint, pattern and room previews, remote cursors) are the same overlay items, drawn on the UI canvas above the 3D view (`RenderHost.drawUiOverlay`), so they sit above bodies; the fixed view draws them between terrain and bodies outdoors. Seed-2026 condo street and apartment room: identical to the fixed view apart from the sun's shadows (`scripts/first-person/edit-capture.mjs [--room]`). Since 253, a first-person seat edits through the unified top-down camera, and `PropEditorScene` uses the same scene with collision guides above it |
| Picking, tap and hold destinations | Done for the top-down camera | 251: it is the fixed view's own camera, so the fixed view's unprojection, markers and tap destinations are used unchanged. Cameras that turn (orbit, XR) still need a ray against the 3D ground |
| Split-screen regions and diagonal masks | Done for play | Rectangular regions done (249), also for top-down 3D views. Play only lays out one view, two side by side or a 2×2 grid (`seatLayout`); the unused diagonal GPU region probe was retired in 253. Play has no diagonal layout |
| Door overlays and realm transitions | Done | 2026-11-16: the door-opening sprites (`DoorPresentation.appendOverlays`) join the 3D view's collection, and bodies crossing a door are the same presented copies as in the fixed view. A realm change resets the 3D scene's world |
| Labs, explorer and renderer probes | Migrated/retired in 253 | All `LabView` consumers, including illustrated rooms and grid underlays, use the shared scene. Explorer tiles and the terrain blend study use its non-simulating `TopDownPreview` host. Fixed-only renderer lab/probes and parity/film captures are removed. Room/edit capture scripts capture unified drawing only; old comparison measurements below remain historical |
| Context loss recovery | Done | 249 phase 1a; merged meshes re-upload (251) |

Settled, owner 2026-11-17: in the `crowd` scene, cars parked north of the shop
row draw over the roofs in the fixed view and behind the buildings in the 3D
scene. The 3D scene is correct; the fixed view is not matched. Where the two
views differ, the unified one is the reference from here on.

Fixed 2026-11-17: a solid prop whose artwork has holes (the park fountain's
statue) showed the inside of its box top-down: the north wall, wearing the
south face's picture again, stood dark behind the statue. Walls the fixed view
never shows (east, west, north: `unseen`) are not drawn by the top-down camera.
City solids unchanged (identical at 1×). The fountain's sun shadow is still its
box's.

### Renderer film

2026-11-16: motion behaviour cannot be judged from one picture, so
`scripts/first-person/film.mjs` makes enlarged side-by-side videos. With
entities paused and presentation time held, the camera pans from a whole screen
pixel at walking speed and carries the player with it, as following does. Each
frame draws the same moment through each column's renderer
(`canvas.__parityFilm`, which shares the parity probe's drawing). A frame
depends only on its index, so runs repeat exactly.

```sh
node scripts/first-person/film.mjs --scenes=woods,city,pond --zooms=1,0.5
node scripts/first-person/film.mjs --scenes=woods --speed=24 --columns=fixed,scene,snapped
```

Columns: `fixed` (as played), `scene` (the 3D top-down camera as played) and
`snapped` (the 3D camera held to whole screen pixels, a preview of snapping).
Grass sway, water and walk cycles stand still; only the camera moves.

What the first films show, for the owner's style decision:

- **Camera fraction.** The fixed view draws the world at whole pixels, then
  moves the finished picture by the camera's fraction of a pixel with a
  bilinear filter (215). Layers stay locked together, but while panning the
  whole screen alternates between sharp (fraction near 0) and soft (near 0.5)
  every few frames. The 3D scene is always sharp, but ground, cards and actors
  each rasterise at their own fractional position, so their edges step on
  different frames. That is the shimmer, and the source of scenery drifting a
  pixel against the ground. Snapping the 3D camera keeps every layer sharp and
  locked, and moves the picture in whole screen pixels.
- **Player shadow.** The fixed view shows none in play: the depth pass's oval
  for the player is 10 × 5 world px, centred 3 px north of the feet, so it lies
  wholly under the sprite, and the pass never shades upright bodies. Robins'
  ovals do show. Before the depth texture exists, the fallback oval at the feet
  shows (the first frame of a session). The 3D scene draws a dark, hard-edged
  contact blob under the feet.
- **Tree shadows.** The fixed view has a soft round shadow under each tree;
  the 3D scene adds the sun's shadow, a large dark patch offset to one side.
- **Grass over the player.** In the 3D scene the blades the player stands in
  draw over the body (blades do not write depth); the fixed view keeps them
  behind it.
- **Fractional zoom (0.5×).** One texel is 1.5 screen pixels, so texel widths
  alternate in both renderers; the fixed view then softens the frame.
- **Moving NPCs and cars** (`--scenes=traffic --others=25`: cars, people and
  rabbits placed round the player, moving at their own speed). The fixed view
  draws a moving actor between pixels with a bilinear step, so people and
  rabbits are always soft, and softer again under the camera's fraction. The 3D
  scene's actor cards are nearest-sampled: at 1× (3 screen pixels a texel) they
  stay sharp and step a screen pixel at a time; at 0.5× texels drop and double
  as they move (a person's eyes come and go). Cars are the same in both, the
  fixed view's images with their one-pixel soft edge.

Owner review, 2026-11-16: the fixed view looks blurry in motion, and the 3D
camera held to whole pixels looks jittery. The continuous 3D camera is the
better base; what it lacks is a sampling rule for fractional scales.

**Settling after a stop.** Owner report: in the unified view, trees shimmer
for a moment after the player stops; ground and trees are handled differently.
Play's follow camera trails the player exponentially, so after a stop it creeps
by shrinking fractions of a pixel. The 3D ground averages four samples per
pixel and glides, cards (trees, actors) take one sample and step whole pixels,
and blades, actors and their contact blobs sit at their own fractions, so each
steps on a different frame. `--stop=1.5` films this (walk, stop, play's own
`advanceCameraFollow`). Two prototype columns:

- `nearest`: the ground sampled once per pixel, as cards are (`GROUND_NEAREST`;
  in play `?groundnearest=1` or `r_groundnearest`). It also removes a one-pixel
  seam line the averaged ground draws at some chunk edges in the city.
- `rigid`: that ground, plus the camera, every entity and every blade placed on
  one grid of screen pixels in world space, so the picture moves as one.

Pixels that move against the rest of the picture between consecutive frames
while the camera settles (after the best whole-pixel shift; walk 1.5 s at
64 px/s, then 2 s):

| Scene | Today: frames, mean px | Rigid: frames, mean px |
| --- | --- | --- |
| woods 1× | 76, 45 | 0, 0 |
| woods 0.5× | 71, 63 | 0, 0 |
| city 1× | 37, 210 | 0, 0 |
| city 0.5× | 47, 219 | 15, 6 |

The owner accepted the pixel grid in play on 2026-11-16, and it became the
top-down default the same day (`PixelGrid.ts`): the actor stage places each
body's interpolated position and height on the grid (`pixelGrid` in
`collectWorldSprites`), with no entity copies. `?pixelgrid=0` (`r_pixelgrid 0`)
turns it off; `?groundnearest=1` keeps only the ground sampling. The film's
`rigid` column is play; `scene` is the earlier sub-pixel placement. Picking and
markers still use the fixed view's continuous camera, up to half a screen pixel
from the gridded eye.

**Delayed final pixel step, fixed 2026-11-16.** A second owner report identified
a different settling fault: the picture appears still, then moves one pixel
after a long pause. The render-time exponential follow had no finite endpoint.
Stopping just beyond a rounding boundary reproduced a 1,450–1,467 ms still
interval before that last step, even with every layer sharing the pixel grid.
`Camera.presentFollow` now finishes each stationary axis when its remaining
error is at most one screen pixel (`1 / camera.scale`). Moving targets keep the
existing response, including slow travel; the change does not increase the
general follow rate. The fixed view and following labs share this policy. The
ordinary film's stop replay now uses `Camera.presentFollow` too.

`node scripts/first-person/settling.mjs` replays the original unbounded follow
and production camera through the actual unified renderer, with the same frozen
world and a stop 0.0001 screen pixels beyond a rounding boundary. It asserts the
old fault reproduces in the captured pixels and that the new run has no step
after a still interval longer than 150 ms. On the M4 Pro's Metal renderer at
60 Hz, the longest still interval is now 117 ms at 1× and 100 ms at 0.5×; the
last pixel moves 550 / 433 ms after stopping and the camera then equals its
target exactly. The runner writes before/after videos (left/right), frames and
full traces to its `--out` directory; the compact
[measurement record](../benchmarks/camera-settling-2026-11-16.json) is committed.

`CameraFollow.test.ts` covers 270 traces across 30/60/120 Hz, five zooms,
both directions and rounding ties, with no pixel movement after a >150 ms
still interval and exact settlement within 750 ms of the stop. It also retains
slow motion and restart behavior. All 66 selected camera, timeline, player,
top-down scene and lab presentation tests pass, together with typechecks,
focused lint, code health and the generated art/Workshop inventories. This is
Mac evidence; no phone or Deck run is claimed.

### Pond shoreline comparison

2026-11-15: investigated the owner's report that pond edges look different in
the unified view. The parity runner now has an explicit `pond` scene: seed 2026,
arrival at tile (215, −196), on the western bank of `pond:1:-2`.

```sh
node scripts/first-person/parity.mjs --headed --scenes=pond --zooms=1,0.75,0.5,0.25 --out=/tmp/tilefun-pond-parity
```

Bundled Chromium on the Mac, 1,280 × 800, with both renderers drawing the same
moment and the probe snapping the camera to screen pixels:

| Zoom setting | Ground pixels differing by more than 24 in any RGB channel | Mean largest channel difference (0–255) |
| --- | --- | --- |
| 1 | 0% (byte-identical ground) | 0 |
| 0.75 | 0.418% | 0.442 |
| 0.5 | 0.552% | 0.548 |
| 0.25 | 0.249% | 0.243 |

These percentages cover the whole ground frame, not just shoreline pixels.
The captures show the same scalloped grass/sand/water boundaries in both views;
no different autotile selection or texture repeat scale was reproduced here.
The shared terrain pages retain their artwork, while the 3D ground shader takes
four samples per pixel and averages them in linear light. Fractional zoom therefore
changes boundary colours. Tree shadows and sprite sampling also differ in the
complete scene, independently of terrain tiling.

The run had no reported errors. This is one seeded pond with a snapped camera;
it does not rule out a different location, camera phase or first-person issue.
Next: use the owner's exact view if its edge shapes differ, and include this
pond when qualifying the top-down sampling rule in slice 5.

### Grass

The 3D scene draws the fixed view's own blades: `collectCameraGrass` collects
them for the view's camera each frame with the fixed view's placement, sway,
push from bodies and zoom fade (none at 0.25× and below), and `GrassCards`
writes them as one mesh of leaning cards read from the page atlas. One draw.

- A blade is an upright card turned in its own plane, which the top-down camera
  shows as the fixed view's turn on screen. The card stands at the blade's
  anchor, so it is in front of or behind a body by the same row the fixed view
  sorts on. The artwork's rows below the anchor would be under the ground; the
  blade material writes their depth as that of the ground they cover (plus a
  quarter pixel, `bladeDepth`). Until 2026-11-16 the card stood a row or two
  south of its anchor instead, which put blades just north of a body's feet
  over its legs.
- Blades blend at the frame's opacity and do not write depth. They hide behind
  anything nearer, cover an actor's feet only from in front, and stay under
  vehicles, which the fixed view also keeps above grass. Where blades overlap
  each other they draw in collection order, not sorted by depth.
- Blades are collected and written on the CPU every frame, as in the fixed
  view. Mac, main-thread render p50, unified against fixed: woods 1.0 against
  1.2 ms at 1× and 2.2 against 2.7 ms at 0.4×; city 0.8 against 0.7 and 1.2
  against 1.3. No missed frame. Not yet measured on the phone or the Deck.
- The top-down camera only. Whether first person and headset views get grass,
  and how tall it stands there, is open.

### Vehicles

Owner request, 2026-11-16: top-down play in the unified view should keep the
fixed view's pixel look for vehicles, the one-pixel ink outline and native-pixel
texels. First person may not want it; that is undecided, so first person and
headset views keep meshes.

- The top-down camera asks the host for the fixed view's own image of each body
  (`SharedMeshAssets.bodyImage`, `GpuMeshBodies.bodyImage`): the same render,
  outline pass, cache keys and tow and bed grouping. A body is culled before
  anything is rendered for it when its image square is off screen.
- `BodyImageCards` draws each image as a square on the ground plane. Its
  fragments write the depth the image's depth texture records, so bodies still
  hide behind buildings and each other, and take the sun's shadow where each
  texel stands. The filter is the fixed view's for actor images: nearest texels
  on the square's own pixel grid, one bilinear step onto the screen, blended in
  display-encoded colour. The image's faint contact disc is dropped; the 3D
  scene's contact shadows stand in.
- Images lent to 3D views must outlive the frame's later renders, so they never
  use the scratch target and never evict a cached image already used this
  frame. Uncached ones go to a 16 MiB per-frame pool (`GpuMeshBodies.held`).
  Over that budget, or while assets or paint load, the view draws the mesh.
- `r_pixelcars3d` and `?pixelcars=0` turn it off for comparison.

Cost, `render:bench` with `--scenes=city,cars,fleet --zooms=1,0.25` (`cars`:
50 parked bodies from the cache; `fleet`: the same with the cache off, the
moving-fleet worst case). Fixed view / unified with meshes / unified with images:

| Device | Measure | city 1× · 0.25× | cars 1× · 0.25× | fleet 1× · 0.25× |
| --- | --- | --- | --- | --- |
| M4 Pro Mac | GPU timer, p50 ms | (fixed not rerun) · mesh 0.52 · 0.80 · images 0.82 · 1.20 | 1.88 · 5.16 / 0.52 · 1.02 / 0.98 · 2.47 | 1.91 · 7.97 / 0.53 · 1.04 / 1.00 · 3.25 |
| Pixel 7a, 60 Hz | render + finish, ms | 3.7 · 3.9 / 3.2 · 3.3 / 3.4 · 3.5 | 3.6 · 4.0 / 3.2 · 5.2 / 3.4 · 4.6 | 3.8 · 4.9 / 3.1 · 5.0 / 3.7 · 5.0 |

- No missed frames anywhere except `cars` at 1× on the phone, 2 of about 290
  with meshes and with images alike (not with the fixed view). Phone battery
  23.6 → 25.6 °C over the three runs. The Deck was not measured.
- Images cost the Mac's GPU 0.3 to 2.2 ms more than meshes, from two offscreen
  passes per rendered body (draw calls fell: crowd 42 → 20 at 1×), and stay well
  under the fixed view, which makes the same images. On the phone they cost 0.2
  to 0.6 ms of render plus finish over meshes, except 50 parked cars at 0.25×,
  where they are cheaper (4.6 against 5.2 ms). They are no worse than the fixed
  view there except that cell (4.6 against 4.0 ms).
- If a crowded scene needs it, every body's image can render into one shared
  atlas pass instead of a target switch per body.

### Building bodies

Owner decision, 2026-11-15: a building stands as tall as its artwork implies,
and its collision box may change to match the picture.

The fixed view draws a box of depth D and height H over D + H screen rows, so a
facade's picture fixes both: the roof deck's rows are the depth and the wall's
rows below it the height. `buildingBody` (`BuildingRecipes.ts`) reads that from
a recipe's pieces, and `getWallsForPropType` makes it the building's one wall,
for collision, the fixed view's depth and shadows, and the 3D volume alike.

| Family | Before (depth × height) | Now |
| --- | --- | --- |
| Condos | 32 × 240 to 384 | 112 × 128 to 272 |
| Storefronts with apartments, regional facades, offices | 48 × 144 to 336 | 96 × 48 to 240 |
| Hotels | 32 × 304 to 536 | 112 × 192 to 384 |
| Shop row (`prop-shopping-v1-*`) | 16 × 64 | unchanged: its picture is all wall |

- Before, the height was the whole picture, roof included, on a footprint a
  third as deep as the roof: tall, thin boxes that stood 32 to 48 px above
  their artwork from above.
- The deck is the highest row of pieces that spans the frontage. A hotel's deck
  is deeper than its top row (112 px, down to the cornice), recorded in
  `prefabRoofDepth` and not on the prefab, whose record is its reviewed identity.
- `groundDepth` no longer sizes the collision box. It still sets a lot's street
  margin, and the promoted asset banks keep it unchanged.
- Bodies reach further north inside ground their lots already reserved. No
  generated prop stands in the newly solid ground (88 buildings, seed 2026,
  chunks −45 to 45).
- The shop row is still 16 px deep: its roof is a separate ground piece, which
  is the parked-cars disagreement above.

## Device scorecard

`npm run render:bench` is the common measure
([236](../tactical/236-render-scorecard-and-gpu-shadows.md) owns commands and
limits). `--query=` selects the renderer under test: `view=fixed` for the
classic fixed view, `view=topdown3d` (or, since 2026-11-16, none) for the unified
top-down view, `view=fps` for first person. The runs below predate the default
and used none for the fixed view.

All three devices, 2026-11-16, after building mode, raised ground, tree houses
and the zoom-following sun map: render p50 in ms (missed frames), 5 s per cell,
zooms 1 / 0.25 / 0.1. The Deck ran the production build (`da90ca88`) in the
packaged shell over CDP; the phone and the Mac the dev build. Cells:
[evidence](../benchmarks/unified-topdown-scorecard-2026-11-16.json).

| Device | Scene | Fixed view | Unified top-down |
| --- | --- | --- | --- |
| M4 Pro Mac, 120 Hz | city | 0.6 (0) / 0.9 (0) / 1.2 (0) | 0.5 (0) / 0.7 (0) / 0.9 (0) |
| | woods | 1.0 (0) / 1.2 (0) / 2.3 (0) | 0.9 (0) / 0.7 (0) / 1.5 (0) |
| | crowd | 1.9 (0) / 3.2 (0) / 4.3 (0) | 2.3 (0) / 3.1 (0) / 4.5 (0) |
| Pixel 7a, 60 Hz | city | 3.5 (2) / 3.8 (0) / 4.9 (0) | 3.4 (0) / 3.5 (0) / 4.3 (0) |
| | woods | 4.3 (1) / 4.7 (0) / 5.5 (0) | 3.6 (0) / 3.6 (0) / 4.5 (0) |
| | crowd | 7.2 (11) / 12.3 (4) / 15.8 (26) | 7.4 (14) / 11.6 (12) / 12.4 (5) |
| Steam Deck, 90 Hz | city | 2.2 (0) / 3.2 (0) / 5.3 (0) | 1.9 (0) / 2.4 (0) / 3.4 (0) |
| | woods | 3.4 (0) / 3.7 (1) / 6.4 (0) | 2.6 (0) / 2.4 (0) / 5.3 (0) |
| | crowd | 7.0 (67) / 13.8 (4) / 16.2 (0) | 7.0 (87) / 11.4 (17) / 13.6 (2) |

- `city` and `woods`: the unified view is no slower than the fixed view in any
  cell on any device and misses no frame.
- The crowd (1,000 rabbits, 50 cars) is bound by the authority on the phone
  and the Deck in both renderers (ticks of 17–27 ms against a 16.7 or 11.1 ms
  step), so its missed frames are not a render measurement. Its render time is
  lower in the unified view except on the Mac at 1× and 0.1× (2.3 against 1.9,
  4.5 against 4.3 ms) and the phone at 1× (7.4 against 7.2); its GPU time on
  the Mac is a quarter of the fixed view's zoomed out (2.5 against 13.6 ms at
  0.25×).
- Earlier the same day, before these slices, the phone measured city 2.9 / 3.2,
  woods 3.8 / 3.7 and crowd 5.7 / 9.7 ms unified at 1× / 0.25×.

Main-thread render time, p50 in ms, at zooms 1 / 0.25 / 0.1, after 251's merge.
Tables with p95, missed frames, draw calls and the before-merge cells are in
[251](../tactical/251-top-down-camera-parity-and-merged-meshes.md#3d--delivered-2026-11-14);
full cells in [evidence](../benchmarks/251-device-scorecard.json).

| Device | Access | Scene | Fixed view | Unified top-down |
| --- | --- | --- | --- | --- |
| M4 Pro Mac, 120 Hz | local | city | 0.6 / 0.8 / 1.1 | 0.5 / 0.8 / 1.0 |
| | | woods | 1.0 / 1.2 / 2.1 | 0.5 / 0.9 / 1.6 |
| | | crowd | 2.0 / 3.7 / 4.3 | 2.0 / 3.0 / 3.8 |
| Pixel 7a, 60 Hz | adb, bench `--cdp` | city | 3.5 / 3.6 / 4.7 | 2.7 / 3.2 / 4.9 |
| | | woods | 4.1 / 4.7 / 5.3 | 2.6 / 3.5 / 4.3 |
| | | crowd | 8.0 / 12.7 / 18.3 | 6.7 / 11.4 / 21.1 |
| Steam Deck, 90 Hz | `npm run deck:*`, bench `--attach-page` | city | 2.1 / 3.0 / 4.9 | 1.4 / 1.8 / 3.4 |
| | | woods | 3.3 / 4.0 / 6.1 | 1.4 / 2.1 / 4.9 |
| | | crowd | 7.6 / 14.1 / 17.0 | 6.5 / 11.1 / 12.9 |
| Quest 3 | adb, Quest Browser | — | Not a headset view | Headset sessions: table below |

- `city`, `woods` and the driving scene hold the display's cadence in the
  unified view on all three devices. The crowd overloads the authority on the
  phone and the Deck in both renderers, so its rows are not clean render
  measurements there.
- This older table is from before the unified view drew grass, particles and
  decals; the table above supersedes it.
- First person after the merge, city / woods at zoom 1: Mac 0.7 / 0.9 ms, Pixel
  7a 3.8 / 3.4, Deck 1.8 / 2.5. Driving on the phone: 4.4 ms, no missed frame.

Headset sessions on the Quest 3 at 72 Hz
([252](../tactical/252-xr-on-the-shared-scene.md#quest-3-frame-pacing),
`scripts/first-person/xr-quest.mjs`). Each cell is late frames of about 720,
then the session's frame work in ms (p50): controller poll, game ticks and
drawing, which is not the render time the table above reports.

| Scene | Screen (the page's canvas) | First person | Tabletop |
| --- | --- | --- | --- |
| city | 0 late, 4.8 | 1 late, 5.7 | 0 late, 5.1 |
| woods | 1 late, 6.6 | 4 late, 6.8 | 1 late, 5.3 |

- At the headset's own 90 Hz every mode, the screen included, is late for 1 to
  4% of frames, so sessions ask for 72 Hz. The GPU takes 0.7 to 2.9 ms a frame.
- Nobody wore the headset for these runs: no head movement, no controllers, no
  judgement of comfort.

All four devices were reachable on 2026-11-14. Concrete device selection comes
from `~/code/machine-control` and private inventory at run time; none of it is
recorded here.

Stereo (252): first person draws 60 calls in the city in the headset against 25
on its flat page, and 12 against 6 in the woods. Halving the city's calls did
not bring 90 Hz back (page work 4.9 → 4.7 ms), so vehicle meshes were not
batched: the screen, which draws no eyes, already takes 4.5 to 6.6 ms of page
work a frame and misses 90 Hz as often as first person does.

Draw calls (251): **go.** Merged, the 3D scene's static content is 4 to 25
draws at any zoom. The Deck gained up to 1.8 ms from the merge; the phone was
not limited by draw calls. What is left is vehicles, 8 to 16 meshes a car with
one render each, and the fixed view makes a similar number into its vehicle
images (its bench count used to leave them out). 252 then measured stereo on
the Quest 3 and did not need to batch them.

## Retirement gate

Three owner decisions, in order. Each needs the evidence listed.

1. **Opt-in.** An Options choice for the unified top-down view. Needs ground
   artwork, registration within the probe's recorded tolerance, and no missed
   frames in `city` and `woods` on the Mac, the Pixel 7a and the Deck.
2. **Default.** The unified view becomes the default, with the fixed view still
   selectable. Needs every checklist row done or explicitly waived by the owner,
   scorecard cells no worse than the fixed view on all three devices at zooms 1,
   0.25 and 0.1, labs running on it, and an owner and child play review.
   **Taken 2026-11-16 on the owner's instruction** to proceed. Where it stood:
   the scorecard holds for `city` and `woods` on all three devices (the crowd is
   authority-bound); the checklist rows still open are listed under
   [Next](#next); labs run on it on request (`?view=topdown3d`), not by default;
   the owner and child play review has not happened yet.
3. **Retirement.** The fixed GPU backend's world drawing is deleted. Needs a
   period as default without reported regressions, and probes and labs moved or
   retired. The review raster stays. **Authorized and completed 2026-11-17**
   in 253: shared terrain/atlas/body-image resources retained, immutable review
   pixels unchanged, broad local coverage and hosted Linux smoke/native gates
   passed. No child play approval or new physical-device scorecard is inferred.

## Retirement inventory

253 migrates the following consumers; its execution record owns validation.
All rows are complete; 253 records the broad run, bounded correction reruns and
final passing hosted revision. Shared image resources remain.

| Consumer | Retirement change |
| --- | --- |
| Play/software WebGL | Always unified; software smoke asserts an actual 3D world frame |
| Loading/failure/context loss | UI frames; automatic scene recovery after context restoration |
| Building with a first-person seat | Temporarily use that seat's top-down camera, retaining its look for Play |
| Prop editor | Shared scene over its editable prop geometry; collision guides remain UI |
| Room labs | Shared room scene with wall bands and anchor-placed furniture |
| Grid/underlay labs | Bounded diagnostic texture on a ground plane behind bodies |
| Explorer tiles | Offscreen `TopDownPreview`, copied into the map at device pixels |
| Terrain blend study | The same preview over its production terrain rasters |
| Fixed-counter browser specs | Unified presented-sprite hooks, view counts and shared page-resource observations |
| Renderer lab/fixed-only probes | Retired with their fixed sprite/shadow/decal/composition subjects |
| Parity probe/film | Retired; no second world renderer to compare |
| CPU terrain rasters, page atlas, vehicle images | Retained shared resources |
| Review raster and immutable snapshots | Retained independently; all 2,130 candidate pixel identities unchanged at the first migration checkpoint |

## Software WebGL investigation (2026-11-17)

Historical step-2 checkpoint, before the retirement implementation in 253.
The fixed fallback described in this checkpoint is subsequently removed.

Owner request: remove the player-facing choice and commit it, then investigate
the software-GPU cost before retiring the fixed renderer. The choice removal is
committed as `71f1e81d`. The interrupted investigation's temporary forced-3D
source edit is removed; the software fallback policy is unchanged.

`render:bench --software-webgl` now launches the browser suite's bundled
headless shell with its exact SwiftShader flags, verifies the actual GL renderer
string, and records `drawing3d` in each cell. Both lanes use explicit URL choices,
so they need no source edits or different builds. Commands, timings and limits:
[paired evidence](../benchmarks/software-webgl-renderer-2026-11-17.json).

Local M4 Pro, Chromium 156, macOS, 1280×800 at DPR 1, seed 2026; steady
camera after terrain preparation. Samples are 4 seconds at 1×/0.25× and
5 seconds at 0.1×. FPS below is approximately sampled frames / sample seconds.
Lanes ran sequentially, with their order reversed for the 0.1× cells.

| Scene | Zoom | Fixed FPS | Unified FPS | Fixed / unified GPU p50, ms |
| --- | --- | --- | --- | --- |
| City | 1 | 44.2 | 59.0 | 19.06 / 13.89 |
| City | 0.25 | 41.0 | 56.0 | 18.60 / 14.11 |
| City | 0.1 | 49.0 | 40.0 | 16.39 / 20.77 |
| Woods | 1 | 59.2 | 59.8 | 13.64 / 8.61 |
| Woods | 0.25 | 56.2 | 60.0 | 14.46 / 9.78 |
| Woods | 0.1 | 42.0 | 45.6 | 18.14 / 17.24 |
| Crowd (1,000 rabbits, parked cars) | 0.1 | 14.0 | 20.2 | 55.60 / 38.51 |

The reported threefold slowdown does not reproduce. Unified is equal or faster
in six of seven cells; the widest city view is slower. Short, local software-GPU
samples do not establish hosted Linux performance, a whole-suite pass or device
acceptance. GPU timers measure SwiftShader work here, not physical GPU speed.

The existing CI smoke (`smoke`, `worker-server`, `pwa`) passes all 12 cases
with each view explicitly selected, one worker and zero retries, against the
same production build and current manifest. Summed test time is 66.6 s fixed
versus 67.9 s unified; this excludes browser/server setup. A temporary wrapper
sets the URL choice before app startup without editing game source or test
bodies. Separate playable-world preflights confirm SwiftShader and the expected
active renderer; the wrapper is removed after measurement. The normal-Chromium
character-manifest test and fixed-view embedded train-recall test also pass
after restoring manifest freshness. Build, the two view-choice unit cases,
focused script/JSON lint and diff checks pass.

The interrupted full-suite experiment is not a valid retirement qualification:
it forced 3D by editing `unifiedTopDown.ts`, failed the manifest build check,
then used `vite build` directly without refreshing the Workshop manifest. Its
log explicitly reports **Review inputs changed. Rebuild the Workshop manifest
before saving.** The 527 passes, 32 failures and two retry flakes include many
disabled-review-button failures caused by that stale inventory. They cannot
establish a 3D regression. A train-recall assertion and the deer/garden retry
flakes remain unattributed under that run's load; the train assertion passes
alone, and there was no matched full-suite baseline.

Step 2 is complete as an investigation. The smoke does not require retaining
fixed drawing on the measured machine, but deleting it still needs the
inventory above: migrate fixed-counter specs and editor/lab/explorer consumers,
provide loading/lost-context frames, then qualify unified drawing on hosted
Linux and the affected browser contracts. No fallback or CI timing policy is
changed by this investigation.

## Open questions

- Top-down takes the sun's shadows (owner, 2026-11-16); the map follows the
  zoom since the same day.
- Artwork outside a building's box: drawn since 2026-11-16 (see the solid
  props row).
- Whether stereo and headset "flat" modes use the oblique camera or the orbit
  overhead preset (230). An oblique shear is exact on a page but is not a
  physically viewable camera in a headset.
- How much of the fixed view's CPU terrain rasteriser stays. Since 250 the 3D
  ground wears its chunk images, so it stays at least until something else
  makes them.
- Texture memory at the far view distance (250): 48.5 MiB of ground pages on
  the GPU and 60 MiB of chunk images on the CPU for one view. Not measured on
  the phone. A cap, or a fade to average colours, is the fallback.
- Terrain preparation ranks every chunk of a 3D view's interest square as on
  screen (250 review). A nearer "on screen" set for 3D views is open.
- Page ageing (250): the page store drops a page nobody drew for 120 frames,
  which is one second at 120 Hz. Wide animation sheets then upload pages again
  and again, in both renderers. Whether the age should be a time, not a frame
  count, is undecided.
- Headset display rate (252): sessions ask for 72 Hz because 90 Hz misses 1 to
  4% of frames on a Quest 3. Whether a production build, or less work in the
  page's frame, holds 90 Hz is not measured.
- Edges in the headset (252): the shared context has no multisampling, so the
  eyes show hard edges. Turning it on changes the fixed view's context as well.
- A HUD inside a session (252, 230): prompts, gems, markers and chat are HTML or
  the 2D overlay canvas, and a session shows neither.
- The page atlas inside a session (252): on the Quest 3 a framebuffer copy of
  the atlas misses pages written since the session began; it grows by drawing
  there. The cause was not found, and other copies of that kind inside a session
  are suspect until it is.
- First person in the woods on the Quest stalled once for about 0.2 s in each
  run (252). Not investigated.
- WebGPU is not part of this work
  ([renderer options](../research/sprite-to-3d-and-renderer-options.md#renderer-choices)).

## Next

- Family play review remains useful for feel and device regressions. No child
  approval is inferred from the owner's retirement authorization.
- Excavation floor visibility from outside and a real generated garage remain
  separate content follow-ups. Tow/bed posing in first person was accepted for
  retirement by the owner on 2026-11-17; that review used a flat-ground mesh
  stand-in, not a captured first-person ramp traversal.
- Owner headset checks remain in [252](../tactical/252-xr-on-the-shared-scene.md#owner-checks-on-the-headset):
  controller mapping, comfort, tabletop placement/scale and Resume behavior.
- 230's orbit camera and page stereo remain independent camera work.
