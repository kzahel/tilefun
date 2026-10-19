"""Blender background --threads 4 --python refine_fenders.py -- RECIPE NEW_REVISION.
Retained mid geometry/UV paint -> physically closed upper fender shoulders.
"""
import bpy,bmesh,json,math,sys,shutil,hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=next(p for p in Path(__file__).resolve().parents if (p/'AGENTS.md').is_file() and (p/'public').is_dir())
recipe_path,REV=sys.argv[sys.argv.index('--')+1:];cfg=json.loads(Path(recipe_path).read_text())
BASE=ROOT/'art-source/vehicle-bake/a-reduced-projection'/cfg['baseRevision'];A=ROOT/'art-source/vehicle-bake/a-reduced-projection'/REV;O=ROOT/'public/demos/vehicle-bake/a-reduced-projection'/REV
assert not A.exists() and not O.exists(),'New revision required'
A.mkdir(parents=True);O.mkdir(parents=True);shutil.copytree(BASE/'evidence',A/'evidence')
cfg['outputRevision']=REV;(A/'input-recipe.json').write_text(json.dumps(cfg,indent=2)+'\n')
bpy.ops.wm.open_mainfile(filepath=str(BASE/'car.blend'));scene=bpy.context.scene;root=bpy.data.objects['Coupe_export_root'];root.rotation_euler=(0,0,0);root.scale=(1,1,1);bpy.context.view_layer.update()
body=bpy.data.objects['Body_static'];base_recipe=json.loads((BASE/'recipe.json').read_text());components=base_recipe['components'];arch_ids={i for i,c in enumerate(components) if c['name'].startswith('Rolled fender arch')}
integrated=cfg.get('geometryMode')=='integrated-flat'
if integrated:
 tuck=cfg['trackTuckPerSide']
 for label in ['FL','FR','RL','RR']:
  steer=bpy.data.objects[f'Wheel_{label}_Steer'];steer.location.y-=math.copysign(tuck,steer.location.y)
 # Tucked rear tires require the old buttress tips to stay inside their slab.
 ids={i for i,c in enumerate(components) if c['name'].startswith('Rear buttress')};owners=body.data.attributes['source_owner'];indices={j for p in body.data.polygons if owners.data[p.index].value in ids for j in p.vertices}
 for j in indices:
  v=body.data.vertices[j]
  if math.hypot(v.co.x-1.4,v.co.z-.34)<.43 and abs(v.co.y)>.70:v.co.y=math.copysign(.70,v.co.y)
 bpy.context.view_layer.update()
