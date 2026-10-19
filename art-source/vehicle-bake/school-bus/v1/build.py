"""Independent original conventional school bus family. Blender background --threads 4 --python build.py.
Replays from this file + family.json, no compact/coupe geometry or ignored inputs.
Only --scratch replay may replace draft outputs; finished report guards v1.
"""
import bpy, bmesh, math, json, sys, shutil, struct, zlib, hashlib
from pathlib import Path
from mathutils import Vector

ROOT=next(p for p in Path(__file__).resolve().parents if (p/'AGENTS.md').is_file() and (p/'public').is_dir())
CFG=json.loads(Path(__file__).with_name('family.json').read_text())
SCRATCH='--scratch' in sys.argv
A=ROOT/('data/vehicle-bake/school-bus/replay/source' if SCRATCH else 'art-source/vehicle-bake/school-bus/v1')
O=ROOT/('data/vehicle-bake/school-bus/replay/public' if SCRATCH else 'public/demos/vehicle-bake/school-bus/v1')
D=ROOT/'data/vehicle-bake/school-bus'
for p in (A,O,D,A/'evidence'):p.mkdir(parents=True,exist_ok=True)
if (O/'report.json').exists(): assert json.loads((O/'report.json').read_text()).get('status')!='complete','Finished revision immutable'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene
S=CFG['exportWorldScale'];P=CFG['palette'];keys=list(P)

def png(path,w,h,pixels):
 def chunk(k,v):return struct.pack('>I',len(v))+k+v+struct.pack('>I',zlib.crc32(k+v)&0xffffffff)
 raw=b''.join(b'\0'+pixels[y*w*4:(y+1)*w*4] for y in range(h))
 path.write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b''))
# Side charts own their own windows/stripes. Door is deliberately +Y only.
def framed(x,z,x0,x1,z0,z1):
 if x0<=x<=x1 and z0<=z<=z1:
  if min(x-x0,x1-x)<.055 or min(z-z0,z1-z)<.06:return 'ink'
  f=(z-z0)/(z1-z0)
  return 'glassGlint' if .68<f<.76 else 'glassLight' if f>.48 else 'glass'
 return None

def side_paint(x,z,side):
 role='paintLight' if z>2.23 else 'paint' if z>1.14 else 'paintMid' if z>.60 else 'paintShadow'
 # Continuous characteristic black rub rails.
 if (.69<z<.76 or 1.09<z<1.16) and -2.2<x<3.28:role='ink'
 if 1.28<z<1.34 and -2.2<x<3.28:role='paintDeep'
 # Passenger folding door: two tall glazed leaves, lower step and center split.
 if side>0 and -1.94<x<-1.16 and .40<z<2.16:
  role='ink'
  if -1.87<x<-1.23 and .49<z<2.08:
   role='paintMid'
   for x0,x1 in [(-1.87,-1.585),(-1.515,-1.23)]:
    k=framed(x,z,x0,x1,.73,2.08)
    if k:role=k
   if z<.60:role='rim' if z>.53 else 'ink'
  return role
 # Driver's windshield-side pane is not a mirrored door.
 if side<0:
  k=framed(x,z,-2.12,-1.22,1.40,2.13)
  if k:return k
  if abs(x+1.19)<.017 and .42<z<2.16:return 'paintDeep'
 # Seven evenly spaced passenger windows with continuous frames and equal bands.
 for i in range(7):
  x0=-1.04+i*.575
  k=framed(x,z,x0,x0+.49,1.40,2.13)
  if k:
   # Horizontal sash stays on skin, with broad cool glass clusters.
   if abs(z-1.77)<.017 and k!='ink':return 'glassDark'
   return k
 # Rear emergency door is its own end chart. Quiet side end panel seam.
 if abs(x-3.06)<.015 and .42<z<2.15:return 'paintDeep'
 return role

