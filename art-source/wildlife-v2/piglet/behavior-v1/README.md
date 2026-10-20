# piglet behavior actions

Owner-authorized existing-animal action batch163 (2026-10-20); exact art remains
pending human review. The retained motion-v2 travel pixels, cell dimensions,
ground anchor, camera and palette masters are unchanged.

`inputs.json` pins the existing editable Blender rig, native sheet/metadata and
palette-letter masters. `paint.py` retains their pixel painting rules; actions
project fixed-volume parts from the saved scene. Goat neck paint follows the
actual neck hull to preserve contact in the raised posture. Pig snout movement
and elephant trunk endpoints follow their own source transforms.

`build.py` delegates to the retained pasture helper, authors keyed action poses,
saves/reopens the scene and checks fixed-length limb/trunk endpoints and original
mesh geometry. `projection.json` is its explicit drawing/socket output.
`pasture-finish.py` appends action cells and checks native travel preservation,
palette/alpha/padding, distinct action frames and connected head/body pixels.

The normal build only loads committed assets. Explicit replay uses
`python scripts/wildlife/pasture-replay.py piglet --check`; its isolated minimal-input
result and the full-Chromium native/3x playback validation are receipt-pinned.
Changed art needs a new revision; never rewrite this bank after registration.
