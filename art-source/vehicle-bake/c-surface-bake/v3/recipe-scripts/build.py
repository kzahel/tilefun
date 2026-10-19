"""Route C: retained source -> authored high surface colors -> ray surface bake.

Blender background, 4 threads. All drawing is on 3D surfaces/UVs, never renders.
Usage: blender -b -t 4 --python build.py -- --revision v1
"""
import bpy, bmesh, math, sys, json, hashlib, struct, zlib, shutil
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT=next(p for p in Path(__file__).resolve().parents if (p/'AGENTS.md').exists() and (p/'package.json').exists())
REV=sys.argv[sys.argv.index('--revision')+1] if '--revision' in sys.argv else 'v1'
ROUTE='c-surface-bake'
SRC=ROOT/'art-source/vehicle-style-study/03-guide-pixel-finish/sports-coupe.blend'
OUT=ROOT/'public/demos/vehicle-bake'/ROUTE/REV
ART=ROOT/'art-source/vehicle-bake'/ROUTE/REV
DATA=ROOT/'data/vehicle-bake'/ROUTE/REV
for d in (OUT,ART,DATA):d.mkdir(parents=True,exist_ok=True)
assert not (OUT/'report.json').exists(), 'Finished candidates are immutable; choose a new revision'
SIZE=512
P={'ink':(58,58,80),'warm_ink':(74,42,61),'red_deep':(127,33,76),'red_shadow':(161,18,80),'red_mid':(197,52,88),'red':(211,68,92),'red_light':(227,90,90),'red_glint':(225,132,132),'glass_dark':(86,89,114),'glass':(115,140,168),'glass_light':(164,187,213),'glass_glint':(186,210,224),'rim':(131,136,151),'silver':(212,212,230),'white':(248,248,248),'tire_light':(70,70,94),'ruby':(186,39,88)}
PAL=np.array(list(P.values()),dtype=np.float32)
def png(path,arr):
 arr=np.asarray(arr,dtype=np.uint8);h,w=arr.shape[:2];channels=arr.shape[2]
 def chunk(t,d):return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
 data=b''.join(b'\0'+r.tobytes() for r in arr)
 path.write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,6 if channels==4 else 2,0,0,0))+chunk(b'IDAT',zlib.compress(data,9))+chunk(b'IEND',b''))
def linear(c):
 c=np.array(c)/255.;return np.where(c<=.04045,c/12.92,((c+.055)/1.055)**2.4)
def select(objs,active=None):
 bpy.ops.object.select_all(action='DESELECT')
 for o in objs:o.select_set(True)
 bpy.context.view_layer.objects.active=active or objs[0]
def world_detach(o):
 mw=o.matrix_world.copy();o.parent=None;o.matrix_world=mw
def tris(o):o.data.calc_loop_triangles();return len(o.data.loop_triangles)
def decimate(o,target):
 if tris(o)>target:
  select([o]);m=o.modifiers.new('Bounded coherent surface reduction','DECIMATE');m.ratio=target/tris(o);m.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=m.name)
 return o
def mesh(name,verts,faces):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(o);return o

bpy.ops.wm.open_mainfile(filepath=str(SRC))
scene=bpy.context.scene
scene.render.threads_mode='FIXED';scene.render.threads=4
root=bpy.data.objects['Car_Root_forward_minus_X'];root.rotation_euler=(0,0,0);bpy.context.view_layer.update()
original=[o for o in scene.objects if o.type in ('MESH','CURVE')]
# Retain the actual curve anchors before conversion. These are source-space paint guides.
anchors={o.name:[o.matrix_world@Vector(p.co[:3]) for p in o.data.splines[0].points] for o in original if o.type=='CURVE'}
wheel_ids={}
for o in original:
 if o.parent and '_Roll_Y' in o.parent.name:
  x,y,z=o.parent.location;wheel_ids[o.name]=('F' if x<0 else 'R')+('L' if y<0 else 'R')
