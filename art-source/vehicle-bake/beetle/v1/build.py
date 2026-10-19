"""Independent Beetle family. Blender background --threads 4 --python build.py.
Replays from this file + family.json, no coupe geometry or ignored inputs.
Only --scratch replay may replace draft outputs; finished report guards v1.
"""
import bpy, bmesh, math, json, sys, shutil, struct, zlib, hashlib
from pathlib import Path
from mathutils import Vector

ROOT=next(p for p in Path(__file__).resolve().parents if (p/'AGENTS.md').is_file() and (p/'public').is_dir())
CFG=json.loads(Path(__file__).with_name('family.json').read_text())
SCRATCH='--scratch' in sys.argv
A=ROOT/('data/vehicle-bake/beetle/replay/source' if SCRATCH else 'art-source/vehicle-bake/beetle/v1')
O=ROOT/('data/vehicle-bake/beetle/replay/public' if SCRATCH else 'public/demos/vehicle-bake/beetle/v1')
D=ROOT/'data/vehicle-bake/beetle'
for p in (A,O,D,A/'evidence'):p.mkdir(parents=True,exist_ok=True)
if (O/'report.json').exists(): assert json.loads((O/'report.json').read_text()).get('status')!='complete','Finished revision immutable'
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
S=CFG['exportWorldScale'];P=CFG['palette'];keys=list(P)

def png(path,w,h,pixels):
 def chunk(k,v):return struct.pack('>I',len(v))+k+v+struct.pack('>I',zlib.crc32(k+v)&0xffffffff)
 raw=b''.join(b'\0'+pixels[y*w*4:(y+1)*w*4] for y in range(h))
 path.write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b''))
def paint_skin(x,t):
 a=abs(t)
 role='cream' if a<.2 else 'paintLight' if a<.58 else 'paint' if a<.95 else 'paintMid'
 apertures=[(-1.17,-.67,-.64,.64,'front'),(.91,1.40,-.56,.56,'rear')]
 for side in [-1,1]:
  for x0,x1 in [(-.94,.20),(.29,1.00)]:
   lo,hi=sorted([side*.68,side*1.26]);apertures.append((x0,x1,lo,hi,'side'))
 for x0,x1,t0,t1,kind in apertures:
  u=(x-x0)/(x1-x0);v=(t-t0)/(t1-t0)
  # Rounded rectangle in the family's own (longitudinal, lateral-angle) surface.
  rad=.13;dx=max(abs(u-.5)-(.5-rad),0);dy=max(abs(v-.5)-(.5-rad),0)
  if 0<=u<=1 and 0<=v<=1 and dx*dx+dy*dy<=rad*rad:
   inner=min(u,1-u)>.075 and min(v,1-v)>.12
   if not inner:return 'ink'
   return 'glassGlint' if .23<v<.32 else 'glassLight' if v<.53 else 'glass'
 # Broad purposeful hood / engine lid seams; paint belongs to body surface.
 if x< -1.2 and abs(t)<.028:return 'paintShadow'
 if x>1.44 and abs(t)<.43 and any(abs(x-q)<.027 for q in [1.48,1.65,1.82]):return 'ink'
 if 1.42<x<2.02 and abs(a-(.72-(x-1.42)*.23))<.014:return 'paintDeep'
 if a>1.27 and (abs(x+.86)<.018 or abs(x-.36)<.018):return 'paintDeep'
 return role

