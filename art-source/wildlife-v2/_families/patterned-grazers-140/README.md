# Patterned grazers, tactical 140

Fresh empty-scene zebra, okapi and dromedary camel bodies share fixed limb/neck
mechanics. Zebra has a short erect mane, equine skull, rounded ears and actual
coat ribbons around its torso, plus neck/limb bands parented to articulated
parts. Okapi has a taller neck, ossicones, pale cheeks, rear coat ribbons and
banded pale lower limbs. Camel has a modeled single hump, longer neck/limbs,
split lips and independent paired padded toes. These are stylized game animals.

Source surface ribbons follow the body's outer envelope. Polygon origins are
centered on their geometry, and visible source quads are rasterized individually:
a convex hull would merge adjacent curved markings. Native limb surfaces and
markings use compact projected mesh hulls, preserving true source joint motion
without redundant vertex clouds. Painted body/head/jaw masters follow actual
rigid source transforms; markings move with their own limbs/necks. Four fixed
links per limb, two neck links and three tail links retain geometry/scale,
buried attachments, independent contact soles and matched world travel.

Registered inputs become immutable. Source/native inspection, deterministic
replay, Chromium playback and shared game checks never approve final pixels.
All exact new identities remain pending human review. Ordinary builds consume
committed assets; WILDLIFE_OUTPUT_DIR isolates unfinished previews.
