# Renderer unification

Topic: renderer-unification
Status: committed direction, 2026-11-14; slices 1 (one renderer host), 2 (ground
artwork, shared page atlas), 3 (opt-in top-down camera, parity probe, merged
meshes, device scorecard) and 4 (play in a headset) delivered the same day;
slice 5 (top-down parity) started 2026-11-15 with building bodies and grass. The fixed 2D
view is the default top-down renderer and stays so until the
[retirement gate](#retirement-gate) is met.
Updated: 2026-11-15.

Owns the move to one world renderer: its status, parity checklist, device
scorecard and decision gates. [Rendering architecture](rendering-architecture.md)
still owns backend boundaries and resource lifetimes. The plan and its slices are
in [248](../tactical/248-renderer-unification.md).

## Decision

Owner, 2026-11-14: unify the renderers, accepting that it takes time. WebXR is
wanted as well, and a third renderer is not.

- The first-person 3D scene ([229](../tactical/229-first-person-view.md),
  [247](../tactical/247-first-person-shadows-and-walls.md)) becomes the one world
  renderer. Top-down, first person, chase, orbit and XR are cameras on it.
- Unification runs in that direction only. The first-person view is not merged
  into the fixed 2D backend.
- The fixed 2D view stays the default for top-down play until the unified one is
  good enough. Until then it is not deleted, not degraded and not left unmaintained.

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

- **Default.** Top-down play, labs, the explorer and probes draw through the
  fixed GPU backend until the retirement gate. New top-down features keep working
  there.
- **Review raster.** `ReviewRasterBackend` and fingerprinted review images are
  outside this work and stay.
- **No cost to the default.** A slice must not slow the fixed view. Check the
  affected `render:bench` cells when shared code changes.
- **One presentation evaluation.** Both renderers keep reading the shared
  collector, mesh poses and shadow shapes. Nothing here changes simulation,
  prediction or replication.
- **Opt-in until gated.** The unified top-down camera is a debug or Options
  choice. It becomes the default only by owner decision.
- **Device claims need device runs.** The Mac alone does not show that a change
  is safe on the phone, the Deck or the headset.
- **Labs.** Shared changes account for embedded labs
  ([embedded engine labs](embedded-engine-labs.md)).

## Trying the unified top-down view

Open the debug panel with **F3** (or **More → Debug** in the world menu) and
toggle **Unified top-down 3D (experimental)**. It changes top-down play for the
whole device immediately and stays in sync with `/r_topdown3d 1` / `0` in the
console and the startup flag `?view=topdown3d`. It is off by default and is not
saved across reloads. This debug opt-in does not change the Options/default
gates below; the parity checklist still applies.

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
| 5 — Top-down parity | In progress since 2026-11-15: building bodies match their artwork (solid props identical at 1×), and grass blades are drawn (99% overlap). Sprite edges with pixel snapping are next | checklist below |
| 6 — Opt-in, default, retirement | Not started (owner decisions) | gate below |

## Top-down parity checklist

What the unified top-down camera needs before it can replace the fixed view.
States: missing, partial, done. Add rows as differences are found.

Numbers are from the parity probe
([251](../tactical/251-top-down-camera-parity-and-merged-meshes.md#3b--delivered-2026-11-14),
`node scripts/first-person/parity.mjs --headed`) in `city`, `woods` and `crowd`
on the Mac. "Overlap" is the share of a kind's pixels that both renderers draw.
Run the probe again when a row changes state. The solid props and grass rows
were measured on 2026-11-15; the other rows are 251's.

| Item | State | Notes |
| --- | --- | --- |
| Framing and registration of actors and vehicles | Done at whole pixels | Actors identical in the city at 1× (3,735 pixels, none different). Vehicle silhouettes overlap 95–97%. Both align best with no move at zooms 1 and 0.25 |
| Registration of standing cards (trees, posts, forest rows) | Partial | 98% overlap at 1×, best one pixel to the left: the fixed view floors a static sprite's screen edges to whole pixels and the 3D card is rasterised where it falls |
| Solid props (buildings) | Done at 1×; partial zoomed out | 2026-11-15: identical at 1× in the city (28,672 pixels, none different; was 54% overlap) and 97.8% overlap at 0.25× (was 86%), where 12% of shared pixels differ in colour from sampling, as for ground. A building's physical box is now the one its artwork depicts ([building bodies](#building-bodies)). Artwork outside the box is not drawn in 3D: rooftop and side signs, and the hotel's carpet south of its feet |
| Ground artwork (terrain pages, road markings, paths) | Done at 1×; partial zoomed out | Identical at 1×. At 0.25× in the city 1.1% of pixels differ on crosswalk stripes and lane dashes: four samples per pixel against the fixed view's one. The top-down camera still needs its own sampling rule |
| Grass blades | Done for the top-down camera | 2026-11-15: 99% overlap at 1× in all three scenes (city 1,215 against 1,222 pixels, woods 30,252 against 30,382), about 1% of shared pixels a different colour; 99% at 0.4× and 0.5×, inside the zoom fade. What is left is the edge pixels of leaning blades. See [grass](#grass). First person and headset views draw none |
| Particles and contact effects | Missing | |
| Surface decals | Missing | |
| Sprite edges | Missing | 3D cards are hard cutouts (`alphaTest`) with one sample per pixel; the fixed view blends filtered edges at fractional zoom. Wildlife overlaps 83–88% at 1× (the soft shadow painted into those sprites is cut off) and 67–84% at 0.25× |
| Pixel snapping and stable sampling at fractional zoom | Missing | Fixed-view rules from 213 and 215. The standing-card row above is the first measured case |
| Vehicle shading | Partial, new in 251 | A fifth to a third of vehicle pixels differ in colour where both draw: the 3D scene shades bodies with its sun |
| Raised ground | Partial, new in 251 | The fixed view tints raised tiles and draws cliff artwork; the 3D scene wears the plain ground image and flat brown walls. The generated world is flat, so only edited worlds show it |
| Body shadows | Partial | 3D has sun shadows and contact shadows; the fixed view has the deferred depth pass. The two are not comparable (340–6,800 pixels against 5,500–72,000). Choose one look for top-down. Zoomed out, the sun's map (2,048 px) covers only the middle of the view |
| Cutaways, slab fades, roof visibility | Missing | `SurfacePresentation` |
| Rooms shown roofless | Missing | First person draws rooms with full walls (230 slice 2). The top-down 3D view hands rooms to the fixed view |
| Tow and bed groups posed together | Missing | 229 limit: members draw at their own poses |
| Emergency lights and flashing sprites | Missing | |
| Excavations (garage ramps below ground) | Missing | 229 limit |
| Editor overlays | Missing | The editor falls back to the fixed view |
| Picking, tap and hold destinations | Done for the top-down camera | 251: it is the fixed view's own camera, so the fixed view's unprojection, markers and tap destinations are used unchanged. Cameras that turn (orbit, XR) still need a ray against the 3D ground |
| Split-screen regions and diagonal masks | Partial | Rectangular regions done (249), also for top-down 3D views; a 3D view falls back to the fixed view in a diagonal mask |
| Door overlays and realm transitions | Missing | |
| Labs, explorer and renderer probes | Missing | They pin the fixed backend's pixels |
| Context loss recovery | Done | 249 phase 1a; merged meshes re-upload (251) |

Known disagreement to settle: in the `crowd` scene, cars parked north of the
shop row draw over the roofs in the fixed view and behind the buildings in the
3D scene.

### Grass

The 3D scene draws the fixed view's own blades: `collectCameraGrass` collects
them for the view's camera each frame with the fixed view's placement, sway,
push from bodies and zoom fade (none at 0.25× and below), and `GrassCards`
writes them as one mesh of leaning cards read from the page atlas. One draw.

- A blade is an upright card turned in its own plane, which the top-down camera
  shows as the fixed view's turn on screen. Its foot stands a pixel or two south
  of the blade's anchor, so the artwork's rows below the anchor are not under
  the ground.
- Blades blend at the frame's opacity and do not write depth. They hide behind
  anything nearer, cover an actor's feet from in front, and stay under
  vehicles, which the fixed view also keeps above grass. Where blades overlap
  each other they draw in collection order, not sorted by depth.
- Blades are collected and written on the CPU every frame, as in the fixed
  view. Mac, main-thread render p50, unified against fixed: woods 1.0 against
  1.2 ms at 1× and 2.2 against 2.7 ms at 0.4×; city 0.8 against 0.7 and 1.2
  against 1.3. No missed frame. Not yet measured on the phone or the Deck.
- The top-down camera only. Whether first person and headset views get grass,
  and how tall it stands there, is open.

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
limits). `--query=` selects the renderer under test: none for the fixed view,
`view=topdown3d` for the unified top-down view, `view=fps` for first person.

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
- The unified view draws less than the fixed view (no particles or decals), and
  the table is from before it drew grass. On the Mac grass took the woods at 1×
  from 0.5 to 1.0 ms, still under the fixed view's 1.2 ([grass](#grass)). The
  phone and the Deck are to be measured again as slice 5 adds content.
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
3. **Retirement.** The fixed GPU backend's world drawing is deleted. Needs a
   period as default without reported regressions, and probes and labs moved or
   retired. The review raster stays.

## Open questions

- Whether top-down in the unified view keeps its own shadow look or takes the
  sun shadows. If it takes them, the sun's map must follow the zoom: at 0.1× it
  covers only the middle of the view (251).
- Artwork outside a building's box (signs above the roof or beside the wall,
  the hotel's carpet): the 3D scene does not draw it. A standing card for a
  sign and a ground decal for a carpet are the likely forms.
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

Slice 4 is delivered for owner play, so the open work is:

- **Owner checks in the headset**
  ([252](../tactical/252-xr-on-the-shared-scene.md#owner-checks-on-the-headset)):
  the controller mapping, comfort in first person, the tabletop's placement and
  scale, and the Resume flow. These decide what the next XR work is; a HUD in
  the session and multisampling are the known gaps.
- **Slice 5, top-down parity**, ordered by what the probe measured. Building
  bodies and grass are done. Next: sprite edges and pixel snapping together
  (standing cards one pixel off, soft sprite shadows cut, small sprites
  unfiltered when zoomed out), then particles and surface decals. Decide the
  shadow look before touching shadows. Measure the phone and the Deck again
  now that the unified view draws grass.
- 230's orbit camera and stereo on the page can land at any time.

Gate 1 (opt-in in Options) needs ground artwork (done), registration within the
recorded tolerance (holds for ground, actors, vehicles and cards, and since
2026-11-15 for solid props) and no missed frames in `city` and `woods` on the
three devices (holds). It is an owner decision.