# Convert the immutable high source in memory; no source file writes.
for o in original:
 world_detach(o);select([o]);bpy.ops.object.convert(target='MESH');bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
high=list(original)
high_collection=bpy.data.collections.new('Retained high source with authored semantic surface paint');scene.collection.children.link(high_collection)
for o in high:
 for c in list(o.users_collection):c.objects.unlink(o)
 high_collection.objects.link(o)

def segment_distance(p,a,b,axes):
 pp=np.array([p[k] for k in axes]);aa=np.array([a[k] for k in axes]);bb=np.array([b[k] for k in axes]);d=bb-aa;t=np.clip(np.dot(pp-aa,d)/max(np.dot(d,d),1e-12),0,1)
 return np.linalg.norm(pp-(aa+t*d))
top_lines=[v for k,v in anchors.items() if k.startswith('Hood pressed crease') or k in ['Rear deck cooling louver '+str(i) for i in (0,2,4)]]
side_lines=[v for k,v in anchors.items() if k.startswith('Door perimeter')]
def source_role(o,p,n,vid):
 kind=o['guide_class'];name=o.name
 if kind=='glass':
  nu,nv=(40,24) if name=='Front windshield' else ((32,24) if name=='Rear glass' else (40,18))
  u=(vid//(nv+1))/nu;v=(vid%(nv+1))/nv
  if min(u,1-u)<(.105 if REV!='v1' else .075) or min(v,1-v)<(.045 if REV!='v1' else .075):return 'ink'
  if name.startswith('Side glass') and abs(p.x-.48)<.027:return 'ink'
  height=u if name!='Rear glass' else 1-u
  if .68<height<.78:return 'glass_glint'
  return 'glass_light' if height>.48 else 'glass'
 if kind=='body':
  if name.startswith('Continuous'):
   if n.z>.35 and p.z>.40:
    for pts in top_lines:
     if any(segment_distance(p,a,b,(0,1))<.027 and abs(p.z-(a.z+b.z)/2)<.17 for a,b in zip(pts,pts[1:])):return 'warm_ink'
   if abs(p.y)>.76 and abs(n.y)>.25:
    for pts in side_lines:
     if (p.y*pts[0].y)>0 and any(segment_distance(p,a,b,(0,2))<.023 for a,b in zip(pts,pts[1:])):return 'warm_ink'
  # Fixed source-space discrete ramps: no view-dependent light or material shading.
  if n.z>.75:return 'red_light' if p.x<.8 else 'red_glint'
  if n.z>.32:return 'red'
  if p.z<.30:return 'red_shadow'
  return 'red_mid'
 if kind=='panels':return 'warm_ink'
 if kind=='intakes':return 'ink'
 if kind=='wheels':return 'ink' if n.z<.65 else 'tire_light'
 if kind=='rim':return 'silver' if n.z>-.3 else 'rim'
 if kind=='lamps':return 'white'
 if kind=='rear_lamps':return 'ruby'
 return 'ink'

source_material=bpy.data.materials.new('High source semantic paint / emission');source_material.use_nodes=True
nodes=source_material.node_tree.nodes;nodes.clear();out=nodes.new('ShaderNodeOutputMaterial');em=nodes.new('ShaderNodeEmission');attr=nodes.new('ShaderNodeVertexColor');attr.layer_name='SourceSemanticPaint';source_material.node_tree.links.new(attr.outputs['Color'],em.inputs[0]);source_material.node_tree.links.new(em.outputs[0],out.inputs['Surface'])
source_records=[]
for o in high:
 if o.name.startswith('Continuous') and REV!='v1':
  bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.subdivide_edges(bm,edges=list(bm.edges),cuts=3,use_grid_fill=True);bm.to_mesh(o.data);bm.free();o.data.update()
 o.data.update();colors=o.data.color_attributes.new(name='SourceSemanticPaint',type='FLOAT_COLOR',domain='POINT')
 roles=[]
 if o.name.startswith('Continuous') and REV!='v1':
  # Dense simple subdivision changes sampling density, not the retained shape.
  # Vectorize source painting so this remains a bounded four-thread CPU recipe.
  count=len(o.data.vertices);pos=np.empty(count*3);norm=np.empty(count*3);o.data.vertices.foreach_get('co',pos);o.data.vertices.foreach_get('normal',norm);pos=pos.reshape(-1,3);norm=norm.reshape(-1,3)
  names=list(P);role_ids=np.full(count,names.index('red_mid'),np.int32)
  role_ids[pos[:,2]<.30]=names.index('red_shadow');role_ids[norm[:,2]>.32]=names.index('red');role_ids[norm[:,2]>.75]=names.index('red_light');role_ids[(norm[:,2]>.75)&(pos[:,0]>.8)]=names.index('red_glint')
  def distance_to_poly(pts,axes):
   result=np.full(count,np.inf);pp=pos[:,axes]
   for a,b in zip(pts,pts[1:]):
    aa=np.array(a)[list(axes)];bb=np.array(b)[list(axes)];dd=bb-aa;t=np.clip(np.sum((pp-aa)*dd,axis=1)/max(np.dot(dd,dd),1e-12),0,1);result=np.minimum(result,np.linalg.norm(pp-aa-t[:,None]*dd,axis=1))
   return result
  for pts in top_lines:
   width=.043 if REV not in ('v1','v2') and pts[0].x>1.4 else .033
   mask=(norm[:,2]>.35)&(pos[:,2]>.4)&(np.abs(pos[:,2]-sum(p.z for p in pts)/len(pts))<.17)&(distance_to_poly(pts,(0,1))<width);role_ids[mask]=names.index('warm_ink')
  for pts in side_lines:
   mask=(np.abs(pos[:,1])>.76)&(np.abs(norm[:,1])>.25)&(pos[:,1]*pts[0].y>0)&(distance_to_poly(pts,(0,2))<.025);role_ids[mask]=names.index('warm_ink')
  values=np.ones((count,4),np.float32);values[:,:3]=np.array([linear(P[n]) for n in names])[role_ids];colors.data.foreach_set('color',values.ravel());roles=[names[i] for i in set(role_ids)]
 else:
  for v in o.data.vertices:
   role=source_role(o,v.co,v.normal,v.index);roles.append(role);colors.data[v.index].color=(*linear(P[role]),1)
 o.data.materials.clear();o.data.materials.append(source_material)
 o['source_paint_roles']=','.join(sorted(set(roles)))
 source_records.append({'name':o.name,'guideClass':o['guide_class'],'triangles':tris(o),'paintRoles':sorted(set(roles))})

# Low surfaces remain source-fitted. Fine hood/door/louver curves are surface paint.
low=[];owners={};parts={}
keep_curves=('A pillar','Rear buttress','Roof drip rail','Mirror stalk','Front splitter','Integrated rear lip','Tail lamp inner signature')
for h in high:
 if h.name in wheel_ids:continue
 name=h.name
 if name.startswith(('Window gasket','Window B pillar','Door perimeter','Hood pressed crease','Rear deck cooling louver','Door handle','Sill crease','Intake upper lip','Rolled fender arch','Diffuser vane','Polished exhaust')):continue
 if name.startswith('Continuous'):target=1120
 elif name=='Roof':target=80
 elif h['guide_class']=='glass':target=32
 elif name.startswith('Aerodynamic mirror'):target=32
 elif name.startswith(keep_curves):target=18 if tris(h)>20 else 12
 else:target=8 if h['guide_class']=='lamps' else 4
 o=h.copy();o.data=h.data.copy();o.name='LOW_'+name;scene.collection.objects.link(o);decimate(o,target)
 if REV not in ('v1','v2') and name.startswith('Rear buttress'):
  # The retained high-detail trim tube dips into the shared conservative
  # wheel cylinder. Lift only its trailing low end by at most 0.083 source
  # units; keep axle, body shell, glass, camera and wheel radius unchanged.
  corrections=[]
  for v in o.data.vertices:
   if v.co.x>1.05 and v.co.z<.71:
    corrections.append({'vertex':v.index,'before':list(v.co),'after':[v.co.x,v.co.y,.71]});v.co.z=.71
  o['wheel_clearance_correction']=json.dumps(corrections);o.data.update()
 low.append(o);owners[o.name]=[h];parts[o.name]='body'

# Economical round tire and closed hub shell. High spokes/rings transfer onto cap.
for wid in ('FL','FR','RL','RR'):
 x=-1.4 if wid[0]=='F' else 1.4;s=-1 if wid[1]=='L' else 1
 bpy.ops.mesh.primitive_torus_add(major_segments=16,minor_segments=6,major_radius=.258,minor_radius=.082,location=(x,s*.89,.34),rotation=(math.pi/2,0,0))
 tire=bpy.context.object;tire.name='LOW_Tire_'+wid;select([tire]);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=.235,depth=.044,location=(x,s*.985,.34),rotation=(math.pi/2,0,0));cap=bpy.context.object;cap.name='LOW_Hub_'+wid;select([cap]);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 for o in (tire,cap):low.append(o);owners[o.name]=[h for h in high if wheel_ids.get(h.name)==wid];parts[o.name]=wid