atlas=bytearray(512*512*4)
for y in range(512):
 for x in range(512):
  if y<384:
   px=-2.14+4.28*(x+.5)/512;t=-math.pi/2+math.pi*(y+.5)/384;k=paint_skin(px,t)
  elif y<448:
   px=-2.14+4.28*(x+.5)/512;z=.27+.37*(y-384+.5)/64;k='paintMid' if z>.43 else 'paintShadow'
   if -.878<px<.378 and (abs(z-.355)<.013 or abs(px+.86)<.018 or abs(px-.36)<.018):k='paintDeep'
  else:k=keys[min(len(keys)-1,((y-448)//32)*16+x//32)]
  atlas[(y*512+x)*4:(y*512+x+1)*4]=bytes((*P[k],255))
png(A/'atlas.png',512,512,atlas);shutil.copy2(A/'atlas.png',O/'atlas.png')
mat=bpy.data.materials.new('Beetle_palette_unlit_nearest');mat.use_nodes=True
nodes=mat.node_tree.nodes;nodes.clear();out=nodes.new('ShaderNodeOutputMaterial');tex=nodes.new('ShaderNodeTexImage')
tex.image=bpy.data.images.load(str(A/'atlas.png'));tex.interpolation='Closest';tex.extension='EXTEND';mat.node_tree.links.new(tex.outputs['Color'],out.inputs['Surface'])
mat.diffuse_color=(.94,.82,.54,1)
owners=[];groups={};component_stats=[]

def mesh(name,verts,faces,roles,group='body'):
 m=bpy.data.meshes.new(name);m.from_pydata(verts,[],faces);m.update()
 o=bpy.data.objects.new(name,m);scene.collection.objects.link(o);o.data.materials.append(mat)
 uv=m.uv_layers.new(name='Semantic_palette_UV');attr=m.attributes.new('paint_role','INT','FACE')
 for f in m.polygons:
  k=roles[f.index] if isinstance(roles,list) else roles
  idx=keys.index(k);attr.data[f.index].value=idx
  # Padded constant-colour UV islands. Each face retains semantic ownership.
  cx=(idx%16)*32+16;cy=448+(idx//16)*32+16
  for j,li in enumerate(f.loop_indices):
   a=2*math.pi*j/len(f.loop_indices);uv.data[li].uv=((cx+6*math.cos(a))/512,1-(cy+6*math.sin(a))/512)
 bm=bmesh.new();bm.from_mesh(m);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(m);bm.free()
 o['surface_owner']=name;groups.setdefault(group,[]).append(o)
 m.calc_loop_triangles();component_stats.append({'name':name,'group':group,'triangles':len(m.loop_triangles),'paintRoles':sorted(set(roles if isinstance(roles,list) else [roles]))})
 return o

def cube(name,loc,scale,role='silver',group='body',bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  mod=o.modifiers.new('Restrained rounded trim','BEVEL');mod.width=bevel;mod.segments=1;bpy.ops.object.modifier_apply(modifier=mod.name)
 vv=[tuple(o.matrix_world@v.co) for v in o.data.vertices];ff=[list(p.vertices) for p in o.data.polygons];bpy.data.objects.remove(o,do_unlink=True)
 return mesh(name,vv,ff,role,group)

def curve_tube(name,pts,r,role,group='body',sides=4):
 vv=[]
 for i,p in enumerate(pts):
  tangent=Vector(pts[min(i+1,len(pts)-1)])-Vector(pts[max(0,i-1)])
  tangent.normalize();a=tangent.cross(Vector((0,0,1)))
  if a.length<.01:a=tangent.cross(Vector((0,1,0)))
  a.normalize();b=tangent.cross(a).normalized()
  for j in range(sides):vv.append(tuple(Vector(p)+r*(a*math.cos(j*2*math.pi/sides)+b*math.sin(j*2*math.pi/sides))))
 ff=[]
 for i in range(len(pts)-1):
  for j in range(sides):ff.append((i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j))
 ff.extend([tuple(range(sides-1,-1,-1)),tuple((len(pts)-1)*sides+j for j in range(sides))])
 return mesh(name,vv,ff,role,group)

stations=CFG['stations']
def profile(x):
 for a,b in zip(stations,stations[1:]):
  if x<=b[0]:
   t=max(0,(x-a[0])/(b[0]-a[0]));return a[1]*(1-t)+b[1]*t,a[2]*(1-t)+b[2]*t
 return stations[-1][1:]
def skin(x,t,offset=0):
 w,h=profile(x);base=min(.64,h-.1)
 return Vector((x,(w+offset)*math.sin(t),base+(h-base)*max(0,math.cos(t))**.85+offset))

# Continuous egg-shaped coachwork, narrower than tires at the lower side wall.
vv=[];nt=16
for x,w,h in stations:
 for j in range(nt+1):vv.append(tuple(skin(x,-math.pi/2+math.pi*j/nt)))
ff=[];rr=[]
for i in range(len(stations)-1):
 for j in range(nt):
  ff.append((i*(nt+1)+j,(i+1)*(nt+1)+j,(i+1)*(nt+1)+j+1,i*(nt+1)+j+1))
  t=-math.pi/2+math.pi*(j+.5)/nt
  rr.append('cream' if abs(t)<.2 else 'paintLight' if abs(t)<.58 else 'paint' if abs(t)<.95 else 'paintMid')
# Side strips and narrow central underfloor; this is not a full-width slab.
for side,j in [(-1,0),(1,nt)]:
 base=len(vv)
 for x,w,h in stations:vv.append((x,min(w,.655)*side,.27))
 for i in range(len(stations)-1):
  ff.append((i*(nt+1)+j,base+i,base+i+1,(i+1)*(nt+1)+j));rr.append('paintShadow')
bottom=(len(stations)*(nt+1));other=bottom+len(stations)
for i in range(len(stations)-1):ff.append((bottom+i,other+i,other+i+1,bottom+i+1));rr.append('paintDeep')
for i in [0,len(stations)-1]:
 ff.append(tuple([i*(nt+1)+j for j in range(nt+1)]+[other+i,bottom+i]));rr.append('paintMid')
coach=mesh('Domed continuous coachwork',vv,ff,rr)
# Continuous actual skin UVs eliminate overlay/body depth disagreement entirely.
# Glass and internal frames are exactly on the same triangles as the coachwork.
uv=coach.data.uv_layers.active.data
for face in list(coach.data.polygons)[:(len(stations)-1)*nt]:
 for li in face.loop_indices:
  vi=coach.data.loops[li].vertex_index;i,j=divmod(vi,nt+1)
  uv[li].uv=((stations[i][0]+2.14)/4.28,1-(j/nt)*384/512)
for face in list(coach.data.polygons)[(len(stations)-1)*nt:(len(stations)-1)*(nt+2)]:
 for li in face.loop_indices:
  v=coach.data.vertices[coach.data.loops[li].vertex_index].co
  uv[li].uv=((v.x+2.14)/4.28,1-(384+max(0,min(1,(v.z-.27)/.37))*64)/512)

# The same parametric windows are now authored directly on coachwork UVs.
# No duplicate glass mesh is exported and no depth-offset workaround is used.

f=CFG['fender'];n=f['segments']
for axle in CFG['axles']:
 for side in [-1,1]:
  vv=[];ff=[];rr=[]
  for y,r in zip(f['lateralStations'],f['shoulderRadii']):
   for j in range(n+1):
    t=-.17+(math.pi+.34)*j/n;vv.append((axle+r*math.cos(t),side*y,.39+r*math.sin(t)))
  for k in range(4):
   for j in range(n):
    ff.append((k*(n+1)+j,k*(n+1)+j+1,(k+1)*(n+1)+j+1,(k+1)*(n+1)+j))
    rr.append('paintLight' if k==1 and 3<=j<=10 else 'paint' if k<3 else 'paintMid')
  # Outer lip is substantial metal thickness around a genuinely open arch.
  base=len(vv)
  for j in range(n+1):
   t=-.17+(math.pi+.34)*j/n;r=f['archRadius'];vv.append((axle+r*math.cos(t),side*1.025,.39+r*math.sin(t)))
  for j in range(n):ff.append((4*(n+1)+j,4*(n+1)+j+1,base+j+1,base+j));rr.append('paintShadow')
  mesh(f'Swept pontoon fender {axle} {side}',vv,ff,rr)

# Classic running boards, quiet trim, door boundaries anchored to body surface.
for side in [-1,1]:
 cube(f'Running board {side}',(0,side*.84,.285),(1.65,.35,.09),'ink',bevel=.025)
 # Door seams live on the actual side-skin UVs, no intersecting trim overlay.
 cube(f'Door handle {side}',(.15,side*.76,.97),(.15,.035,.035),'silver')

def disk(name,center,normal,r,role,segments=12,depth=.035,group='body'):
 c=Vector(center);n=Vector(normal).normalized();u=n.cross(Vector((0,0,1)))
 if u.length<.01:u=n.cross(Vector((0,1,0)))
 u.normalize();v=n.cross(u);verts=[]
 for dep,rad in [(0,r),(depth,r*.83)]:
  for j in range(segments):verts.append(tuple(c+n*dep+rad*(u*math.cos(2*math.pi*j/segments)+v*math.sin(2*math.pi*j/segments))))
 faces=[]
 for j in range(segments):faces.append((j,(j+1)%segments,segments+(j+1)%segments,segments+j))
 faces.append(tuple(segments+j for j in range(segments)))
 return mesh(name,verts,faces,role,group)
for side in [-1,1]:
 disk(f'Round headlamp chrome {side}',(-1.84,side*.80,.79),(-1,0,.4),.163,'silver')
 disk(f'Round ivory headlamp {side}',(-1.875,side*.80,.804),(-1,0,.4),.127,'cream',depth=.018)
 disk(f'Rear ruby lamp {side}',(1.89,side*.81,.72),(1,0,.3),.092,'ruby',segments=8)
 disk(f'Front amber signal {side}',(-1.40,side*.91,.995),(0,0,1),.055,'amber',segments=8,depth=.014)
for end in [-1,1]:
 curve_tube(f'Curved slim bumper {end}',[(end*2.13,-.86,.43),(end*2.23,-.58,.43),(end*2.28,0,.43),(end*2.23,.58,.43),(end*2.13,.86,.43)],.045,'silver',sides=6)
 for side in [-1,1]:cube(f'Bumper upright {end} {side}',(end*2.25,side*.53,.45),(.065,.065,.22),'rim')
# Hood spine and curved rear engine-lid seam; surface anchored, never projected.
# Hood/engine seams and louvers are atlas paint, with no coplanar trim tubes.

# Wheel topology has an exact circular envelope and genuinely centered pivots.
r=CFG['wheelRadius'];width=CFG['wheelWidth'];nr=16
for axle in CFG['axles']:
 for side in [-1,1]:
  wid=('F' if axle<0 else 'R')+('L' if side<0 else 'R');group=wid
  vv=[];ff=[];rr=[]
  rings=[(-width/2,.31),(-width*.36,r),(width*.36,r),(width/2,.31)]
  for y,rad in rings:
   for j in range(nr):
    t=2*math.pi*j/nr;vv.append((rad*math.sin(t),y,rad*math.cos(t)))
  for k in range(3):
   for j in range(nr):ff.append((k*nr+j,k*nr+(j+1)%nr,(k+1)*nr+(j+1)%nr,(k+1)*nr+j));rr.append('tireLight' if k!=1 else 'tire')
  for k in [0,3]:ff.append(tuple(k*nr+j for j in range(nr)));rr.append('tire')
  mesh('Wheel rubber '+wid,vv,ff,rr,group)
  # Symmetric pressed-steel wheel and smooth dome hub; hubs remain inside radius.
  for s in [side]:
   disk('Wheel rim '+wid+str(s),(0,s*(width/2+.003),0),(0,s,0),.245,'paintLight',segments=12,depth=.012,group=group)
   disk('Chrome hub '+wid+str(s),(0,s*(width/2+.017),0),(0,s,0),.169,'silver',segments=12,depth=.037,group=group)
   disk('Hub glint '+wid+str(s),(-.035,s*(width/2+.055),.035),(0,s,0),.07,'white',segments=8,depth=.002,group=group)

# Keep correctly placed named components in an editable semantic source master.
tex.image.pack();scene.view_settings.view_transform='Standard'
# An explicitly unused palette planning image is retained, not a projected draft.
draft=bpy.data.images.new('Unused family palette planning draft',width=512,height=512)
draft.pixels=[c/255 for y in range(512) for x in range(512) for c in (*P[keys[min(len(keys)-1,(y//64)*8+x//64)]],255)]
draft.filepath_raw=str(A/'palette-draft.png');draft.file_format='PNG';draft.save();draft.pack();draft.use_fake_user=True
camera_data=bpy.data.cameras.new('Fixed family study camera');camera=bpy.data.objects.new('Fixed family study camera',camera_data);scene.collection.objects.link(camera)
camera.location=(0,-12*math.cos(math.radians(50)),12*math.sin(math.radians(50)))
camera.rotation_euler=(-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.type='ORTHO';camera_data.ortho_scale=7.2;scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.samples=1;scene.cycles.max_bounces=0;scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.resolution_x=scene.render.resolution_y=512;scene.render.resolution_percentage=100;scene.render.film_transparent=True
for group,obs in groups.items():
 if group!='body':
  axle=CFG['axles'][0 if group[0]=='F' else 1];side=-1 if group[1]=='L' else 1
  for o in obs:o.location=(axle,side*CFG['halfTrack'],r)
bpy.ops.wm.save_as_mainfile(filepath=str(A/'master.blend'))
for group,obs in groups.items():
 if group!='body':
  for o in obs:o.location=(0,0,0)
root=bpy.data.objects.new('Beetle_Root_forward_minus_X',None);scene.collection.objects.link(root)
wheels=[]
for group,obs in groups.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in obs:o.select_set(True)
 bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();o=bpy.context.object
 if group=='body':o.name='Body_static';o.parent=root
 else:
  axle=CFG['axles'][0 if group[0]=='F' else 1];side=-1 if group[1]=='L' else 1;c=Vector((axle,side*CFG['halfTrack'],r))
  st=bpy.data.objects.new(f'Wheel_{group}_Steer',None);scene.collection.objects.link(st);st.parent=root;st.location=c;st['steering_enabled']=group[0]=='F';st['steer_axis_gltf']=[0,1,0]
  ro=bpy.data.objects.new(f'Wheel_{group}_Roll',None);scene.collection.objects.link(ro);ro.parent=st;ro['wheel_radius']=r*S;ro['roll_axis_gltf']=[0,0,-1]
  o.name=f'Wheel_{group}_tire_hub';o.parent=ro;o.location=(0,0,0)
  wheels.append({'id':group,'centerBlender':list(c),'centerExport':[c.x*S,c.z*S,-c.y*S],'radiusBlender':r,'wheel_radius':r*S})
 # Stable explicit triangulation is also used by the standard Blender glTF exporter.
 mod=o.modifiers.new('Explicit runtime triangulation','TRIANGULATE');bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
root.scale=(S,)*3;bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
for o in root.children_recursive:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(O/'model.glb'),export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_materials='EXPORT')
shutil.copy2(O/'model.glb',A/'model.glb')
root.scale=(1,1,1);bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(A/'car.blend'))
recipe={**CFG,'components':component_stats,'wheels':wheels,'method':CFG['paintMethod'],'masterMeaning':'Editable semantic component master at runtime topology; no separate high-poly/decimation claim.','sourceDependencies':['scripts/vehicle-bake/beetle/build.py','scripts/vehicle-bake/beetle/family.json'],'sharedComponents':['Blender glTF exporter (same selected-root/y-up/extras/material contract as coupe)','scripts/vehicle-bake/catalog.py:audit_glb','scripts/vehicle-bake/clearance.py','Compiled shared viewer.js / CarMeshAsset / CarPixelOutline / wheel-rig.mjs']}
(A/'recipe.json').write_text(json.dumps(recipe,indent=2)+'\n');shutil.copy2(A/'recipe.json',O/'recipe.json')
(A/'paint-ownership.json').write_text(json.dumps({'method':CFG['paintMethod'],'palette':P,'ownership':'Per-component names in master.blend; FACE paint_role attributes for component roles (coachwork UV pixels own its glass and panel details); separate wheel-only meshes. Coachwork continuous UV skin + side-panel strip; padded palette swatches intentionally overlap within identical trim/fender/wheel roles.','observedProjectionTexels':0,'unknownProjectionTexels':'not applicable: wholly original semantic authored surfaces','uncertainty':'Hidden/underside surfaces deliberately authored; no photographic or source sprite fidelity asserted. Shape and highlight choices require owner review.','outerInk':'none in atlas; shared renderer supplies exterior outline','glass':'Glass apertures and four-sided frames authored directly on actual cabin triangle UVs, broad blue bands, no overlapping glass meshes.','limitations':['No automatic high-to-low transfer demonstrated.','No steering/suspension clearance qualification.']},indent=2)+'\n')
for file in ['build.py','family.json']:shutil.copy2(Path(__file__).with_name(file),A/file)
sys.path.insert(0,str(ROOT/'scripts/vehicle-bake'));from catalog import audit_glb
audit=audit_glb(O/'model.glb')
report={'status':'draft','artReviewStatus':'awaiting-owner-review','family':'beetle','route':'beetle','revision':'v1','method':CFG['paintMethod'],'geometry':audit,'exportWorldScale':S,'wheels':wheels,'atlasSize':[512,512],'sourceBlend':(A/'car.blend').relative_to(ROOT).as_posix(),'masterBlend':(A/'master.blend').relative_to(ROOT).as_posix(),'recipe':(A/'recipe.json').relative_to(ROOT).as_posix(),'renderThreads':4}
(O/'report.json').write_text(json.dumps(report,indent=2)+'\n')
(D/'progress.md').write_text('Draft actual GLB READY FOR QA: public/demos/vehicle-bake/beetle/v1/model.glb\n'+json.dumps(audit,indent=2)+'\nEditable source/master/atlas retained. Shared rendering and clearance next.\n')
print(json.dumps(audit,indent=2),flush=True)
