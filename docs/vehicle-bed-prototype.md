# Vehicle bed gameplay and extension workflow

The articulated dump-bed playground runs the normal scenario Worker, binary replica,
player prediction, shared scene collector and selectable game renderer. Find
**Truck bed playground** in Workshop tools, or use
`workshop.html?geometry=truck-bed#/tool/world-geometry` in the checkout you run.
[Tactical 164](tactical/164-playable-truck-bed.md) retains the original proof;
[165](tactical/165-truck-bed-gameplay.md) owns normal-game activation and cargo;
[167](tactical/167-tipping-dump-bed.md) adds tipping, tailgate motion and discharge;
[vehicles](topics/vehicles.md) owns the next product work.

## In the game

Place **Edit → Vehicles → Construction dump truck**, return to play and stand beside the stopped
truck. The normal vehicle panel offers **Ride in bed** and **Drive car**. A bed
rider remains an independent person: walk, jump or use **Climb out** while stopped.
Another player can drive while people ride visibly in the bed. This is separate
from enclosed passenger seats and does not require a character mesh.

Bring a loose ball, fruit, nut, root or twig beside the truck and press **Load
cargo**. **Unload cargo** places the same object on clear nearby ground. These
are real actor identities, with no copying, inventory conversion or rigid seat
attachment. Animal-held/claimed food and growing resource sources are excluded.
Loading/climbing requires stopped motion, nearby ready terrain, free space and
clear external wall/ceiling clearance across the rim. A full bed or blocked exit
reports an error without moving anyone. Cargo and riders save their actual floor
heights; old dump-truck records acquire the qualified hollow profile on restore.

Ordinary generated dump trucks have the same profile. Their normal road-size
admission and autonomous behavior are unchanged. Wait until stopped to board/load.
**Tip bed** raises the stopped truck's tub to 48 degrees over 3.2 seconds. Its
upper-hinged tailgate opens automatically and the hydraulic rams extend. Loose
contents drift downhill once the incline overcomes friction, then fall onto
ordinary ground. People remain upright and can walk or jump. **Lower bed** returns
to level; driving, loading and climbing controls require level equipment. The
driver operates it from the cab, or an unmounted nearby person can operate an
unoccupied truck. An occupied cab owns the controls. Stopped/nearby/paused/storage
checks still apply. Obstructions pause the physical motion until cleared or the
operator reverses it. Ordinary unowned balls retain their three-second cleanup
once discharged; owner toys and food keep their normal persistent identities.

## Playground and clipping inspection

The Workshop fixture includes two loose objects beside the truck. **Stand beside
truck** is an explicit diagnostic teleport; the in-scene game panel then uses the
same normal loading/boarding requests as the game. **Load into bed** remains a
separate diagnostic teleport. WASD/arrows move and Space jumps. **Drive truck**
uses ordinary autonomous traffic on the bounded road. Heading selection resets
the fixture; actual driven turning is separately qualified in native scenarios.

**Show clipping geometry** opens the shared collision layer controls. Orange shows
physical walking obstacles (floor, walls, cab/chassis and tire clips), green their
standing tops, blue active player/cargo bodies, yellow upright sprite planes and
white your feet. Red driving bodies and gray search bounds are separate optional
layers. **Shape names & heights** adds object IDs, part names and Z ranges for
screenshots. The game exposes the same collector and color key through **F3 →
Collision overlay** or `r_showbboxes 1`. The game initially hides standing tops,
sprite planes and search bounds; the bed playground starts with its standing and
sprite layers enabled. Green shows possible support, not a current contact.
Pause and step inspect contacts;
paused game controls are locked. Renderer switches preserve the Worker/world.
Reload retains truck, cargo identities and the recessed rider height. The fixture's
traffic target resets to stopped; a saved residual velocity still brakes normally.

## Three representations with one registration

The active visible model is the 3,720-triangle articulated
`public/assets/models/vehicles/dump-truck-v2.glb`
(`237be10a2c5e63b9e7b226d4d6e4acd84f623e703386a2b43b43f3e0baecc719`).
The v1 model, source bundle, atlas and old capture receipts remain byte-identical.
V2 keeps the same rest vertices/UV paint and six wheel rigs, adding separate tub,
tailgate and extending-ram transforms. Its source bundle is
[retained v2](../art-source/vehicle-bake/dump-truck/v2/). Changed poses await human
appearance inspection; engine qualification does not create an art approval.