# Shared nonoverlapping UV layout across body and all wheel assemblies.
select(low);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.008,area_weight=.2,correct_aspect=True,scale_to_bounds=False);bpy.ops.object.mode_set(mode='OBJECT')

def make_bvh(hs):
 vs=[];fs=[];cs=[];semantic=[]
 for h in hs:
  offset=len(vs);vs.extend(v.co.copy() for v in h.data.vertices);h.data.calc_loop_triangles()
  attr=h.data.color_attributes['SourceSemanticPaint']
  for t in h.data.loop_triangles:
   ids=list(t.vertices);fs.append(tuple(offset+i for i in ids));cs.append(np.array([attr.data[i].color[:3] for i in ids]));semantic.append(h.name)
 return BVHTree.FromPolygons(vs,fs,all_triangles=True),vs,fs,cs,semantic
cache={}
raw=np.zeros((SIZE,SIZE,4),np.uint8);covered=np.zeros((SIZE,SIZE),bool);hits=np.zeros_like(covered);fallback=np.zeros_like(covered);ambig=np.zeros_like(covered);distance=np.zeros((SIZE,SIZE),np.float32);ownership=np.zeros((SIZE,SIZE,3),np.uint8)
stats=[]
for o in low:
 key=tuple(h.name for h in owners[o.name])
 if key not in cache:cache[key]=make_bvh(owners[o.name])
 tree,vs,fs,cs,semantic=cache[key]
 me=o.data;me.calc_loop_triangles();uv=me.uv_layers.active.data;count=0;hitcount=0;nearcount=0
 for tri in me.loop_triangles:
  coords=np.array([[uv[l].uv.x*SIZE, (1-uv[l].uv.y)*SIZE] for l in tri.loops]);xyz=np.array([me.vertices[i].co[:] for i in tri.vertices]);normal=Vector(tri.normal);a,b,c=coords
  den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
  if abs(den)<1e-8:continue
  xmin=max(0,int(np.floor(coords[:,0].min())));xmax=min(SIZE-1,int(np.ceil(coords[:,0].max())))
  ymin=max(0,int(np.floor(coords[:,1].min())));ymax=min(SIZE-1,int(np.ceil(coords[:,1].max())))
  for yy in range(ymin,ymax+1):
   for xx in range(xmin,xmax+1):
    q=np.array([xx+.5,yy+.5]);wa=((b[1]-c[1])*(q[0]-c[0])+(c[0]-b[0])*(q[1]-c[1]))/den;wb=((c[1]-a[1])*(q[0]-c[0])+(a[0]-c[0])*(q[1]-c[1]))/den;wc=1-wa-wb
    if min(wa,wb,wc)<-1e-7:continue
    p=Vector(wa*xyz[0]+wb*xyz[1]+wc*xyz[2]);covered[yy,xx]=True;count+=1
    # True high-to-low transfer: two normal rays, restricted to source owner(s).
    candidates=[]
    for sign in (1,-1):
     hit,hn,idx,dist=tree.ray_cast(p+normal*(.13*sign),normal*(-sign),.26)
     if hit is not None:candidates.append(((hit-p).length,hit,idx,hn))
    if candidates:
     candidates.sort(key=lambda v:v[0]);d,hit,idx,hn=candidates[0];hits[yy,xx]=True;hitcount+=1
     if len(candidates)>1 and candidates[0][2]!=candidates[1][2] and abs(candidates[0][0]-candidates[1][0])>.025:ambig[yy,xx]=True
    else:
     hit,hn,idx,d=tree.find_nearest(p,.20)
     if hit is None:continue
     fallback[yy,xx]=True;nearcount+=1
    distance[yy,xx]=d
    ia,ib,ic=fs[idx];aa=np.array(vs[ia]);bb=np.array(vs[ib]);cc=np.array(vs[ic]);pp=np.array(hit)
    v0=bb-aa;v1=cc-aa;v2=pp-aa;d00=np.dot(v0,v0);d01=np.dot(v0,v1);d11=np.dot(v1,v1);d20=np.dot(v2,v0);d21=np.dot(v2,v1);dd=d00*d11-d01*d01
    vv=(d11*d20-d01*d21)/dd if dd>1e-18 else 0;ww=(d00*d21-d01*d20)/dd if dd>1e-18 else 0
    col=np.clip(cs[idx][0]*(1-vv-ww)+cs[idx][1]*vv+cs[idx][2]*ww,0,1);rgb=np.where(col<=.0031308,col*12.92,1.055*col**(1/2.4)-.055)
    raw[yy,xx]=(*np.round(rgb*255).astype(np.uint8),255)
    name=semantic[idx];ownership[yy,xx]=tuple(hashlib.sha256(name.encode()).digest()[:3])
 stats.append({'lowPart':o.name,'sourceOwners':list(key),'triangles':tris(o),'coveredTexels':count,'normalRayHits':hitcount,'nearestFallback':nearcount})
 print('BAKED',o.name,count,hitcount,nearcount,flush=True)

