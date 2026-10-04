# Wildlife source checkpoint

This bank contains 16 production-reviewed drafts, not human approvals or game
integration. See [the wildlife topic](../../docs/topics/wildlife.md) for projection,
motion, review and storage policy. The dated source checkpoint records exact
committed file hashes and the checksum of the separate evidence archive.

## Files retained

Each final revision retains its editable Blender scene, authored palette-letter
masters, builder/export/finishing/audit scripts, README and existing checksum
records. Camera and roster are shared. The matching public revision retains
`sheet.png`, `sprite.json`, `playback.js` and `index.html`. The player source
preserves timing where the current descriptor does not yet contain it.

Native sheet PNGs are a small generated runtime exception. Normal game builds
continue to use committed assets. These drafts are not added to the game by
this checkpoint, and the new Workshop review integration is a separate change.

## Reproduction and evidence

The current authoring toolchain is Blender 5.2.2 LTS, Python 3.12 and Pillow
12.3. See each revision's README for its builder, saved-scene guide exporter,
finisher and independent audit commands. Do not overwrite a reviewed revision
when changing art; create a new identity.

Most finishers consume generated `projected-guides.json`. Regenerate it using
the revision's Blender builder/exporter, or restore its exact archived copy
before finishing. Pixel masters for cat, dog, harbor seal and manta ray already
contain complete final frames; all four sheets were reconstructed byte-for-byte
in scratch. Cross-platform reproduction of all revisions is not yet certified.

Generated GIFs, guide renders/JSON, contact sheets, scene comparisons and browser
captures are outside this commit. Existing candidate receipts still pin those
files; their exact bytes remain in a separate checksum-addressed local archive.
The dated checkpoint records its filename and full SHA-256, not a machine path.
The archive is a local persistent backup, not a remote distribution service.

Existing preview pages require that evidence to be restored before they can
display their scene backgrounds and previews. A plain source checkout should
not be treated as a complete Workshop preview deployment. Review integration
and a portable archive hydration command remain follow-up work. The coordinator
stages explicit source paths; there is no blanket PNG or JSON ignore rule.
