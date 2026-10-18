"""Fresh jellyfish: deforming closed bell with constant volume and linked tendrils."""
import bpy,math,json,os
from pathlib import Path
from mathutils import Vector,Matrix
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[4];S=Path(__file__).resolve().parent;O=Path(os.environ.get('WILDLIFE_OUTPUT_DIR',str(ROOT/'public/demos/wildlife-v2/jellyfish/roster-v2')))
assert not (S/'receipt.json').exists(),'Registered banks are immutable'
O.mkdir(parents=True,exist_ok=True);bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.color_type='MATERIAL';scene.view_settings.view_transform='Standard';W=32;ANCHOR=[16,24]
def node(name,parent=None,loc=(0,0,0)):
 o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.parent=parent;o.location=loc;return o
root=node('ROOT-water');body=node('BODY-floating',root);root['phase']=0.0;root['amplitude']=.14
palette={'B':'#dcc4df','H':'#f3dce4','R':'#a887c0','C':'#bb8fb9','T':'#eac6df','K':'#75658f','W':'#f8ead9'};mats={}
for key,color in palette.items():
 m=bpy.data.materials.new(key);m.diffuse_color=(*[v/255 for v in bytes.fromhex(color[1:])],1);m['paintKey']=key;mats[key]=m
R=.52;H=.45;K=16;NR=6;verts=[(0,0,H)];faces=[]
for i in range(1,NR+1):
 theta=math.pi/2*i/NR
 for j in range(K):verts.append((R*math.sin(theta)*math.cos(j*2*math.pi/K),R*math.sin(theta)*math.sin(j*2*math.pi/K),H*math.cos(theta)))
for j in range(K):faces.append((0,1+j,1+(j+1)%K))
for i in range(NR-1):
 for j in range(K):
  a=1+i*K+j;b=1+(i+1)*K+j;c=1+(i+1)*K+(j+1)%K;d=1+i*K+(j+1)%K;faces.append((a,b,c,d))
center=len(verts);verts.append((0,0,0))
for j in range(K):faces.append((center,1+(NR-1)*K+(j+1)%K,1+(NR-1)*K+j))
mesh=bpy.data.meshes.new('closed bell surface');mesh.from_pydata(verts,[],faces);mesh.update();bell=bpy.data.objects.new('BELL-volume-preserving',mesh);scene.collection.objects.link(bell);bell.parent=body;bell.location.z=1.02
for key in ['B','H','R']:mesh.materials.append(mats[key])
for p in mesh.polygons:p.material_index=2 if p.index>=K*(NR-1) else (1 if p.index%4==0 else 0)
basis=bell.shape_key_add(name='Basis');radial=bell.shape_key_add(name='radial');height=bell.shape_key_add(name='height')
for key in [radial,height]:key.slider_min=-1;key.slider_max=1
for i,v in enumerate(basis.data):radial.data[i].co=(v.co.x*2,v.co.y*2,v.co.z);height.data[i].co=(v.co.x,v.co.y,v.co.z*2)
def driver(key,expr):
 d=key.driver_add('value').driver;d.type='SCRIPTED';d.expression=expr
 for name,prop in [('phase','phase'),('amp','amplitude')]:
  v=d.variables.new();v.name=name;v.type='SINGLE_PROP';v.targets[0].id=root;v.targets[0].data_path=f'["{prop}"]'
driver(radial,'amp*sin(2*pi*phase)');driver(height,'1/(1+amp*sin(2*pi*phase))**2-1')
def egg(name,loc,radii,key,parent=body,group='organ'):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8);o=bpy.context.object;o.name=name;o.scale=radii;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.parent=parent;o.location=loc;o.data.materials.append(mats[key]);o['paintGroup']=group;return o
organs=[]
for i in range(4):
 a=i*math.pi/2+math.pi/4;organs.append((a,egg(f'gonad {i}',(0,0,0),(.105,.105,.06),'C')))
tendrils={};lengths=[.18,.18,.17,.16,.15]
def align(o,a,b):
 o.location=(a+b)/2;z=(b-a).normalized();x=Vector((1,0,0));x=(x-z*x.dot(z)).normalized();y=z.cross(x);q=Matrix((x,y,z)).transposed().to_quaternion();q.make_compatible(o.rotation_quaternion);o.rotation_mode='QUATERNION';o.rotation_quaternion=q
for i in range(8):
 name=f'tendril{i}';angle=i*math.pi/4;js=[node(f'{name}-joint-{j}',root) for j in range(6)];ls=[egg(f'{name}-link-{j}',(0,0,0),(.025,.025,L/2),'T',root,'tendril') for j,L in enumerate(lengths)];tendrils[name]=dict(angle=angle,joints=js,links=ls)
oral={}
for i in range(4):
 name=f'oral{i}';a=i*math.pi/2;Ls=[.18,.16,.14];js=[node(f'{name}-joint-{j}',root) for j in range(4)];ls=[egg(f'{name}-link-{j}',(0,0,0),(.075-j*.017,.06,L/2),'B',root,'oral') for j,L in enumerate(Ls)];oral[name]=dict(angle=a,lengths=Ls,joints=js,links=ls)