png(ART/'raw-surface-transfer.png',raw);png(ART/'paint-ownership.png',ownership)
unknown=covered & (raw[:,:,3]==0)
uncertainty=np.zeros((SIZE,SIZE,3),np.uint8);uncertainty[hits]=(40,150,70);uncertainty[fallback]=(240,170,30);uncertainty[ambig]=(180,70,220);uncertainty[unknown]=(255,30,30);png(ART/'uncertainty.png',uncertainty)
# Explicit atlas cleanup: nearest palette (no dither), unknown ink, 4px padding.
clean=np.zeros((SIZE,SIZE,4),np.uint8);clean[:,:,:3]=P['ink'];clean[:,:,3]=255
valid=raw[:,:,3]>0;colors=raw[valid,:3].astype(np.float32)
nearest=((colors[:,None,:]-PAL[None,:,:])**2).sum(axis=2).argmin(axis=1);clean[valid,:3]=PAL[nearest].astype(np.uint8)
known=covered.copy()
for _ in range(4):
 old=known.copy();values=clean.copy()
 for dy,dx in ((-1,0),(1,0),(0,-1),(0,1)):
  neighbor=np.roll(np.roll(old,dy,0),dx,1);take=(~known)&neighbor;shift=np.roll(np.roll(values,dy,0),dx,1);clean[take]=shift[take];known[take]=True
