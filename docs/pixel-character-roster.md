# Pixel character roster

The authored 32px roster and tiger now have a [Workshop Character lab](topics/characters.md)
for movement, grounding and collision review. All six approved 32px models are
available in Entities and the main-menu player picker; the original gallery and
source art below are unchanged.

The [Pixel Character Gallery](https://tilefun.graehlarts.com/tilefun/demos/pixel-characters/)
is a standalone sprite study, discoverable from the root tool directory. It
now supplies the exact approved 32px art to the game and leaves the Tiger Walk Demo untouched.
The final five-character roster is complete: cat, dog, person, squirrel and bear.
Only completed exports appear in its generated registry. Tuxedo Cat remains the
explicit gallery default, independent of source filename sorting.

These five additions were made in sequential Yep Anywhere Codex gpt-6.1-sol
sessions with high effort and bypassPermissions, each committed before the next
started. This note records workflow provenance; raw session state and logs are
not checked in.

## Workflow and reproducible commands

These sprites are **programmatically composed authored pixel patterns using
Blender pose guides**. The source contains explicit letter-grid drawings, flat
shadow regions and named palette colors. Pillow places the parts, draws integer
limb connections and a tail, and packs sheets. No frames were painted in
Aseprite, no image-generation model was used, and native16 is separately
authored rather than downsampled.

```sh
# Export every source record and regenerate the completed-character registry:
uv run --with pillow python scripts/blender/finish_characters.py
# Export only one character; leave other character sheets/previews untouched:
uv run --with pillow python scripts/blender/finish_characters.py --character cat
# Export the labeled final roster GIF/overview from completed sheets only:
uv run --with pillow python scripts/blender/preview_character_roster.py
# Run the standalone gallery locally:
npm run dev
```

Open `/tilefun/demos/pixel-characters/`. Inspect the full pose contact sheet,
four-direction looping GIF, enlarged cycles and Actual pixel size at both
details. The generator verifies encoded sheet dimensions, alpha 0/255, shared
palette membership (at most twelve colors), transparent padding on every side,
four unique frames per direction, connected silhouettes, full opaque head
pattern consistency, independent native16 output and a four-frame, 1000ms GIF
loop. Review assets include enlarged **and actual-size** sprites.

The export contract is four columns and four rows (down, up, left, right),
4 fps, fixed untrimmed 32×32 or 16×16 frames. Pivots are `(16,27)` and `(8,14)`.
The gallery reads these pivots and metadata, uses nearest-neighbor drawing,
loads both detail sheets, and reports fetch/decode errors visibly. Keyboard and
pointer controls move a selected character on an independent demonstration
canvas. E2E tests cover exact native16 pixels, selector switching, all movement
directions/release/reset, real touch events, mobile overflow and loading errors.

## Blender provenance and skills

The existing editable rig is `art-source/blender/tiger.blend`, produced by
`scripts/blender/build_tiger.py`. Its committed projected guide file is
`art-source/pixel-tiger/pose-guides.json`, exported by
`scripts/blender/export_tiger_guides.py`. Frames **1, 3, 5 and 7** supply the
head/torso bob, alternating foot contacts/lifts and opposite arm swing. The new
generator references that guide file directly; it never rewrites the rig,
original tiger patterns or tiger exports. Character `poseOverrides` replace
selected anchors deliberately. Native16 uses half-up coordinate rounding and
an additional one-pixel passing-pose head bob, following the successful tiger
finish in commit `222be28`.

The local instructions read for this session were
[itsjavi blender-game-assets](https://github.com/itsjavi/skills/blob/9c1b5137c003d4d251d903bb376d21dd9951915a/plugins/gamegen/skills/blender-game-assets/SKILL.md)
and [RobLe3 blender-animation](https://github.com/RobLe3/cc-blender-skill/blob/11016c9a5847897491dde935c346571bd7548e3d/plugin/skills/blender-animation/SKILL.md).
They informed the export contract, editable-source retention, connected moving
parts and loop review. Those same skills originally informed the reused rig.
This session did **not** create a new Blender model or new keyframes, so their
modeling/F-curve recipes were not executed again. The local skill copies remain
ignored; pinned upstream links document provenance. See
[the tiger workflow](blender-pixel-characters.md) for the original rig process.
There are no third-party character models or textures.

## Cat

- Source: `art-source/pixel-characters/cat.json` (eight-color palette, separate
  32px/native16 front/back/profile heads, torso, arms and feet, tail/limb colors,
  per-direction tail overrides and provenance).
- Exports: `public/demos/pixel-characters/cat-32.png`, `cat-16.png`, `cat.json`,
  `cat-contact-sheet.png` and `cat-preview.gif`.
- Retained browser review captures in that same directory:
  `cat-gallery-desktop.png`, `cat-gallery-phone.png` and
  `cat-gallery-native16-phone.png`. These document the reviewed gallery revision;
  the generator recreates sprite review sheets/GIFs, not browser captures.
- Design: upright tuxedo cat, charcoal coat, light green eyes, pink nose/inner
  ears, white central muzzle/blaze, broad white bib and white mitten paws.
  Taller separated triangular ears, a narrower cheek outline and a plain hooked
  tail distinguish it from the tiger's broad striped head and banded tail.
  Baked coat shadows and every facial pixel translate as complete head drawings.
- Motion adaptation: the original guide contacts and arm swing remain; every
  tail path is redrawn into an outward hook, with a one-pixel ribbon at native16.
  Shoulder-to-hand and hip-to-foot connections avoid floating limbs. The right
  head/torso mirror the left profile; right-side limb timing still uses its own
  guide samples. Native16 simplifies the muzzle, ears, eye clusters and bib.
- Review: all sixteen poses at each size were inspected enlarged and at actual
  size, along with the directional preview and desktop/mobile gallery captures.
  The generator checks the entire opaque head pattern, not only eyes. Motion is
  economical four-pose part translation with alternating contacts and a tail
  hook; it is a study for review, not promoted gameplay art.
- Cat foundation validation: `npx tsc --noEmit`, `npx biome check --write .`
  and `npm run build` passed; Biome reports existing warnings and its unrelated
  clean-file `public/data/art-catalog.json` formatting was restored.
  `npx playwright test --workers=2`: **175 passed, 1 skipped**. Focused gallery,
  tools and original tiger coverage: **11 passed**. `npm test`: **1080 passed,
  1 failed, 10 skipped**, matching the known Windows symlink EPERM baseline in
  `src/server/staticFiles.test.ts` and `src/persistence/FsSecurity.test.ts`;
  those unrelated tests were left unchanged.

## Dog

- Design: friendly upright cream-and-brown dog, rounded crown, long brown
  hanging ears, asymmetric eye patch, broad dark nose, projecting rounded
  profile snout, cream chest and broad paws. Front/back/profile masters and
  the simplified native16 drawings are authored separately; facial pixels
  move as one complete head. Eight shared colors, broad flat shadows.
- Reused guide source: `art-source/pixel-tiger/pose-guides.json`, from
  `art-source/blender/tiger.blend` frames 1, 3, 5 and 7. No new Blender model
  or Aseprite painting. Front/back contacts are widened for a planted dog
  stance; profile strides are spread and the head sits one guide pixel
  forward. Short, low tail paths wag visibly outside the back/profile body
  silhouette. The shared generator needed no changes.
- Editable source: `art-source/pixel-characters/dog.json`. Regenerate exactly:
  `uv run --with pillow python scripts/blender/finish_characters.py --character dog`.
- Outputs: `public/demos/pixel-characters/dog-32.png`, `dog-16.png`, `dog.json`,
  `dog-contact-sheet.png`, `dog-preview.gif`, and the completed `characters.json`
  registry. Retained browser review captures: `dog-gallery-desktop.png`,
  `dog-gallery-phone.png`, `dog-gallery-native16-phone.png` in the same directory.
- Review: all directions and four poses inspected enlarged and at native
  scale, plus desktop/mobile gallery captures. Export checks protect connected
  limbs, whole heads, palette, binary alpha, padding and one-second loops.
  E2E checks select the real dog, compare every directional card to its source
  at both sizes, and walk/release/reset in all four directions.
- Validation: `npx tsc --noEmit`, `npx biome check --write .` and
  `npm run build` passed (existing warnings); the unrelated art-catalog
  formatting was restored. `npx playwright test --workers=2`: **176 passed,
  1 skipped**. `npm test`: **1080 passed, 1 failed, 10 skipped**, matching the
  existing Windows symlink EPERM baseline in `src/server/staticFiles.test.ts`
  and `src/persistence/FsSecurity.test.ts`; no unrelated fixes.

## Person

- Design: original friendly human trail explorer, short swept brown hair,
  warm skin, teal zip jacket, canvas backpack, dark brown trousers and boots.
  Separate front/back/profile head and clothing masters at both sizes; native16
  retains two front eyes, a human profile, jacket straps and the backpack.
  Ten shared colors and broad flat shadows; no animal features or tail.
- Reused guide: `art-source/pixel-tiger/pose-guides.json`, exported from
  `art-source/blender/tiger.blend` frames 1, 3, 5 and 7. This is authored pixel
  composition with Pillow, with no new Blender model or Aseprite painting.
  Narrow human front/back contacts, wider profile strides and opposite arm
  swings adapt the rig. Optional `armFill` and `profileForegroundArm` keep teal
  sleeves distinct from trousers and the near arm visible over the backpack.
  Existing cat/dog pixel exports remain unchanged under these optional fields.
- Editable source: `art-source/pixel-characters/person.json`. Regenerate exactly:
  `uv run --with pillow python scripts/blender/finish_characters.py --character person`.
- Outputs: `public/demos/pixel-characters/person-32.png`, `person-16.png`,
  `person.json`, `person-contact-sheet.png`, `person-preview.gif`, and the
  completed `characters.json` registry. Browser review captures in that same
  directory: `person-gallery-desktop.png`, `person-gallery-phone.png` and
  `person-gallery-native16-phone.png`.
- Review: all directions and poses inspected enlarged and at actual size.
  Export checks cover whole-head stability, connected limbs, binary alpha,
  palette, padding, four distinct poses and the one-second loop. Gallery E2E
  coverage selects the person, checks exact directional pixels at both sizes,
  walks in all directions, advances through all four poses, releases and resets.
- Validation: `npx tsc --noEmit`, `npx biome check --write .` and
  `npm run build` passed (existing warnings); unrelated art-catalog formatting
  was restored. `npx playwright test --workers=2`: **178 passed, 1 skipped**.
  `npm test`: **1080 passed, 1 failed, 10 skipped**, matching the known Windows
  symlink EPERM baseline in `src/server/staticFiles.test.ts` and
  `src/persistence/FsSecurity.test.ts`; no unrelated fixes.

## Squirrel

- Design: upright russet squirrel with small rounded ears, a short cream muzzle,
  a pear-shaped cream belly and compact russet paws. Separate front/back/profile
  head and torso masters at 32px and native16 use eight shared colors and broad
  flat shadows. The large curved tail has a thick lobe, a concave inner edge,
  stepped fur clusters and a tapered root; it remains distinct at native16.
- Reused rig/guide: `art-source/blender/tiger.blend`, through committed
  `art-source/pixel-tiger/pose-guides.json` frames 1, 3, 5 and 7. Authored pixel
  patterns composed with Pillow; no new Blender model or Aseprite painting.
  The head/body sit forward to reserve plume space. Compact opposing forepaw
  swings and wider profile contacts give connected, visible limb motion.
  Two tail drawings at each size sway with per-pose anchors, behind the face.
  The optional generator `tail.patterns` path is justified by this bushy anatomy;
  existing ribbon-tail and tailless exports retain identical sprite pixels.
- Editable source: `art-source/pixel-characters/squirrel.json`. Regenerate exactly:
  `uv run --with pillow python scripts/blender/finish_characters.py --character squirrel`.
- Outputs: `public/demos/pixel-characters/squirrel-32.png`, `squirrel-16.png`,
  `squirrel.json`, `squirrel-contact-sheet.png`, `squirrel-preview.gif`, and the
  completed `characters.json` registry. Browser captures in the same directory:
  `squirrel-gallery-desktop.png`, `squirrel-gallery-phone.png` and
  `squirrel-gallery-native16-phone.png`.
- Review: all directions and four poses inspected enlarged and at actual size,
  plus directional GIF frames and desktop/mobile gallery captures. Export checks
  cover whole-head stability, connected silhouettes, palette, binary alpha,
  padding, four distinct poses and the one-second loop. E2E coverage selects the
  squirrel, checks exact directional sheet pixels at both sizes, walks/releases/
  resets in all directions and advances through all four poses at both sizes.
- Validation: `npx tsc --noEmit`, `npx biome check --write .` and
  `npm run build` passed with existing warnings; unrelated art-catalog formatting
  was restored. `npx playwright test --workers=2`: **181 passed, 1 skipped**.
  `npm test`: **1080 passed, 1 failed, 10 skipped**, matching the known Windows
  symlink EPERM baseline in `src/server/staticFiles.test.ts` and
  `src/persistence/FsSecurity.test.ts`; no unrelated fixes.

## Bear

- Design: friendly stocky brown bear, small round ears, broad rounded head,
  tan muzzle, thick compact torso, short arms, big paws and a tiny tail. Separate
  front/back/profile masters at both sizes use eight shared colors and broad
  flat shadows. Native16 has rounded ear clusters and a broad muzzle/body,
  distinct from the dog’s hanging ears and the cat’s triangular ears.
- Reused rig/guide: `art-source/blender/tiger.blend`, through committed
  `art-source/pixel-tiger/pose-guides.json` frames 1, 3, 5 and 7. Authored pixel
  patterns composed using Pillow; no new Blender modeling or Aseprite painting.
  Wide paw contacts, low foot lifts, short opposing arm swings and a level 32px
  head give a heavier planted cadence. Native16 keeps a one-pixel passing bob.
  A small authored profile stub and baked back-body rump tail replace the long
  rig tail. Existing generator anatomy options suffice; previous art is intact.
- Editable source: `art-source/pixel-characters/bear.json`. Regenerate exactly:
  `uv run --with pillow python scripts/blender/finish_characters.py --character bear`.
- Outputs: `public/demos/pixel-characters/bear-32.png`, `bear-16.png`, `bear.json`,
  `bear-contact-sheet.png`, `bear-preview.gif`, and the final `characters.json`.
  Browser captures: `bear-gallery-desktop.png`, `bear-gallery-phone.png` and
  `bear-gallery-native16-phone.png` in the same directory.
- Review: all sixteen poses at both sizes inspected enlarged and at actual size,
  every GIF pose and the complete five-character overview reviewed. Export checks
  cover whole-head stability, connected limbs, palette, binary alpha, padding,
  unique poses and one-second loops. Gallery E2E selects the bear, checks exact
  directional sheet pixels at both sizes, walks/releases/resets in all directions,
  advances through all four poses at both sizes and preserves the cat default.
- Validation: `npx tsc --noEmit`, `npx biome check --write .` and
  `npm run build` passed with existing warnings; unrelated art-catalog formatting
  was restored. `npx playwright test --workers=2`: **184 passed, 1 skipped**.
  Refreshed final build and focused gallery suite: **14 passed**.
  `npm test`: **1080 passed, 1 failed, 10 skipped**, matching the known Windows
  symlink EPERM baseline in `src/server/staticFiles.test.ts` and
  `src/persistence/FsSecurity.test.ts`; no unrelated fixes. Bear sprite/review
  exports regenerate byte-identically; all four encoded roster GIF frames
  preserve the exact composed sprite and label pixels with a shared palette.

## Final five-character review artifacts

All paths below are relative to `public/demos/pixel-characters/`.

| Character | Animated preview | All poses at both sizes |
| --- | --- | --- |
| Tuxedo Cat | `cat-preview.gif` | `cat-contact-sheet.png` |
| Floppy Dog | `dog-preview.gif` | `dog-contact-sheet.png` |
| Trail Explorer | `person-preview.gif` | `person-contact-sheet.png` |
| Russet Squirrel | `squirrel-preview.gif` | `squirrel-contact-sheet.png` |
| Brown Bear | `bear-preview.gif` | `bear-contact-sheet.png` |

`roster-preview.gif` is the final labeled combined review: columns **cat, dog,
person, squirrel, bear**; rows **down, up, left, right**. Each cell shows enlarged
32px and independently authored native16, with actual-size samples underneath.
Four frames at 250ms each give a looping one-second walk. `roster-overview.png`
is its first-pose still. Both are linked from the gallery. Regenerate exactly:

```sh
uv run --with pillow python scripts/blender/preview_character_roster.py
```

The overview builder reads the completed registry and committed sheets, without
rewriting previous characters. Regenerating bear alone also preserves their
sources/exports. Future additions should author separate species masters, inspect
all poses at both scales, and publish only complete records.

## Three-way Blender / 32px / 16px comparison

`three-way-comparison.gif` animates all three stages side by side with matching
poses 1, 3, 5 and 7, at 4 fps in a one-second loop. It uses one shared palette,
without dithering. Every authored 32px/native16 color and label/background color
is reserved exactly; only the continuous-tone Blender render is reduced to fit
GIF's 256-color limit. The exporter verifies unchanged authored panels and
decodes all four GIF frames to check pixels, labels, disposal, timing and loop.

`three-way-comparison.png` shows the original tiger and all five new characters,
with four directions in each of three columns: the original Blender render,
authored 32px and separately authored native16. Pixel previews use nearest-neighbor
scaling and have actual-size samples underneath. Additional lossless PNGs
`three-way-comparison-pose-3.png`, `three-way-comparison-pose-5.png` and
`three-way-comparison-pose-7.png` show the other matched walk poses.

Only the tiger has a 3D model. The other five rows explicitly show the shared
tiger pose reference, not a species-specific 3D predecessor. The reference was
rendered again from the unchanged `art-source/blender/tiger.blend`, with its
original geometry, lighting, camera and visible 3D eyes at 128px. It has no
palette mapping, pixel eye patches or authored finish. Its retained sheet and
metadata are `public/demos/blender-tiger/tiger-reference-3d.png` and `.json`.
PNG preserves the continuous render colors without GIF palette quantization.

Regenerate the comparison from committed images:

```sh
uv run --with pillow python scripts/blender/preview_character_stages.py
```

To refresh the reference itself, render the saved scene without saving changes,
then pack the raw frames from ignored `data/blender-tiger/comparison-reference/`:

```sh
blender --background art-source/blender/tiger.blend --python-exit-code 1 --python scripts/blender/render_tiger_reference.py
uv run --with pillow python scripts/blender/preview_character_stages.py --pack-reference
```

The sheet exporter verifies source dimensions and lossless PNG round trips.
Original sprite sheets, masters, pose guides and the Blender source are untouched.
