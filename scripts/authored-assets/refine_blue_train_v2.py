"""Blender -- PART OUTPUT: retain v1; align roof support and straight-track gauge.

Preserve every source pixel and UV coordinate. Only upper body vertices and
inferred wheel-pivot lateral positions change. Bogie yaw/coupling remain at rest.
"""
import hashlib
import json
import math
from pathlib import Path
import shutil
import sys

import bpy

root=Path(__file__).resolve().parents[2]
part,output=sys.argv[sys.argv.index('--')+1:]
output=Path(output).resolve();source=root/'art-source/train-models/blue/v1'/part
if output.exists():raise FileExistsError('Choose a fresh revision workspace')
output.mkdir();shutil.copytree(source/'refs',output/'refs')
for name in ['car-atlas.png','paint-ownership.json']:
    shutil.copyfile(source/name,output/name)
read=lambda p:json.loads(p.read_text(encoding='utf-8'))
def write(name,value):(output/name).write_bytes((json.dumps(value,indent=2)+'\n').encode())
bpy.ops.wm.open_mainfile(filepath=str(source/'car.blend'))
bpy.context.view_layer.update()
rig=read(source/'rig.json');spec=read(source/'mesh-spec.json')
for obj in bpy.context.scene.objects:
    if obj.type!='MESH':continue
    inverse=obj.matrix_world.inverted()
    for vertex in obj.data.vertices:
        position=obj.matrix_world @ vertex.co
        if position.z>=32:position.z+=4;vertex.co=inverse @ position
    obj.data.update()
for wheel in rig['wheels']:
    steer=bpy.data.objects[wheel['steer']]
    steer.location.y=math.copysign(10,steer.location.y)
    wheel['center'][1]=math.copysign(10,wheel['center'][1])
rig['roofSupportFit']={'visualRoof':44,'nativeSupportHeight':44,'collisionChanged':False}
rig['straightRailFit']={'trackHalfGauge':10,'wheelCenterHalfGauge':10,'source':'src/rendering/RailTrackRaster.ts','curvedBogieYaw':'rest-only; not rail-contact qualified'}
write('rig.json',rig)
spec['wheels']=rig['wheels']
for record in spec['objects']:
    mesh=bpy.data.objects[record['name']].data
    record['vertices']=[list(v.co) for v in mesh.vertices]
    record['faces']=[list(p.vertices) for p in mesh.polygons]
    record['uvs']=[[list(mesh.uv_layers.active.data[l].uv) for l in p.loop_indices] for p in mesh.polygons]
write('mesh-spec.json',spec)
config=read(source/'family-config.json');config['revision']='v2';config['roof']=44;config['trackHalfGauge']=10
recipe=read(source/'recipe.json')
for view in recipe['views']:
    camera=view['camera'];e=math.radians(camera['elevation']);sx=camera['horizontalScale'];sy=sx*camera['verticalStretch']
    depth,height=sy*math.sin(e),sy*math.cos(e)
    gain=38/42 if view['id'] in ['east','west'] else 40/44
    new_height=height*gain
    if view['id'] in ['east','west']:camera['origin'][1]-=(height-new_height)*3
    camera['elevation']=math.degrees(math.atan2(depth,new_height))
    camera['verticalStretch']=math.hypot(depth,new_height)/sx
    camera['status']='Recorded native fit after roof-to-support alignment; no gameplay camera change'
    config['cameras'][view['id']]=camera
write('family-config.json',config)
recipe['source']['image']=str(root/recipe['source']['image']);recipe['reviewStatus']='Blue train v2 prototype; moving-art review before live activation'
recipe['workingBlend']='car.blend'
bpy.context.preferences.filepaths.save_version=0
bpy.context.scene['review_status']='Blue v2: roof 44 and straight wheel gauge 20; live activation pending review'
bpy.context.view_layer.update();bpy.ops.wm.save_as_mainfile(filepath=str(output/'car.blend'))
recipe['template']={'path':str(output/'car.blend'),'sha256':hashlib.sha256((output/'car.blend').read_bytes()).hexdigest()}
write('recipe.json',recipe)
write('geometry-refinement.json',{'schema':'tilefun-blue-train-refinement-v2','baseBlend':(source.relative_to(root)/'car.blend').as_posix(),
    'baseBlendSha256':hashlib.sha256((source/'car.blend').read_bytes()).hexdigest(),
    'atlasUnchanged':True,'uvCoordinatesUnchanged':True,'roofDelta':4,'straightTrackHalfGauge':10,
    'simulationChanged':False,'limits':'Bogies/couplers remain at rest; native spacing and source projection differences remain explicit'})
