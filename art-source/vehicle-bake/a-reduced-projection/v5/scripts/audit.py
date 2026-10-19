"""Actual exported GLB: neutral full-roll clearance, rig/scale, fresh-import renders.
Cylinder/triangle test adapted from scripts/authored-assets/verify_vehicle_body_clearance.py.
"""
import bpy,math,json,sys,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=next(p for p in Path(__file__).resolve().parents if (p/'AGENTS.md').is_file() and (p/'public').is_dir());REV=sys.argv[sys.argv.index('--')+1]
O=ROOT/'public/demos/vehicle-bake/a-reduced-projection'/REV;A=ROOT/'art-source/vehicle-bake/a-reduced-projection'/REV
assert not (O/'report.json').exists() or json.loads((O/'report.json').read_text()).get('status')!='complete','Finished revision is immutable'
S=80/4.6
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(O/'model.glb'));bpy.context.view_layer.update()
scene=bpy.context.scene;root=bpy.data.objects['Coupe_export_root'];meshes=[o for o in scene.objects if o.type=='MESH']
def clip(poly,axis,bound,direction):
 if not poly:return []
 result=[];previous=poly[-1];prev_in=direction*(previous[axis]-bound)>=-1e-7
 for current in poly:
  inside=direction*(current[axis]-bound)>=-1e-7
  if inside!=prev_in:result.append(previous.lerp(current,(bound-previous[axis])/(current[axis]-previous[axis])))
  if inside:result.append(current)
  previous,prev_in=current,inside
 return result
def radial(poly,center):
 points=[(p.x-center.x,p.z-center.z) for p in poly];sides=[];dist=[];area=0
 for a,b in zip(points,points[1:]+points[:1]):
  sides.append(a[0]*b[1]-a[1]*b[0]);area+=sides[-1];dx=b[0]-a[0];dy=b[1]-a[1];ll=dx*dx+dy*dy;t=min(1,max(0,-(a[0]*dx+a[1]*dy)/ll)) if ll else 0;dist.append(math.hypot(a[0]+t*dx,a[1]+t*dy))
 if abs(area)>1e-9 and (all(v>=-1e-7 for v in sides) or all(v<=1e-7 for v in sides)):return 0
 return min(dist)
body=bpy.data.objects['Body_static'];body.data.calc_loop_triangles();bodypoints=[body.matrix_world@v.co for v in body.data.vertices];bodytris=[[bodypoints[i] for i in t.vertices] for t in body.data.loop_triangles]
checks=[]
for label in ['FL','FR','RL','RR']:
 roll=bpy.data.objects[f'Wheel_{label}_Roll'];steer=bpy.data.objects[f'Wheel_{label}_Steer'];wheel=bpy.data.objects[f'Wheel_{label}_tire_hub']
 assert roll.parent==steer and wheel.parent==roll
 assert list(roll['roll_axis_gltf'])==[0,0,-1] and list(steer['steer_axis_gltf'])==[0,1,0]
 assert bool(steer['steering_enabled'])==label.startswith('F')
 center=roll.matrix_world.translation;pts=[wheel.matrix_world@v.co for v in wheel.data.vertices];lo=min(p.y for p in pts);hi=max(p.y for p in pts);radius=max(math.hypot(p.x-center.x,p.z-center.z) for p in pts)
 gap=1e9;owner=None
 for idx,tri in enumerate(bodytris):
  poly=clip(clip(tri,1,lo,1),1,hi,-1)
  if poly:
   g=radial(poly,center)-radius
   if g<gap:gap=g;owner=idx
 meta_radius=float(roll['wheel_radius']);assert abs(meta_radius-.34*S)<1e-5
 checks.append({'wheel':label,'centerWorldBlender':list(center),'actualRadialEnvelope':radius,'metadataRadius':meta_radius,'axialSlab':[lo,hi],'minimumBodyGap':gap,'closestTriangle':owner,'floorGapAcrossAllRolls':center.z-radius,'neutralMeshFloorGap':min(p.z for p in pts),'allNeutralRollBodyClear':gap>0,'allNeutralRollFloorClear':center.z-radius>=-1e-5})
allpoints=[o.matrix_world@v.co for o in meshes for v in o.data.vertices];mn=[min(p[i] for p in allpoints) for i in range(3)];mx=[max(p[i] for p in allpoints) for i in range(3)]
report={'sourceGLBSha256':hashlib.sha256((O/'model.glb').read_bytes()).hexdigest(),'meshCount':len(meshes),'worldBounds':{'min':mn,'max':mx,'size':[b-a for a,b in zip(mn,mx)]},'sourceUnitBoundsSize':[(b-a)/S for a,b in zip(mn,mx)],'wheels':checks,'allNeutralRollBodyClear':all(c['allNeutralRollBodyClear'] for c in checks),'allNeutralRollFloorClear':all(c['allNeutralRollFloorClear'] for c in checks),'method':'Clip every imported fixed-body triangle to each actual exported wheel axial slab; prove radial separation from entire moving vertex cylinder for all roll angles','steeringQualified':False}
(A/'evidence/clearance.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2),flush=True)
# Fresh glTF import render. All interior paint comes from imported material/texture.
bpy.ops.object.camera_add(location=(0,-12*math.cos(math.radians(50))*S,12*math.sin(math.radians(50))*S));cam=bpy.context.object;cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=7.2*S;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=1;scene.cycles.use_denoising=False;scene.cycles.max_bounces=0;scene.render.threads_mode='FIXED';scene.render.threads=4;scene.render.resolution_x=scene.render.resolution_y=512;scene.render.resolution_percentage=100;scene.render.film_transparent=True;scene.render.image_settings.color_mode='RGBA';scene.view_settings.view_transform='Standard'
(O/'imported').mkdir(exist_ok=True)
for i in range(8):
 root.rotation_euler.z=math.radians(i*45);scene.render.filepath=str(O/f'imported/raw-{i}.png');bpy.ops.render.render(write_still=True)
print('IMPORTED_GLB_AUDITED',REV)
