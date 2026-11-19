# Authoring pixel-styled 3D assets

Use this workflow for a small live-mesh experiment in Tilefun. The [3D assets
topic](topics/3d-assets.md) tracks current experiments. For a vehicle, start
with the [vehicle authoring pipeline](vehicle-authoring-pipeline.md) and its
wheel, pivot and projection checks. For field names, dimensions and axes, use
the conventions of the asset's engine consumer.

## Pick a reference and a test scene

- Start with one asset and a playable scene where it can be compared with a
  visual reference. Capture the reference at its native size and enlarge it
  with nearest-neighbor sampling for inspection. For sprite ports, read the art
  source too. The rabbit's Blender render supplied the poses and projection.
  The [pixel masters](../art-source/wildlife-v2/rabbit/pilot-v1/masters.json)
  supplied the final light, shadow and silhouette.
- Identify what survives at normal zoom. For the rabbit it was the long rump,
  tilted ears, light muzzle and dark neck crease. Check top-down first for
  readability, then use first person to check volume and overlap from a few
  angles. Keep the comparison scene, zoom and pose fixed while iterating.

## Build and paint in Blender

1. Model the silhouette and the pieces that move. Set the ground origin,
   facing axis, dimensions and attachment pivots. Fit the mesh to the game's
   visible footprint and exercise the animation's widest poses.
2. Start the paint with broad regions of light and shade. Put dark clusters
   where forms overlap, such as the jaw and shoulder or a foot under the body.
   Keep the rump or equivalent broad surface light so those shadows read at
   native size. Inspect this paint in game before adding surface detail. The
   rabbit uses a 32×32 atlas with nearest sampling. Bake or paint contact shade
   into the base color to keep it in the same texture sample. For a moving joint,
   check the mark throughout its range so a painted shadow stays plausible.
3. If the silhouette still needs separation, try a thin reversed-face contour
   on the major closed volumes. The rabbit puts this geometry in the same
   material and draw as each part. It costs triangles and can crowd small gaps,
   so check the ears, feet and ground line during motion.
4. Keep an editable source and export a self-contained GLB with packed textures.
   Record the Blender version, export command, dimensions, triangle count,
   primitive count, material count, texture dimensions and GLB size. Confirm
   that the export keeps the intended sampler, UVs, pivots and color data.

The [rabbit builder](../art-source/experiments/rabbit/build.py) is a working
example. It was tested with Blender 5.2.2 LTS. Use the Blender executable on your
PATH or its installed path. On macOS the app at `/Applications/Blender.app`
contains `Contents/MacOS/Blender`.

```sh
blender --background --factory-startup --python-exit-code 1 \
  --python art-source/experiments/rabbit/build.py -- data/experiments/rabbit
```

The output contains `rabbit.blend`, `rabbit.glb` and `report.json`. Generate into
a scratch directory and copy the verified GLB into the asset bank explicitly.
Normal game builds consume the retained GLB.

## Qualify in Tilefun

1. Register the GLB, height and optional part poses by sprite sheet key in the
   [wildlife mesh catalog](../src/rendering/WildlifeMeshCatalog.ts) for an animal.
   Draw through the [shared 3D scene](topics/renderer-unification.md) and reuse
   the actor's gameplay pose and timing. Validate model placement, world depth
   and occlusion, ground contact and motion. For an overlapping sprite, check
   its depth plane against the mesh while holding the game pose fixed. Exercise
   the **3D animals** switch and the sprite fallback when the asset is unavailable.
2. Save matched evidence at game scale. Compare top-down cardinal facings, a
   close perspective view, and a characteristic animated pose. Check whether the
   light and dark regions remain distinct in motion. The [rabbit experiment](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-behavior-rabbit&wildlife3d=1#/tool/world-geometry)
   exercises hop and feeding in the shared gameplay renderer.
3. Compare texture, triangle and draw counts with the previous version. Use the
   [performance workflow](topics/performance.md) when asset count, extra passes
   or target hardware make timings material. The rabbit's paint-only pass
   preserves the atlas size, triangle count and draw count. Its earlier contour
   added 428 triangles per instance without adding a draw or render target.
4. Follow [art review](topics/art-review.md) when submitting a formal candidate.
   Retain the exact source and output of any registered version. Regenerate the
   art catalog and Workshop manifest for render or input changes and verify the
   served asset before sharing the review link.
