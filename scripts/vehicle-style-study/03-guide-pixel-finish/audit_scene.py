"""Read-only source scene checks. Run inside background Blender."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[3];D=ROOT/'data/vehicle-style-study/03-guide-pixel-finish'
bpy.ops.wm.open_mainfile(filepath=str(D/'sports-coupe.blend'))
s=bpy.context.scene;deps=bpy.context.evaluated_depsgraph_get();triangles=0;lo=[1e9]*3;hi=[-1e9]*3
for o in s.objects:
 if o.type not in ('MESH','CURVE'):continue
 assert all(not m.name.startswith('Guide_') for m in o.data.materials if m),'Saved scene must retain original beauty materials'
 eo=o.evaluated_get(deps);me=eo.to_mesh();me.calc_loop_triangles();triangles+=len(me.loop_triangles)
 for v in me.vertices:
  p=o.matrix_world@v.co
  for j in range(3):lo[j]=min(lo[j],p[j]);hi[j]=max(hi[j],p[j])
 eo.to_mesh_clear()
origin=world_to_camera_view(s,s.camera,Vector((0,0,0)))
assert abs(origin.x*128-64)<1e-4 and abs((1-origin.y)*128+28-92)<1e-4
assert s.render.threads==4 and s.cycles.device=='CPU'
assert triangles>=10000
pivots=[o for o in s.objects if o.name.endswith('_Roll_Y')];assert len(pivots)==4
tires=[]
for o in s.objects:
 if o.name.startswith('Rounded performance tire'):
  assert o.parent in pivots
  actual=min((o.matrix_world@Vector(c)).z for c in o.bound_box);assert abs(actual)<1e-4
  tires.append({'object':o.name,'parent':o.parent.name,'minZ':actual})
assert len(tires)==4
r={'triangles':triangles,'bounds':{'min':lo,'max':hi,'size':[b-a for a,b in zip(lo,hi)]},'wheelPivots':len(pivots),'tires':tires,'groundAnchor':[64,92],'threads':4,'device':'CPU','beautyMaterialsRetained':True}
(D/'scene-audit.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r,indent=2))