png(ART/'atlas.png',clean);shutil.copy2(ART/'atlas.png',OUT/'atlas.png')
cleanup={'algorithm':'source-corner barycentric color -> nearest exact source palette; missing paint ink; four atlas-space padding rounds','palette':P,'coveredTexels':int(covered.sum()),'normalRayHitTexels':int(hits.sum()),'nearestFallbackTexels':int(fallback.sum()),'ambiguousTexels':int(ambig.sum()),'unknownTexels':int(unknown.sum()),'coveredFraction':float(covered.mean()),'rayDistancePercentiles':np.percentile(distance[valid],[50,90,99,100]).tolist(),'quantizationChangedTexels':int(np.any(clean[valid,:3]!=raw[valid,:3],axis=1).sum()),'paddingRounds':4,'screenInteriorPatches':0,'owners':stats}
(ART/'transfer.json').write_text(json.dumps(cleanup,indent=2)+'\n')
(ART/'source-paint.json').write_text(json.dumps({'method':'Authored high surface point color from original semantic roles and source-space curve anchors; glass parametric bands and aperture border; fixed source-normal red ramps. Not a raw PBR bake or a target-image projection.','glassBorderParametric':{'u':.105 if REV!='v1' else .075,'v':.045 if REV!='v1' else .075},'sourceSimpleSubdivisionCuts':0 if REV=='v1' else 3,'louverInkSourceRadius':.033 if REV in ('v1','v2') else .043,'sources':source_records,'anchors':{k:[list(v) for v in vv] for k,vv in anchors.items()},'targetDecision':'141 approach 3; three source louver anchors (0,2,4), widened hood/door ink, blue glass bands; view-dependent component glints cannot be preserved exactly.'},indent=2)+'\n')

