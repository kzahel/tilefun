"""Blender 5.2 background, --threads 4 --python build.py -- REVISION [budget factor].
Actual retained source -> component QEM -> visible same-owner projection -> UV cleanup.
No view-dependent materials or canvas drawing. Run prepare.py first.
"""
import bpy, math, json, sys, struct,zlib,hashlib, shutil
import numpy as np
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree

ROOT=next(p for p in Path(__file__).resolve().parents if (p/'AGENTS.md').is_file() and (p/'public').is_dir());ROUTE='a-reduced-projection'
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['v1']
REV=args[0];FACTOR=float(args[1]) if len(args)>1 else 1.
SRC=ROOT/'art-source/vehicle-style-study/03-guide-pixel-finish/sports-coupe.blend'
A=ROOT/'art-source/vehicle-bake'/ROUTE/REV;O=ROOT/'public/demos/vehicle-bake'/ROUTE/REV
INPUT=json.loads((A/'input-recipe.json').read_text()) if (A/'input-recipe.json').exists() else {}
SRC=ROOT/INPUT.get('sourceBlend',str(SRC.relative_to(ROOT)))
D=ROOT/'data/vehicle-bake'/ROUTE/REV
for p in (A,O,D,A/'evidence'):p.mkdir(parents=True,exist_ok=True)
assert not (O/'report.json').exists(), 'Retained candidate is immutable: use a new revision'
N=512;SCALE=80/4.6
P={'ink':(58,58,80),'warm':(74,42,61),'deep':(127,33,76),'shadow':(161,18,80),'mid':(197,52,88),'red':(211,68,92),'light':(227,90,90),'glint':(225,132,132),'gd':(86,89,114),'glass':(115,140,168),'gl':(164,187,213),'gg':(186,210,224),'rim':(131,136,151),'silver':(212,212,230),'white':(248,248,248),'ruby':(186,39,88)}
K={'body':(255,0,0),'glass':(0,255,255),'wheels':(0,0,255),'lamps':(255,255,0),'intakes':(255,0,255),'panels':(0,255,0),'rim':(255,255,255),'rear_lamps':(255,64,0)}
targets=[np.frombuffer((A/f'evidence/inputs/target-{i}.rgba').read_bytes(),dtype=np.uint8).reshape(128,128,4) for i in range(8)]
guides=[np.frombuffer((A/f'evidence/inputs/guide-{i}.rgba').read_bytes(),dtype=np.uint8).reshape(128,128,4) for i in range(8)]
def png(path,a):
 a=np.asarray(a,dtype=np.uint8);h,w=a.shape[:2];ct=6 if a.shape[2]==4 else 2
 def chunk(k,v):return struct.pack('>I',len(v))+k+v+struct.pack('>I',zlib.crc32(k+v)&0xffffffff)
 path.write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,ct,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(b'\0'+r.tobytes() for r in a),6))+chunk(b'IEND',b''))
bpy.ops.wm.open_mainfile(filepath=str(SRC));scene=bpy.context.scene
root=bpy.data.objects['Car_Root_forward_minus_X'];root.rotation_euler=(0,0,0);bpy.context.view_layer.update()
objects=[o for o in scene.objects if o.type in ('MESH','CURVE')];source=[];verts=[];faces=[];face_owner=[]
deps=bpy.context.evaluated_depsgraph_get()
for sid,o in enumerate(objects):
 eo=o.evaluated_get(deps);m=eo.to_mesh();m.calc_loop_triangles();vv=[o.matrix_world@v.co for v in m.vertices]
 base=len(verts);verts.extend(vv)
 ff=[tuple(t.vertices) for t in m.loop_triangles];faces.extend(tuple(base+j for j in f) for f in ff);face_owner.extend([sid]*len(ff))
 info={'name':o.name,'kind':o['guide_class'],'sourceTriangles':len(ff),'wheel':o.parent.name if o.parent and o.parent.name.endswith('_Roll_Y') else None,'vertices':vv,'triangles':ff}
 if o['guide_class']=='glass':
  nu,nv=(40,24) if o.name=='Front windshield' else ((32,24) if o.name=='Rear glass' else (40,18))
  info['patch']=[vv[0],vv[nu*(nv+1)],vv[-1],vv[nv]]
 source.append(info);eo.to_mesh_clear()