[VehicleBed.ts](../src/traffic/VehicleBed.ts) holds thirteen plain prisms: chassis,
floor, cab, four tub walls and six fixed conservative tire clips. A prism has bottom/top XY rectangles and bottom/top
Z heights. Different rectangles express the outward wall slopes. The tub prisms rotate about
the source rear pivot; the tailgate rotates independently about its upper hinge. These are
deliberately simple contact shapes; cab/chassis and rim extents are conservative,
not triangle-perfect replacements for the visual model.

Dimensions come from the retained
[geometry](../art-source/vehicle-bake/dump-truck/v1/geometry.py) and
[family registration](../art-source/vehicle-bake/dump-truck/v1/family.json).
The source's export scale is `400/23`; the loader flips forward/side axes into
game coordinates and keeps Z up. Current dump-truck height/lateral fits are 1.
The actual floor top is source Z `1.25`, or `21.73913` world pixels; its center is
game X `-20.34783`. The ordinary broad body remains `112 × 46 × 49` for road
admission, vehicle movement and broad-phase queries.

Authority and prediction query the same convex shapes for pedestrian side collision and
support tops, including the recessed and inclined floor. Moving support preserves an actual
local position and support height rather than always snapping to the roof.
Standing occupants remain loose walkers; they are not parented to a driver seat.
Their existing `10 × 6 × 12` physical player collider is unchanged. It intentionally
does not describe the full painted silhouette or anatomical character depth.

## Rendering and fallback

The collector moves an overlapping player's ordinary sprite item into the truck's
neutral `bedGroup`. No Three.js object enters simulation or scene data. The GPU
backend adds a foot-registered, alpha-tested upright plane to the truck's existing
local depth target, then applies the normal inward outline. Source atlas UVs,
orientation, frame and transparency are preserved. Textures/pool meshes belong to
the backend and are retired on asset replacement, backend disposal or scene clear.

At level rest Canvas, GPU-without-meshes and pending/failed meshes retain the
original cardinal sprite. At nonzero tilt a software depth rasterizer uses the
retained v2 triangles, UVs and same atlas, with one-degree pose quantization and a
bounded twelve-image cache. This requires no WebGL or successful GLB request.
Contents are clipped against rays through the same posed physical prisms. This keeps
fallback gameplay inspectable, but it is an **approximate visual clip**: the
loaded model uses actual triangles, while fallback uses the simpler contact
geometry and cardinal source image. Do not assert exact fallback/mesh pixel parity.

The group still participates in ordinary whole-object scene ordering. It does
not resolve the cross-group wall conflict demonstrated in
[162](tactical/162-shared-world-depth-comparison.md), and it does not introduce a
shared world depth buffer. Terrain/other props retain their current rendering.

## Profile activation and persistence

Normal dump-truck creation sets `vehicleBed: true`; restored older dump trucks
migrate to the same profile. Other vehicle types retain their existing roof/body
behavior. Adding another profile remains explicit qualification work.

Routed dump trucks retain a continuous `vehicleHeading`, shared by the mesh,
physical bed and moving contents. It remains stable on stopping and reload;
cardinal fallback artwork does not determine the bed's physical yaw. Autonomous
road admission retains the existing routing policy. Pedestrian/support indexes
and visual grouping use `bedQueryBounds`: continuous yaw plus articulated
overhang. They must not reuse the cardinal road-admission box. Sparse and crowded
indexes update the posed bounds, including angular-only equipment movement; this
keeps rear-bed food/riders in support and local depth across diagonal chunk seams. Airborne bed occupants use
the hollow volume for crossing/push checks, with actual wall motion still checked
before committing the vehicle step. They retain world momentum during a jump.

The flag travels through snapshots, nullable deltas, hydration and `SavedTraffic`.
Current frame tag `0x09` carries nullable `vehicleBedTilt`/`vehicleBedTarget`
(introduced in 0x07); matching endpoints are required and older tags are rejected. A supported
player's `roofRide` save includes relative `height`; older records without it
retain roof-height semantics. Loose contents remain ordinary durable actor records
at their actual world positions/heights. Shared moving support carries loose
objects only on qualified beds. Cross-boundary dependency tickets keep truck/load
neighborhoods together while active and expire when ordinary activity ends.

Balls resolve floor landings, wall rebounds and support loss against the same bed
geometry. They do not bounce off the truck's broad solid-body proxy. Settled bed
cargo does not expire simply for being an unowned ball. Food retains its resource semantics. Qualified bed cargo acquires downhill drift
and gravity; it is still an ordinary actor, never a hidden cargo inventory. Food
position changes explicitly dirty durable records, including final landing.
Tilted support and grounded step-up queries are shared by player prediction and
authority. Displayed rider anchors sample the same bed pose as the truck.

