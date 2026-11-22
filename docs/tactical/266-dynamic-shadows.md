# 266 Dynamic shadows

Status: delivered and enabled by default · 2026-11-22. Owner request after the
[construction playground](265-construction-playground.md): moving bodies only
shaded the floor under them, as soft contact shadows. Any moving body should
cast onto the ground and onto other bodies, without a large frame cost.
Owner: [rendering architecture](../topics/rendering-architecture.md).

## What changed

Moving bodies cast the sun's shadow in top-down and first-person views.
**Options → Dynamic shadows** saves the choice in the browser for both the game
and Workshop. `r_dynshadows 0` and `?dynshadows=0` turn it off for a session.

- Vehicles, boats, cargo, the crane, the marble, chute and seesaw, 3D animals and
  sprite actors cast onto the ground, buildings, decks, each other and themselves.
  The forklift's mast throws its lattice on the ground and crates shade each other.
- A body that casts drops its soft contact shadow. In first person a mesh's
  sides turned away from the sun are in shadow, as a building's are.
- It defaults to on. Rooms and views with the sun's shadows off use contact shadows.

## How it works

`FirstPersonShadows.ts` (`DynamicShadows`), `FirstPersonSun.ts` (math),
`FirstPersonMaterials.ts` (receivers).

- **A second map, redrawn every frame.** [247](247-first-person-shadows-and-walls.md)
  caches a depth map of the static world along the sun's rays. The dynamic map
  uses the same projection (`sunProjection`) at a finer scale and holds moving
  bodies only, at the poses the frame draws. The static map stays cached.
- **Casters.** Shared vehicle and cargo meshes are posed and drawn depth-only
  (`FirstPersonVehicles.drawDepth`), also where the top-down view shows them as
  images. Animal models are marked on a scene layer. Sprite actors are written
  a second time as cards facing the sun, as standing trees are in the static map.
  Every drawn mesh casts, with or without a contact shadow (boats have none);
  a sprite casts only where the collector gives it a shadow. A raised body is
  admitted by where its shadow falls (`reaches`), not where it stands.
- **Receivers.** `sunLightAt` takes the darker of the two maps. Static faces,
  standing cards and grass are not in the dynamic map and sample it with a small
  offset. Meshes (`solid`) use the surface's facing: sides turned from the sun
  are shaded without a lookup, the rest sample from one texel off the surface.
  Actor cards (`actor`) are in the map facing the sun: the half behind that card
  samples further along its own ray to the sun, so the lookup stays on the texel
  its shadow falls on and only something higher on that ray shades it. Standing
  cards (`card`) sample where they stand, not at the offset the static map needs.
  Vehicle images (`image`) have no surface direction and sample further
  towards the sun.
- **Resolution.** 2048², a power-of-two texel from 0.25 to 8 world pixels chosen
  from what the view must cover (`dynamicTexel`): 0.5 px in play at 3× on
  1,280 × 800, and in first person, where the map reaches 400 px from the eye.
  The origin moves in 16-texel steps, so a resting body's shadow edge is steady
  under a moving camera.
- **Handover.** Shadows fade out towards the map's edge and the caster's contact
  shadow fades in by the same curve (`dynamicStrength`).
- **Bounds.** At most 64 vehicle and cargo meshes are drawn into the map per
  frame, nearest first; the rest keep contact shadows. The view's own limit of
  24 animal models and one batch of actor cards come on top of that.
- **Off.** No map is drawn or kept (it is about 12 MB per view while on).
  Receivers still declare its sampler, which reads the sun's map behind a fade
  that ends at zero, so each shaded pixel pays one more distance test; contact
  shadows carry one more float per vertex.

## Measurements

`npm run render:bench -- --headed --scenes=city,cars,fleet,crowd,wildlife
--zooms=1,0.25 --query=dynshadows=0|1`, M4 Pro, 120 Hz, 1,280 × 800, bundled
Chromium, working checkout, one run each. p50 off → on:

