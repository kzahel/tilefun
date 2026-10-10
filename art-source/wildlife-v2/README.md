# Wildlife source checkpoint

This bank contains 22 retained drafts, not human approvals or game
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

Native sheet, scene and contact PNGs for registered candidates are the small
committed review render bank. Generated GIFs, guide renders/JSON, enlarged
comparisons and browser captures stay outside Git. Existing candidate receipts
still pin those files; their exact bytes remain in a separate checksum-addressed
local archive.
The dated checkpoint records its filename and full SHA-256, not a machine path.
The archive is a local persistent backup, not a remote distribution service.

Normal builds and the gallery use committed render inputs. Human feedback requires
every original pinned artifact, including animation evidence, both in the browser
and on the server at submission time. Missing or changed evidence blocks feedback.
The cleanup checkpoint records the archive containing all retained, superseded and
blocked drafts. Restore it with `python scripts/wildlife/restore-evidence.py ARCHIVE`;
use `--verify-only` to validate without writing. The command verifies the full
archive and refuses to overwrite differing files. Obtain the archive separately;
it is a local backup, not available from a Git clone.

The historical campaign remains stopped. Tactical 084 separately authorizes
four common pets under pet-batch.json: ginger/black cats and golden/shepherd
dogs. Their shared editable authoring/audit pipeline is in pets/; per-pet scenes,
pixel masters and exact pending receipts are retained in their own new IDs.
This batch includes its small native review PNG/GIF/player artifacts in Git so
a fresh checkout can review all four without the historical evidence archive.
Large guide/contact studies and browser captures remain ignored local evidence.
Other production is limited to existing frozen-torso repairs. Changed review
renderer source produces fresh pending fingerprints; all human art approvals
remain separate.
