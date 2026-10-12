"""Blender --background INPUT --python this.py -- DRAFT NEW_BLEND.

Replace only the unused draft image. Reloading an already packed Blender image
can retain old packed bytes, so load a fresh image and verify its actual bytes.
"""
import hashlib
from pathlib import Path
import sys

import bpy

draft,output=[Path(p).resolve() for p in sys.argv[sys.argv.index('--')+1:]]
if output.exists():raise FileExistsError('Choose a fresh packed source output')
name='Draft projection · reference only'
old=bpy.data.images.get(name)
if old:
    assert not any(n.type=='TEX_IMAGE' and n.image==old for m in bpy.data.materials if m.use_nodes for n in m.node_tree.nodes), 'Draft must be unused'
    bpy.data.images.remove(old)
image=bpy.data.images.load(str(draft),check_existing=False)
image.name=name;image.use_fake_user=True;image.pack()
assert hashlib.sha256(bytes(image.packed_file.data)).hexdigest()==hashlib.sha256(draft.read_bytes()).hexdigest()
for image in bpy.data.images:
    if image.source=='FILE' and image.packed_file:image.filepath_raw='//'+Path(image.filepath).name
bpy.context.preferences.filepaths.save_version=0
bpy.context.scene['review_status']='Retained blue train: exact clean atlas and fresh own unused projection draft'
bpy.ops.wm.save_as_mainfile(filepath=str(output))
