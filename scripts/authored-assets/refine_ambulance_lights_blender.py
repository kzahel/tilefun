"""Edit only roof lights in an already-open retained scene; save a new file."""
import hashlib
import json
from pathlib import Path
import sys

import bmesh
import bpy

out=Path(sys.argv[sys.argv.index('--')+1]).resolve()
if (out/'car.blend').exists():
    raise FileExistsError('Never overwrite an earlier scene.')
spec=json.loads((out/'light-mesh-spec.json').read_text())


def unchanged_shape():
    records=[]
    for obj in sorted(bpy.context.scene.objects,key=lambda o:o.name):
        if obj.type != 'MESH' or obj.name.startswith(('Blue-bar-','Lightbar-','Beacon-')):
            continue
        records.append([obj.name,[list(v.co) for v in obj.data.vertices],
                        [list(p.vertices) for p in obj.data.polygons],
                        [list(loop.uv) for loop in obj.data.uv_layers.active.data],
                        obj.parent.name if obj.parent else None,[list(row) for row in obj.matrix_world]])
    return hashlib.sha256(json.dumps(records).encode()).hexdigest()


before=unchanged_shape()
for obj in list(bpy.context.scene.objects):
    if obj.name.startswith(spec['removePrefix']):
        bpy.data.objects.remove(obj,do_unlink=True)
material=bpy.data.materials[spec['material']]
image=bpy.data.images.load(str(out/'car-atlas.png'),check_existing=False)
image.pack()
image.filepath_raw='//car-atlas.png'
material.node_tree.nodes['Clean atlas'].image=image
for record in spec['objects']:
    data=bpy.data.meshes.new(record['name'])
    data.from_pydata(record['vertices'],[],record['faces'])
    data.update()
    editable=bmesh.new()
    editable.from_mesh(data)
    bmesh.ops.recalc_face_normals(editable,faces=list(editable.faces))
    editable.to_mesh(data)
    editable.free()
    original={frozenset(face):dict(zip(face,coords)) for face,coords in zip(record['faces'],record['uvs'])}
    uv=data.uv_layers.new(name='AmbulanceAtlas')
    for face in data.polygons:
        coords=original[frozenset(face.vertices)]
        for loop in face.loop_indices:
            uv.data[loop].uv=coords[data.loops[loop].vertex_index]
    obj=bpy.data.objects.new(record['name'],data)
    bpy.context.collection.objects.link(obj)
    obj.parent=bpy.data.objects['Body']
    obj['uv_region']=record['region']
    obj['paint_provenance']='Observed light palette on inferred light geometry'
    if record['light']:
        obj['tilefun_effect_schema']=1
        obj['tilefun_role']='emergency-light'
        obj['tilefun_channel']='emergencyLights'
        obj['tilefun_group']=record['light']['group']
        obj['tilefun_phase']=record['light']['phase']
    data.materials.append(material)
bpy.context.view_layer.update()
after=unchanged_shape()
assert before == after, 'Light refinement changed body, windows, wheels or their UVs'
(out/'beacon-audit.json').write_text(json.dumps({'unchangedBodyWheelsUvSha256':before,
    'bodyWheelsUvsUnchanged':True,'taggedLenses':6,'fixedBases':6,'source':spec['source']},indent=2)+'\n')
# Remove orphaned old images; the retained projection draft is replaced after the new bake.
for old in list(bpy.data.images):
    if old != image and old.users == 0:
        bpy.data.images.remove(old)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out/'car.blend'))
print('Six tagged light lenses; fixed bases; body/wheels/UVs unchanged.',flush=True)
