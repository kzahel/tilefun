# Cow motion repair v2

Owner-authorized full-roster work, tactical 140. Preserves the original Holstein patches, pink muzzle and udder, lateral ears and three articulated tail segments.
Native cell 64px, ground anchor (32,46), unchanged 10px/world-unit camera.
The immutable original source and palette-letter masters are listed in inputs.json.

The editable Blender source moves the torso about its anatomical center. Buried
shoulder/hip points carry four constant-length limb links, distinct fore carpus
and hind hock flexion, separate grounded feet and fixed-volume parts. The
32-pose walk takes 1600ms and matches 12px/s movement; flee doubles cadence.
Idle and the original ear/tail action retain 100ms poses. Source timeline
frame spacing matches each clip's physical duration.

Projected source bases move the original rigid coat/head paint. Separate
joints drive feet and articulated tail. Saved-scene audits check 65 half-poses
per facing, fixed geometry and links, stance travel, support and loop closure.
Pixel checks require palette/binary alpha, padding and native torso motion.
Full Chromium checks every chronological pose at native/3x; explicit replay
must reproduce all output bytes before registration. Ordinary builds use
committed assets. Never regenerate a registered bank or invent a human vote.
