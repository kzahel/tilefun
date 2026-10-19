# Hoofed mammals, tactical 140

Fresh empty-scene moose, elk, white rhinoceros, warthog and hippo anatomy uses
species-specific bodies, skulls, neck/limb proportions and coats. Moose has
palmate antler blades/tines, long muzzle and hanging bell; elk branched antlers
and pale rump; rhinoceros broad grey skin folds and two nasal horns; warthog
cheek warts, curved tusks, bristles and a raised moving tail; hippo a broad
muzzle, raised eyes/nostrils, four-toed feet and an opening jaw. These are
stylized game animals, not anatomical measurements or ecological claims.

Cervids/warthog have two connected-component toes per foot, rhinoceros three
and hippo four. The independent saved-scene audit counts actual mesh components.
Four fixed links per limb connect buried roots to planted hooves/pads; two fixed
neck links carry head motion and three links carry the tail. Local geometry and
scale stay constant. Thirty-two walk and eight action poses per facing retain
body weight transfer, jaw motion and matched travel. The common camera remains
10px/world, using 96px cells/(48,72) anchor except 64px/(32,48) warthog.

Body/head paint follows actual rigid source transforms; limb surfaces use compact
projected meshes. Hippo's larger jaw rotation uses actual projected source jaw
volumes rather than approximating its depth as a rigid painted plane. Ordinary
builds use committed banks. WILDLIFE_OUTPUT_DIR isolates drafts. All registered
inputs are immutable, and exact final art stays pending human review after
source, native, replay, browser and game checks.
