"""Blender side of author_ambulance.py; isolated scene construction only."""
import json
from pathlib import Path
import sys

import bmesh
import bpy

out=Path(sys.argv[sys.argv.index('--')+1]).resolve()
if (out/'car.blend').exists():
    raise FileExistsError('Never replace an earlier authored scene.')
spec=json.loads((out/'mesh-spec.json').read_text())
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version=0
material=bpy.data.materials.new(spec['material'])
material.use_nodes=True
nodes,links=material.node_tree.nodes,material.node_tree.links
shader=nodes.get('Principled BSDF')
shader.inputs['Roughness'].default_value=1
shader.inputs['Specular IOR Level'].default_value=0
texture=nodes.new('ShaderNodeTexImage')
texture.name='Clean atlas'
texture.interpolation='Closest'
texture.image=bpy.data.images.load(str(out/'car-atlas.png'))
texture.image.pack()
links.new(texture.outputs['Color'],shader.inputs['Base Color'])

def node(name,parent=None,location=(0,0,0)):
    obj=bpy.data.objects.new(name,None)
    bpy.context.collection.objects.link(obj)
    obj.parent=parent
    obj.location=location
    obj['asset_rig_node']=True
    return obj

car=node('CarRoot')
car['asset_id']='ambulance'
car['forward_blender']=[-1,0,0]
car['world_pixel_units']=True
body=node('Body',car)
parents={'Body':body}
for wheel in spec['wheels']:
    steer=node(wheel['steer'],car,wheel['center'])
    steer['steering_enabled']=wheel['steering']
    steer['steer_axis_gltf']=[0,1,0]
    roll=node(wheel['roll'],steer)
    roll['wheel_radius']=wheel['radius']
    roll['roll_axis_gltf']=[0,0,-1]
    parents[wheel['roll']]=roll

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
    obj.parent=parents[record['parent']]
    obj['uv_region']=record['region']
    obj['paint_provenance']='Source-owned affine UV paint plus explicit inferred hidden fill'
    data.materials.append(material)

bpy.context.view_layer.update()
bpy.ops.object.camera_add(location=(150,150,150))
bpy.context.scene.camera=bpy.context.object
bpy.context.scene['review_status']='Authored ambulance; unreviewed diagnostic'
bpy.ops.wm.save_as_mainfile(filepath=str(out/'car.blend'))
print('New ambulance-specific body, source-owned UVs and four steer/roll assemblies built.',flush=True)