high=BVHTree.FromPolygons(verts,faces,all_triangles=True)
def base_budget(s):
 n=s['name'];k=s['kind']
 if n.startswith('Continuous'):return 850
 if n.startswith('Rounded performance tire'):return 128
 if n.startswith('Recessed wheel barrel'):return 28
 if n.startswith('Torus'):return 32 # wheel rim
 if n.startswith('Sphere'):return 16 # wheel central hub
 if n.startswith('Swept forged spoke'):return 8
 if n.startswith('Rolled fender'):return 36
 if k=='glass':return 20 if 'Side' in n else 28
 if n=='Roof':return 36
 if n.startswith('Aerodynamic'):return 20
 if n.startswith('Polished exhaust'):return 20
 if n.startswith('Rear deck cooling'):return 0 # projected into deck atlas instead
 if n.startswith('Window gasket'):return 28
 if k in ('lamps','rear_lamps','intakes'):return 4 if s['sourceTriangles']>100 else 8
 return 10 if s['sourceTriangles']<100 else 16
def budget(s):
 b=base_budget(s)
 if not b:return 0
 minimum=64 if s['name'].startswith('Rounded performance tire') else INPUT.get('minimumCoachworkTriangles',220) if s['name'].startswith('Continuous') else INPUT.get('minimumFenderTriangles',30) if s['name'].startswith('Rolled fender') else 8 if s['kind']=='glass' else 4
 return max(minimum,round(b*FACTOR))
