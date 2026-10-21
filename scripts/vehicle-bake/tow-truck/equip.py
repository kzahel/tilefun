"""Add an original telescoping wheel lift to retained v1; preserve its body/UVs.
Blender --background --python THIS -- [--output repository-relative-directory]
"""
import bpy, sys, json, hashlib, shutil
from pathlib import Path
ROOT=next(p for p in Path(__file__).resolve().parents if (p/'AGENTS.md').is_file())
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
OUT=ROOT/(args[args.index('--output')+1] if '--output' in args else 'art-source/vehicle-bake/tow-truck/v2')
if (OUT/'recipe.json').exists(): raise SystemExit('Retained output is immutable; choose a fresh output.')
OUT.mkdir(parents=True,exist_ok=True)
OLD=ROOT/'art-source/vehicle-bake/tow-truck/v1'
cfg=json.loads((OLD/'family.json').read_text(encoding='utf-8'))
S=cfg['exportWorldScale']
bpy.ops.wm.open_mainfile(filepath=str(OLD/'car.blend'))
bpy.context.preferences.filepaths.save_version=0
body=bpy.data.objects['Body_static'];root=body.parent
assert root and root.type=='EMPTY'
material=body.data.materials[0]
image=next(n.image for n in material.node_tree.nodes if n.type=='TEX_IMAGE')
pixels=list(image.pixels[:]);W,H=image.size[:]
def uv_for(role):
    rgb=cfg['palette'][role]
    for i in range(W*H):
        if all(abs(pixels[i*4+j]*255-rgb[j])<1 for j in range(3)):
            return ((i%W+.5)/W,(i//W+.5)/H)
    raise ValueError('Missing retained palette swatch '+role)
def empty(name,tag):
    o=bpy.data.objects.new(name,None);bpy.context.scene.collection.objects.link(o);o.parent=root;o[tag]=1;return o
boom=empty('Tow_Lift_Boom','tilefun_tow_boom')
cradle=empty('Tow_Lift_Cradle','tilefun_tow_cradle')
boom.location=(44/S,0,10/S)
cradle.location=(80/S,0,10/S)
def box(name,parent,center,size,role):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o=bpy.context.object;o.name=name;o.parent=parent;o.location=center;o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(material)
    uv=uv_for(role)
    for corner in o.data.uv_layers.active.data: corner.uv=uv
    return o
box('Telescoping steel lift',boom,(18/S,0,0),(36/S,6/S,4/S),'rim')
box('Axle cradle crossbar',cradle,(0,0,0),(5/S,48/S,4/S),'silver')
for side in [-1,1]:
    box('Tire cradle '+str(side),cradle,(0,side*17/S,0),(14/S,5/S,4/S),'paintDeep')
    box('Cradle stop '+str(side),cradle,(7/S,side*17/S,3/S),(3/S,5/S,7/S),'amber')
# Join sibling rigid surfaces for two additional draw groups, leaving all four wheels untouched.
for parent,name in [(boom,'Tow_Telescoping_Steel'),(cradle,'Tow_Axle_Cradle')]:
    bpy.ops.object.select_all(action='DESELECT')
    for o in parent.children: o.select_set(True)
    bpy.context.view_layer.objects.active=parent.children[0]
    bpy.ops.object.join();o=bpy.context.object;o.name=name
    mod=o.modifiers.new('Runtime triangles','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=mod.name)
for image in bpy.data.images:
    if image.source=='FILE': image.pack()
root.scale=(S,)*3;bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
for o in root.children_recursive:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'model.glb'),export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_materials='EXPORT')
shutil.copy2(OLD/'atlas.png',OUT/'atlas.png')
root.scale=(1,)*3;bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'car.blend'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
record={'revision':'v2','method':'Retained v1 body, atlas and four wheel rigs plus original two-group telescoping wheel lift','sourceScale':S,'hitchGame':[-80,0,12],'stowedCradleGame':[-51,0,6],'artReviewStatus':'awaiting-owner-inspection','inputs':{p.relative_to(ROOT).as_posix():sha(p) for p in [OLD/'car.blend',OLD/'family.json',OLD/'atlas.png',Path(__file__)]},'outputs':{n:sha(OUT/n) for n in ['model.glb','car.blend','atlas.png']}}
(OUT/'recipe.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps(record,indent=2))