def pose(t,clip):
 moving=clip=='pulse';action=clip=='action';phase=t if moving or action else 0;root['phase']=float(phase);root['amplitude']=.14 if moving else .09 if action else 0.0
 body.location.z=.07*math.sin(2*math.pi*phase);body.rotation_euler.y=.025*math.sin(2*math.pi*phase);r=1+root['amplitude']*math.sin(2*math.pi*phase);h=1/r**2;bpy.context.view_layer.update()
 for a,o in organs:o.location=(.18*r*math.cos(a),.18*r*math.sin(a),1.02+.14*h)
 for i,(n,l) in enumerate(tendrils.items()):
  a=l['angle'];ps=[body.matrix_local@Vector((R*r*math.cos(a),R*r*math.sin(a),1.02))]
  for j,L in enumerate(lengths):
   swing=.16*math.sin(2*math.pi*phase-i*.5+j*.6) if moving or action else 0;v=Vector((math.cos(a)*swing,math.sin(a)*swing,-1)).normalized();ps.append(ps[-1]+v*L)
  for o,p,q in zip(l['links'],ps,ps[1:]):align(o,p,q)
  for o,p in zip(l['joints'],ps):o.location=p
 for i,(n,l) in enumerate(oral.items()):
  a=l['angle'];ps=[body.matrix_local@Vector((.12*math.cos(a),.12*math.sin(a),1.02))]
  for j,L in enumerate(l['lengths']):
   curl=.35*math.sin(2*math.pi*phase+j*.9+i*.6);v=Vector((math.cos(a+curl)*.35,math.sin(a+curl)*.35,-1)).normalized();ps.append(ps[-1]+v*L)
  for o,p,q in zip(l['links'],ps,ps[1:]):align(o,p,q)
  for o,p in zip(l['joints'],ps):o.location=p
 bpy.context.view_layer.update()
animated=[body]+[o for a in tendrils.values() for o in a['joints']+a['links']]+[o for a in oral.values() for o in a['joints']+a['links']]+[o for a,o in organs]
clips=[('idle',1,1,1),('pulse',10,32,4),('action',160,8,10)]
for clip,start,count,step in clips:
 for i in range(count*2+1):
  pose(i/(count*2),clip);f=start+i*step/2
  root.keyframe_insert('["phase"]',frame=f);root.keyframe_insert('["amplitude"]',frame=f)
  for o in animated:o.keyframe_insert('location',frame=f);o.keyframe_insert('rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler',frame=f)
for o in [root,*animated]:
 for layer in o.animation_data.action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for fc in bag.fcurves:
     for k in fc.keyframe_points:k.interpolation='LINEAR'
camera=json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text());bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=W/10;cam.data.shift_y=(ANCHOR[1]-W/2)/W;cam.location=camera['cameraLocationAtDistance10'];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.resolution_x=scene.render.resolution_y=W;scene.render.resolution_percentage=100;scene.render.fps=100;scene.render.film_transparent=True;scene.frame_start=10;scene.frame_end=134
scene['motionIdentity']='jellyfish-roster-v2';scene['tendrilLengths']=json.dumps(lengths);scene['oralLengths']=json.dumps([.18,.16,.14]);scene['bellRadius']=R;scene['bellHeight']=H;scene['bodyMotion']='real closed-bell radial/height deformation; volume determinant 1';scene.timeline_markers.new('PULSE - constant volume bell',frame=10);scene.timeline_markers.new('ORAL ARM CURL',frame=160);scene.frame_set(1);pose(0,'idle');bpy.ops.wm.save_as_mainfile(filepath=str(S/'jellyfish.blend'))
def project(p):
 v=world_to_camera_view(scene,cam,p);return [v.x*W,(1-v.y)*W,v.z]
def point(o):return project(o.matrix_world.translation)
records=[]
for facing,yaw in camera['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw)
 for clip,start,count,step in clips:
  for i in range(count):
   scene.frame_set(start+i*step);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();obj=bell.evaluated_get(dg);m=obj.to_mesh();polys=[]
   projected=[project(obj.matrix_world@v.co) for v in m.vertices]
   obj.to_mesh_clear();records.append(dict(facing=facing,clip=clip,index=i,bellVertices=projected,organs=[point(o.evaluated_get(dg)) for a,o in organs],tendrils={n:[point(o.evaluated_get(dg)) for o in l['joints']] for n,l in tendrils.items()},oral={n:[point(o.evaluated_get(dg)) for o in l['joints']] for n,l in oral.items()}))
(S/'projection.json').write_text(json.dumps(dict(identity='jellyfish-roster-v2',canvas=W,anchor=ANCHOR,frameDurationMs=40,palette=palette,bellFaces=faces,bellKeys=[["B","H","R"][p.material_index] for p in mesh.polygons],records=records),separators=(',',':')),encoding='utf8');print('JELLYFISH_SOURCE_OK',len(records))