before=sum(len(o.data.polygons) for o in scene.objects if o.type=='MESH');beforebody=len(body.data.polygons)
bm=bmesh.new();bm.from_mesh(body.data);layer=bm.faces.layers.int.get('source_owner');assert layer
bmesh.ops.delete(bm,geom=[f for f in bm.faces if f[layer] in arch_ids],context='FACES');bm.to_mesh(body.data);bm.free();body.data.update()
removed=beforebody-len(body.data.polygons)
# Exact source coachwork only, for the inboard shoulder/body join height.
body.data.calc_loop_triangles();owner=body.data.attributes['source_owner'];vv=[v.co.copy() for v in body.data.vertices];ff=[tuple(t.vertices) for t in body.data.loop_triangles if owner.data[t.polygon_index].value==0]
hull=BVHTree.FromPolygons(vv,ff,all_triangles=True)
atlas=bpy.data.images.load(str(BASE/'atlas.png'),check_existing=False);pixels=list(atlas.pixels);W,H=atlas.size
palette={'light':(227,90,90),'mid':(197,52,88),'shadow':(161,18,80),'deep':(127,33,76)}
swatches={}
for role,color in palette.items():
 for idx in range(W*H):
  if tuple(round(pixels[idx*4+j]*255) for j in range(3))==color:
   swatches[role]=((idx%W+.5)/W,(idx//W+.5)/H);break
 assert role in swatches,(role,'palette swatch missing')
mat=body.data.materials[0];N=cfg['segments'];R=cfg['outerRadius'];r=cfg['innerRadius'];Y=cfg['railsY'];added=[]
for xc in (-1.4,1.4):
 for side in (-1,1):
  verts=[]
  station=cfg['longitudinalStations'] if integrated else list(range(N+1));N=len(station)-1
  for k,value in enumerate(station):
   t=math.pi*k/N;co=math.cos(t);si=math.sin(t);x=xc+R*co;top=.34+R*si
   if integrated:
    dx=value;x=xc+dx
   hit,normal,face,d=hull.ray_cast(Vector((x,side*Y[0],2)),Vector((0,0,-1)),4)
   assert hit is not None,'Shoulder must join actual retained body'
   z=hit.z+.006
   if integrated:
    profile=cfg['crownProfile'];ad=abs(dx)
    for (a,az),(b,bz) in zip(profile,profile[1:]):
     if ad<=b:top=az+(bz-az)*(ad-a)/(b-a);break
    top=max(z,top)
    # Narrow tapered ends meet the original coachwork footprint.
    widths=[(-2.3,.68),(-2.13,.85),(-1.5,.94),(-.6,.865),(.3,.88),(1.35,.965),(2.08,.91),(2.3,.76)]
    for (a,aw),(b,bw) in zip(widths,widths[1:]):
     if x<=b:width=aw+(bw-aw)*(x-a)/(b-a);break
    outer=Y[2] if ad<=.375 else Y[2]+(min(Y[2],width)-Y[2])*min(1,(ad-.375)/(.70-.375))
    bottom=.34+math.sqrt(max(0,r*r-dx*dx)) if ad<=r else min(top-.018,z-.018)
    verts.extend([(x,side*Y[0],z),(x,side*Y[1],top),(x,side*outer,top),(x,side*outer,bottom),(x,side*Y[1],bottom),(x,side*Y[0],z-.018)])
   else:verts.extend([(x,side*Y[0],z),(x,side*Y[1],top),(x,side*Y[2],top),(xc+r*co,side*Y[2],.34+r*si),(xc+r*co,side*Y[1],.34+r*si),(x,side*Y[0],z-.018)])
  faces=[];roles=[]
  for k in range(N):
   for j in range(6):faces.append((k*6+j,(k+1)*6+j,(k+1)*6+(j+1)%6,k*6+(j+1)%6));roles.append(['light','light','mid','deep','shadow','mid'][j])
  faces.extend([tuple(reversed(range(6))),tuple(N*6+j for j in range(6))]);roles.extend(['mid','mid'])
  mesh=bpy.data.meshes.new('Solid_fender_shoulder');mesh.from_pydata(verts,[],faces);mesh.update();ob=bpy.data.objects.new(f'Physical_shoulder_{xc}_{side}',mesh);scene.collection.objects.link(ob);ob.parent=root;mesh.materials.append(mat)
  uv=mesh.uv_layers.new(name=body.data.uv_layers.active.name)
  for f,role in zip(mesh.polygons,roles):
   for loop in f.loop_indices:uv.data[loop].uv=swatches[role]
   f.use_smooth=True
  attr=mesh.attributes.new('source_owner','INT','FACE')
  for a in attr.data:a.value=100+len(added)
  bpy.context.view_layer.objects.active=ob;mod=ob.modifiers.new('Explicit shoulder triangles','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=mod.name)
  added.append({'center':[xc,side*.87,.34],'triangles':len(ob.data.polygons),'object':ob.name})
  bpy.ops.object.select_all(action='DESELECT');body.select_set(True);ob.select_set(True);bpy.context.view_layer.objects.active=body;bpy.ops.object.join()
for w in base_recipe['wheels']:
 center=bpy.data.objects[f'Wheel_{w["label"]}_Steer'].location
 w['centerBlender']=list(center);w['centerExport']=[center.x*(80/4.6),center.z*(80/4.6),-center.y*(80/4.6)]
newcount=sum(len(o.data.polygons) for o in scene.objects if o.type=='MESH');assert newcount<=2500
# Preserve the old atlas byte-for-byte; all old UVs and all wheel paint are kept.
shutil.copy2(BASE/'atlas.png',A/'atlas.png');shutil.copy2(A/'atlas.png',O/'atlas.png')
for node in mat.node_tree.nodes:
 if node.type=='TEX_IMAGE':node.image=atlas;atlas.pack()
S=80/4.6;root.scale=(S,)*3;bpy.context.view_layer.update();bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
for o in root.children_recursive:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(O/'model.glb'),export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_materials='EXPORT')
root.scale=(1,1,1);bpy.context.view_layer.update();scene.render.threads_mode='FIXED';scene.render.threads=4
bpy.ops.wm.save_as_mainfile(filepath=str(A/'car.blend'))
for i in range(8):
 root.rotation_euler.z=math.radians(i*45);scene.render.filepath=str(O/f'raw-{i}.png');bpy.ops.render.render(write_still=True)
root.rotation_euler.z=0
base_recipe.update(revision=REV,inputRecipe=cfg,baseRevision=cfg['baseRevision'],refinement='Source geometric defect corrected: replace narrow arch tubes with closed body shoulders over upper tire envelopes',shoulders=added,removedTubeTriangles=removed,actualTriangles=newcount,atlasPolicy='Exact base atlas bytes and old UV paint retained; shoulders own fixed source-palette swatches in that atlas')
(A/'recipe.json').write_text(json.dumps(base_recipe,indent=2)+'\n')
hashes=json.loads((A/'evidence/source-hashes.json').read_text())
for p in (BASE/'car.blend',BASE/'atlas.png'):hashes[str(p.relative_to(ROOT)).replace('\\','/')]=hashlib.sha256(p.read_bytes()).hexdigest()
(A/'evidence/source-hashes.json').write_text(json.dumps(hashes,indent=2)+'\n')
(A/'evidence/fender-correction.json').write_text(json.dumps({'cause':'Tire upper envelope reaches z=.68, while hood/deck behind the open pockets is lower. Narrow rolled arch tubes do not span the tread width; source and low mesh expose far-side tire half-moons.','fix':'Replace tube faces with four closed fender shoulders, joining actual coachwork inboard and spanning over tread with open lower arches. Existing body/UVs/wheel meshes/cameras are retained.','beforeTriangles':before,'removedTubeTriangles':removed,'addedTriangles':sum(a['triangles'] for a in added),'afterTriangles':newcount,'outerRadius':R,'innerRadius':r,'railsY':Y,'sameAtlasBytes':True},indent=2)+'\n')
print('PHYSICAL_FENDERS',REV,newcount,flush=True)