| Scene, zoom | Render callback ms | GPU ms | Draw calls |
| --- | --- | --- | --- |
| city 1× | 0.6 → 0.7 | 0.69 → 0.89 | 29 → 49 |
| city 0.25× | 0.9 → 1.2 | 1.44 → 1.52 | 113 → 221 |
| cars 1× (50 parked) | 0.7 → 1.0 | 0.86 → 1.05 | 46 → 116 |
| cars 0.25× | 1.4 → 2.1 | 3.08 → 3.01 | 331 → 704 |
| fleet 1× (image cache off) | 0.8 → 1.0 | 0.88 → 1.05 | 49 → 119 |
| fleet 0.25× | 1.7 → 2.2 | 5.32 → 5.07 | 446 → 819 |
| crowd 1× (1,000 rabbits) | 2.7 → 2.6 | 0.84 → 1.09 | 51 → 135 |
| crowd 0.25× | 4.0 → 3.6 | 3.78 → 5.77 | 302 → 689 |
| wildlife 1× (24 models) | 0.8 → 0.7 | 0.47 → 0.71 | 15 → 25 |
| wildlife 0.25× | 0.9 → 0.9 | 0.64 → 0.80 | 15 → 24 |

No cell missed a frame in either run (8.3 ms cadence). The cost is the second
draw of each body: draw calls about double where vehicles are many, and the
render callback grows by up to 0.7 ms. Populated scenes are not exact replays
(rabbits wander), so the crowd's render difference is within its noise.

The table was taken before the review changes below, which altered lookup
offsets and which bodies cast, not the passes.

Off against clean HEAD, same bench (`city`, `cars`, `crowd` at 1× and 0.25×,
one run each): render 0.6–3.0 ms and GPU 0.72–2.97 ms are equal within 0.1 ms
in every cell except the crowd's GPU time at 0.25× (5.53 → 3.80 ms), which
varies with where the rabbits wander.

Limits: one desktop only. The Steam Deck and phones are CPU-bound in rendering
([performance](../topics/performance.md)), where doubled vehicle draw calls
will cost more. Split screen draws one map per view and was not measured.

## Known gaps

- **First person shows no shadow of the viewer's own body.** That body is left
  out of collection for its own view, so nothing draws it into the map.
- **A rigged vehicle carried in a top-down group.** The grouped image poses a
  carried vehicle without its fork or boom rig (`GpuMeshBodies`), while the map
  draws it with the full pose: with forks raised on a transporter, the shadow
  shows them raised and the image does not. The image path predates this work.
- **Coarse maps lift lookups.** A mesh samples one texel off its surface. At
  0.25× the texel is 2 px, so a shadow starts about 3 px from a contact.

## Review

Codex (GPT-6.2-Sol, high) reviewed the working tree before the commit and found
no blockers. Taken: raised casters culled by ground position; shadow lookups
moved off the sun ray for actor and standing cards; meshes without a contact
shadow not casting; target binding outside the pass's `try`; the bounds and
off-mode wording here, with the HEAD comparison. Recorded above instead: the
viewer's own shadow and the carried vehicle's pose.

## Validation

- Native: map scale, snapping, handover and raised-caster reach
  (`FirstPersonSun.test.ts`);
  the view draws bodies in reach into the map before its own frame, including
  bodies shown as images and a mesh without a contact shadow, drops their
  contact shadows, keeps them beyond the map and with the sun off
  (`FirstPersonView.test.ts`). These use a renderer that draws nothing: they
  pin what is drawn and in what order, not the map's pixels.
- Seen in bundled Chromium: the marble run, seesaw and construction yard labs
  (`?dynshadows=1`), the city in first person, the wildlife and crowd bench
  scenes (also with vehicles as meshes, `pixelcars=0`), and zooms 3×, 0.5× and
  0.25×. The Options button, its saved choice across a reload and the cvar were
  exercised in the game. Not seen: boats, rooms, a headset, split screen and a
  restored graphics context.

## Next

- Measure on the Steam Deck, on a phone and in split screen.
- Collect the viewer's own body for its shadow in first person, and pose a
  carried vehicle once for its image and its shadow.
- If draw calls matter there, draw each shared mesh's instances without a
  scene traversal per body, or lower the 64-body limit by device.
- Owner play review of the look: silhouette shadows for sprite actors, and
  shaded mesh sides in first person.