stats=[];low=[]
for sid,(o,s) in enumerate(zip(objects,source)):
 b=budget(s)
 if not b:bpy.data.objects.remove(o,do_unlink=True);stats.append({k:v for k,v in s.items() if k not in ('vertices','triangles','patch')}|{'budget':0,'actual':0});continue
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
 if o.type=='CURVE':o.data.bevel_resolution=0;o.data.resolution_u=1
 bpy.ops.object.convert(target='MESH');o=bpy.context.object
 # Freeze world-space geometry, preserving source component and open topology.
 mw=o.matrix_world.copy();o.parent=None;o.matrix_world=mw;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 o.data.calc_loop_triangles();before=len(o.data.loop_triangles)
 if before>b:
  mod=o.modifiers.new('Component budget QEM','DECIMATE');mod.ratio=max(.001,b/before);mod.use_collapse_triangulate=True
  bpy.ops.object.modifier_apply(modifier=mod.name)
 if s['name'].startswith('Rounded performance tire'):
  # QEM may drift outside the original rigid radial envelope. Restore its exact
  # source-owned constraint, rather than changing axle/metadata to fit artifacts.
  center=Vector((-1.4 if s['wheel'].startswith('Front') else 1.4,0,.34))
  for v in o.data.vertices:
   dx=v.co.x-center.x;dz=v.co.z-center.z;r=math.hypot(dx,dz)
   if r>.34:v.co.x=center.x+dx*.34/r;v.co.z=center.z+dz*.34/r
  candidates=[v for v in o.data.vertices if math.hypot(v.co.x-center.x,v.co.z-center.z)>.339999]
  contact=min(candidates,key=lambda v:abs(math.atan2(v.co.x-center.x,center.z-v.co.z)))
  theta=math.atan2(contact.co.x-center.x,center.z-contact.co.z);ct=math.cos(theta);st=math.sin(theta)
  for v in o.data.vertices:
   dx=v.co.x-center.x;dz=v.co.z-center.z;v.co.x=center.x+dx*ct+dz*st;v.co.z=center.z-dx*st+dz*ct
 if s['name'].startswith('Rear buttress'):
  # Source buttress tube's lower outside corner enters the rear tire slab.
  # Keep the same centerline/swept cabin while pulling only this tip inward.
  for v in o.data.vertices:
   if abs(v.co.y)>.79:v.co.y=math.copysign(.79,v.co.y)
 if s['name'].startswith('Continuous'):
  # Preserve actual open pockets after QEM; coarse diagonals must not bridge a
  # source well. Inner cutter walls remain geometry, never painted fake holes.
  for x in (-1.4,1.4):
   for side in (-1,1):
    bpy.ops.mesh.primitive_cylinder_add(vertices=20,radius=.375,depth=.70,location=(x,side*1.0,.34),rotation=(math.pi/2,0,0));cutter=bpy.context.object
    bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('Post-QEM source well safety','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
  bpy.context.view_layer.objects.active=o
 mod=o.modifiers.new('Explicit export triangulation','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=mod.name)
 for p in o.data.polygons:p.use_smooth=True
 attr=o.data.attributes.new('source_owner','INT','FACE')
 for q in attr.data:q.value=sid
 o['source_owner']=sid;o['wheel_source']=s['wheel'] or '';low.append(o)
 stats.append({k:v for k,v in s.items() if k not in ('vertices','triangles','patch')}|{'budget':b,'actual':len(o.data.polygons)})
print('REDUCED',sum(s['actual'] for s in stats),flush=True)
bpy.ops.object.select_all(action='DESELECT')
for o in low:o.select_set(True)
bpy.context.view_layer.objects.active=low[0];bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(70),island_margin=.006,area_weight=.3,correct_aspect=True,scale_to_bounds=True)
bpy.ops.object.mode_set(mode='OBJECT')
# Fixed source cameras represented in unrotated object coordinates.
cam0=Vector((0,-12*math.cos(math.radians(50)),12*math.sin(math.radians(50))))
cams=[]
for i in range(8):
 rot=Matrix.Rotation(-math.radians(i*45),3,'Z');c=rot@cam0;d=c.normalized();right=rot@Vector((1,0,0));up=d.cross(right);cams.append((c,d,right,up))
atlas=np.zeros((N,N,4),np.uint8);atlas[:]=(*P['deep'],255)
raw=atlas.copy();ownership=np.full((N,N),-1,np.int16);confidence=np.zeros((N,N),np.uint8);conflicts=np.zeros((N,N),np.uint8);reasons=np.zeros(5,np.int64)
def fallback(s,p):
 k=s['kind']
 if k=='body':return P['light'] if p.z>.57 else P['mid'] if p.z>.4 else P['shadow']
 return P[{'glass':'glass','wheels':'ink','rim':'silver','lamps':'white','rear_lamps':'ruby','intakes':'ink','panels':'ink'}[k]]
def glass_uv(s,p):
 a,b,c,d=s['patch'];u=v=.5
 for _ in range(5):
  q=a*(1-u)*(1-v)+b*u*(1-v)+c*u*v+d*(1-u)*v
  du=(b-a)*(1-v)+(c-d)*v;dv=(d-a)*(1-u)+(c-b)*u
  mm=np.array([list(du),list(dv)]).T
  delta=np.linalg.lstsq(mm,np.array(p-q),rcond=None)[0];u+=float(delta[0]);v+=float(delta[1])
 return u,v
def paint(s,p,n):
 samples=[];sid=s['sid']
 for i,(c,d,right,up) in enumerate(cams):
  weight=abs(n.dot(d))
  if weight<.18:continue
  x=math.floor(64+p.dot(right)*128/7.2);y=math.floor(92-p.dot(up)*128/7.2)
  if not(1<=x<127 and 1<=y<127):continue
  a=targets[i];g=guides[i];co=a[y,x]
  if co[3]<128:continue
  if any(a[y+dy,x+dx,3]<128 for dx,dy in [(-1,0),(1,0),(0,-1),(0,1)]):reasons[0]+=1;continue
  if sum(abs(int(g[y,x,j])-K[s['kind']][j]) for j in range(3))>8:reasons[1]+=1;continue
  # Orthographic ray, from outside scene. Only the same actual source component may own it.
  hit,normal,idx,dist=high.ray_cast(p+d*10,-d,20)
  if hit is None or face_owner[idx]!=sid or (hit-p).length>.085:reasons[2]+=1;continue
  samples.append((weight,tuple(int(q) for q in co[:3]),i))
 samples.sort(reverse=True)
 base=fallback(s,p);r=samples[0][1] if samples else base
 cleanup=r;k=s['kind']
 if k=='glass':
  u,v=glass_uv(s,p);edge=min(u,1-u,v,1-v)
  # Source parametric boundaries, not screen-space redraw. Continuous 3D-owned frame.
  height=1-u if s['name']=='Rear glass' else u
  cleanup=P['ink'] if edge<.055 else P['gg'] if .68<height<.76 else P['gl'] if height>.48 else P['glass']
 elif k in ('panels','intakes'):cleanup=P['ink']
 elif k=='body' and s['name'].startswith('Continuous'):
  # Three source anchored deck louvers projected onto physical deck surface.
  if p.z>.59 and abs(p.y)<.41 and any(abs(p.x-x)<.026 for x in (1.45,1.60,1.75)):cleanup=P['warm']
  elif cleanup in (P['ink'],P['warm'],P['silver'],P['glass'],P['gd'],P['gl']):cleanup=base
 elif k=='wheels':cleanup=P['ink']
 elif k=='rim':cleanup=P['silver'] if p.z>.28 else P['rim']
 elif k=='lamps':cleanup=P['white']
 elif k=='rear_lamps':cleanup=P['ruby']
 return r,cleanup,len(samples),len({q[1] for q in samples})>1
for oi,o in enumerate(low):
 sid=o['source_owner'];s=source[sid];s['sid']=sid;m=o.data;uv=m.uv_layers.active.data
 for t in m.polygons:
  xyz=[m.vertices[j].co.copy() for j in t.vertices];uvv=np.array([[uv[j].uv.x*N,(1-uv[j].uv.y)*N] for j in t.loop_indices]);a,b,c=uvv
  lo=np.maximum(np.floor(uvv.min(axis=0)).astype(int),0);hi=np.minimum(np.ceil(uvv.max(axis=0)).astype(int),N-1)
  den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
  if abs(den)<1e-9:continue
  for y in range(lo[1],hi[1]+1):
   for x in range(lo[0],hi[0]+1):
    xx=x+.5;yy=y+.5;u=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/den;v=((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/den;w=1-u-v
    if min(u,v,w)<-1e-6:continue
    p=xyz[0]*u+xyz[1]*v+xyz[2]*w;n=t.normal
    rr,cc,count,conflict=paint(s,p,n);raw[y,x]=(*rr,255);atlas[y,x]=(*cc,255);ownership[y,x]=sid;confidence[y,x]=min(count*32,255);conflicts[y,x]=255 if conflict else 0
 if oi%12==0:print('PROJECT',oi,len(low),flush=True)
# Suppress isolated projection samples using same-owner atlas neighborhoods.
# This is a texture cleanup before export, never a native canvas patch.
for _ in range(2):
 prior=atlas.copy()
 for sid,s in enumerate(source):
  if s['kind']!='body':continue
  yy,xx=np.where(ownership==sid)
  for y,x in zip(yy,xx):
   votes={}
   for dy,dx in ((0,0),(-1,0),(1,0),(0,-1),(0,1),(-1,-1),(1,1),(-1,1),(1,-1)):
    ny,nx=y+dy,x+dx
    if 0<=ny<N and 0<=nx<N and ownership[ny,nx]==sid:
     color=tuple(prior[ny,nx,:3]);votes[color]=votes.get(color,0)+1
   if votes:
    color,count=max(votes.items(),key=lambda q:q[1])
    if count>=4:atlas[y,x,:3]=color
png(A/'evidence/raw-projection.png',raw)
png(A/'evidence/observed.png',np.stack([confidence]*3,axis=2));png(A/'evidence/conflicts.png',np.stack([conflicts]*3,axis=2))
unknown=np.where((ownership>=0)&(confidence==0),255,0).astype(np.uint8);png(A/'evidence/unknown.png',np.stack([unknown]*3,axis=2))
colors=np.zeros((N,N,3),np.uint8)
for sid in range(len(source)):colors[ownership==sid]=[(sid*79+80)%256,(sid*131+40)%256,(sid*43+100)%256]
png(A/'evidence/ownership.png',colors)
# Three texels of bleed, with nearest original island ownership. No UV overlaps.
occupied=ownership>=0
for _ in range(3):
 new=occupied.copy();out=atlas.copy()
 for dy,dx in ((-1,0),(1,0),(0,-1),(0,1)):
  near=np.roll(occupied,(dy,dx),(0,1));take=near&~new;out[take]=np.roll(atlas,(dy,dx),(0,1))[take];new|=take
 atlas=out;occupied=new
png(A/'atlas.png',atlas);shutil.copy2(A/'atlas.png',O/'atlas.png')
(A/'evidence/transfer.json').write_text(json.dumps({'retainedTexels':int((ownership>=0).sum()),'observedTexels':int(((ownership>=0)&(confidence>0)).sum()),'unknownTexels':int((unknown>0).sum()),'conflictingTexels':int((conflicts>0).sum()),'rejectedSamples':{'exteriorBoundary':int(reasons[0]),'semanticMismatch':int(reasons[1]),'visibilityOrOwnerMismatch':int(reasons[2])},'cleanup':['Source-parametric continuous dark glass frame and broad reflection bands','Solid intakes/panels and wheel rubber; source palette lamp/rim roles','Three world-space source-anchored deck slats; no exterior ink projected','Explicit source-role fallback for unseen texels; three-texel island dilation']},indent=2))
# Consolidate exactly one body plus four assemblies, one shared unlit atlas.
mat=bpy.data.materials.new('Source_palette_unlit_atlas');mat.use_nodes=True;nodes=mat.node_tree.nodes;nodes.clear()
out=nodes.new('ShaderNodeOutputMaterial');tex=nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(A/'atlas.png'));tex.interpolation='Closest';tex.extension='EXTEND';mat.node_tree.links.new(tex.outputs['Color'],out.inputs['Surface'])
for o in low:o.data.materials.clear();o.data.materials.append(mat)
groups={}
for o in low:groups.setdefault(o['wheel_source'],[]).append(o)
for o in list(scene.objects):
 if o.type=='EMPTY':bpy.data.objects.remove(o,do_unlink=True)
root=bpy.data.objects.new('Coupe_export_root',None);scene.collection.objects.link(root)
wheels=[]
for group,obs in groups.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in obs:o.select_set(True)
 bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();o=bpy.context.object
 if not group:o.name='Body_static';o.parent=root
 else:
  front=group.startswith('Front');side=-1 if '_near' in group else 1;label=('F' if front else 'R')+('L' if side<0 else 'R');center=Vector((-1.4 if front else 1.4,side*.87,.34))
  steer=bpy.data.objects.new(f'Wheel_{label}_Steer',None);scene.collection.objects.link(steer);steer.parent=root;steer.location=center;steer['steering_enabled']=front;steer['steer_axis_gltf']=[0,1,0]
  roll=bpy.data.objects.new(f'Wheel_{label}_Roll',None);scene.collection.objects.link(roll);roll.parent=steer;roll['wheel_radius']=.34*SCALE;roll['roll_axis_gltf']=[0,0,-1]
  o.name=f'Wheel_{label}_tire_hub';o.parent=roll;o.location=-center
  wheels.append({'label':label,'centerBlender':list(center),'centerExport':[center.x*SCALE,center.z*SCALE,-center.y*SCALE],'wheel_radius':.34*SCALE})
root.scale=(SCALE,)*3;bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
for o in root.children_recursive:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(O/'model.glb'),export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_materials='EXPORT')
root.scale=(1,1,1);bpy.context.view_layer.update()
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=1;scene.cycles.use_denoising=False;scene.cycles.max_bounces=0;scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.resolution_x=scene.render.resolution_y=512;scene.render.resolution_percentage=100;scene.render.film_transparent=True;scene.render.image_settings.color_mode='RGBA';scene.view_settings.view_transform='Standard'
tex.image.pack();bpy.ops.wm.save_as_mainfile(filepath=str(A/'car.blend'))
for i in range(8):
 root.rotation_euler.z=math.radians(i*45);scene.render.filepath=str(O/f'raw-{i}.png');bpy.ops.render.render(write_still=True)
 print('RENDER',i,flush=True)
root.rotation_euler.z=0
(A/'recipe.json').write_text(json.dumps({'route':ROUTE,'revision':REV,'budgetFactor':FACTOR,'inputRecipe':INPUT,'exportWorldScale':SCALE,'components':stats,'wheels':wheels,'source':str(SRC.relative_to(ROOT)),'postReductionConstraints':['Clamp tire radial envelope to source radius .34; align an outer contact vertex down','Rear buttress outside tip limited to |Y|<=.79 to clear tire axial slab','Actual wheel-local radius .375 safety pockets after QEM, 20 cutter sides'],'projection':'Eight fixed cameras, ray visibility against retained high mesh, exact source component and semantic pixel ownership; native exterior boundary rejection','atlas':[512,512],'renderThreads':4},indent=2))
shutil.copy2(Path(__file__),A/'build.py');shutil.copy2(Path(__file__).with_name('prepare.py'),A/'prepare.py')
print('DONE',REV,flush=True)
