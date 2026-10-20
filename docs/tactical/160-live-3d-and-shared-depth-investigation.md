# 160 — Live characters and shared scene depth

Status: initial source audit and bounded GPU comparison complete; production route
and appearance acceptance remain open. Date: 2026-10-20.
Owners: [rendering architecture](../topics/rendering-architecture.md),
[3D assets](../topics/3d-assets.md), [characters](../topics/characters.md).

Owner direction: investigate leaning further into live 3D for characters and
other assets currently finished/exported as sprites. This follows the request for
co-op vehicle passengers and a dump bed containing movable objects and people.
The investigation covers rendering and source readiness; ordinary game behavior,
promoted artwork, wildlife repair scope and the current camera remain unchanged.

## Questions and first findings

Two decisions can proceed separately:

1. **Shared depth:** can existing character sprites participate in 3D occlusion
   with vehicles and props? The first schematic GPU proof passes.
2. **Live character meshes:** can retained authoring geometry, appearance and
   animation become good runtime assets? Some source geometry/animation exports,
   but direct export does not preserve finished character art or supply a complete
   gameplay animation/identity inventory.

The current body path from [042](042-optional-mesh-bodies.md) renders a mesh body
into an isolated target, then inserts its color texture into the existing ordered
sprite scene. Depth is local to that body. This let meshes share the old draw
ordering, fixed projection and sprite fallback. Logical-pixel rendering and
outlining can also be applied to a shared-depth scene; they do not inherently
require isolated per-object color images.

## Actual source/export audit

The repeatable `scripts/instrumentation/inspect-3d-sources.py` opens four retained
sources with script execution disabled, evaluates geometry/animation metadata,
optionally exports fresh scratch GLBs and checks every source hash afterward.
Blender 5.2.2 LTS performed the recorded trial. All four source hashes remain exact.
[Retained audit](../research/live-3d-160/source-audit.json) records source hashes,
counts, materials and actual GLB animation inventories.

| Source | Source visible meshes / evaluated triangles | Trial GLB | Exported animation |
| --- | --- | --- | --- |
| Original upright Tiger | 47 / 14,040 | 541,392 bytes; 13,886 triangles; 48 primitives | One 11-bone skin; one clip / 33 channels |
| Wildlife Tiger pilot | 46 / 20,580 | 1,558,644 bytes; 20,580 triangles | 30 separate part-action clips |
| Rabbit behavior-v1 | 24 / 5,376 | 431,880 bytes; 5,376 triangles | 16 separate part-action clips |
| Static upright Explorer rider | 1 / 1,956 | 153,284 bytes; 1,956 triangles | None; one packed 256² atlas |

The audit counts objects in the saved scene and samples a few timeline frames;
it does not certify all clips, contacts, export semantics or runtime performance.
The upright Tiger's source modifier evaluation and exported topology counts differ;
retain the measured counts separately rather than claiming identical geometry.

Important source distinctions:

- Of the 27 selectable player appearances, the existing character docs identify
  a retained standing Blender rig for upright Tiger. The other five promoted
  appearances are authored pixel-pattern characters driven by pose guides, not
  complete matching standing-avatar meshes. Classic and the twenty legacy people
  also need explicit matching source inventory/authoring. The four isolated seated
  rider identities are separate static prototypes, not walking-avatar coverage.
- `art-source/pixel-characters/person.json` explicitly uses Tiger's pose guides
  while drawing Explorer's own face, hair, clothes and backpack in pixel masters.
  Reusing the guide mesh would substitute the wrong identity. The same distinction
  matters for the other authored pixel characters.
- The wildlife Blender samples have real closed volume and articulated motion,
  but their finishers construct final integer drawings from guides/masters. Native
  face clusters, coat markings and outlines are not a ready runtime texture atlas.
- The upright Tiger's Blender `ShaderToRGB`/ramp material chain does not survive a
  direct GLB export as the intended bands. All five exported base-color factors
  are black; orange and cream export with white emission. Actual Three rendering
  shows the lost orange/cream distinction. Portable unlit palette/UV materials
  need deliberate conversion and appearance review.
- The part-action exports need clip assembly/slicing into shared idle, travel and
  action timelines. A list of exported actions is not playable semantic coverage.
  The Rabbit saved frame is 200 despite its 1–46 scene range, another reason to
  select explicit animation ranges instead of exporting the saved pose blindly.

## Executed GPU comparison

`scripts/instrumentation/live-3d-comparison.mjs` owns an isolated static HTTP server
and bundled full Chromium, then closes both. It uses the production
`setCarMeshProjection`, an unchanged Explorer sprite and a schematic five-part
open bed. It adds no production model, physics, lab or Workshop art candidate.
Raw captures, scratch exports, bundled code and the self-contained gallery are
ignored under `data/3d-investigation/`.

The fixture compares:

- **Isolated body:** bed rendered to a texture, then the whole character drawn on
  top. This models the existing composition boundary; it is not an invocation of
  the complete game collector/backend.
- **Local shared depth:** bed plus alpha-tested upright sprite plane rendered
  together into the small target, then composited.
- **World shared depth:** the same bed and sprite drawn directly together into
  the canvas using the same projection and resolution.

This is a pre-outline rendering diagnostic. Double-sided bed faces explicitly
handle the handedness of the custom game projection. A CPU ray/triangle query at
opaque sprite pixel centers independently checks the GPU's visibility result.
It compares expected actor/bed colors within one channel value; ambiguous exact
depth ties are counted, not silently accepted. There were zero ties in this run.