## Repeating the proof or extending to another vehicle

1. Keep the retained visual asset immutable. Read its actual constructor, export
   units, ground origin, source forward axis and game height/lateral registration.
   Derive the floor, inner walls and openings from those dimensions, including
   wall thickness and any conservative approximation. A screenshot alone is not
   sufficient geometry evidence.
2. Add a qualified plain geometry profile and model opt-in. This first proof
   explicitly qualifies only the dump truck; extending the type guard, persisted
   validation and shared fallback pose is part of adding the next profile.
   Keep vehicle road/body admission conservative while hollow actor queries
   use the detailed shapes. Avoid changing every truck implicitly.
3. Use the same pose/shape data for collision, support and debug. Use the actual
   model for loaded visual depth. Verify feet, floor, near/far walls and yaw in
   native pixels with the normal loader and fixed game camera. Do not derive a
   character collision body from its rendered outline.
4. Exercise walking into walls, landing, jumping out, carrying/braking, binary
   replication and reload in `ScenarioSession` tests. Cover prediction rebasing
   separately: every support-height assumption must use the selected surface.
   This prototype found and fixed a client path that still snapped to roof height.
5. Use one focused browser boundary for Worker input, actual GPU composition,
   backend replacement and overlays. Keep shape/yaw/contact variants in native
   tests. Inspect source-pixel UV orientation for both ImageBitmap and HTML images.
6. Register a Workshop geometry candidate with the relevant runtime/renderer
   source identity. Run catalog/manifest generation and the normal validation
   gates. Changed art needs fresh human review; this engine proof creates no art
   approval. Keep all scratch captures and bundles under ignored `data/`.

Capture a self-contained gallery with its own isolated server and full bundled
Chromium (both close when the command completes):

```sh
npx tsx scripts/instrumentation/truck-bed-playground.ts --tipping --game
```

Open `data/3d-investigation/truck-bed/index.html`. It includes center/near-wall
poses, a jump, all four headings, both sprite fallbacks, loaded cargo and clipping overlays.
These sample live authority and are diagnostic captures, not immutable approval
snapshots. A running isolated developer server can instead be supplied with
`--base-url=http://127.0.0.1:PORT`; that borrowed server is left running.
Add `--game` to also capture normal desktop/phone gameplay using that same isolated
server; both test browsers and an owned server close when finished.

To capture actual editor placement, loading, bed walking and phone boarding through
the normal GameClient/Worker, run this against an isolated dev/preview server. Its
fresh test browser owns its temporary worlds and closes afterward:

```sh
npx tsx scripts/instrumentation/truck-bed-game.ts --base-url=http://127.0.0.1:PORT
```

The desktop/390px touch images and ordinary authority/renderer diagnostics are in
`data/3d-investigation/truck-bed-gameplay/`.

## Articulated extension contract and remaining limits

Use `scripts/vehicle-bake/dump-truck/articulate.py` to replay v2 into a **fresh**
ignored output directory. It refuses an existing retained recipe. The source
recipe pins v1 components, atlas, constructor and every final artifact; repeat
exports reproduce exact GLB/atlas/software-geometry bytes. Blender scene saves
carry workspace metadata, so blend-file byte replay is not claimed.

For another mechanism, retain a new revision, explicit pivots/axis tags and actual
rest geometry/UV parity. Define plain support/contact geometry in those same
component coordinates. Keep fixed-clock authority, current pose/target persistence,
nullable replication, upright support carry, foot-height prediction and visual
pose sampling aligned. Validate swept equipment **and** supported heads against
external props and unloaded chunks before committing. Dynamic fallback must show
the moving parts too. Debug consumes actual posed shapes, not an unrelated box.

The dump's chassis proxy now follows the narrower underframe rather than the old
full-width elevated shelf. Walls/cab/chassis remain conservative contact shapes;
tiny hydraulic hardware is visual geometry, not an anatomical collision surface.
V2 adds four draw meshes (eleven authored meshes versus seven in v1), retaining
3,720 triangles. It currently embeds two identical atlas images/materials from
its two retained child scenes; deduplicating those is a future source revision,
not a silent rewrite of this recipe. The 128px target radius also covers raised
diagonal poses (the original 112px rest target was insufficient). No general rigid-body engine or material mass/friction solver is
claimed: loose contents use bounded frictional downhill drift and existing gravity.

Crates, enclosed passenger seats, independently commanded tailgates, forklift loads
and mixer equipment remain follow-ons. Local depth still has the external-occluder
limitation from tactical 162; this does not establish shared world depth or a
mobile performance budget.
