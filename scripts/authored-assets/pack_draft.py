"""Retain a variant's own unused source-projection draft in its editable scene.

Blender --background evaluated.blend --python pack_draft.py -- DRAFT NEW_BLEND
"""
from pathlib import Path
import sys
import bpy

draft, output = [Path(p).resolve() for p in sys.argv[sys.argv.index('--')+1:]]
if output.exists():
    raise FileExistsError('Choose a new editable source path.')
image = bpy.data.images.get('Draft projection · reference only')
if image is None:
    image = bpy.data.images.load(str(draft), check_existing=False)
    image.name = 'Draft projection · reference only'
else:
    image.filepath = str(draft)
    image.reload()
image.use_fake_user = True
image.pack()
for packed in bpy.data.images:
    if packed.source == 'FILE' and packed.packed_file:
        packed.filepath_raw = '//' + Path(packed.filepath).name
bpy.context.preferences.filepaths.save_version = 0
bpy.context.scene['review_status'] = 'Unreviewed authored asset; cleaned atlas plus own source-projection draft'
bpy.ops.wm.save_as_mainfile(filepath=str(output))
print('Own source draft packed; mesh, active atlas and rig retained.')