atlas=bpy.data.images.load(str(ART/'atlas.png'));atlas.name='Single opaque nearest palette atlas';atlas.pack()
mat=bpy.data.materials.new('Coupe baked semantic paint / KHR_materials_unlit');mat.use_nodes=True;n=mat.node_tree.nodes;n.clear();out=n.new('ShaderNodeOutputMaterial');em=n.new('ShaderNodeEmission');tex=n.new('ShaderNodeTexImage');tex.image=atlas;tex.interpolation='Closest';mat.node_tree.links.new(tex.outputs['Color'],em.inputs[0]);mat.node_tree.links.new(em.outputs[0],out.inputs['Surface'])
assemblies={}
join_groups={part:[o for o in low if parts[o.name]==part] for part in ('body','FL','FR','RL','RR')}
for part in ('body','FL','FR','RL','RR'):
 obs=join_groups[part];select(obs);bpy.ops.object.join();o=bpy.context.object;o.name='Body' if part=='body' else 'Wheel_'+part+'_TireHub'
 o.data.materials.clear();o.data.materials.append(mat)
 for p in o.data.polygons:p.material_index=0;p.use_smooth=False
 # Discard source-only colors from low export.
 for a in list(o.data.color_attributes):o.data.color_attributes.remove(a)
 assemblies[part]=o
exportroot=bpy.data.objects.new('Coupe_WorldScale_80_over_4p6',None);scene.collection.objects.link(exportroot)
for part,o in assemblies.items():
 if part=='body':o.parent=exportroot;continue
 x=-1.4 if part[0]=='F' else 1.4;y=-.87 if part[1]=='L' else .87
 steer=bpy.data.objects.new('Wheel_'+part+'_Steer',None);scene.collection.objects.link(steer);steer.parent=exportroot;steer.location=(x,y,.34);steer['steering_enabled']=part[0]=='F';steer['steer_axis_gltf']=[0,1,0]
 roll=bpy.data.objects.new('Wheel_'+part+'_Roll',None);scene.collection.objects.link(roll);roll.parent=steer;roll['wheel_radius']=.34*80/4.6;roll['roll_axis_gltf']=[0,0,-1]
 o.parent=roll;o.location=(-x,-y,-.34)
