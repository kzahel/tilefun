"""Read-only verification of the saved editable Blender scene; writes route JSON."""
import bpy
import json
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT=Path(__file__).resolve().parents[3]
DATA=ROOT/'data/vehicle-style-study/02-detailed-toon'
bpy.ops.wm.open_mainfile(filepath=str(DATA/'sports-coupe.blend'))
scene=bpy.context.scene
g=json.loads((DATA/'geometry.json').read_text())
assert scene.render.engine=='BLENDER_EEVEE'
assert scene.render.threads_mode=='FIXED' and scene.render.threads==4
assert scene.render.film_transparent
assert scene.render.resolution_x==scene.render.resolution_y==512
assert scene.camera.data.type=='ORTHO' and abs(scene.camera.data.ortho_scale-7.2)<1e-6
root=bpy.data.objects['SportsCoupe_Root_rotate_Z']
assert abs(root.rotation_euler.z)<1e-7
origin=world_to_camera_view(scene,scene.camera,Vector((0,0,0)))
assert abs(origin.x*128-64)<1e-5 and abs((1-origin.y)*128+28-92)<1e-5
roles={}
for mat in bpy.data.materials:
    if 'role' not in mat:
        continue
    nodes=mat.node_tree.nodes
    ramps=[n for n in nodes if n.type=='VALTORGB']
    assert len(ramps)==1 and ramps[0].color_ramp.interpolation=='CONSTANT'
    assert any(n.type=='SHADERTORGB' for n in nodes)
    roles[mat['role']]=len(ramps[0].color_ramp.elements)
assert len(roles)==6
deps=bpy.context.evaluated_depsgraph_get()
triangles=0
mesh_count=0
lo=Vector((1e9,1e9,1e9))
hi=-lo
wheel_minima={}
for ob in scene.objects:
    if ob.type not in {'MESH','CURVE'}:
        continue
    ev=ob.evaluated_get(deps)
    me=ev.to_mesh()
    me.calc_loop_triangles()
    triangles+=len(me.loop_triangles)
    mesh_count+=1
    min_z=1e9
    for v in me.vertices:
        co=ev.matrix_world@v.co
        min_z=min(min_z,co.z)
        for j in range(3):
            lo[j]=min(lo[j],co[j])
            hi[j]=max(hi[j],co[j])
    if ob.name.startswith('Rounded_performance_tire_'):
        assert abs(min_z)<1e-6
        wheel_minima[ob.name]=min_z
    ev.to_mesh_clear()
assert triangles==g['evaluatedTriangles'] and triangles>=15000
assert mesh_count==g['evaluatedMeshCount']
assert abs((hi.x-lo.x)-4.6)<1e-5
assert len(wheel_minima)==4
for wheel in g['wheels']:
    rig=bpy.data.objects['Wheel_'+wheel['name']+'_independent_Y_axle']
    assert (rig.matrix_world.translation-Vector(wheel['center'])).length<1e-6
    assert rig.parent==root
    assert abs(wheel['center'][2]-wheel['radius'])<1e-8
evidence={'status':'passed','savedSceneReopened':True,'evaluatedTriangles':triangles,'evaluatedMeshCount':mesh_count,'overallDimensions':list(hi-lo),'bounds':{'min':list(lo),'max':list(hi)},'toonRoleBandCounts':roles,'groundAnchor':[origin.x*128,(1-origin.y)*128+28],'tireMinimumWorldZ':wheel_minima,'fourIndependentWheelAxleFrames':True,'renderer':'BLENDER_EEVEE','threads':scene.render.threads,'sceneUnmodified':True}
(DATA/'scene-validation.json').write_text(json.dumps(evidence,indent=2)+'\n')
print(json.dumps(evidence,indent=2))
