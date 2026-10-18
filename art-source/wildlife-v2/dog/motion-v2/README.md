# Dog motion repair v2

Owner-authorized full-roster work, tactical 140. Retains original editable
anatomy, tricolor beagle coat, black saddle, white blaze/muzzle and pendent ears. Original bank remains immutable.
Cell 64px, anchor (32,44), unchanged camera and physical gameplay body.

The torso moves around its center; buried shoulder/hip points carry four
constant-length links with distinct carpus/hock flexion and independent paws.
The 32-pose 640ms walk matches 22px/s; flee halves pose duration. Source
uses 200fps, four timeline frames per walk pose; idle/action use 32 frames
per original 160ms pose. Ears and articulated tail retain their own actions.

Original face palette-letter templates are retained. Original body meshes and
coat recipe produce a separate rest torso master once; that paint moves
rigidly through actual source bases rather than being redrawn per pose.
Foot/ear/tail pixels follow separate evaluated joints and volumes.

Saved-source audits sample 65 half-poses per facing and check fixed geometry,
links, planted travel and loop closure. Pixel checks require padding, palette,
binary alpha and native torso-paint excursion. Explicit replay must reproduce
all output bytes; Chromium checks every pose at native/3x. Builds use committed
assets. New final pixels retain their own pending human review identity.