exportroot.scale=(80/4.6,)*3
exportroot['exportWorldScale']=80/4.6;exportroot['front_axis_blender']='-X';exportroot['source_dimensions']=[4.6,1.9,1.05]
export_objs=[exportroot,*assemblies.values(),*[o for o in scene.objects if o.name.startswith('Wheel_') and o.type=='EMPTY']]
select(export_objs,exportroot)
bpy.ops.export_scene.gltf(filepath=str(OUT/'model.glb'),export_format='GLB',use_selection=True,export_extras=True,export_materials='EXPORT',export_texcoords=True,export_normals=True,export_yup=True,export_animations=False)
# Blender's standalone emission export is PBR+emissive in 5.2. Declare actual
# unlit semantics explicitly, preserving the existing embedded texture bytes.
glb_path=OUT/'model.glb';blob=glb_path.read_bytes();jl=struct.unpack_from('<I',blob,12)[0];doc=json.loads(blob[20:20+jl]);tail=blob[20+jl:]
for m in doc['materials']:
 pbr=m.setdefault('pbrMetallicRoughness',{})
 if 'baseColorTexture' not in pbr and 'emissiveTexture' in m:pbr['baseColorTexture']=m['emissiveTexture']
 pbr['baseColorFactor']=[1,1,1,1];pbr['metallicFactor']=0;pbr['roughnessFactor']=1
 m.pop('emissiveTexture',None);m.pop('emissiveFactor',None)
 m.setdefault('extensions',{}).pop('KHR_materials_emissive_strength',None)
 m['extensions']['KHR_materials_unlit']={}
doc['extensionsUsed']=sorted(set(doc.get('extensionsUsed',[]))|{'KHR_materials_unlit'})
if not any('KHR_materials_emissive_strength' in m.get('extensions',{}) for m in doc['materials']):doc['extensionsUsed']=[e for e in doc['extensionsUsed'] if e!='KHR_materials_emissive_strength']
j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4);glb_path.write_bytes(struct.pack('<III',0x46546c67,2,20+len(j)+len(tail))+struct.pack('<II',len(j),0x4e4f534a)+j+tail)
for h in high:h.hide_render=True;h.hide_set(True)
high_collection.hide_render=True
# Save self-contained authoring scene at native model dimensions; the export root
# retains world scale, camera/ortho follows it identically for render evidence.
scale=80/4.6
cam=scene.camera;cam.location=Vector((0,-12*math.cos(math.radians(50)),12*math.sin(math.radians(50))))*scale;cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=7.2*scale
scene.render.engine='CYCLES';scene.cycles.samples=1;scene.cycles.use_denoising=False;scene.cycles.max_bounces=0;scene.render.film_transparent=True;scene.render.resolution_x=512;scene.render.resolution_y=512;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=0;scene.view_settings.gamma=1
exportroot.rotation_euler.z=0
bpy.ops.wm.save_as_mainfile(filepath=str(ART/'car.blend'))
for i in range(8):
 exportroot.rotation_euler.z=math.radians(i*45);scene.render.filepath=str(DATA/f'low-{i}-512.png');bpy.ops.render.render(write_still=True)
for j,angle in enumerate((22.5,67.5,112.5,157.5)):
 exportroot.rotation_euler.z=math.radians(angle);scene.render.filepath=str(DATA/f'intermediate-{j}-512.png');bpy.ops.render.render(write_still=True)
meta={'revision':REV,'exportWorldScale':80/4.6,'source':str(SRC.relative_to(ROOT)).replace('\\','/'),'sourceHash':hashlib.sha256(SRC.read_bytes()).hexdigest(),'lowTrianglesBeforeExport':sum(tris(o) for o in assemblies.values()),'transfer':{k:v for k,v in cleanup.items() if k!='owners'},'paths':{'source':str(ART.relative_to(ROOT)).replace('\\','/'),'output':str(OUT.relative_to(ROOT)).replace('\\','/')},'method':'Owner-restricted bidirectional normal raycast from low UV texel to retained high triangle; barycentric high semantic surface color; exact palette cleanup and padding.'}
(ART/'recipe.json').write_text(json.dumps(meta,indent=2)+'\n');(DATA/'build.json').write_text(json.dumps(meta,indent=2)+'\n')
print('BUILD_COMPLETE',json.dumps(meta),flush=True)
