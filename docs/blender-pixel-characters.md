# Blender to pixel characters

The Tiger Walk Demo is a standalone character study: an upright tiger, four facing directions,
and a moving striped tail. It now compares the eight-pose Blender render with
a four-pose authored pixel finish at 32px and a separately drawn 16px version.
It is linked from
the [tool directory](https://tilefun.graehlarts.com/tilefun/tools.html).
Start Vite and open `/tilefun/demos/blender-tiger/`. On a deployment running
this revision, use the [shared demo URL](https://tilefun.graehlarts.com/tilefun/demos/blender-tiger/).

## Skills that helped

The best starting point was
[itsjavi's blender-game-assets](https://github.com/itsjavi/skills/blob/9c1b5137c003d4d251d903bb376d21dd9951915a/plugins/gamegen/skills/blender-game-assets/SKILL.md).
Its useful sequence is: establish the sprite contract, block out the model,
inspect several angles, give moving parts an editable rig, and retain the
source and builder. We followed its standalone-asset route, rather than setting
up a GameGen/Godot project. Its Blender CLI reference and animation guidance
informed fixed cameras, in-place movement, contact poses and loop endpoints.

[RobLe3's blender-animation](https://github.com/RobLe3/cc-blender-skill/blob/11016c9a5847897491dde935c346571bd7548e3d/plugin/skills/blender-animation/SKILL.md)
provided the practical keyframe/F-curve recipes, including Blender 5's layered
Action API, easing and secondary motion. The tail uses staggered motion down
its bone chain. These are workflow instructions; they do not generate a
finished tiger automatically.

Both upstream skill sources were read and used locally in the ignored
`skills/` folder. They are not vendored into Git or required to play the demo.
The pinned links above record which versions were used. No third-party models
or textures were used in the tiger.

## What we did

1. **Set a small export contract.** One model; 32x32 untrimmed frames; rows
   down, up, left, right, matching Tilefun's direction order; eight columns;
   8 fps; fixed ground pivot at `(16, 27)`; twelve shared colors and binary alpha.
2. **Build readable shapes.** Orange ellipsoids for a large head, compact body
   and short limbs; pointed ears; cream muzzle, tummy and paws; closed markings
   on the face and body. Left/right views turn slightly toward the camera so
   the face remains readable. This is an original tiger inspired by the game's
   small upright cat, not an edit of the existing player sheet.
3. **Rig and key the walk.** Eleven bones control body, head, arms, legs and
   four tail segments. Primitive parts use rigid skin weights; the tail tube
   blends weights between bones. Alternate foot contacts and lifts, swing arms
   oppositely, add a small body bob and delayed tail swish. Keep the root still;
   the demo supplies movement. Add a closing key at frame nine but export only
   frames one through eight.
4. **Render a test before the batch.** Keep the orthographic camera and light
   fixed and rotate the model. Direct 32px Eevee renders blurred small pupils
   and stripes. Rendering at 128px and point-sampling to 32px preserved them.
   Toon color ramps give controlled light/shadow bands.
5. **Finish the pixel pass.** Map every frame to the same twelve-color palette,
   threshold alpha, add a one-pixel exterior outline, and keep the complete
   canvas and pivot. Do not independently crop frames or optimize each frame's
   palette. Use nearest-neighbor scaling in the browser. Author important face
   features as fixed pixel clusters instead of letting subpixel 3D sampling
   decide their shapes on each frame; the eye treatment below is an example.
6. **Inspect motion and export.** Check all directions in a pose sheet and
   continuous playback, then test moving/stopping in the garden. Verify real
   tail vertex deformation, distinct poses, padding, alpha, sprite dimensions
   and GIF duration. The source contains just this studio and its dependencies.

### Keep the eyes consistent

The first batch had apparent dithering in the eyes, despite using no dithering
algorithm. Tiny pupil/highlight geometry crossed sample boundaries as the head
moved; palette mapping amplified those changes. Increasing render resolution
alone did not preserve the intended feature from pose to pose.

The revised builder keeps the editable eyes in the `.blend`, hides them for
sprite rendering, and exports a projected head anchor for each pose and view.
The packer snaps that anchor to whole pixels and draws a deliberately authored
3x3 front eye or 2x3 profile eye: a solid dark pupil, warm cream socket and one
fixed pale catchlight. Both front eyes share one anchor and fixed spacing;
profile views show one near eye, and the rear view has none. The complete eye
patch includes orange background pixels so leftover rendered detail cannot
change its shape. Only its location changes during the walk.

This is a hybrid workflow: Blender supplies pose, volume and lighting, while
the pixel pass makes explicit decisions about features that must stay readable.
To start, draw one small feature template per facing view, attach it to an
appropriate bone/surface anchor, and inspect the whole loop at native size.
The packer also reads back the encoded sheet and verifies identical eye shapes
and colors in every pose after accounting for translation. Other shaded edges
and markings still use the rendered result and can vary between poses.

### Redraw the whole character from pose guides

The second experiment uses the rig for movement and authored pixel drawings
for the entire visible character. This follows the broad 3D-reference workflow
described by [BlazBlue's developers](https://www.gamedeveloper.com/business/dodging-striking-winning-the-arc-system-works-interview)
and the combination of rendered poses and pixel-art expressions/shadows in
[KOF XIII's producer interview](https://blog.playstation.com/2011/11/01/the-king-of-fighters-xiii-interview-fighting-its-way-back-to-the-throne/).
Those describe professional pipelines; our experiment uses reusable text pixel
patterns and Pillow composition. The same Blender skills supplied the existing
rig and pose source. The redraw is explicitly authored art, rather than a skill
or shader automatically making the aesthetic decisions.

1. **Choose four key poses.** Sample Blender frames 1, 3, 5 and 7. Export integer
   screen positions for the head, torso, feet, hands and five tail joints into
   `art-source/pixel-tiger/pose-guides.json`. Keep the saved rig as the motion
   source; the exporter opens it and writes guides without saving over it.
2. **Draw the parts once at the target grid.** In `masters.json`, each letter
   is one exact palette color and `.` is transparent. Spaces just aid reading.
   Draw the front, back and profile head, then torso, arms and feet. The right
   profile mirrors the left drawing. Use eight colors, a warm brown outline,
   broad shadow shapes, clear stripes, cream muzzle and fixed face details.
3. **Compose the four poses.** Place these drawings using the projected rig
   anchors. Connect legs to their feet and rebuild the tail as an integer-grid
   ribbon with broad bands. Spread the front/back tail curl outward because
   the wider drawn head would hide the original projected curl. These are
   deliberate silhouette choices. Baked shading moves with each drawing;
   profile shading mirrors with the profile rather than simulating new light.
4. **Author 16px separately.** Its smaller patterns simplify eyes, stripes,
   muzzle and limbs. Half-up coordinate rounding retains small contact/lift
   differences, and passing poses receive a one-pixel head bob. This avoids
   losing the walk to downsampling. The original render's 16px comparison is
   nearest-neighbor downsampled, with that distinction stated in the demo.
5. **Inspect and retain both versions.** Both four-pose finishes run at 4 fps
   by default, giving a one-second loop. The comparison samples the same four
   Blender poses at that cadence; garden mode retains the original render's
   full eight poses at 8 fps. Both share the same travel rate. Use Actual pixel
   size to inspect the selected art at 1:1, then compare enlarged motion.

The finish step requires only committed sources and Pillow:

```sh
uv run --with pillow python scripts/blender/finish_tiger.py
```

To refresh the pose guides after editing the rig:

```sh
blender --background art-source/blender/tiger.blend --python-exit-code 1 --python scripts/blender/export_tiger_guides.py
uv run --with pillow python scripts/blender/finish_tiger.py
```

The generator checks four distinct poses in every direction at both sizes,
binary alpha, eight-color palette membership, padding and unchanged full head
drawings across poses. This protects silhouette details, muzzle and markings
as well as the eyes. It exports the two sheets, metadata, a pose sheet and a
four-direction comparison GIF. The browser test verifies switching between
both styles/sizes changes the rendered pixels, and that displayed native 16px
art matches its actual sheet. The four-pose motion is deliberately economical;
arm/leg drawings translate rather than changing shape during the swing.

The earlier tornado used the same broad pipeline: procedural 3D geometry,
periodic motion, fixed camera, shared palette and PNG packing. Its working
files remain local under `skills/blender-pixel-tornado/`; this character study
adds a skinned rig and a checked-in interactive preview.

## Reproduce it

Use Blender 5.2.2 LTS (the tested version), Python and
[uv](https://docs.astral.sh/uv/). Ordinary game development needs neither Blender
nor Python; the generated demo assets are committed.

Run the builder inside Blender, not ordinary Python. Replace `blender` below
with your installed executable if it is not on PATH:

```sh
blender --background --factory-startup --python-exit-code 1 --python scripts/blender/build_tiger.py
uv run --with pillow python scripts/blender/pack_tiger.py
npm run dev
```

For a first look, add `-- --preview` to the Blender command and `--preview` to
the packer. It renders one pose in each direction into ignored `data/`.

This session authored and rendered through
[MCP for Blender](https://github.com/ahujasid/mcp-for-blender), with addon 1.8
and protocol 13. The same scripts also work through the CLI above. To use MCP,
install/enable the addon, open Blender with its local server running, and run:

```sh
uvx mcp-for-blender install-addon
uv run --with mcp python scripts/blender/blender_mcp.py scripts/blender/build_tiger.py
uv run --with pillow python scripts/blender/pack_tiger.py
```

The MCP runner has `--preview` and `--prompt` options; the latter records the
current task intent. A native computer-use helper was unavailable during this
session, but actual MCP scene creation, inspection and rendering succeeded.

## Files and limits

- `scripts/blender/build_tiger.py`: model, rig, animation and rendering.
- `scripts/blender/pack_tiger.py`: pixel pass, packing, previews and validation.
- `scripts/blender/export_tiger_guides.py`: projected four-pose rig references.
- `scripts/blender/finish_tiger.py`: authored part composition and comparisons.
- `art-source/pixel-tiger/`: editable 32px/16px pixel patterns and pose guides.
- `art-source/blender/tiger.blend`: portable editable scene, with materials and
  keyed animation; no external textures.
- `public/demos/blender-tiger/`: playable preview, 256x128 transparent sheet,
  frame metadata, GIF and contact sheet; 128x128 finished 32px sheet and 64x64
  native 16px sheet, with their comparison assets.
- `data/blender-tiger/`: ignored raw renders and diagnostic reports.

The demo is a sprite workflow proof, not a replacement player asset or a full
3D character export. The original render stabilizes eyes; the authored finish
stabilizes the complete head and baked markings. Its four-pose movement uses
translated drawings and a simplified tail. Review both native sizes in motion,
then tune limb pose drawings and stride before considering gameplay integration.