def end_paint(y,z,rear):
 role='paintLight' if z>2.22 else 'paint' if z>1.15 else 'paintMid'
 if rear:
  if abs(y)<.51 and .49<z<2.17:
   role='paintDeep' if abs(abs(y)-.49)<.027 or abs(z-.52)<.025 else role
   k=framed(y,z,-.49,.49,1.41,2.12)
   if k:return k
   if .73<z<.78:return 'ink'
  if (.69<z<.76 or 1.09<z<1.16):role='ink'
  for yy in [-.80,.80]:
   if (y-yy)**2+(z-1.08)**2<.115**2:return 'ruby'
   if (y-yy)**2+(z-.82)**2<.08**2:return 'amber'
 else:
  k=framed(y,z,-.86,.86,1.38,2.16)
  if k:
   return 'ink' if abs(y)<.035 else k
 # Static marker lenses; no light or flashing extras.
 for yy in [-.81,-.52,.52,.81]:
  if (y-yy)**2+(z-2.25)**2<.07**2:return 'ruby' if abs(yy)>.7 else 'amber'
 return role

atlas=bytearray(512*512*4)
for y in range(512):
 for x in range(512):
  if y<288:
   side=-1 if y<144 else 1;px=-3.5+7*(x+.5)/512;z=.25+2.30*((y%144)+.5)/144;k=side_paint(px,z,side)
  elif y<368:
   py=-1.25+2.5*(y-288+.5)/80;k='cream' if abs(py)<.50 else 'paintLight' if abs(py)<.90 else 'paint'
  elif y<448:
   py=-1.25+2.5*((x%256)+.5)/256;z=.25+2.30*(y-368+.5)/80;k=end_paint(py,z,x>=256)
  elif y<480:
   px=-3.5+7*(x+.5)/512;py=-1.25+2.5*(y-448+.5)/32;k='paintLight' if abs(py)<.55 else 'paint'
   if abs(py)<.025:k='paintMid'
  else:k=keys[min(len(keys)-1,((y-480)//16)*16+x//32)]
  atlas[(y*512+x)*4:(y*512+x+1)*4]=bytes((*P[k],255))
png(A/'atlas.png',512,512,atlas);shutil.copy2(A/'atlas.png',O/'atlas.png')
mat=bpy.data.materials.new('SchoolBus_palette_unlit_nearest');mat.use_nodes=True
nodes=mat.node_tree.nodes;nodes.clear();out=nodes.new('ShaderNodeOutputMaterial');tex=nodes.new('ShaderNodeTexImage')
tex.image=bpy.data.images.load(str(A/'atlas.png'));tex.interpolation='Closest';tex.extension='EXTEND';mat.node_tree.links.new(tex.outputs['Color'],out.inputs['Surface'])
mat.diffuse_color=(.98,.73,.19,1)
owners=[];groups={};component_stats=[]

def mesh(name,verts,faces,roles,group='body'):
 m=bpy.data.meshes.new(name);m.from_pydata(verts,[],faces);m.update()
 o=bpy.data.objects.new(name,m);scene.collection.objects.link(o);o.data.materials.append(mat)
 uv=m.uv_layers.new(name='Semantic_palette_UV');attr=m.attributes.new('paint_role','INT','FACE')
 for f in m.polygons:
  k=roles[f.index] if isinstance(roles,list) else roles
  idx=keys.index(k);attr.data[f.index].value=idx
  # Padded constant-colour UV islands. Each face retains semantic ownership.
  cx=(idx%16)*32+16;cy=480+(idx//16)*16+8
  for j,li in enumerate(f.loop_indices):
   a=2*math.pi*j/len(f.loop_indices);uv.data[li].uv=((cx+6*math.cos(a))/512,1-(cy+3*math.sin(a))/512)
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

def chart(o,kind):
 uv=o.data.uv_layers.active.data
 for f in o.data.polygons:
  for li in f.loop_indices:
   v=o.data.vertices[o.data.loops[li].vertex_index].co
   if kind=='front' or kind=='rear':
    u=((v.y+1.25)/2.5*256+(256 if kind=='rear' else 0))/512;py=368+(v.z-.25)/2.30*80
   elif kind=='hood':u=(v.x+3.5)/7;py=448+(v.y+1.25)/2.5*32
   elif abs(f.normal.z)>.55 and f.center.z>2.1:
    u=(v.x+3.5)/7;py=288+(v.y+1.25)/2.5*80
   else:u=(v.x+3.5)/7;py=(0 if f.center.y<0 else 144)+(v.z-.25)/2.30*144
   uv[li].uv=(max(.001,min(.999,u)),1-py/512)

# The bus body has its own long, softly crowned coach section; no compact scale-up.
vv=[];sec=CFG['bodySection'];ns=len(sec)
for x,ws,hs in CFG['bodyStations']:
 for y,z in sec:
  # Slightly sloping conventional front windshield, rounded back cap shoulders.
  xx=x+(.12*max(0,(z-1.23)/1.25) if x==-2.25 else 0)
  vv.append((xx,y*ws,.38+(z-.38)*hs))
ff=[]
for i in range(len(CFG['bodyStations'])-1):
 for j in range(ns):ff.append((i*ns+j,i*ns+(j+1)%ns,(i+1)*ns+(j+1)%ns,(i+1)*ns+j))
ff.extend([tuple(range(ns-1,-1,-1)),tuple((len(CFG['bodyStations'])-1)*ns+j for j in range(ns))])
coach=mesh('Long crowned coach body with local open wheel pockets',vv,ff,'paint')
# Actual local side-only cylinders open sidewall AND floor, leaving center structure.
for axle in CFG['axles']:
 for side in [-1,1]:
  bpy.ops.mesh.primitive_cylinder_add(vertices=CFG['arch']['segments'],radius=CFG['arch']['cutRadius'],depth=1.1,location=(axle,side*1.25,.47),rotation=(math.pi/2,0,0))
  cutter=bpy.context.object;cutter.name='Temporary wheel-local pocket'
  bpy.context.view_layer.objects.active=coach
  mod=coach.modifiers.new('True local side and floor arch','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
  bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
coach.data.update();chart(coach,'side')
# Separate front and rear cap charts prevent side-window duplication on end surfaces.
uv=coach.data.uv_layers.active.data
for f in coach.data.polygons:
 if abs(f.normal.x)>.85:
  for li in f.loop_indices:
   v=coach.data.vertices[coach.data.loops[li].vertex_index].co
   uv[li].uv=(((v.y+1.25)/2.5*256+(256 if f.center.x>0 else 0))/512,1-(368+(v.z-.25)/2.30*80)/512)
# Long projecting hood has a rounded broad crown and lower inner sides clear of tires.
vv=[];nh=10
for x,w,h in CFG['hoodStations']:
 for j in range(nh+1):
  t=-math.pi/2+math.pi*j/nh;vv.append((x,w*math.sin(t),.90+(h-.90)*math.cos(t)))
ff=[]
for i in range(len(CFG['hoodStations'])-1):
 for j in range(nh):ff.append((i*(nh+1)+j,(i+1)*(nh+1)+j,(i+1)*(nh+1)+j+1,i*(nh+1)+j+1))
ff.extend([tuple(range(nh,-1,-1)),tuple((len(CFG['hoodStations'])-1)*(nh+1)+j for j in range(nh+1))])
hood=mesh('Short rounded projecting engine hood',vv,ff,'paint');chart(hood,'hood')
# Inner engine box deliberately stops before the tires; no full-width floor slab.
cube('Central engine bay',(-2.80,0,.71),(1.05,1.34,.40),'paintMid')
# Broad metal shell above every tire, seated into continuous coachwork at rear.
for axle in CFG['axles']:
 for side in [-1,1]:
  vv=[];ff=[];rr=[];n=20
  for y,r in [(.70,.595),(.85,.625),(1.03,.625),(1.18,.58)]:
   for j in range(n+1):
    t=math.pi*j/n;vv.append((axle+r*math.cos(t),side*y,.47+r*math.sin(t)))
  for k in range(3):
   for j in range(n):ff.append((k*(n+1)+j,k*(n+1)+j+1,(k+1)*(n+1)+j+1,(k+1)*(n+1)+j));rr.append('paintLight' if k==1 else 'paint' if k==0 else 'paintMid')
  base=len(vv)
  for j in range(n+1):
   t=math.pi*j/n;vv.append((axle+.555*math.cos(t),side*1.18,.47+.555*math.sin(t)))
  for j in range(n):ff.append((3*(n+1)+j,3*(n+1)+j+1,base+j+1,base+j));rr.append('paintDeep')
  mesh(f'Broad open fender shell {axle} {side}',vv,ff,rr)
# Restrained fixed bumpers and front grille; details remain part of Body_static.
for x in [-3.43,3.39]:cube('Restrained black end bumper '+str(x),(x,0,.43),(.15,2.25,.18),'ink',bevel=.035)
cube('Front grille dark face',(-3.353,0,.87),(.024,.84,.42),'ink',bevel=.035)
for z in [.74,.86,.98]:cube('Broad quiet grille slat '+str(z),(-3.371,0,z),(.025,.69,.027),'rim')
# Static folded red stop plate on driver side; no logos or text.
verts=[]
for i in range(8):
 t=2*math.pi*i/8+math.pi/8;verts.append((-.80+.18*math.cos(t),-1.108,1.14+.18*math.sin(t)))
mesh('Static folded red stop plate',verts,[tuple(range(8))],'ruby')
# One compact mirror on each side, fixed at rest and below crown height.
for side in [-1,1]:
 curve_tube('Mirror arm '+str(side),[(-2.20,side*1.01,1.62),(-2.31,side*1.18,1.70)],.018,'ink')
 cube('Driver passenger mirror '+str(side),(-2.31,side*1.19,1.78),(.12,.08,.23),'rim',bevel=.018)
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
 disk('Round headlamp metal rim '+str(side),(-3.328,side*.58,.99),(-1,0,0),.143,'rim',segments=12,depth=.018)
 disk('Round ivory headlamp '+str(side),(-3.350,side*.58,.99),(-1,0,0),.108,'cream',segments=12,depth=.015)
 disk('Front amber corner lamp '+str(side),(-3.272,side*.73,1.17),(-1,0,.15),.06,'amber',segments=8,depth=.015)
# Wheel topology has an exact circular envelope and genuinely centered pivots.
r=CFG['wheelRadius'];width=CFG['wheelWidth'];nr=20
for axle in CFG['axles']:
 for side in [-1,1]:
  wid=('F' if axle<0 else 'R')+('L' if side<0 else 'R');group=wid
  vv=[];ff=[];rr=[]
  rings=[(-width/2,.38),(-width*.36,r),(width*.36,r),(width/2,.38)]
  for y,rad in rings:
   for j in range(nr):
    t=2*math.pi*j/nr;vv.append((rad*math.sin(t),y,rad*math.cos(t)))
  for k in range(3):
   for j in range(nr):ff.append((k*nr+j,k*nr+(j+1)%nr,(k+1)*nr+(j+1)%nr,(k+1)*nr+j));rr.append('tireLight' if k!=1 else 'tire')
  for k in [0,3]:ff.append(tuple(k*nr+j for j in range(nr)));rr.append('tire')
  mesh('Wheel rubber '+wid,vv,ff,rr,group)
  # Symmetric pressed-steel wheel and smooth dome hub; hubs remain inside radius.
  for s in [side]:
   disk('Wheel rim '+wid+str(s),(0,s*(width/2+.003),0),(0,s,0),.295,'rim',segments=12,depth=.012,group=group)
   disk('Chrome hub '+wid+str(s),(0,s*(width/2+.017),0),(0,s,0),.20,'silver',segments=12,depth=.037,group=group)
   disk('Hub glint '+wid+str(s),(-.035,s*(width/2+.055),.035),(0,s,0),.082,'white',segments=8,depth=.002,group=group)

# Boolean cutters may add UV layers; retain one explicit chart on every mesh.
for obs in groups.values():
 for o in obs:
  for layer in list(o.data.uv_layers):
   if layer.name!='Semantic_palette_UV':o.data.uv_layers.remove(layer)
  o.data.uv_layers.active_index=0;o.data.uv_layers[0].active_render=True
# Record evaluated component topology after local pocket booleans.
for stat in component_stats:
 obj=next(o for obs in groups.values() for o in obs if o.name==stat['name'])
 obj.data.calc_loop_triangles();stat['triangles']=len(obj.data.loop_triangles)
# Keep correctly placed named components in an editable semantic source master.
tex.image.pack();scene.view_settings.view_transform='Standard'
# An explicitly unused palette planning image is retained, not a projected draft.
draft=bpy.data.images.new('Unused family palette planning draft',width=512,height=512)
draft.pixels=[c/255 for y in range(512) for x in range(512) for c in (*P[keys[min(len(keys)-1,(y//64)*8+x//64)]],255)]
draft.filepath_raw=str(A/'palette-draft.png');draft.file_format='PNG';draft.save();draft.pack();draft.use_fake_user=True
camera_data=bpy.data.cameras.new('Fixed family study camera');camera=bpy.data.objects.new('Fixed family study camera',camera_data);scene.collection.objects.link(camera)
camera.location=(0,-12*math.cos(math.radians(50)),12*math.sin(math.radians(50)))
camera.rotation_euler=(-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.type='ORTHO';camera_data.ortho_scale=12.6;scene.camera=camera
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
root=bpy.data.objects.new('SchoolBus_Root_forward_minus_X',None);scene.collection.objects.link(root)
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
recipe={**CFG,'components':component_stats,'wheels':wheels,'method':CFG['paintMethod'],'masterMeaning':'Editable semantic component master at runtime topology; no separate high-poly/decimation claim.','sourceDependencies':['scripts/vehicle-bake/school-bus/'+f for f in ['build.py','family.json','coverage-region.json','review.json']],'sharedComponents':['Blender glTF exporter (same selected-root/y-up/extras/material contract as coupe)','scripts/vehicle-bake/catalog.py:audit_glb','scripts/vehicle-bake/clearance.py','Compiled shared viewer.js / CarMeshAsset / CarPixelOutline / wheel-rig.mjs']}
(A/'recipe.json').write_text(json.dumps(recipe,indent=2)+'\n');shutil.copy2(A/'recipe.json',O/'recipe.json')
(A/'paint-ownership.json').write_text(json.dumps({'method':CFG['paintMethod'],'palette':P,'ownership':'Independent driver/passenger continuous side charts, dedicated roof/front/rear/hood charts. Named semantic source components; FACE paint_role attributes; separate wheel-only meshes. Trim islands intentionally share padded constant-role swatches.','observedProjectionTexels':0,'uncertainty':'Wholly original authored surfaces, including underside. No source-image fidelity or high-to-low transfer asserted.','outerInk':'No exterior silhouette paint in atlas; shared engine outline is RGB 58,58,80.','asymmetry':'Passenger +Y folding door behind front axle; driver -Y retains driver glass and static folded stop plate.','limitations':['Economical runtime-topology component master.','Neutral steering only; no suspension or animated equipment qualification.']},indent=2)+'\n')
for file in ['build.py','family.json','coverage-region.json','review.json']:shutil.copy2(Path(__file__).with_name(file),A/file)
sys.path.insert(0,str(ROOT/'scripts/vehicle-bake'));from catalog import audit_glb
audit=audit_glb(O/'model.glb')
report={'status':'draft','artReviewStatus':'awaiting-owner-review','family':'school-bus','route':'school-bus','revision':'v1','method':CFG['paintMethod'],'geometry':audit,'exportWorldScale':S,'wheels':wheels,'atlasSize':[512,512],'sourceBlend':(A/'car.blend').relative_to(ROOT).as_posix(),'masterBlend':(A/'master.blend').relative_to(ROOT).as_posix(),'recipe':(A/'recipe.json').relative_to(ROOT).as_posix(),'render':CFG['render'],'renderThreads':4}
(O/'report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(audit,indent=2),flush=True)