| Heading / bed tilt | Actor pixels hidden / visible | Isolated-vs-shared changed pixels | Local-vs-world changed pixels | Ray-oracle mismatches |
| --- | --- | --- | --- | --- |
| 0° / 0° | 33 / 168 | 33 | 0 | 0 |
| 45° / 0° | 5 / 196 | 5 | 0 | 0 |
| 0° / 25° | 180 / 21 | 180 | 0 | 0 |
| 45° / 25° | 146 / 55 | 146 | 0 | 0 |

Thus existing character pixels can survive while depth correctly hides only the
parts behind a bed wall. The flat sprite plane approximates anatomical depth;
it does not establish a volumetric person, sitting pose or body-shaped collision.

The browser also loads the unmodified upright-Tiger trial GLB. One skeleton clip
plays at two explicit times, changes 393 rendered channels, and submits 48 draws /
13,886 triangles in each capture. This is a direct playback proof with the failed
material appearance still visible. It is not an optimized crowd budget or an
assertion that the other three exported sources play correctly.

[Retained GPU report](../research/live-3d-160/comparison.json) pins the exact script,
projection, sprite and trial-GLB hashes. The fixture has zero browser page errors.
The native/large screenshot gallery was inspected separately from the assertions.

## Decision and next comparison

The local and world approaches are pixel-identical for this **one group**. This
does not establish which is faster or which handles an open world better.
Surrounding props, intersecting vehicles, buildings, grass, cutaways and other
independently rendered actors are outside the fixture. Including more interacting
objects in a local group also changes its bounds, ordering and resource ownership.

Proceed with a bounded **shared-world-depth** scenario before selecting the
production route. Compare it against grouped rendering on the same content/state:

1. Keep the fixed game camera and current physics. Use one actual retained road
   vehicle, one open-bed/support diagnostic, two unchanged sprite billboards,
   one verified live character mesh, a ground patch and an exterior occluder.
   Include a second overlapping vehicle to expose group-order limitations.
2. Use the real scenario/Worker state and shared read-only presentation. Define
   neutral world transforms/asset identities for mesh and billboard submissions;
   keep Three.js resources in the backend. Explicitly align feet, units, visual
   registration, authoritative support and interpolated poses.
3. Compare native-pixel current sprites, billboard depth and the live character
   in motion. Qualify silhouette, face/marking readability, palette/outline,
   partial occlusion, frame stability and alpha cutouts. Add debug collision,
   sprite-plane/depth, foot/contact and hinge overlays described in
   [vehicles](../topics/vehicles.md#bed-geometry-and-debug-inspection).
4. Measure CPU preparation, GPU submissions, cold upload/resident bytes and
   actual device pacing for representative populations. Include disposal and
   resource recovery. A shared target may remove body blits but adds other costs;
   record measurements before making a performance/default decision.
5. Only then choose shared-depth/group boundaries, character material/animation
   export rules, remaining sprite-asset handling and Canvas/loading/failure
   behavior. Preserve existing fallback capabilities while the prototype is
   compared; future fallback feature parity needs an explicit product decision.

Seat ownership, loose bed support and tipping contacts remain distinct shared
gameplay concerns. More accurate visual meshes never silently change collisions.
Broader first-person cameras, engine/language changes, a full character conversion
campaign and automatic replacement of approved art are outside this investigation.

## Replay and validation

Use a fresh ignored source output directory for trial exports:

```sh
blender --background --factory-startup --disable-autoexec -t 2 --python scripts/instrumentation/inspect-3d-sources.py -- --output data/3d-investigation/NEW-SOURCE/source-audit.json --trial-export
node scripts/instrumentation/live-3d-comparison.mjs --source-root=data/3d-investigation/NEW-SOURCE --output=data/3d-investigation/NEW-COMPARISON
```

No asset generation runs in ordinary builds. The comparison needs full bundled
Chromium for its pixel contract; source inventory/export and clip/shape inspection
run below the browser. Avoid an exhaustive per-species/browser matrix. Existing
source hashes and promoted banks remain unchanged. Repository typecheck, unit,
lint and build/regression results follow.

Final checkpoint:

- A second fresh Blender export and full-Chromium comparison reproduce both
  retained JSON reports exactly, including all trial GLB hashes and pixel counts.
  The inspector's Python syntax check passes; every retained source/tool hash
  still matches. Scratch GLBs, galleries, bundles and caches are Git-ignored.
- All three typechecks, repository lint and the production build pass. Lint
  retains 120 existing warnings and 37 informational diagnostics.
- The existing browser regression for mesh rotation, ordered composition and
  atomic fallback passes (one focused case). The standalone source/depth harness
  is the new GPU-specific experiment, not a new fleet-wide browser matrix.
- The bounded full Windows unit run records 6,390 passes, five known failures
  and ten skips across 348 files (534s). The unchanged FsSecurity/privateDataPlugin
  symlink-privilege failures and SqliteRecordStore process-death test account for
  the five failures; staticFiles has its known symlink setup/dependent cleanup
  hook failures and ten skips. No new diagnostic was introduced by this slice.
- The browser-free node integration/comparison lane passes its one case.

Follow-up [162](162-shared-world-depth-comparison.md) completes the bounded actual
vehicle/outside-occluder comparison using headless authority snapshots. Shared
host/Worker integration and live-character appearance remain open. These results
establish source/export and visual-depth feasibility, not production passengers,
cargo physics, a live-character rollout or device budgets.
